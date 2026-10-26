import { Inject, Injectable, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';
import { RateLimiterRedis, RateLimiterRes } from 'rate-limiter-flexible';
import { REDIS_TOKEN } from '@application/connections/index.js';
import { IpDiscoveryService } from '@application/modules/ip-discovery/index.js';
import {
  LimiterCounter,
  LimiterGrant,
  LimiterRule,
  LimiterWindowSeconds,
} from '../models/limiter.model.js';
import { LimiterPoolCache } from '../caches/limiter-pool.cache.js';
import { LimiterPool } from '../models/limiter-pool.model.js';
import {
  LIMITER_BLOCKED_RETRY_MS,
  LIMITER_DEFAULT_POINTS,
  LIMITER_KEY_PREFIX,
} from '../constants/limiter.constant.js';

type CounterResult = { allowed: boolean; state: RateLimiterRes };

/**
 * Take points from the pool a sender belongs to, one point per message by default.
 * Backed by rate-limiter-flexible on Redis, one fixed window per rule
 *
 * @example
 * const { allowed, retryAfterMs } = await limiterService.acquire(account.limiterPoolId);
 * const { allowed, retryAfterMs } = await limiterService.acquire(account.limiterPoolId, 5);
 *
 * @example Redis key: limiter:pool-id:<pool id>:Second
 * @example Redis key: limiter:pool-id:<pool id>:Second:Ip:<egress ip>
 */
@Injectable()
export class LimiterService {
  private logger = new Logger(LimiterService.name);
  private limiters = new Map<string, RateLimiterRedis>();

  constructor(
    @Inject(REDIS_TOKEN.PRIMARY) private readonly redis: Redis,
    private readonly poolCache: LimiterPoolCache,
    private readonly ipDiscovery: IpDiscoveryService,
  ) {}

  async acquire(poolId: string, points = LIMITER_DEFAULT_POINTS): Promise<LimiterGrant> {
    try {
      const pool = await this.poolCache.getPool(poolId);

      if (!pool?.isEnabled) {
        this.logger.warn('Limiter pool missing or disabled, blocking', { poolId });
        return { allowed: false, retryAfterMs: LIMITER_BLOCKED_RETRY_MS };
      }

      return await this.consumeAll(await this.toCounters(pool), points);
    } catch (error: unknown) {
      this.logger.error('Limiter unavailable, blocking', { poolId }, error);
      return { allowed: false, retryAfterMs: LIMITER_BLOCKED_RETRY_MS };
    }
  }

  private async toCounters(pool: LimiterPool): Promise<LimiterCounter[]> {
    return Promise.all(
      pool.rules.map(async (rule) => ({ key: await this.toKey(pool.id, rule), rule })),
    );
  }

  private async toKey(poolId: string, rule: LimiterRule) {
    const key = `pool-id:${poolId}:${rule.window}`;
    if (rule.strategy === 'Shared') return key;
    return `${key}:Ip:${await this.ipDiscovery.getEgressIp()}`;
  }

  private async consumeAll(counters: LimiterCounter[], points: number): Promise<LimiterGrant> {
    const results = await Promise.all(counters.map((counter) => this.consume(counter, points)));

    const refused = results.filter((res) => !res.allowed);
    if (refused.length > 0) {
      await this.undo(
        counters.filter((_, i) => results[i].allowed),
        points,
      );
      return { allowed: false, retryAfterMs: this.wait(refused) };
    }

    const emptied = results.filter((res) => res.state.remainingPoints === 0);
    return { allowed: true, retryAfterMs: this.wait(emptied) };
  }

  private async consume({ key, rule }: LimiterCounter, points: number): Promise<CounterResult> {
    try {
      return { allowed: true, state: await this.getLimiter(rule).consume(key, points) };
    } catch (error: unknown) {
      if (error instanceof RateLimiterRes) return { allowed: false, state: error };
      throw error;
    }
  }

  private async undo(counters: LimiterCounter[], points: number) {
    await Promise.all(counters.map(({ key, rule }) => this.getLimiter(rule).reward(key, points)));
  }

  private wait(results: CounterResult[]) {
    return Math.max(0, ...results.map((res) => res.state.msBeforeNext));
  }

  private getLimiter(rule: LimiterRule) {
    const id = `${rule.window}:${rule.limit}`;
    let limiter = this.limiters.get(id);

    if (!limiter) {
      limiter = new RateLimiterRedis({
        storeClient: this.redis,
        keyPrefix: LIMITER_KEY_PREFIX,
        points: rule.limit,
        duration: LimiterWindowSeconds[rule.window],
      });
      this.limiters.set(id, limiter);
    }

    return limiter;
  }
}
