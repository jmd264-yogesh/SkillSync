# Handover Guide — Skill Matrix Platform

> Run `/release-review` to generate an up-to-date handover summary at any time.

_Last updated: 2026-06-24_

---

## Project Summary

**Name:** Skill Matrix Platform
**Type:** Enterprise internal tool
**Owner:** Sagar Negi (sagar.n@jmangroup.com) — JMan Group
**Purpose:** Employee skill tracking, gap analysis, learning paths, talent discovery, resource management.

---

## Current State (2026-06-24)

- 5 of 14 modules complete (P0 core)
- 8 modules in progress
- 1 module not started (AI Features)
- Zero test coverage (highest-priority tech debt)

For full status: `.claude/memory/module-status.md`

---

## Architecture in One Paragraph

Next.js 16 App Router with TypeScript strict mode. Server Components fetch data directly from PostgreSQL via Prisma 6. All mutations use Server Actions (no REST API for internal use). NextAuth.js v5 handles authentication with JWT sessions. Role-based access control is enforced at middleware → layout → action layers. shadcn/ui + Tailwind CSS 4 for the UI. No dark mode. No client-side data fetching libraries.

For full detail: `.claude/docs/architecture-overview.md`

---

## How to Run Locally

```bash
pnpm install
cp .env.example .env      # fill in DATABASE_URL, AUTH_SECRET, NEXTAUTH_URL
pnpm db:migrate
pnpm db:seed
pnpm dev                  # http://localhost:3000
```

---

## Key Files to Know

| File | Purpose |
|------|---------|
| `CLAUDE.md` | Engineering standards for AI-assisted development |
| `prisma/schema.prisma` | Single source of truth for DB |
| `src/lib/auth.ts` | NextAuth configuration |
| `src/lib/constants.ts` | ROLE_PERMISSIONS, COMPETENCY_LEVELS |
| `src/lib/errors.ts` | Custom error classes |
| `src/middleware.ts` | Route protection |
| `.claude/memory/module-status.md` | Current build status |
| `.claude/memory/tech-debt.md` | Known issues |
| `.claude/memory/architecture-decisions.md` | Why things are the way they are |

---

## Known Issues & Tech Debt

See `.claude/memory/tech-debt.md` for full list. Top 3:
1. **Zero test coverage** — must be addressed before production
2. **No AI infrastructure** — Module 14 not started
3. **No approval notifications** — employees don't know when skills are reviewed

---

## What Needs to Be Done Before Production

1. Write tests for P0 modules (WI-002)
2. Build AI service infrastructure (WI-001)
3. Add approval notifications (WI-004)
4. Complete Module 9 (Designation Transition) (WI-005)
5. Complete Module 10 (Employee Report) (WI-006)
6. Add rate limiting to auth
7. Validate all environment variables at startup
8. Configure monitoring (Sentry, etc.)

---

## Development Process

This project uses Claude Code as an AI engineering partner. Key conventions:

- Always run `/impact-analysis` before implementing anything non-trivial
- Use `/scaffold-module` to build new modules (enforces 10-step workflow)
- Run `/pre-pr-review` before any PR
- Update `.claude/memory/daily/YYYY-MM-DD.md` every session (use `/daily-summary`)
- Never work directly on `main` branch

---

## Contact

- **Product Owner:** Sagar Negi — sagar.n@jmangroup.com
- **Repository:** (internal)
- **DB:** PostgreSQL 16 (connection string in `.env`)
