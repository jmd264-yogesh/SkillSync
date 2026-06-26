Perform a full security review of: $ARGUMENTS

If no argument is given, review the entire codebase.

This review covers OWASP Top 10 + enterprise SaaS-specific concerns.

---

## Review Dimensions

### 1. Authentication (OWASP A07)
- [ ] All protected routes check session via `getServerSession()`.
- [ ] Session tokens are HTTP-only, Secure, SameSite=Strict.
- [ ] No session IDs in URLs or logs.
- [ ] Password hashing uses bcrypt (cost factor ≥ 12).
- [ ] No plaintext passwords anywhere (including logs, errors, responses).

### 2. Authorization / RBAC (OWASP A01)
- [ ] Every server action enforces role check.
- [ ] Employee cannot access other employees' data.
- [ ] Manager cannot access outside their reportee tree.
- [ ] No IDOR vulnerabilities (IDs from user input are validated against session scope).

### 3. Input Validation (OWASP A03)
- [ ] All inputs validated with Zod at API/action boundary.
- [ ] No raw user input passed to Prisma queries.
- [ ] String lengths bounded (prevent megabyte payloads).
- [ ] UUID format validated before DB lookup.
- [ ] Enum values validated against allowed set.

### 4. SQL Injection
- [ ] All DB queries use Prisma ORM (parameterized by design).
- [ ] No `$queryRaw` or `$executeRaw` with string interpolation.
- [ ] If raw queries exist: confirm they use tagged template literals, not string concatenation.

### 5. XSS (OWASP A03)
- [ ] No `dangerouslySetInnerHTML` without sanitization.
- [ ] User-generated content rendered via React (auto-escaped).
- [ ] No `eval()` or `new Function()` with user data.

### 6. CSRF
- [ ] Server Actions are CSRF-safe by Next.js design (same-origin token).
- [ ] Any fetch-based mutations include CSRF token or use SameSite cookies.

### 7. Secrets & Credentials (OWASP A02)
- [ ] No hardcoded API keys, secrets, or passwords in source code.
- [ ] All secrets in environment variables.
- [ ] `.env` is in `.gitignore`.
- [ ] No secrets in error messages returned to client.
- [ ] AI API key not exposed to client bundle.

### 8. Sensitive Data Exposure (OWASP A02)
- [ ] `passwordHash` never included in API responses.
- [ ] Employee personal data (email, etc.) not returned to wrong roles.
- [ ] Error responses do not expose stack traces or DB details to clients.

### 9. File Upload Security
- [ ] File type validated by MIME type (not just extension).
- [ ] File size limits enforced.
- [ ] Files stored outside web root or with randomized names.
- [ ] No executable file types accepted.

### 10. Prompt Injection (AI features)
- [ ] User input passed to AI prompts is sanitized/escaped.
- [ ] Prompt templates use structured inputs, not string concatenation with raw user text.
- [ ] AI responses are validated before use (not trusted as instructions).

### 11. Rate Limiting
- [ ] Auth endpoints (login) have rate limiting.
- [ ] AI endpoints have per-user rate limiting.
- [ ] No endpoints accept unbounded list queries without pagination.

### 12. Dependency Vulnerabilities (OWASP A06)
- [ ] Run `pnpm audit` and report any high/critical CVEs.

---

## Output Format

For each finding:
```
SEVERITY: CRITICAL | HIGH | MEDIUM | LOW | INFO
FILE: src/server/actions/employee-skill.ts:42
ISSUE: Employee ID taken from request body — IDOR risk
FIX: Replace `data.employeeId` with `session.user.employeeId`
```

## Summary
- CRITICAL / HIGH / MEDIUM / LOW counts
- Files requiring immediate remediation
- Overall security posture: SECURE / REVIEW NEEDED / CRITICAL

## After Review
- Log CRITICAL/HIGH findings in `.claude/memory/tech-debt.md`.
- Update today's daily log.
