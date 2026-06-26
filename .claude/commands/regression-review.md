Perform a regression analysis for the current branch changes before merge.

## Pre-flight
Run: `git diff main...HEAD --name-only` to get the list of changed files.
Run: `git log main...HEAD --oneline` to get commit history.

---

## Step 1 — Change Surface Analysis

List every changed file and categorize:
- **Schema changes** (`prisma/schema.prisma`) — highest risk
- **Server actions** (`src/server/actions/`) — auth/RBAC regression risk
- **Service layer** (`src/server/services/`) — business logic regression risk
- **Pages/components** — UI regression risk
- **Types/schemas** — TypeScript contract changes
- **Config files** — environment/build regression risk

---

## Step 2 — Downstream Impact

For each changed file, identify what calls it:
- Use Grep to find all imports of changed modules.
- List pages/components that render changed server actions.
- List tests that cover changed code.

---

## Step 3 — Breaking Change Detection

Check for:
- [ ] Changed function signatures (added required params, removed params, changed return type).
- [ ] Changed Zod schema (stricter validation could reject previously valid data).
- [ ] Changed Prisma query shape (changed `include` could break consumers expecting certain fields).
- [ ] Renamed exports (any component/function renamed without updating all imports).
- [ ] Changed environment variables (new required env vars without documented defaults).
- [ ] Changed route paths (would break navigation or bookmarks).

---

## Step 4 — RBAC Regression

For each changed action or page:
- [ ] Auth check still present?
- [ ] Role check still correct?
- [ ] Data scope still enforced (manager-reportee, employee self-only)?

---

## Step 5 — DB Regression (if schema changed)

- [ ] All existing queries still compatible with schema changes?
- [ ] Migration is reversible?
- [ ] No data loss on applying migration to existing data?
- [ ] Seed data still valid?

---

## Step 6 — Test Coverage Gap

- [ ] Are all changed service functions covered by unit tests?
- [ ] Are all changed server actions covered by integration tests?
- [ ] Are changed user flows covered by E2E tests?
- List any gaps as required tests before merge.

---

## Output

### Regression Risk Report
```
OVERALL RISK: LOW | MEDIUM | HIGH | CRITICAL

BREAKING CHANGES:
  - [description or "None"]

RBAC REGRESSIONS:
  - [description or "None"]

UNCOVERED CHANGES (no tests):
  - [file:function or "None"]

REQUIRED BEFORE MERGE:
  [ ] ...
  [ ] ...
```

After analysis, update today's daily log.
