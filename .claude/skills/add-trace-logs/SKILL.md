---
name: add-trace-logs
description: Adds useful, masked trace logs to a file, folder, or the current branch's changes.
argument-hint: '[file or folder]'
disable-model-invocation: true
---

# Add trace logs

Add log lines that let someone follow one message or request through the code from the logs alone, and nothing beyond that. Every line answers a tracing question ("did provider X accept message Y?", "why was account Z skipped?"). `trace_id` is already added to every line by `traceMixin` in `libs/framework/src/logger`, so log the business ids that link lines together instead.

## Steps

1. **Resolve scope.** Use `$ARGUMENTS` as the file or folder. If it is empty, use the files changed on this branch: `git diff --name-only $(git merge-base HEAD main)` plus `git status --short`. Keep `.ts` files under `apps/` and `libs/`, excluding `*.spec.ts`. Done when you have a file list; if it is empty, say so and stop.
2. **Read the flow.** Read each file and enough of its callers and callees to know where the flow starts, which external calls it makes (provider APIs, Pulsar, Redis, Mongo), where it branches, and where it can fail. Note the log lines already there. Done when every function in scope is either a log point candidate or explicitly not worth logging.
3. **Pick log points** from the [log point guide](#log-point-guide) and set each level by [Levels](#levels). Done when each point has its tracing question, and no point repeats what an existing line already tells.
4. **Classify every field** you plan to log with the [field table](#fields). For each sensitive value with no mask helper, ask the user whether to omit it, log it as is, or add a helper to `masking.utils.ts`. Done when every field has an action.
5. **Propose** a table and wait for the user's OK before editing:

   | #   | Action | File:line                     | Level | Message            | Fields                         | Masking                        |
   | --- | ------ | ----------------------------- | ----- | ------------------ | ------------------------------ | ------------------------------ |
   | 1   | add    | viber-account.worker.ts:42    | info  | Sent viber message | messageId, accountId, provider | none                           |
   | 2   | fix    | pulsar-producer.service.ts:30 | debug | Producing message  | phoneNo                        | maskPhoneNumber; drop OTP code |

   Use `fix` rows for existing lines that leak unmasked data or interpolate values into the message.

6. **Apply** the approved rows. Add `private readonly logger = new Logger(<Class>.name)` (from `@nestjs/common`) where the class has none, and import mask helpers from `@framework/utils`. Done when `pnpm run typecheck` and `pnpm run lint` pass.

## Levels

Choose by what the reader should do when they see the line:

| Level | Call                | Use when                                                                                                                        | Reader action                       |
| ----- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| info  | `this.logger.log`   | A normal step of the flow happened (received, sent, saved)                                                                      | None; it is the trail               |
| warn  | `this.logger.warn`  | The flow left the normal path but handled it (retry, rate limit, fallback, skipped or disabled account, invalid input rejected) | Look if it repeats                  |
| error | `this.logger.error` | The unit of work failed or was lost (exception caught, provider rejected after retries, save failed)                            | Investigate; always include `error` |
| debug | `this.logger.debug` | Detail needed only to debug one case                                                                                            | Read only while debugging           |

Nest's `Logger` has no `.info()`; `this.logger.log` is written as pino `info`.
A failure that is retried is `warn`; only the final failed attempt is `error`.

## Log point guide

| Point                                                                      | Level              | Fields                                               |
| -------------------------------------------------------------------------- | ------------------ | ---------------------------------------------------- |
| Flow entry (consumer receives, job starts, request handled)                | log                | the ids that identify the unit of work               |
| External call result                                                       | log                | ids, provider, outcome (status, provider message id) |
| Branch that changes the outcome (skipped, rate limited, retried, fallback) | warn               | ids, the reason                                      |
| Failure                                                                    | error              | ids, `error`                                         |
| Batch or loop                                                              | log once per batch | count, ids array                                     |
| Detail only useful while debugging one case                                | debug              | sanitized payload fields                             |

## Format

- Object first, constant message: `this.logger.log({ messageId, accountId }, 'Sent viber message')`.
- Messages are short past-tense or "Failed to ..." phrases; every variable goes in the object.
- Make each line actionable and agent friendly where the context allows: from that line alone a reader knows what happened, to which record, and what to do next, and an agent can filter and group it by its fields (reuse the key names existing logs use for the same thing).
- Name the error field `error`: `this.logger.error({ error, messageId }, 'Failed to send viber message')`.
- Pick named fields; pass whole DTOs, entities, or provider responses only when every field in them is safe.

## Fields

| Data                                                                              | Action                   |
| --------------------------------------------------------------------------------- | ------------------------ |
| ids, status, counts, provider or platform name, durations                         | log as is                |
| phone number                                                                      | `maskPhoneNumber(phone)` |
| email                                                                             | `maskEmail(email)`       |
| API key, token, secret, auth header                                               | `maskCredentials(value)` |
| password                                                                          | `maskPassword(value)`    |
| message body, OTP code, URL with tokens, anything else sensitive without a helper | ask the user (step 4)    |
