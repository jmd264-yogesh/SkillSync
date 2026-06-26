Synchronize all project documentation to reflect current codebase state.

Documentation sync is triggered by: $ARGUMENTS

If no argument given, sync all documentation. If a specific area is given (e.g., "api", "database", "modules"), sync only that area.

---

## Sync Areas

### 1. API Documentation (`.claude/docs/api-documentation.md`)
- Read all files in `src/app/api/` to enumerate REST routes.
- Read all files in `src/server/actions/` to enumerate server actions.
- Update the API documentation with:
  - Route path, method, auth requirement, role requirement, input schema, output shape.
  - Mark deprecated or planned-but-not-implemented routes.

### 2. Database Design (`.claude/docs/database-design.md`)
- Read `prisma/schema.prisma` in full.
- Update the database documentation with:
  - All models, fields, types, constraints.
  - ER diagram description (text-based).
  - Index list.
  - Enum definitions.

### 3. Module Documentation (`.claude/docs/module-documentation.md`)
- Read `.claude/memory/module-status.md`.
- For each module, verify the documentation matches the current implementation.
- Update status, feature list, and remaining work.

### 4. Architecture Overview (`.claude/docs/architecture-overview.md`)
- Review `src/` directory structure.
- Confirm the architecture description matches actual implementation.
- Update data flow diagrams (text-based ASCII).
- Update service dependency map.

### 5. CLAUDE.md
- Verify all patterns described in CLAUDE.md still match the codebase.
- Update if new patterns were introduced.
- Flag any instructions that are outdated.

---

## Sync Rules
- Never remove documentation without confirming it's obsolete.
- Mark sections with `> ⚠️ Needs verification` rather than deleting uncertain content.
- Always include a `Last synced: [YYYY-MM-DD]` footer in each doc.

## Output
Report what was updated, what was already current, and what needs manual attention.
Update today's daily log with the sync results.
