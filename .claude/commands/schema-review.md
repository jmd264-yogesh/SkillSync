Perform a structured Prisma schema review of: $ARGUMENTS

If no argument is given, review the full schema at `prisma/schema.prisma`.

---

## Review Dimensions

### 1. Naming Consistency
- [ ] Table names: PascalCase singular (`Employee`, `Skill`) — check `@@map()` for snake_case DB names.
- [ ] Field names: camelCase in Prisma, `@map("snake_case")` for DB.
- [ ] Relation fields: named after the related model, not generic (`manager` not `user`).
- [ ] Enum values: UPPER_SNAKE_CASE.

### 2. Required Fields
Every model must have:
- [ ] `id String @id @default(uuid())`
- [ ] `createdAt DateTime @default(now()) @map("created_at")`
- [ ] `updatedAt DateTime @updatedAt @map("updated_at")`
- [ ] `@@map("table_name")` mapping to snake_case table name.

### 3. Relations
- [ ] All relations use explicit `@relation(fields: [...], references: [...])`.
- [ ] Cascade deletes (`onDelete: Cascade`) only where child records should die with parent.
- [ ] No implicit many-to-many (use explicit junction models like `EmployeeSkill`).
- [ ] Self-referential relations have unique `@relation("Name")` strings.

### 4. Constraints & Uniqueness
- [ ] Unique constraints on business keys (e.g., `@@unique([employeeId, skillId])`).
- [ ] `@unique` on natural keys (email, employee code, name where appropriate).
- [ ] Check for missing constraints that would allow duplicate data.

### 5. Indexes
- [ ] Foreign key fields have indexes (`@@index([foreignKeyField])`).
- [ ] Frequently filtered fields (status, role, managerId) have indexes.
- [ ] Composite indexes for common query patterns (e.g., `[employeeId, status]`).
- [ ] No over-indexing on low-cardinality fields.

### 6. Soft Deletes
- [ ] Models that should support soft delete have `deletedAt DateTime? @map("deleted_at")`.
- [ ] If `deletedAt` present, queries must filter `where: { deletedAt: null }`.

### 7. Optional vs Required Fields
- [ ] Required fields (not nullable) are genuinely always present.
- [ ] Optional fields (`?`) are truly optional in business logic.
- [ ] No nullable foreign keys where the relation is always required.

### 8. N+1 Risk Assessment
- [ ] Identify relations that are commonly included together — suggest `@@index` or denormalization.
- [ ] Flag any model with many nested relations that could cause N+1 in service layer.
- [ ] Recommend `include` patterns for common query shapes.

### 9. Migration Safety
- [ ] Identify any changes that would require a destructive migration (dropping columns, changing types).
- [ ] Flag columns that are NOT NULL with no default (risky to add to existing table).
- [ ] Suggest migration strategies for risky changes.

---

## Output Format

For each issue found:
```
MODEL: EmployeeSkill
  [WARN] Missing index on `employeeId` — common FK field, add @@index([employeeId])
  [FAIL] No @@map on table — will create PascalCase table name in DB
  [INFO] Consider adding @@index([employeeId, status]) for approval queue queries
```

## Summary
- Total models reviewed
- FAIL / WARN / INFO counts
- Top 3 highest-priority fixes

## After Review
- Document decisions in `.claude/memory/architecture-decisions.md`.
- Update today's daily log.
