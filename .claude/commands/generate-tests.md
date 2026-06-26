Generate comprehensive tests for: $ARGUMENTS

## Pre-flight

1. Read the target file(s) in full — understand every function, branch, and error path.
2. Read existing test files in `tests/` to match patterns and conventions.
3. Read the Zod schema for the module to know what inputs are valid vs invalid.
4. Check the RBAC rules in `src/lib/constants.ts` — tests must cover role-based behavior.

## Test Layer 1 — Unit Tests (`tests/unit/`)

File: `tests/unit/services/[module].test.ts`

For each exported service function, write tests covering:
- **Happy path** — valid input, expected output.
- **Invalid input** — bad types, out-of-range values, missing required fields.
- **Null / undefined edge cases** — what happens with missing optional fields.
- **Error paths** — DB errors, not-found scenarios.
- **Authorization logic** (if any logic exists in the service).

Conventions:
- Use `describe('[functionName]', () => { ... })` grouping.
- Mock Prisma via `vi.mock('@/lib/db')`.
- Mock external services (AI, email, file storage) — never real calls in unit tests.
- Use factory functions for test data, not inline object literals.

## Test Layer 2 — Integration Tests (`tests/integration/`)

File: `tests/integration/actions/[module].test.ts`

For each server action, write tests covering:
- **Unauthenticated** — no session → expects `UnauthorizedError` or 401.
- **Wrong role** — EMPLOYEE calling ADMIN action → expects `ForbiddenError` or 403.
- **Valid request as correct role** — full flow against test database.
- **Invalid input** — Zod validation rejection.
- **Scope enforcement** — manager cannot access another manager's team; employee cannot access others' data.

Conventions:
- Use a real test database (not mocked Prisma).
- Wrap each test in a transaction and roll back after.
- Use seed factories to create prerequisite data.
- Test all three roles: ADMIN, MANAGER, EMPLOYEE.

## Test Layer 3 — E2E Tests (`tests/e2e/`)

File: `tests/e2e/[role]/[flow].spec.ts`

For the module's primary user flow, write Playwright tests covering:
- **Successful flow** — complete the happy path from page load to confirmation.
- **Validation errors** — submit invalid form → inline error messages appear.
- **Empty state** — new user with no data → empty state component visible.
- **Role-based UI** — ADMIN sees admin controls; EMPLOYEE does not.

Conventions:
- Use `page.getByRole` and `page.getByTestId` selectors — not CSS selectors.
- Each test must be independent (set up its own data).
- Use Playwright's `test.use({ storageState: ... })` for pre-authenticated sessions.

## Coverage Target
- Service functions: 80% line coverage minimum.
- Server actions: all exported functions have at least one integration test.
- Critical user flows (skill submission, approval, gap view): E2E covered.

## After Generation
- Run `pnpm test` to verify all tests pass.
- Update `.claude/memory/module-status.md` — mark tests as written.
- Update today's daily log.
