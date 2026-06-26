# Deployment Guide — Skill Matrix Platform

> ⚠️ This is a stub. Update before first production deployment.

_Last updated: 2026-06-24_

---

## Prerequisites

- Node.js LTS
- PostgreSQL 16
- Environment variables configured (see below)

---

## Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:password@host:5432/skill_matrix

# Auth
AUTH_SECRET=<32+ char random string>
NEXTAUTH_URL=https://your-domain.com

# AI (when Module 14 is built)
ANTHROPIC_API_KEY=sk-ant-...

# File Storage (when evidence upload is built)
# AWS_REGION=
# AWS_ACCESS_KEY_ID=
# AWS_SECRET_ACCESS_KEY=
# S3_BUCKET_NAME=
```

---

## Build & Deploy

```bash
# Install dependencies
pnpm install --frozen-lockfile

# Generate Prisma client
pnpm db:generate

# Run migrations
pnpm db:migrate

# Seed initial data (first deployment only)
pnpm db:seed

# Build
pnpm build

# Start
pnpm start
```

---

## Database Migrations

Always run migrations before deploying new code.

```bash
# Check pending migrations
npx prisma migrate status

# Apply migrations (production)
npx prisma migrate deploy  # NOT migrate dev
```

**Never** use `prisma migrate dev` or `prisma db push` in production.

---

## Health Checks

- App: `GET /api/health` (to be implemented)
- DB: verify Prisma can connect at startup

---

## Rollback

If a deployment fails:
1. Revert the git commit
2. If DB migration was applied: run `prisma migrate resolve --rolled-back [migration-name]` and restore from backup
3. Redeploy the previous build

---

## Monitoring

> ⚠️ Not yet configured. Add before production.

Recommended:
- Application: Sentry for error tracking
- Performance: Vercel Analytics or Datadog APM
- DB: pg_stat_statements + slow query logging
