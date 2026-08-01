# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Skill Matrix Platform — Claude Code Guide

## AI Engineering System

This repository uses Claude Code as a senior engineering partner. Every session must follow this contract:

1. **Analyze before implementing.** For any non-trivial task: read the relevant context docs, run `/impact-analysis`, then plan.
2. **Follow the development flow:** Analyze → Impact → Plan → Implement → Test → Security Review → Code Review → Docs Update → Module Status Update → Pre-PR.
3. **Never work directly on `main`.** Always create a feature branch first.
4. **Update the daily log** (`.claude/memory/daily/YYYY-MM-DD.md`) every session. Use `/daily-summary` at end of session.

---

## Dev Commands

This repo uses **npm** (package-lock.json is the committed lockfile — do not add a pnpm-lock.yaml).

```bash
npm run dev           # Start dev server (http://localhost:3000)
npm run build         # Production build + type check
npm run lint          # ESLint check
npm run lint:fix      # ESLint auto-fix
npm run format        # Prettier format
npm test              # All unit + integration tests (vitest run)
npm run test:watch    # Vitest watch mode
npm run test:coverage # Coverage report
npm run test:e2e      # Playwright E2E tests
npm run db:generate   # Regenerate Prisma client
npm run db:push       # Push schema without a migration (prototyping)
npm run db:migrate    # Run Prisma migrations (dev)
npm run db:seed       # Seed database (runs prisma/seed.ts)
npm run db:studio     # Open Prisma Studio
npm run etl           # Ingest reference files (scripts/etl/ingest.ts) — Resourcing CoLab data
npm run export:excel  # CLI export: out/07_Pipeline_Details_UPDATED.xlsx
```

Run a single test file: `npx vitest run tests/unit/services/foo.test.ts`

**DB provider note:** `prisma/schema.prisma` and `migrations/migration_lock.toml` are currently `sqlite` (`DATABASE_URL="file:./dev.db"` in `.env`), even though `architecture.md` and `codebase-current-state.md` describe PostgreSQL 16 as the target. Treat the schema file as ground truth over the docs until this is reconciled.

---

## Slash Commands

| Command | Purpose |
|---------|---------|
| `/scaffold-module [name]` | 10-step module scaffolding (mandatory for new modules) |
| `/generate-tests [target]` | Unit + integration + E2E tests |
| `/audit-rbac [scope]` | RBAC compliance audit (PASS/WARN/FAIL) |
| `/schema-review` | Prisma schema quality review |
| `/security-review [scope]` | OWASP + enterprise security audit |
| `/performance-review [scope]` | N+1, indexes, caching, payload analysis |
| `/impact-analysis [change]` | Pre-implementation impact report |
| `/feature-planning [feature]` | Work item + technical design |
| `/regression-review` | Pre-merge regression analysis |
| `/pre-pr-review` | Full PR quality gate + PR description |
| `/release-review` | Release readiness report |
| `/work-item [create\|list\|update\|close]` | Work item management |
| `/module-status [update\|init]` | Live module dashboard |
| `/daily-summary` | EOD report + create daily log |
| `/documentation-sync [area]` | Sync docs with codebase |
| `/architecture-sync` | Update architecture docs + add ADRs |

---

## Context Documents

@.claude/context/architecture.md

@.claude/context/coding-standards.md

@.claude/context/ui-guidelines.md

@.claude/context/security-standards.md

@.claude/context/testing-standards.md

@.claude/context/definition-of-done.md

@.claude/context/ai-guidelines.md

@.claude/context/data-governance.md

@.claude/context/codebase-current-state.md

`codebase-current-state.md` reflects what is actually implemented in the code (directory map, real model list, wired-up features, and a "What Is NOT Yet Built" list). Prefer it over `architecture.md`'s module table or `module-status.md` when they disagree — those two track planned/aspirational state.

---

## Project Memory

@.claude/memory/module-status.md

@.claude/memory/api-registry.md

@.claude/memory/architecture-decisions.md

@.claude/memory/tech-debt.md

@.claude/memory/work-items.md
