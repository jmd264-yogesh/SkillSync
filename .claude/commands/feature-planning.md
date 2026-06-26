Create a complete feature plan for: $ARGUMENTS

## Pre-flight
1. Read `.claude/memory/module-status.md` to understand current implementation state.
2. Read `.claude/memory/work-items.md` to avoid duplicating existing items.
3. Read `prisma/schema.prisma` to understand DB model availability.
4. Read the relevant module's existing pages and server actions.

---

## Feature Plan Output

### 1. Feature Overview
- **Name:** [Feature name]
- **Module:** [Which of the 14 modules]
- **Priority:** P0 / P1 / P2
- **Roles affected:** ADMIN | MANAGER | EMPLOYEE
- **Estimated effort:** S (< 1 day) | M (1–3 days) | L (3–7 days) | XL (> 1 week)

### 2. User Stories
For each affected role, write:
```
As a [ROLE], I want to [ACTION] so that [OUTCOME].
```

### 3. Acceptance Criteria
List specific, testable criteria:
- [ ] Given [context], when [action], then [expected outcome].
- [ ] Given [unauthorized role], when [action], then [403 / redirect].
- [ ] Given [invalid input], when [submitted], then [validation error shown].

### 4. Technical Design

#### DB Changes (if any)
- New models needed in `prisma/schema.prisma`
- New fields or indexes on existing models
- Migration risk (SAFE / RISKY — requires backfill)

#### API / Actions
- New server actions required
- New API routes (if webhooks or external integrations)
- Modified existing actions

#### Service Layer
- New service functions
- Business logic description

#### UI Changes
- New pages or routes
- Modified components
- New form fields or dialogs

#### RBAC Impact
- Which roles can access this feature
- Scope rules (manager-reportee, self-only)

### 5. Dependencies
- Modules this feature depends on
- External services (AI, file storage, email)
- This feature being a blocker for other features

### 6. Risks
- Technical risks (schema migration, performance, RBAC complexity)
- Business risks (data integrity, user impact)
- Mitigation for each risk

### 7. Task Breakdown
Break into discrete implementation tasks (each < 1 day):
```
Task 1: [title] — [what to build] — [estimated hours]
Task 2: ...
```

### 8. Definition of Done
This feature is complete when:
- [ ] All acceptance criteria pass
- [ ] TypeScript compiles (no errors)
- [ ] Lint passes
- [ ] Unit tests written and passing
- [ ] Integration tests written and passing
- [ ] RBAC audit passes for this feature
- [ ] Documentation updated
- [ ] Module status updated

---

## After Planning
- Add work items to `.claude/memory/work-items.md`.
- Update `.claude/memory/module-status.md` with planned work.
- Update today's daily log with the planning output.
