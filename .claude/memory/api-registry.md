# API Registry — Skill Matrix Platform

_Last updated: 2026-06-24_

This registry tracks all HTTP endpoints and server actions. Update whenever routes are added, changed, or deprecated.

---

## REST API Routes (`src/app/api/`)

| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET/POST | `/api/auth/[...nextauth]` | — | — | NextAuth.js auth handler (login, session, signout) |

**Note:** The application uses Server Actions for all mutations and Server Components for all data reads. REST routes are limited to auth and future webhook/external integrations only.

---

## Server Actions (`src/server/actions/`)

### Auth / Users (`user.ts`)
| Action | Auth | Role | Description |
|--------|------|------|-------------|
| `createUser(data)` | Yes | ADMIN | Create a new user account |
| `updateUser(id, data)` | Yes | ADMIN | Update user details or role |
| `deleteUser(id)` | Yes | ADMIN | Deactivate a user |

### COE Management (`coe.ts`)
| Action | Auth | Role | Description |
|--------|------|------|-------------|
| `createCoe(data)` | Yes | ADMIN | Create a new Center of Excellence |
| `updateCoe(id, data)` | Yes | ADMIN | Update COE details |
| `deleteCoe(id)` | Yes | ADMIN | Delete a COE |

### Designation Management (`designation.ts`)
| Action | Auth | Role | Description |
|--------|------|------|-------------|
| `createDesignation(data)` | Yes | ADMIN | Create a designation level |
| `updateDesignation(id, data)` | Yes | ADMIN | Update designation |
| `deleteDesignation(id)` | Yes | ADMIN | Delete designation |

### Competency Levels (`competency-level.ts`)
| Action | Auth | Role | Description |
|--------|------|------|-------------|
| `createCompetencyLevel(data)` | Yes | ADMIN | Create a competency level |
| `updateCompetencyLevel(id, data)` | Yes | ADMIN | Update competency level |
| `deleteCompetencyLevel(id)` | Yes | ADMIN | Delete competency level |

### Skill Management (`skill.ts`)
| Action | Auth | Role | Description |
|--------|------|------|-------------|
| `createSkill(data)` | Yes | ADMIN | Create a new skill |
| `updateSkill(id, data)` | Yes | ADMIN | Update skill details |
| `deleteSkill(id)` | Yes | ADMIN | Delete a skill |

### Skill Mapping (`skill-mapping.ts`)
| Action | Auth | Role | Description |
|--------|------|------|-------------|
| `mapSkillToCoe(data)` | Yes | ADMIN | Map skill to COE with target level |
| `mapSkillToDesignation(data)` | Yes | ADMIN | Map skill to designation with target level |
| `removeSkillFromCoe(id)` | Yes | ADMIN | Remove COE skill mapping |
| `removeSkillFromDesignation(id)` | Yes | ADMIN | Remove designation skill mapping |

### Employee Management (`employee.ts`)
| Action | Auth | Role | Description |
|--------|------|------|-------------|
| `createEmployee(data)` | Yes | ADMIN | Create employee profile |
| `updateEmployee(id, data)` | Yes | ADMIN | Update employee details |
| `assignEmployeeToCoe(data)` | Yes | ADMIN | Assign employee to COE |
| `assignDesignation(data)` | Yes | ADMIN | Assign designation to employee |

### Employee Skills (`employee-skill.ts`, `my-skills.ts`)
| Action | Auth | Role | Description |
|--------|------|------|-------------|
| `submitSkill(data)` | Yes | EMPLOYEE | Submit a skill for approval |
| `updateSkillSubmission(id, data)` | Yes | EMPLOYEE | Update a pending submission |
| `removeSkill(id)` | Yes | EMPLOYEE | Remove a pending skill |

### Approvals (`approval.ts`)
| Action | Auth | Role | Description |
|--------|------|------|-------------|
| `approveSkill(id, data)` | Yes | MANAGER | Approve a skill with validated level |
| `rejectSkill(id, data)` | Yes | MANAGER | Reject a skill with comment |

### Gap Analysis (`gap-analysis.ts`)
| Action | Auth | Role | Description |
|--------|------|------|-------------|
| `getGapAnalysis(employeeId?)` | Yes | EMPLOYEE/MANAGER | Compute skill gaps for employee |

### Learning Paths (`learning-paths.ts`)
| Action | Auth | Role | Description |
|--------|------|------|-------------|
| `getLearningPaths(skillId, fromLevel, toLevel)` | Yes | ALL | Get learning paths for a skill gap |

### Team Reports (`team-reports.ts`)
| Action | Auth | Role | Description |
|--------|------|------|-------------|
| `getTeamSkillReport(managerId?)` | Yes | MANAGER | Get skill summary for the team |

### Transition Path (`transition-path.ts`)
| Action | Auth | Role | Description |
|--------|------|------|-------------|
| `getTransitionPath(targetDesignationId)` | Yes | EMPLOYEE | Get gap analysis for designation transition |

### Talent Discovery (`talent-discovery.ts`)
| Action | Auth | Role | Description |
|--------|------|------|-------------|
| `searchTalent(filters)` | Yes | ADMIN | Search employees by skill and level |

### Resource Management (`resource-management.ts`)
| Action | Auth | Role | Description |
|--------|------|------|-------------|
| `createProject(data)` | Yes | ADMIN | Create a project |
| `updateProject(id, data)` | Yes | ADMIN | Update project details |
| `addSkillRequirement(data)` | Yes | ADMIN | Add skill requirement to project |
| `allocateEmployee(data)` | Yes | ADMIN | Allocate employee to project |
| `removeAllocation(id)` | Yes | ADMIN | Remove employee from project |

---

## Planned Future Routes (not yet implemented)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/ai/gap-summary` | AI-generated gap summary (streaming) |
| POST | `/api/ai/learning-path` | AI-generated learning path |
| POST | `/api/webhooks/jin` | JIN integration webhook |
| GET | `/api/reports/[employeeId]/pdf` | PDF report export |
