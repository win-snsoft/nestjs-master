import { PULSAR_CONN_TOKEN } from '@application/connections/index.js';
import { Inject, Injectable, OnModuleInit, OnApplicationShutdown, Logger } from '@nestjs/common';
import { Client, Consumer, ConsumerConfig } from 'pulsar-client';
import PQueue from 'p-queue';
import {
  ViberLogCreatedQueueSchema,
  ViberLogService,
  ViberLogTopic,
  type ViberLogCreatedQueue,
} from '@application/modules/viber/index.js';
import { TraceJob } from '@framework/trace/index.js';
import { trace } from '@opentelemetry/api';

const tracer = trace.getTracer('viber-log-consumer');

@Injectable()
export class ViberLogConsumerService implements OnModuleInit, OnApplicationShutdown {
  private logger = new Logger(ViberLogConsumerService.name);
  private isConsuming: boolean = false;
  private queue = new PQueue({ concurrency: 1 });
  private consumer: Consumer;

  constructor(
    @Inject(PULSAR_CONN_TOKEN.PRIMARY) private readonly pulsarClient: Client,
    private readonly logService: ViberLogService,
  ) {}

  async onModuleInit() {
    await this.subscribe();
    void this.start();
  }

  async onApplicationShutdown(signal?: string) {
    this.logger.log({ receivedAt: new Date(), signal }, 'Received shutdown signal at ');
    this.pause();
    // Wait for tasks to finish running
    await this.queue.onIdle();

    await this.unsubscribe();
    this.logger.log({ finishedAt: new Date() }, 'Finished processing');
  }

  private async unsubscribe() {
    await this.consumer.close();
  }
  private async start() {
    this.isConsuming = true;
    while (true) {
      if (!this.isConsuming) return;

      let logs: ViberLogCreatedQueue[];
      try {
        logs = await this.consumeBatch();
      } catch (error: unknown) {
        // Closing the consumer during shutdown rejects the pending batchReceive (AlreadyClosed)
        if (!this.isConsuming) {
          this.logger.log(
            { stoppedAt: new Date() },
            'Consumer closed, stopped consuming viber logs',
          );
          return;
        }
        throw error;
      }
      if (logs.length > 0) this.queue.add(() => this.saveBatch(logs)).catch(() => undefined);
      await this.queue.onSizeLessThan(this.queue.concurrency);
    }
  }

  @TraceJob({ name: 'save-viber-log-batch', tracer })
  private async saveBatch(logs: ViberLogCreatedQueue[]) {
    const ids = logs.map((log) => log.id);
    try {
      const { savedIds, failedIds } = await this.logService.batchSave(logs);
      this.logger.log({ savedIds }, 'Saved viber log batch');
      if (failedIds.length > 0) this.logger.error({ failedIds }, 'Failed to save some viber logs');
    } catch (error: unknown) {
      this.logger.error({ error, ids }, 'Failed to save viber log batch');
      throw error;
    }
  }

  private pause() {
    this.isConsuming = false;
  }

  private async subscribe() {
    const config: ConsumerConfig = {
      topic: ViberLogTopic.LogCreated,
      subscription: 'viber-log-consumer',
      subscriptionType: 'Shared',
      batchReceivePolicy: {
        maxNumMessages: 100,
        maxNumBytes: 8_000_000, //8 mb
        timeoutMs: 1500,
      },
      batchIndexAckEnabled: true,
    };

    this.consumer = await this.pulsarClient.subscribe(config);
    this.logger.log(config, 'Connected to consumer');
  }

  private async consumeBatch(): Promise<ViberLogCreatedQueue[]> {
    const logs: ViberLogCreatedQueue[] = [];
    const messages = await this.consumer.batchReceive();
    for (const message of messages) {
      try {
        const log = ViberLogCreatedQueueSchema.parse(JSON.parse(message.getData().toString()));
        logs.push(log);
      } catch (error: unknown) {
        this.logger.error(
          { error, data: message.getData().toString() },
          'Failed to parse viber log',
        );
      }
      await this.consumer.acknowledge(message);
    }
    return logs;
  }
}
