# Data Governance — Skill Matrix Platform

## Data Classification

| Class | Definition | Examples | Handling |
|-------|-----------|---------|---------|
| **Personal** | Identifies a specific individual | Name, email, employee code | Role-scoped access, not logged |
| **Organizational** | Confidential business data | Skill gaps, designation plans | RBAC-enforced, manager/admin only |
| **Operational** | System configuration data | COEs, skill definitions, competency levels | Admin-only write, all-roles read |
| **Audit** | Activity and change records | Approval history, review comments | Immutable, admin-viewable |

---

## Access Control by Data Type

### Employee Personal Data
- Employee can access their own data only.
- Manager can access their direct reportees' data only.
- Admin can access all employee data.
- **Rule:** `session.user.employeeId` is the scope for employee self-access. Never trust `employeeId` from user input.

### Skill Assessment Data
- Employee sees only their own assessments.
- Manager sees their team's assessments.
- Admin sees all.
- Rejected assessments: visible to employee and manager. Not visible to other employees.

### Gap Analysis Results
- Visible to the employee (their own gaps).
- Visible to their manager.
- Visible to admins for analytics.

### Approval Comments (ReviewComment)
- Visible to the employee who submitted the skill.
- Visible to the reviewing manager.
- Visible to admins.
- Not visible to other employees.

---

## Data Retention

| Data | Retention | Reason |
|------|-----------|--------|
| Employee skills (approved) | Indefinite | Historical competency record |
| Employee skills (rejected) | 1 year | Audit trail |
| Approval history | 2 years | Compliance |
| Learning path completions | Indefinite | Career history |
| Analytics aggregates | 3 years | Trend analysis |
| Deleted employee records | Soft delete — 90 days before hard delete | Allow re-activation |

Soft delete pattern: `deletedAt DateTime? @map("deleted_at")`. All queries must add `where: { deletedAt: null }`.

---

## PII Handling Rules

1. **Minimum necessary:** Collect only what the system needs. No surplus personal data.
2. **No PII in logs:** Never log employee names, emails, or IDs in server logs.
3. **No PII in error messages:** Sanitize before returning errors to client.
4. **No PII in AI prompts:** Anonymize or pseudonymize if possible when sending to external AI.
5. **Encrypted at rest:** Database-level encryption for the PostgreSQL instance.
6. **Encrypted in transit:** HTTPS only. No HTTP. Enforced via `next.config.ts` headers.

---

## Evidence / File Storage

Evidence files (certifications, documents) may contain PII.
- Store with randomized filenames (not original names).
- Access via signed URLs (not public direct links).
- Delete files when the associated `Evidence` record is deleted.
- Never store files in the repository or `public/` directory.

---

## Audit Trail

The following events must be auditable (logged or stored):
- Skill submission (employee, skill, level, timestamp)
- Skill approval / rejection (manager, decision, comment, timestamp)
- User creation / deactivation (admin, target, timestamp)
- Role change (admin, target, old role, new role, timestamp)

Audit records are **immutable** — never delete or update them.

---

## Data Export & GDPR Consideration

When an employee leaves or requests their data:
- All their personal data must be exportable (skill records, approvals, learning history).
- Deletion request: soft-delete the employee; hard-delete after retention period.
- Anonymized analytics data may be retained indefinitely.

---

## Environment & Secrets

- Production DB URL never in source code.
- All secrets in environment variables with documentation in `.env.example`.
- No test credentials matching production patterns.
- Rotate secrets if any exposure is suspected.

_Last updated: 2026-06-24_
