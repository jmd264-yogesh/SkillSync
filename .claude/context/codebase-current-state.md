# Codebase Current State — SkillSphere Platform

_Generated: 2026-06-26 | Covers actual implemented code, not planned modules_

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16.2.9 (App Router) |
| Language | TypeScript 5 (strict) |
| Database | PostgreSQL 16 via Prisma 6.19.3 |
| Auth | NextAuth.js v5 (beta.31) — Credentials provider, JWT sessions |
| UI Components | shadcn/ui + Radix UI primitives |
| Styling | Tailwind CSS 4 |
| Charts | Recharts 3 |
| Forms | React Hook Form 7 + Zod 4 |
| State | Zustand 5 (minimal, UI-only) |
| Animations | Framer Motion 12 |
| Testing | Vitest 4 + Playwright (scaffolded, no test files written) |
| Password Hashing | bcryptjs (cost factor 12) |

---

## Directory Map

```
src/
├── app/
│   ├── (auth)/login/              # Login page
│   ├── (dashboard)/
│   │   ├── admin/
│   │   │   ├── analytics/         # Analytics dashboard
│   │   │   ├── coe/               # COE management
│   │   │   ├── competency-levels/ # Competency level management
│   │   │   ├── config/            # Config hub page
│   │   │   ├── designations/      # Designation management
│   │   │   ├── employee-mapping/  # Employee → COE/Designation/Manager assignment
│   │   │   ├── feedback/
│   │   │   │   └── cycles/        # Review cycle list
│   │   │   │       └── [cycleId]/
│   │   │   │           ├── page.tsx                    # Cycle detail + assignments
│   │   │   │           ├── forms/page.tsx              # Form management for a cycle
│   │   │   │           └── employee/[employeeId]/page.tsx  # Employee feedback view
│   │   │   ├── resource-management/ # Projects + allocations
│   │   │   ├── skill-mapping/     # COE/Designation → Skill mapping
│   │   │   ├── skills/            # Skill catalog
│   │   │   ├── talent-discovery/  # Employee search by skill
│   │   │   └── users/             # User account management
│   │   ├── manager/
│   │   │   ├── approvals/         # Skill approval queue
│   │   │   ├── feedback/
│   │   │   │   ├── page.tsx       # Manager feedback dashboard
│   │   │   │   ├── assign/        # Assign feedback forms
│   │   │   │   ├── forms/         # Manager's own feedback forms
│   │   │   │   ├── team/          # Team assignment status
│   │   │   │   └── submit/[assignmentId]/ # Submit feedback response
│   │   │   ├── team-reports/      # Team skill readiness report
│   │   │   └── team-skills/       # Team skills overview
│   │   └── employee/
│   │       ├── learning-paths/    # Auto-generated learning recommendations
│   │       ├── my-report/         # Full skill report (profile + gaps + certs)
│   │       ├── my-skills/         # Skill submission + evidence
│   │       ├── skill-gaps/        # Gap analysis vs COE/Designation targets
│   │       └── transition-path/   # Gap analysis for next designation
│   └── api/auth/[...nextauth]/    # NextAuth handler (only REST route)
├── server/
│   ├── actions/                   # All mutations (20 files)
│   └── services/                  # (currently empty — logic is inline in actions)
├── components/
│   ├── ui/                        # shadcn/ui primitives (16 components)
│   ├── forms/                     # Form dialogs (9 components)
│   ├── layouts/                   # app-sidebar.tsx, dashboard-header.tsx
│   └── shared/                    # confirm-dialog, data-table, empty-state, page-header
├── lib/
│   ├── auth.ts                    # NextAuth config + session shape
│   ├── constants.ts               # COMPETENCY_LEVELS, ROLE_PERMISSIONS, etc.
│   ├── db.ts                      # Prisma client singleton
│   ├── errors.ts                  # UnauthorizedError, ForbiddenError, NotFoundError, ValidationError
│   └── utils.ts                   # cn() and general utilities
├── hooks/use-mobile.ts
├── middleware.ts                  # Route protection (unauthenticated → /login)
├── types/index.ts
└── validations/
    ├── admin.schema.ts
    ├── auth.schema.ts
    ├── employee.schema.ts
    ├── feedback.schema.ts         # All feedback/cycle Zod schemas
    └── skill.schema.ts
```

---

## Database Schema (All Models)

### Auth & Users
| Model | Key Fields |
|-------|-----------|
| `User` | id, email, name, passwordHash, role (ADMIN/MANAGER/EMPLOYEE), employeeId (optional FK → Employee) |

### Organization Structure
| Model | Key Fields |
|-------|-----------|
| `Coe` | id, name (unique), description |
| `Designation` | id, name (unique), level (Int), description |
| `CompetencyLevel` | id, level (Int unique), name, description |

### People
| Model | Key Fields |
|-------|-----------|
| `Employee` | id, employeeCode (unique), name, email, coeId, designationId, managerId (self-ref) |

### Skills
| Model | Key Fields |
|-------|-----------|
| `Skill` | id, name (unique), description, category (SKILL/FRAMEWORK/CONCEPT/TOOL/CERTIFICATION) |
| `CoeSkill` | coeId, skillId, targetCompetency — unique(coeId, skillId) |
| `DesignationSkill` | designationId, skillId, targetCompetency — unique(designationId, skillId) |
| `EmployeeSkill` | employeeId, skillId, selfAssessedLevel, validatedLevel, status (PENDING/APPROVED/REJECTED), reviewComment, reviewedBy, reviewedAt — unique(employeeId, skillId) |
| `Evidence` | employeeSkillId, employeeId, type (CERTIFICATION/ASSESSMENT_SCORE/PROJECT_DOCUMENT/SUPPORTING_DOCUMENT), title, description, fileUrl, score, issuedAt, expiresAt |

### Learning
| Model | Key Fields |
|-------|-----------|
| `LearningPath` | id, title, description, skillId, fromLevel, toLevel |
| `LearningItem` | learningPathId, title, type (INTERNAL_TRAINING/EXTERNAL_COURSE/CERTIFICATION/ASSESSMENT/PROJECT_BASED/DOCUMENTATION), url, duration, order |

### Resource Management
| Model | Key Fields |
|-------|-----------|
| `Project` | id, name, description, domain, startDate, endDate, teamSize, status (PLANNING/ACTIVE/COMPLETED/ON_HOLD), projectManagerId |
| `ProjectSkillRequirement` | projectId, skillId, requiredLevel, headcount, priority (CRITICAL/HIGH/MEDIUM/LOW) — unique(projectId, skillId) |
| `ProjectAllocation` | projectId, employeeId, allocation (Float %), role, startDate, endDate — unique(projectId, employeeId) |

### Feedback & Promotion Readiness
| Model | Key Fields |
|-------|-----------|
| `ReviewCycle` | id, name, startDate, endDate, status (DRAFT/ACTIVE/CLOSED/ARCHIVED), createdById |
| `FeedbackForm` | id, title, description, formType (PM_FEEDBACK/CDM_ASSESSMENT/HR_FEEDBACK), reviewCycleId, createdById |
| `FeedbackFormSection` | formId, title, description, order |
| `FeedbackFormQuestion` | sectionId, text, type (RATING/TEXT), required, order |
| `FeedbackFormAssignment` | reviewCycleId, formId, reviewerId, employeeId, projectId (optional), assignedById, status (PENDING/IN_PROGRESS/SUBMITTED/OVERDUE), dueDate |
| `FeedbackSubmission` | assignmentId (unique), submittedAt |
| `FeedbackResponse` | submissionId, questionId, ratingValue (1–5), textValue |
| `FeedbackSummary` | reviewCycleId + employeeId (unique), summaryText, keyStrengths, developmentAreas, skillReadiness, feedbackReadiness, compositeScore (0–100), promotionStatus (READY_FOR_PROMOTION/NEAR_READY/NEEDS_DEVELOPMENT/NOT_ELIGIBLE_YET) |

---

## Implemented Features by Role

### ADMIN

#### Configuration Management (`/admin/config`, `/admin/coe`, `/admin/designations`, `/admin/competency-levels`)
- Full CRUD for Centers of Excellence (COE), Designations (with hierarchy levels), and Competency Levels
- Config hub page aggregates all three into one view

#### Skill Catalog (`/admin/skills`)
- CRUD for skills with 5 categories: SKILL, FRAMEWORK, CONCEPT, TOOL, CERTIFICATION
- Filter by category

#### Skill Mapping (`/admin/skill-mapping`)
- Map skills to COEs with a target competency level (1–5)
- Map skills to Designations with a target competency level
- Dual-tab UI; remove mappings individually

#### Employee Management (`/admin/employee-mapping`)
- Create employee profiles (name, email, employeeCode)
- Assign employee to COE, Designation, and manager hierarchy
- Link employees to user accounts (via `/admin/users`)

#### User & Permissions (`/admin/users`)
- Create / update / delete user accounts
- Assign roles (ADMIN, MANAGER, EMPLOYEE)
- Link user to an employee profile
- Guard: cannot delete the last admin, cannot delete own account

#### Talent Discovery (`/admin/talent-discovery`)
- Search employees by: skill, minimum competency level, COE, designation
- Displays employee's approved skills with levels
- Shows manager name and COE/designation
- `getSkillDemandProfile()`: computes project skill demand vs employee supply gap

#### Resource Management (`/admin/resource-management`)
- Full project CRUD (name, description, domain, dates, team size, status)
- Add/remove skill requirements per project (skill + required level + headcount + priority)
- Allocate employees to projects with % allocation
- Over-allocation protection: prevents total allocation > 100% across active projects
- Create new skills inline when adding project requirements

#### Analytics Dashboard (`/admin/analytics`)
- KPI cards: total employees, total skills mapped, total COEs, total designations
- COE employee distribution (bar chart)
- Designation employee distribution (bar chart)
- Skill approval status breakdown (pending/approved/rejected)
- Org-wide readiness score (average % of target skills met)
- Readiness bands: low (<40%), medium (40–70%), high (>70%)
- COE readiness comparison chart
- Recent skill submissions activity feed
- "Employees with no gaps" count

#### Feedback & Promotion (`/admin/feedback/cycles`)
- Create and manage Review Cycles (name, start date, end date)
- Lifecycle transitions: DRAFT → ACTIVE → CLOSED → ARCHIVED (enforced state machine)
- Per-cycle: view all assignments and their statuses
- Per-employee in a cycle: view all submitted feedback with full responses
- Generate promotion readiness summary:
  - Composite score = 50% skill readiness + 50% feedback readiness (avg rating score)
  - Promotion status: READY_FOR_PROMOTION (≥85%), NEAR_READY (≥65%), NEEDS_DEVELOPMENT (≥40%), NOT_ELIGIBLE_YET (<40%)
  - Persisted in `FeedbackSummary` (upsertable)

---

### MANAGER

#### Skill Approvals (`/manager/approvals`)
- View pending skill submissions for direct reportees
- Filter by status (PENDING/APPROVED/REJECTED/ALL)
- Approve skill: set validated level + optional comment
- Reject skill: require rejection reason comment
- Admin can see all employees' submissions (not scoped to team)

#### Team Skills (`/manager/team-skills`)
- Overview of all direct reportees and their skill statuses

#### Team Reports (`/manager/team-reports`)
- List view: each reportee's approved count, pending count, readiness score (% of target skills met)
- Detail view per team member: full skill list, gap analysis, readiness score

#### Feedback (`/manager/feedback`)
- Dashboard: pending feedback assignments
- Create PM_FEEDBACK forms (managers restricted to PM_FEEDBACK type only)
- `getMyAssignments()`: fetch pending/in-progress feedback assignments where they are the reviewer
- Submit feedback form (`/manager/feedback/submit/[assignmentId]`): fill out rating + text responses per question
- Assign feedback forms to employees (`/manager/feedback/assign`): restricted to own reportees
- View team assignment statuses (`/manager/feedback/team`)

---

### EMPLOYEE

#### My Skills (`/employee/my-skills`)
- View all submitted skills grouped by status
- Submit new skill: pick skill, set self-assessed level (1–5), optionally attach evidence
- Evidence types: CERTIFICATION, ASSESSMENT_SCORE, PROJECT_DOCUMENT, SUPPORTING_DOCUMENT
- Withdraw a pending skill submission (deletes evidence too, in a transaction)
- See target skills from COE and Designation mappings

#### Skill Gaps (`/employee/skill-gaps`)
- Computed from approved employee skills vs COE + Designation target levels
- For overlapping skills: takes the higher of COE/Designation target
- Gap items: skillName, category, targetLevel, currentLevel, gap, status (met/partial/missing), source (COE/Designation/Both)
- Readiness summary: % of target skills met, counts per status
- Sorted by gap size (largest gaps first)

#### Learning Paths (`/employee/learning-paths`)
- Auto-generated step-by-step learning plans for each skill gap
- Steps are generated procedurally per level increment (no manual DB content needed):
  - Level 0→1: Foundations course (6–10 hrs)
  - Level 1→2: Core concepts course + practice exercises
  - Level 2→3: Advanced course + project
  - Level 3→5: Expert contribution + certification
  - Final step always: "Submit for Manager Validation"
- Sorted by gap size (highest priority first)
- Only shows paths for skills with a remaining gap > 0

#### Transition Path (`/employee/transition-path`)
- Employee selects a target designation (only higher-level designations shown)
- Gap analysis vs that designation's required skills
- Per-skill priority: Critical (gap ≥4), High (gap ≥3), Medium (gap ≥1), None (met)
- Readiness score (% skills met), estimated timeline (months, computed from total gap points × 1.5–2.5)

#### My Report (`/employee/my-report`)
- Full comprehensive report page (Server Component, no client JS needed):
  - Employee profile card (name, code, email, COE, designation, manager)
  - KPI summary: approved count, avg validated level, pending count, certification count
  - Readiness ring (SVG circular progress, color-coded: green ≥70%, amber ≥40%, red <40%)
  - Skill readiness breakdown: met / in-progress / not-started counts + top 3 priority gaps
  - Validated skill profile: full list with self/validated levels, status badge, evidence count, review comment
  - Skill gap details: per-skill status with source indicator
  - Certifications & assessments gallery
  - Recommended next steps: top 3 gaps with actionable instructions

---

## Server Actions Reference

### `src/server/actions/user.ts`
- `getUsers()` — all users with linked employee profile
- `createUser(formData)` — validates unique email, bcrypt hash, optional employee link
- `updateUser(id, formData)` — update name/email/role/password/employee link
- `deleteUser(id)` — guards: can't delete self, can't delete last admin

### `src/server/actions/approval.ts`
- `getPendingApprovals()` — scoped by manager's reportees (or all for admin)
- `getAllApprovals(statusFilter?)` — with optional status filter
- `approveSkill(formData)` — sets APPROVED + validatedLevel + optional comment
- `rejectSkill(formData)` — sets REJECTED + required reviewComment

### `src/server/actions/my-skills.ts`
- `getMySkills()` — employee's own submissions with skill + evidences
- `getMyTargetSkills()` — merged COE + Designation target skills map
- `getAvailableSkills()` — all skills not yet submitted by employee
- `submitSkill(formData)` — creates EmployeeSkill + optional Evidence in a transaction
- `withdrawSkill(id)` — deletes evidence + skill in a transaction

### `src/server/actions/gap-analysis.ts`
- `getMyGapAnalysis()` — full gap computation (COE + Designation targets vs approved skills)

### `src/server/actions/learning-paths.ts`
- `getMyLearningPaths()` — procedurally generated step-by-step paths for each gap

### `src/server/actions/transition-path.ts`
- `getDesignationsForTransition()` — higher-level designations than current
- `getTransitionGap(targetDesignationId)` — full gap analysis + readiness + estimated months

### `src/server/actions/team-reports.ts`
- `getTeamReports()` — summary list for all reportees (readiness score per person)
- `getTeamMemberDetail(employeeId)` — full skill + gap detail for one reportee

### `src/server/actions/resource-management.ts`
- `getResourceDashboard()` — all projects + all employees with allocations
- `createProject(formData)` / `updateProjectStatus(id, status)` / `deleteProject(id)`
- `addSkillRequirement(projectId, formData)` / `removeSkillRequirement(requirementId)`
- `allocateEmployee(formData)` — with over-allocation guard (sums active allocations)
- `updateAllocation(id, allocation)` / `removeAllocation(id)`
- `createSkillAndAddRequirement(...)` — upserts skill + adds to project
- `getSkillsForSelect()` / `getEmployeesForSelect()`

### `src/server/actions/talent-discovery.ts`
- `searchTalent(filters)` — filter by skillId + minLevel + coeId + designationId
- `getTalentFilterOptions()` — all skills, COEs, designations for filter dropdowns
- `getSkillDemandProfile()` — demand (projects) vs supply (employees) per skill

### `src/server/actions/review-cycle.ts`
- `getReviewCycles()` / `getReviewCycle(id)` / `createReviewCycle(data)` / `updateReviewCycle(id, data)`
- `updateCycleStatus(id, status)` — enforces state machine transitions
- `deleteReviewCycle(id)` — only DRAFT cycles deletable
- `getCycleEmployeeStatus(cycleId)` — all assignments for a cycle

### `src/server/actions/feedback-form.ts`
- `getFeedbackFormsForCycle(cycleId)` — admin sees all; manager sees own
- `getFeedbackForm(id)` — with full sections + questions
- `createFeedbackForm(data)` — creates form + sections + questions in nested create; managers restricted to PM_FEEDBACK
- `deleteFeedbackForm(id)` — blocked if any assignments exist

### `src/server/actions/feedback-assignment.ts`
- `getMyAssignments()` — reviewer's pending/in-progress assignments
- `getAssignment(id)` — with full form, submission, responses
- `getTeamAssignmentStatus(cycleId?)` — manager sees reportees' assignments
- `createAssignment(data)` — validates PM_FEEDBACK → reviewer must be PM of project, employee must be allocated
- `deleteAssignment(id)` — admin only, blocked if submitted
- `getAssignmentContext(cycleId)` — all context data needed for the assignment UI

### `src/server/actions/feedback-submission.ts`
- `submitFeedback(data)` — creates submission + responses in transaction; validates required questions, rating range (1–5)
- `getEmployeeFeedback(employeeId, cycleId)` — scope-aware: managers see PM_FEEDBACK + CDM_ASSESSMENT only
- `generateFeedbackSummary(data)` — computes skill readiness (from designation skills) + feedback readiness (avg rating/5), 50/50 composite, upserts FeedbackSummary
- `getEmployeeSummary(employeeId, cycleId)` — returns existing summary

### Other actions
- `coe.ts`: `getCoes`, `createCoe`, `updateCoe`, `deleteCoe`
- `designation.ts`: `getDesignations`, `createDesignation`, `updateDesignation`, `deleteDesignation`
- `competency-level.ts`: `getCompetencyLevels`, `createCompetencyLevel`, `updateCompetencyLevel`, `deleteCompetencyLevel`
- `skill.ts`: `getSkills`, `createSkill`, `updateSkill`, `deleteSkill`
- `skill-mapping.ts`: `getCoeSkillMappings`, `getDesignationSkillMappings`, `mapSkillToCoe`, `mapSkillToDesignation`, `removeSkillFromCoe`, `removeSkillFromDesignation`
- `employee.ts`: `getEmployees`, `createEmployee`, `updateEmployee`, `deleteEmployee`
- `employee-skill.ts`: approve/reject variants (overlaps with approval.ts)

---

## Authentication & Authorization

### Session Shape
```typescript
session.user = { id, email, name, role: UserRole, employeeId: string | null }
```

### Middleware (`src/middleware.ts`)
- Public routes: `/login`, `/register`
- Authenticated → redirects public routes to `/employee/my-skills`
- Unauthenticated → redirects all protected routes to `/login`
- Does NOT enforce role-level routing (handled per-layout)

### RBAC Enforcement
1. Middleware — unauthenticated guard
2. Role layouts (`admin/layout.tsx`, `manager/layout.tsx`) — role guard
3. Server actions — session check + role check + scope check inline
4. No service layer abstraction (auth logic lives in action files directly)

### Scope Rules Implemented
- Employee: `employeeId` always from `session.user.employeeId`, never from request body
- Manager: always verifies `managerId === session.user.employeeId` before accessing reportee data
- Admin: no scope restriction, role check only

---

## UI Component Inventory

### shadcn/ui Primitives (`src/components/ui/`)
Avatar, Badge, Button, Card, Dialog, Dropdown Menu, Input, Label, Progress, Select, Separator, Sheet, Sidebar, Skeleton, Sonner (toasts), Table, Tabs, Textarea, Tooltip

### Form Dialogs (`src/components/forms/`)
| Component | Purpose |
|-----------|---------|
| `coe-form-dialog.tsx` | Create/edit COE |
| `competency-level-form-dialog.tsx` | Create/edit competency level |
| `designation-form-dialog.tsx` | Create/edit designation |
| `employee-form-dialog.tsx` | Create/edit employee |
| `employee-skills-dialog.tsx` | Skill submission with evidence |
| `feedback-form-builder-dialog.tsx` | Build feedback form with sections + questions |
| `review-cycle-form-dialog.tsx` | Create/edit review cycle |
| `skill-form-dialog.tsx` | Create/edit skill |
| `user-form-dialog.tsx` | Create/edit user account |

### Shared Components (`src/components/shared/`)
| Component | Purpose |
|-----------|---------|
| `confirm-dialog.tsx` | Reusable confirmation modal |
| `data-table.tsx` | Sortable/filterable data table with pagination |
| `empty-state.tsx` | Empty state with icon + message + optional CTA |
| `page-header.tsx` | Standard page title + description + optional action slot |

### Layout Components (`src/components/layouts/`)
| Component | Purpose |
|-----------|---------|
| `app-sidebar.tsx` | Role-aware collapsible sidebar navigation |
| `dashboard-header.tsx` | Top bar with user info and sign-out |

---

## Navigation Structure

### Admin Sidebar
- Dashboard → `/admin/analytics`
- Configuration → `/admin/config`
- Employee Mapping → `/admin/employee-mapping`
- Skill Mapping → `/admin/skill-mapping`
- Users & Permissions → `/admin/users`
- Talent Discovery → `/admin/talent-discovery`
- Resource Management → `/admin/resource-management`
- Feedback & Promotion → `/admin/feedback/cycles`

### Manager Sidebar
- Team Skills → `/manager/team-skills`
- Approvals → `/manager/approvals`
- Team Reports → `/manager/team-reports`
- Team Learning → `/manager/team-learning` *(link exists, page not implemented)*
- Feedback → `/manager/feedback`

### Employee Sidebar (shown to all authenticated users)
- My Skills → `/employee/my-skills`
- Skill Gaps → `/employee/skill-gaps`
- Learning Paths → `/employee/learning-paths`
- Transition Path → `/employee/transition-path`
- My Report → `/employee/my-report`

---

## What Is NOT Yet Built

| Feature | Status |
|---------|--------|
| `/manager/team-learning` page | Link in sidebar exists, no page file |
| Register page | Route in public list but no page file |
| Email notifications on approval/rejection | Not implemented |
| In-app notification system (badge) | Not implemented |
| PDF export for reports | Not implemented |
| AI features (Module 14) | Zero implementation — no `ai.service.ts`, no prompts |
| Test files | Zero test files despite test infrastructure being set up |
| Bulk approve/reject in approvals | Not implemented |
| Pagination on large tables | Not implemented |
| Manager endorsement for designation transitions | Not implemented |

---

## Key Business Logic Notes

### Readiness Score Computation (used in 4 places)
```
targetMap = merge(COE target skills, Designation target skills, taking higher level when both apply)
currentMap = approved employeeSkills → validatedLevel
met = skills where currentLevel >= targetLevel
readiness% = round(met / total * 100)
```
This exact logic is duplicated in: `gap-analysis.ts`, `team-reports.ts`, `feedback-submission.ts`, `analytics/page.tsx`

### Promotion Summary Scoring
```
skillReadiness  = met / requiredSkills * 100 (from designation skills)
feedbackReadiness = avg(all rating responses) / 5 * 100
compositeScore  = round((skillReadiness + feedbackReadiness) / 2)
promotionStatus = READY(≥85) | NEAR_READY(≥65) | NEEDS_DEVELOPMENT(≥40) | NOT_ELIGIBLE_YET
```

### Learning Path Steps (Procedural Generation)
Learning paths are generated in code (not stored in DB). The `generateSteps()` function in `learning-paths.ts` produces steps based on the gap level range — no manual admin configuration needed.

### Project Allocation Guard
`allocateEmployee()` sums all existing active (non-COMPLETED) project allocations for the employee before allowing a new allocation. Blocks if `totalExisting + newAllocation > 100`.

### Feedback Assignment Validation
PM_FEEDBACK assignments enforce: reviewer must be the `projectManager` of the specified project, and the employee must have a `ProjectAllocation` record for that project.

---

_This document reflects the actual code as of 2026-06-26. For planned/aspirational state see `.claude/memory/module-status.md`._
