Scaffold a complete, production-ready module for: $ARGUMENTS

## Pre-flight

Before writing a single line of code:
1. Read `.claude/memory/module-status.md` to confirm this module is not already built.
2. Read `.claude/context/coding-standards.md` and `.claude/context/security-standards.md`.
3. Run impact analysis: which existing modules does this new module touch? List them.
4. Read the Prisma schema at `prisma/schema.prisma` — confirm or propose the models needed.

## Mandatory 10-Step Scaffolding Workflow

Follow this order exactly. Do not skip steps.

### Step 1 — Routes / Pages
Create all required pages under `src/app/(dashboard)/[role]/[module]/`:
- `page.tsx` — Server Component; fetches data via Prisma directly, passes as props.
- `[module]-client.tsx` — Client Component (`"use client"`); handles interactivity.
- `loading.tsx` — Skeleton loading state using shadcn Skeleton.
- `error.tsx` — Error boundary with user-friendly message.
- `not-found.tsx` if the route can 404.

### Step 2 — Service Layer
Create `src/server/services/[module].service.ts`:
- Pure business logic functions.
- No auth checks here — auth is enforced at the action layer.
- All functions return typed results; never `any`.
- Export named functions only.

### Step 3 — Server Actions
Create `src/server/actions/[module].ts`:
- `"use server"` directive at the top.
- Every action starts with: `const session = await getServerSession(); if (!session) throw new UnauthorizedError();`
- Role check immediately after: verify `session.user.role` against `ROLE_PERMISSIONS`.
- Validate all inputs with the module's Zod schema.
- Call service layer for business logic.
- End with `revalidatePath(...)` as needed.

### Step 4 — Zod Schemas
Create `src/validations/[module].schema.ts`:
- One schema per action (create, update, etc.).
- Export both the schema AND the inferred type.
- Schemas are shared between client forms and server actions.

### Step 5 — TypeScript Types
Add types to `src/types/[module].ts` or extend `src/types/index.ts`:
- Use `interface` for object shapes.
- Use discriminated unions for state modeling.
- Derive DB types from Prisma: `Prisma.ModelGetPayload<{include: {...}}>`.
- No `any`, no `!`, no `as` assertions.

### Step 6 — Tests
Create test files:
- `tests/unit/services/[module].test.ts` — unit tests for all service functions.
- `tests/integration/actions/[module].test.ts` — integration tests against test DB.
- Cover: happy path, unauthorized access, forbidden (wrong role), invalid input, edge cases.

### Step 7 — Register API Endpoints
Update `.claude/memory/api-registry.md`:
- Add any new REST endpoints (if needed).
- Note if the module uses server actions only (no REST routes).

### Step 8 — Update Module Status
Update `.claude/memory/module-status.md`:
- Set status to `In Progress` when starting, `Complete` when done.
- List implemented features and pending work.

### Step 9 — Update Dependencies
Update `.claude/memory/dependencies.md` if this module introduces new packages.

### Step 10 — Update Daily Log
Update `.claude/memory/daily/[YYYY-MM-DD].md`:
- Summary of what was implemented.
- Files created or changed.
- Decisions made.
- Next steps.

## Quality Gates (must pass before declaring complete)
- [ ] TypeScript compiles: `pnpm build` (no type errors)
- [ ] Lint passes: `pnpm lint`
- [ ] Every server action has an auth check
- [ ] Every server action validates input with Zod
- [ ] Managers only see their reportees; employees only see their own data
- [ ] Loading and error states exist for every page
- [ ] Unit tests written for service functions
