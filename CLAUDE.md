# Skill Matrix Platform — Claude Code Guide

## AI Engineering System

This repository uses Claude Code as a senior engineering partner. Every session must follow this contract:

1. **Analyze before implementing.** For any non-trivial task: read the relevant context docs, run `/impact-analysis`, then plan.
2. **Follow the development flow:** Analyze → Impact → Plan → Implement → Test → Security Review → Code Review → Docs Update → Module Status Update → Pre-PR.
3. **Never work directly on `main`.** Always create a feature branch first.
4. **Update the daily log** (`.claude/memory/daily/YYYY-MM-DD.md`) every session. Use `/daily-summary` at end of session.

---

## Dev Commands

```bash
pnpm dev            # Start dev server (http://localhost:3000)
pnpm build          # Production build + type check
pnpm lint           # ESLint check
pnpm lint:fix       # ESLint auto-fix
pnpm format         # Prettier format
pnpm test           # All unit + integration tests
pnpm test:e2e       # Playwright E2E tests
pnpm test:coverage  # Coverage report
pnpm db:migrate     # Run Prisma migrations (dev)
pnpm db:generate    # Regenerate Prisma client
pnpm db:seed        # Seed database
pnpm db:studio      # Open Prisma Studio
```

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

---

## Project Memory

@.claude/memory/module-status.md

@.claude/memory/api-registry.md

@.claude/memory/architecture-decisions.md

@.claude/memory/tech-debt.md

@.claude/memory/work-items.md
