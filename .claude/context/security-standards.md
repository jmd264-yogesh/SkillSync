# Security Standards — Skill Matrix Platform

## Authentication

### Provider: NextAuth.js v5 (Auth.js)
- Sessions via JWT stored in HTTP-only, Secure, SameSite=Strict cookies.
- Session configuration in `src/lib/auth.ts`.
- Session shape includes: `user.id`, `user.role`, `user.employeeId`.

### Password Hashing
- bcrypt with cost factor ≥ 12 (currently: `bcryptjs`).
- Never store, log, or return plaintext passwords.
- Passwords never included in any API response.

### Session Checks
Every server action and protected API route must begin with:
```typescript
const session = await getServerSession();
if (!session) throw new UnauthorizedError();
```

---

## Authorization (RBAC)

### Roles and Permissions
```typescript
const ROLE_PERMISSIONS = {
  ADMIN: ["manage:coe", "manage:skills", "manage:employees", "view:analytics", "manage:resources"],
  MANAGER: ["approve:skills", "view:team", "view:team-reports", "endorse:transition"],
  EMPLOYEE: ["submit:skills", "view:own-skills", "view:own-gaps", "view:own-report"],
} as const;
```

### Scope Enforcement (mandatory)

**Employee actions:** `employeeId` is ALWAYS `session.user.employeeId`.
```typescript
// CORRECT
const employeeId = session.user.employeeId; // from session — trusted

// WRONG — IDOR vulnerability
const employeeId = data.employeeId; // from request body — never trust
```

**Manager actions:** validate that the target employee is in the manager's reportee list.
```typescript
const reportees = await db.employee.findMany({
  where: { managerId: session.user.employeeId },
  select: { id: true },
});
const reporteeIds = new Set(reportees.map(r => r.id));
if (!reporteeIds.has(data.employeeId)) throw new ForbiddenError();
```

**Admin actions:** no scope restriction, but still require role check.

### Enforcement Points
| Layer | Responsibility |
|-------|----------------|
| `src/middleware.ts` | Route-level: unauthenticated → /login |
| Role layouts | Role-level: wrong role → redirect |
| Server actions | Action-level: full auth + role + scope |
| Services | Data-level: never bypass scope at service layer |

---

## Input Validation

All inputs validated at the API/action boundary via Zod.

```typescript
// Validate before any DB operation
const validated = skillSubmissionSchema.parse(data);
// If parse() throws, ZodError is caught and returned as 400
```

Rules:
- String lengths bounded (prevent large payload attacks).
- UUIDs validated as UUID format before DB lookup.
- Enum values validated against the allowed set.
- Numeric values have min/max bounds.
- No raw user strings passed to `$queryRaw`.

---

## SQL Injection

Prisma ORM parameterizes all queries by default.
- Never use `db.$queryRaw` or `db.$executeRaw` with string interpolation.
- If raw queries are needed, use tagged template literals only:
```typescript
// CORRECT
await db.$queryRaw`SELECT * FROM employees WHERE id = ${id}`;

// WRONG — SQL injection
await db.$queryRaw(Prisma.raw(`SELECT * FROM employees WHERE id = '${id}'`));
```

---

## XSS Prevention

- All user content rendered via React (auto-escaped).
- Never use `dangerouslySetInnerHTML` without sanitization.
- No `eval()` or `new Function()` with user data.
- Content Security Policy headers configured in `next.config.ts`.

---

## Sensitive Data

### Never expose:
- `passwordHash` field — exclude in all queries: `select: { passwordHash: false }`
- Internal error details (stack traces, DB errors) — catch and sanitize before client response
- Other users' PII to employees/managers

### Environment Variables
- All secrets in `.env` (not `.env.local` for production)
- `.env` in `.gitignore`
- API keys (AI, file storage) never in client bundle (server-only)
- Validate required env vars at startup

---

## File Upload Security (when implemented)

- Validate MIME type (not just extension).
- Enforce size limits (max 10MB per file).
- Store with randomized filenames (not user-provided names).
- Store outside the web root or use signed URLs.
- Accepted types: PDF, PNG, JPG, DOCX only.
- No executable types accepted under any circumstances.

---

## AI / Prompt Injection

When AI features are implemented:
- Never interpolate raw user input directly into prompt strings.
- Use structured prompt templates with delimited user content.
- Validate and sanitize AI responses before use in the application.
- Never trust AI output as instructions.
- Rate limit AI calls per user (max N requests/hour).

---

## Error Handling

```typescript
// Server action catch block
} catch (error) {
  if (error instanceof UnauthorizedError) throw error; // let propagate
  if (error instanceof ForbiddenError) throw error;
  if (error instanceof ValidationError) throw error;
  
  // Log full error server-side
  console.error("[action:name]", error);
  
  // Return sanitized message to client
  throw new Error("An unexpected error occurred");
}
```

Never expose:
- Stack traces
- Database error messages
- Internal IDs or system paths

_Last updated: 2026-06-24_
