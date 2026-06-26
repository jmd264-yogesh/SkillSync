Perform a comprehensive RBAC audit of: $ARGUMENTS

If no argument is given, audit the entire codebase.

## Reference: RBAC Rules for This Project

```
ADMIN:    manage:coe | manage:skills | manage:employees | view:analytics | manage:resources
MANAGER:  approve:skills | view:team | view:team-reports | endorse:transition
EMPLOYEE: submit:skills | view:own-skills | view:own-gaps | view:own-report
```

**Scope rules:**
- Managers may only access data for their direct reportees (`managerId` matches).
- Employees may only access their own data (`employeeId === session.user.employeeId`).
- Admins have no scope restriction.

---

## Audit Checklist

### 1. Dashboard Layout (`src/app/(dashboard)/layout.tsx`)
- [ ] Session existence check before rendering.
- [ ] Redirect to `/login` if unauthenticated.

### 2. Role-Specific Layouts (`admin/layout.tsx`, `manager/layout.tsx`, `employee/layout.tsx`)
- [ ] Role verified; redirect to appropriate dashboard if wrong role.

### 3. Every Page (`src/app/(dashboard)/**/*.tsx`)
For each page, verify:
- [ ] Auth check (session exists).
- [ ] Role matches the page's intended audience.
- [ ] Data fetched is scoped to the user (no full-table exposure to employees/managers).

### 4. Every Server Action (`src/server/actions/**/*.ts`)
For each exported function, verify:
- [ ] `getServerSession()` called as first statement.
- [ ] `if (!session) throw new UnauthorizedError()` present.
- [ ] Role verified against `ROLE_PERMISSIONS` constant.
- [ ] Employee actions: `employeeId` is always `session.user.employeeId`, never from user input.
- [ ] Manager actions: any `employeeId` parameter is validated as one of `session.user.reporteeIds`.

### 5. API Routes (`src/app/api/**/*.ts`)
For each route handler:
- [ ] Auth middleware active, OR inline session check present.
- [ ] Role-based filtering on response data.
- [ ] No admin-only data returned to employee/manager roles.

### 6. Services (`src/server/services/**/*.ts`)
- [ ] Services do NOT enforce auth (that is the action layer's job).
- [ ] No accidental full-table queries that bypass scope at the action layer.

---

## Output Format

For each file audited, output findings in this format:

```
FILE: src/server/actions/example.ts
  [PASS] getUsers() — session check present, role verified (ADMIN only)
  [WARN] getTeamStats() — role check present but no manager-reportee scope validation
  [FAIL] deleteUser() — no session check found
    FIX: Add `const session = await getServerSession(); if (!session) throw new UnauthorizedError();` at line 1
```

## Summary Section
At the end, output:
- Total PASS / WARN / FAIL counts
- Files with FAIL (must fix before merge)
- Files with WARN (fix before production)
- Overall RBAC health: SECURE / NEEDS ATTENTION / CRITICAL

## After Audit
- Document findings in `.claude/memory/tech-debt.md` if WARNs or FAILs found.
- Update today's daily log with the audit result.
