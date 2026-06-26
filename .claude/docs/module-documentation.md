# Module Documentation — Skill Matrix Platform

> Run `/documentation-sync modules` to update from `.claude/memory/module-status.md`.

_Last synced: 2026-06-24_

For detailed module status (completion %, blockers, pending work), see `.claude/memory/module-status.md`.

---

## Module 1: Auth & User Management
**Status:** Complete

Handles user authentication and user account management.

**Key files:**
- `src/app/(auth)/login/` — login page
- `src/middleware.ts` — route protection
- `src/lib/auth.ts` — NextAuth configuration
- `src/server/actions/user.ts` — user CRUD (admin)
- `src/app/(dashboard)/admin/users/` — user management UI

---

## Module 2: Admin Configuration
**Status:** Complete

Manages foundational data: Centers of Excellence, designations, and competency levels.

**Key files:**
- `src/app/(dashboard)/admin/coe/` — COE management
- `src/app/(dashboard)/admin/designations/` — designation management
- `src/app/(dashboard)/admin/competency-levels/` — competency level management
- `src/server/actions/coe.ts`, `designation.ts`, `competency-level.ts`

---

## Module 3: Skill Management
**Status:** Complete

Admin management of the skill catalog across 5 categories.

**Key files:**
- `src/app/(dashboard)/admin/skills/`
- `src/server/actions/skill.ts`
- `src/components/forms/skill-form-dialog.tsx`

---

## Module 4: Skill Mapping
**Status:** Complete

Maps skills (with target competency levels) to COEs and designations.

**Key files:**
- `src/app/(dashboard)/admin/skill-mapping/`
- `src/app/(dashboard)/admin/employee-mapping/`
- `src/server/actions/skill-mapping.ts`

---

## Module 5: Employee Skill Submission
**Status:** Complete

Employees self-assess their skills and attach evidence for manager review.

**Key files:**
- `src/app/(dashboard)/employee/my-skills/`
- `src/server/actions/my-skills.ts`, `employee-skill.ts`

---

## Module 6: Manager Approval Workflow
**Status:** In Progress (95%)

Managers review, approve, or reject employee skill submissions.

**Key files:**
- `src/app/(dashboard)/manager/approvals/`
- `src/server/actions/approval.ts`

**Pending:** Bulk operations, notifications.

---

## Module 7: Skill Gap Assessment
**Status:** In Progress (70%)

Computes gaps between employee's approved skills and their designation's target skills.

**Key files:**
- `src/app/(dashboard)/employee/skill-gaps/`
- `src/server/actions/gap-analysis.ts`

**Pending:** Readiness score, AI narrative, manager team view.

---

## Module 8: Learning Path
**Status:** In Progress (60%)

Learning items and paths for progressing from one competency level to another.

**Key files:**
- `src/app/(dashboard)/employee/learning-paths/`
- `src/server/actions/learning-paths.ts`

**Pending:** AI recommendations, progress tracking.

---

## Module 9: Designation Transition
**Status:** In Progress (50%)

Helps employees plan and track their path to the next designation.

**Key files:**
- `src/app/(dashboard)/employee/transition-path/`
- `src/server/actions/transition-path.ts`

**Pending:** TransitionPlan model, readiness score, manager endorsement.

---

## Module 10: Employee Skill Report
**Status:** In Progress (40%)

Full skill report for an employee with sections, AI narrative, and export.

**Key files:**
- `src/app/(dashboard)/employee/my-report/`

**Pending:** Structured sections, AI narrative, PDF export.

---

## Module 11: Talent Discovery
**Status:** In Progress (60%)

Admin search for employees matching skill and competency criteria.

**Key files:**
- `src/app/(dashboard)/admin/talent-discovery/`
- `src/server/actions/talent-discovery.ts`

**Pending:** Advanced filters, availability, saved searches.

---

## Module 12: Analytics & Reporting
**Status:** In Progress (50%)

Organization-wide skill analytics and dashboards for admins.

**Key files:**
- `src/app/(dashboard)/admin/analytics/`

**Pending:** Heatmaps, trend charts, export.

---

## Module 13: Resource Management
**Status:** In Progress (65%)

Project creation, skill requirements, and employee allocation.

**Key files:**
- `src/app/(dashboard)/admin/resource-management/`
- `src/server/actions/resource-management.ts`

**Pending:** JIN integration, conflict detection, timeline view.

---

## Module 14: AI Features
**Status:** Not Started

AI-powered gap summaries, learning path recommendations, and skill reports.

**Pending:** All infrastructure and features.
**See:** `.claude/context/ai-guidelines.md` for implementation standards.
