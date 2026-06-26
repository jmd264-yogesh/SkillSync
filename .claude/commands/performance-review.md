Perform a performance review of: $ARGUMENTS

If no argument is given, review the full codebase for performance issues.

---

## Review Dimensions

### 1. N+1 Query Detection (Prisma)
Read every service file and server action. For each Prisma query:
- [ ] Is a list fetched and then each item queried again in a loop? → N+1
- [ ] Are nested relations fetched without `include`? → N+1
- [ ] Is `findUnique` called inside a `forEach` or `.map()`? → N+1

Pattern to watch for:
```typescript
// BAD — N+1
const employees = await db.employee.findMany();
for (const emp of employees) {
  const skills = await db.employeeSkill.findMany({ where: { employeeId: emp.id } }); // N+1
}

// GOOD
const employees = await db.employee.findMany({ include: { employeeSkills: true } });
```

### 2. Missing Indexes
Cross-reference `prisma/schema.prisma` with common query patterns in services:
- [ ] Foreign key columns without `@@index`.
- [ ] Filter columns (status, role, coeId, designationId) without index.
- [ ] Composite filters without composite index.

### 3. Expensive DB Operations
- [ ] `findMany()` without `take` limit — unbounded queries.
- [ ] `count()` on large tables without an index on the WHERE clause.
- [ ] `SELECT *` equivalent (Prisma `findMany` with all relations included when only one is needed).
- [ ] Aggregations on unindexed columns.

### 4. Large Payloads
- [ ] Server Components passing large serialized objects to Client Components as props.
- [ ] API responses returning entire rows when only a subset of fields is needed — use `select`.
- [ ] Recharts receiving full datasets without server-side aggregation.

### 5. Unnecessary Re-renders
- [ ] Client Components with no state or event handlers — should be Server Components.
- [ ] `useEffect` triggering fetch on every render without proper dependency array.
- [ ] `useState` holding derived state that could be computed from props.
- [ ] Missing `useMemo` / `useCallback` in expensive list renders.

### 6. Redundant API Calls
- [ ] Server action called in `useEffect` on mount — should be Server Component data fetch.
- [ ] Same data fetched in parent and child independently.
- [ ] No `revalidatePath` after mutations causing stale data + extra refetch.

### 7. Caching Opportunities
- [ ] Static reference data (COEs, designations, competency levels) not cached.
- [ ] `unstable_cache` not used for expensive aggregations.
- [ ] No `revalidateTag` strategy for cache invalidation.

### 8. AI Call Efficiency
- [ ] AI calls made synchronously blocking page render.
- [ ] No caching of identical AI prompts.
- [ ] Prompt sends full dataset when a summary would suffice.
- [ ] No streaming for long AI responses.

---

## Output Format

For each issue:
```
SEVERITY: HIGH | MEDIUM | LOW
TYPE: N+1 | Missing Index | Unbounded Query | Large Payload | Re-render | Caching
FILE: src/server/services/gap-analysis.service.ts:67
ISSUE: `findMany` on EmployeeSkill inside a loop over employees — N+1 query
FIX: Move query outside loop; use `where: { employeeId: { in: employeeIds } }` + group in memory
ESTIMATED IMPACT: ~50ms → ~5ms per request at 100 employees
```

## Summary
- Total issues: HIGH / MEDIUM / LOW
- Top 3 highest-impact fixes
- Estimated DB query count for key pages (before → after estimate)

## After Review
- Log HIGH items in `.claude/memory/tech-debt.md`.
- Update today's daily log.
