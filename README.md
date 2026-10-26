# Messaging Gateway

A high-throughput, multi-channel messaging gateway for dispatching transactional and promotional messages.

This project supersedes the legacy **SMS Gateway**. That system started as an SMS sender and grew to cover email,
WhatsApp and other channels, but its plain JavaScript codebase and outdated framework made new features and
architectural changes hard to ship. This repository is a ground-up rewrite that addresses those limits.

## Channels

- Viber (developing)
- SMS (planning)
- Email (planning)
- Whatsapp (planning)
- App Push (comming soon)

## Why this project exists

The legacy system had no enforced structure or rules, so every feature was built in a different way. Over time that produced inconsistent code, AI-generated slop, and unsafe handling of data and business logic, which led to production bugs and failures.

This project counters that with:

- **Strict structure:** a fixed project and module layout with lint-enforced import boundaries.
- **Safe TypeScript:** strict null checks, validated inputs (zod) and type-safe contracts between layers.
- **SOLID design:** small, single-purpose modules, ports and adapters for providers, and dependencies that point
  one way.

Read [docs/project-structure.md](docs/project-structure.md) before adding code. It defines where code goes, what
it may import, and how modules are named.

### Focus: CRISP

- **Clear:** code and structure that read the same everywhere.
- **Robust:** safe data handling and predictable failure modes.
- **Idiomatic:** NestJS and TypeScript used the way they are meant to be used.
- **Simple:** no abstraction without a reason.
- **Performant:** built for high message throughput.

## Tech stack

NestJS 12 (Express), TypeScript 6, Node.js 24, MongoDB (Mongoose), Redis (Ioredis), Apache Pulsar, OpenTelemetry,pnpm

## Applications

List of independently deployable application that serves different purposes

- apps/backoffice-api: Internal admin API for managing admins, provider accounts, routing, rate limits and message logs.
- apps/messaging-api: Public API that clients call to send OTP, notification and marketing messages on each channel.
- apps/log-consumer: Consumes message log events from Pulsar and saves them to the database in batches.
- apps/dlr-receiver: (coming soon)
- apps/viber-consumer-promotexter: (coming soon)
- apps/viber-consumer-promotexter-apix: (coming soon)
- apps/sms-consumer-promtexter-apix: (coming soon)
- apps/sms-consumer-promtexter: (coming soon)
- apps/sms-consumer-pldt: (coming soon)
- apps/sms-consumer-airudder: (coming soon)
- apps/sms-consumer-aliyun: (coming soon)
- apps/sms-consumer-dito: (coming soon)
- apps/sms-consumer-m360: (coming soon)
- apps/sms-consumer-mocean: (coming soon)
- apps/sms-consumer-laafic: (coming soon)
- apps/sms-consumer-oaktel: (coming soon)
- apps/email-consumer-aliyun: (coming soon)
- apps/email-consumer-aws: (coming soon)
- apps/whatsapp-consumer-infobip: (coming soon)

## Development

### Env

Each app may read its environment from env files at the repository root:

- A shared `.env`
- A `.env.<app-name>` file at the repository root.

```bash
pnpm install
pnpm run infra:up               # Mongo, Redis, Pulsar, ClickHouse, Jaeger via Docker
pnpm run dev:<app-name>         # Eg: pnpm run dev:messaging-api, pnpm run dev:backoffice-api
```

### Build

```bash
pnpm install
pnpm run build:<app-name>       # Eg: pnpm run build:messaging-api
pnpm run start:<app-name>       # Eg: pnpm run start:messaging-api
```

## Quality checks

```bash
pnpm run lint        # oxlint (type-aware)
pnpm run format      # Prettier
pnpm run typecheck   # TypeScript across the workspace
pnpm test            # Jest
```
