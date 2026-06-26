# Database Design — Skill Matrix Platform

> Run `/documentation-sync database` to regenerate from current `prisma/schema.prisma`.

_Last synced: 2026-06-24_

---

## Database: PostgreSQL 16

ORM: Prisma 6 (schema-first, migrations via `prisma migrate dev`)

---

## Model Overview

### Auth & Users

**`users`** — Authentication accounts
- `id` UUID PK
- `email` Unique
- `password_hash` — bcrypt, never returned in queries
- `role` UserRole (ADMIN | MANAGER | EMPLOYEE)
- `employee_id` Optional FK → `employees` (1:1)

### Organization Structure

**`coes`** — Centers of Excellence
- `id`, `name` (Unique), `description`

**`designations`** — Job levels / titles
- `id`, `name` (Unique), `level` Int, `description`

**`competency_levels`** — Skill proficiency scale
- `id`, `level` Int (Unique), `name`, `description`
- Default: 1=Beginner, 2=Basic, 3=Intermediate, 4=Advanced, 5=Expert

### Employees

**`employees`** — Employee profiles (separate from auth)
- `id`, `employee_code` (Unique), `name`, `email` (Unique)
- `coe_id` FK → `coes`
- `designation_id` FK → `designations`
- `manager_id` FK → `employees` (self-referential — ManagerReports)

### Skills

**`skills`** — Skill catalog
- `id`, `name` (Unique), `description`
- `category` SkillCategory (SKILL | FRAMEWORK | CONCEPT | TOOL | CERTIFICATION)

### Skill Mapping

**`coe_skills`** — Skills required by a COE
- `coe_id`, `skill_id`, `target_competency` Int
- Unique: `[coe_id, skill_id]`

**`designation_skills`** — Skills required by a designation
- `designation_id`, `skill_id`, `target_competency` Int
- Unique: `[designation_id, skill_id]`

### Employee Skills & Validation

**`employee_skills`** — Employee's skill assessments
- `employee_id`, `skill_id`
- `self_assessed_level` Int — employee's self-rating
- `validated_level` Int? — manager's validated rating (null until approved)
- `status` SkillApprovalStatus (PENDING | APPROVED | REJECTED)
- `review_comment`, `reviewed_by`, `reviewed_at`
- Unique: `[employee_id, skill_id]`

**`evidences`** — Supporting evidence for skill claims
- `employee_skill_id` FK → `employee_skills`
- `employee_id` FK → `employees`
- `type` EvidenceType (CERTIFICATION | ASSESSMENT_SCORE | PROJECT_DOCUMENT | SUPPORTING_DOCUMENT)
- `title`, `description`, `file_url`, `score`, `issued_at`, `expires_at`

### Learning

**`learning_paths`** — Learning paths for skill progression
- `skill_id` FK → `skills`
- `from_level` Int, `to_level` Int — e.g., level 2 → level 3

**`learning_items`** — Individual items within a learning path
- `learning_path_id` FK → `learning_paths`
- `type` LearningType (INTERNAL_TRAINING | EXTERNAL_COURSE | CERTIFICATION | ASSESSMENT | PROJECT_BASED | DOCUMENTATION)
- `order` Int — display order

### Resource Management

**`projects`** — Projects needing staffing
- `name`, `description`, `domain`, `start_date`, `end_date`, `team_size`
- `status` ProjectStatus (PLANNING | ACTIVE | COMPLETED | ON_HOLD)

**`project_skill_requirements`** — Skills needed per project
- `project_id`, `skill_id`, `required_level` Int, `headcount` Int
- `priority` RequirementPriority (CRITICAL | HIGH | MEDIUM | LOW)
- Unique: `[project_id, skill_id]`

**`project_allocations`** — Employees assigned to projects
- `project_id`, `employee_id`, `allocation` Float (% of time), `role`
- `start_date`, `end_date`
- Unique: `[project_id, employee_id]`

---

## Enums

| Enum | Values |
|------|--------|
| `UserRole` | ADMIN, MANAGER, EMPLOYEE |
| `SkillCategory` | SKILL, FRAMEWORK, CONCEPT, TOOL, CERTIFICATION |
| `SkillApprovalStatus` | PENDING, APPROVED, REJECTED |
| `EvidenceType` | CERTIFICATION, ASSESSMENT_SCORE, PROJECT_DOCUMENT, SUPPORTING_DOCUMENT |
| `LearningType` | INTERNAL_TRAINING, EXTERNAL_COURSE, CERTIFICATION, ASSESSMENT, PROJECT_BASED, DOCUMENTATION |
| `ProjectStatus` | PLANNING, ACTIVE, COMPLETED, ON_HOLD |
| `RequirementPriority` | CRITICAL, HIGH, MEDIUM, LOW |

---

## Key Relationships

```
Employee ──── many ──── EmployeeSkill ──── many ──── Evidence
    │                        │
    │                        └── Skill ──── many ──── CoeSkill ──── Coe
    │                                   └── many ──── DesignationSkill ──── Designation
    │
    ├── Coe (1:1 current assignment)
    ├── Designation (1:1 current assignment)
    └── Manager (Employee → Employee self-ref)

Skill ──── many ──── LearningPath ──── many ──── LearningItem

Project ──── many ──── ProjectSkillRequirement ──── Skill
        └── many ──── ProjectAllocation ──── Employee
```

---

## Migration Commands

```bash
pnpm db:migrate           # Apply pending migrations (dev)
pnpm db:push              # Push schema changes without migration (dev only)
pnpm db:generate          # Regenerate Prisma client
pnpm db:studio            # Open Prisma Studio
pnpm db:seed              # Run seed file
```

**Never** edit a migration file after it has been applied to any environment.
