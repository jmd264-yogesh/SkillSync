# Definition of Done — Skill Matrix Platform

A feature or module is DONE only when ALL of the following are true.

---

## Code Quality
- [ ] TypeScript compiles with zero errors: `pnpm build`
- [ ] Lint passes with zero errors: `pnpm lint`
- [ ] No `any` types introduced
- [ ] No `@ts-ignore` or `@ts-expect-error` used
- [ ] No non-null assertions (`!`) introduced
- [ ] No default exports introduced
- [ ] Code follows naming conventions in `coding-standards.md`

## Security
- [ ] Every server action has a session check at line 1
- [ ] Every server action has a role check
- [ ] Employee actions use `session.user.employeeId` (never from request body)
- [ ] Manager actions validate that the target employee is their reportee
- [ ] All inputs validated with Zod
- [ ] No sensitive data (passwordHash, stack traces) returned to client
- [ ] No hardcoded secrets

## Testing
- [ ] Unit tests written for all new service functions
- [ ] Integration tests written for all new server actions (covering: unauthorized, forbidden, invalid input, happy path)
- [ ] Test coverage for this module ≥ 80%
- [ ] E2E test exists for the primary user flow (if user-facing)

## UI (for user-facing features)
- [ ] Loading state implemented (Skeleton components)
- [ ] Error state implemented (error.tsx or inline error handling)
- [ ] Empty state implemented (EmptyState component)
- [ ] Form has inline validation errors
- [ ] Actions show success/error toast notifications
- [ ] Responsive layout (tested at mobile and desktop)
- [ ] No inline styles; Tailwind only
- [ ] No dark mode violations
- [ ] Follows UI guidelines in `ui-guidelines.md`

## Database (if schema changed)
- [ ] Migration is named descriptively: `prisma migrate dev --name description`
- [ ] Migration is reversible (or rollback plan documented)
- [ ] New indexes added for frequently queried fields
- [ ] No N+1 query patterns introduced

## Documentation
- [ ] `.claude/memory/module-status.md` updated with new status and completion %
- [ ] `.claude/memory/api-registry.md` updated if new routes were added
- [ ] `.claude/memory/daily/[YYYY-MM-DD].md` updated with work done
- [ ] `.claude/docs/` updated if architecture, API, or DB changed
- [ ] If new patterns were introduced: `CLAUDE.md` or context docs updated

## Architecture
- [ ] New code follows the layered architecture (Client → Action → Service → Prisma)
- [ ] No direct Prisma calls in Client Components
- [ ] No business logic in Server Components (query + render only)
- [ ] No auth logic in Services (auth is the Action layer's job)

## Git Workflow
- [ ] Feature branch created (never worked directly on main)
- [ ] Impact analysis was done before implementation
- [ ] Commits are descriptive and atomic
- [ ] Pre-PR review completed (`/pre-pr-review`)

---

## Shorthand by Tier

**P0 (Critical):** All items above.
**P1 (Important):** All items except E2E tests (integration tests suffice).
**P2 (Nice to have):** Code quality + security + basic tests.

_Last updated: 2026-06-24_
