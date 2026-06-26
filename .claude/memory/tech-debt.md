# Tech Debt — Skill Matrix Platform

_Last updated: 2026-06-24_

Priority: CRITICAL > HIGH > MEDIUM > LOW

---

## CRITICAL

_(None currently — no security vulnerabilities or data integrity risks known)_

---

## HIGH

### TD-001: Zero Test Coverage
**Module:** All | **Discovered:** 2026-06-24
`tests/` directory structure exists but no test files have been written. Zero coverage on all service functions, server actions, and user flows.
**Fix:** Run `/generate-tests` for each module. Start with P0 modules: auth, skills, approvals.
**Effort:** L (3–7 days)

### TD-002: AI Infrastructure Not Built
**Module:** 14 — AI Features | **Discovered:** 2026-06-24
`src/lib/ai.ts`, `src/server/services/ai.service.ts`, and all AI prompt templates are missing. No AI features work.
**Fix:** Build AI service infrastructure as a standalone task before adding AI to individual modules.
**Effort:** M (1–3 days)

### TD-003: Approval Notifications Missing
**Module:** 6 — Manager Approval Workflow | **Discovered:** 2026-06-24
Employees have no way to know their skill was approved or rejected (no email, no in-app notification).
**Fix:** Add email notification via Resend/Nodemailer on approval/rejection. Add notification badge in sidebar.
**Effort:** M (1–3 days)

---

## MEDIUM

### TD-004: Register Page Missing
**Module:** 1 — Auth | **Discovered:** 2026-06-24
Only login exists under `(auth)/`. Users cannot self-register. New employees must be created by an admin.
**Note:** May be intentional (enterprise SSO or admin-controlled onboarding). Clarify with product owner.
**Effort:** S (< 1 day) if self-registration is needed

### TD-005: No Bulk Operations in Approvals
**Module:** 6 — Manager Approval Workflow | **Discovered:** 2026-06-24
Managers must approve skills one by one. No bulk approve/reject.
**Fix:** Add bulk selection + bulk action to the approvals table.
**Effort:** S (< 1 day)

### TD-006: Team Learning Page Not Implemented
**Module:** Manager section | **Discovered:** 2026-06-24
`manager/team-learning/` is in the planned structure but not implemented.
**Effort:** M (1–3 days)

### TD-007: Employee Report is Incomplete
**Module:** 10 — Employee Skill Report | **Discovered:** 2026-06-24
`employee/my-report/` page exists but shows only a basic skill summary. Missing: structured sections, AI narrative, PDF export.
**Effort:** M–L (2–5 days)

### TD-008: No Pagination on Tables
**Module:** Multiple | **Discovered:** 2026-06-24
Large datasets (many employees, many skills) will degrade performance. Tables need server-side pagination.
**Fix:** Add `take`/`skip` to all Prisma queries behind tables. Add pagination controls to DataTable component.
**Effort:** M (1–3 days)

### TD-009: Missing `next-themes` Cleanup
**Module:** Config | **Discovered:** 2026-06-24
`next-themes` is installed but unused (no dark mode). Package should be removed or at minimum not configured.
**Fix:** Remove `next-themes` from dependencies; remove any `ThemeProvider` wrapper if it exists.
**Effort:** S (< 1 hour)

---

## LOW

### TD-010: No Environment Variable Validation at Startup
**Module:** Infrastructure | **Discovered:** 2026-06-24
Missing env vars will cause cryptic runtime errors rather than a clear startup failure.
**Fix:** Add `src/lib/env.ts` using Zod to validate required env vars at startup (DATABASE_URL, AUTH_SECRET, NEXTAUTH_URL, ANTHROPIC_API_KEY when AI is added).
**Effort:** S (< 1 day)

### TD-011: No Rate Limiting on Auth Endpoints
**Module:** 1 — Auth | **Discovered:** 2026-06-24
The login endpoint is not rate-limited. Vulnerable to brute-force attacks.
**Fix:** Add rate limiting to `/api/auth/[...nextauth]` login handler (e.g., max 5 attempts/minute per IP).
**Effort:** S (< 1 day)

### TD-012: framer-motion Bundle Size
**Module:** UI | **Discovered:** 2026-06-24
`framer-motion` adds ~100KB to the client bundle. It's installed but usage should be minimal/lazy-loaded.
**Fix:** Audit usage; ensure it's only loaded in client components that actually animate.
**Effort:** S (< 1 day)

---

## Resolved

_(None yet — tracking will start as items are fixed)_
