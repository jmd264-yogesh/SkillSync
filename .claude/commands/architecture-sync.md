Synchronize architecture documentation with current system state.

Triggered by: $ARGUMENTS

This command must be run whenever:
- A new module is added or completed
- A new service dependency is introduced
- DB schema changes significantly
- New API routes are added
- RBAC rules change

---

## Step 1 — Inventory Current State

Read and analyze:
- `src/` directory structure (Glob)
- `prisma/schema.prisma` (full read)
- `src/server/services/` (all service files)
- `src/server/actions/` (all action files)
- `src/app/api/` (all API routes)
- `src/lib/auth.ts` (auth config)
- `src/middleware.ts` (middleware config)

---

## Step 2 — Update Architecture Overview (`.claude/docs/architecture-overview.md`)

Update sections:
1. **System architecture** — layers (Client → Server Component → Server Action → Service → Prisma → DB)
2. **Module map** — which modules exist and their completion status
3. **Service dependency graph** — which services call which other services
4. **Data flow diagrams** — how data moves for key operations (skill submission, approval, gap analysis)
5. **Authentication flow** — NextAuth → middleware → session → action
6. **RBAC enforcement points** — where role checks happen in the stack

---

## Step 3 — Update System Overview (`.claude/docs/system-overview.md`)

Update:
- Feature list (based on module status)
- Technical stack versions (check package.json)
- Environment requirements
- Key architectural decisions summary

---

## Step 4 — Update Architecture Decisions (`.claude/memory/architecture-decisions.md`)

For any architectural change that was made:
- Add a new ADR (Architecture Decision Record) entry.
- Format:
  ```
  ## ADR-[N]: [Title]
  Date: YYYY-MM-DD
  Status: Accepted | Superseded | Deprecated
  
  **Context:** Why this decision was needed.
  **Decision:** What was decided.
  **Consequences:** Trade-offs and implications.
  ```

---

## Output
Report:
- What changed since the last sync
- What was updated
- What requires manual review
- New ADRs added (if any)

Update today's daily log.
