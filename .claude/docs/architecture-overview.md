# Architecture Overview — Skill Matrix Platform

> Run `/architecture-sync` to update this document after major changes.

_Last synced: 2026-06-24_

---

## System Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                         BROWSER (Client)                          │
│                                                                    │
│  React Client Components   │   Zustand Stores (UI state only)    │
│  ("use client" directive)  │   Forms (react-hook-form + Zod)     │
└────────────────────────────┬─────────────────────────────────────┘
                             │  RSC payload + Server Action calls
┌────────────────────────────▼─────────────────────────────────────┐
│                     NEXT.JS APP ROUTER (Server)                   │
│                                                                    │
│  Server Components (fetch + render)  │  Route Handlers (auth)    │
│  Middleware (auth gate + redirect)   │  Server Actions (mutations)│
└────────────────────────────┬─────────────────────────────────────┘
                             │  Direct function call
┌────────────────────────────▼─────────────────────────────────────┐
│                    SERVER ACTIONS LAYER                            │
│       src/server/actions/*.ts                                      │
│                                                                    │
│  1. Auth check (getServerSession)                                 │
│  2. Role check (ROLE_PERMISSIONS)                                 │
│  3. Scope check (employee-self, manager-reportee)                 │
│  4. Input validation (Zod)                                        │
│  5. Call service layer                                            │
│  6. Revalidate cache                                              │
└────────────────────────────┬─────────────────────────────────────┘
                             │  Function call
┌────────────────────────────▼─────────────────────────────────────┐
│                     SERVICE LAYER                                  │
│       src/server/services/*.service.ts                             │
│                                                                    │
│  Pure business logic — no auth, no HTTP, no UI concerns           │
│  Returns typed results                                            │
└────────────────────────────┬─────────────────────────────────────┘
                             │  Prisma ORM
┌────────────────────────────▼─────────────────────────────────────┐
│                       PRISMA 6 ORM                                │
│                    src/lib/db.ts (singleton)                       │
└────────────────────────────┬─────────────────────────────────────┘
                             │  TCP/SSL
┌────────────────────────────▼─────────────────────────────────────┐
│                     POSTGRESQL 16                                  │
└───────────────────────────────────────────────────────────────────┘
```

---

## Authentication Flow

```
HTTP Request
    │
    ▼
src/middleware.ts
    │── No session + protected route ──→ redirect /login
    │── Session + wrong role for route ──→ redirect to role dashboard
    │── Authorized ──→ pass through
    ▼
(dashboard)/layout.tsx — secondary role guard
    ▼
Server Component (page.tsx)
    │── Fetch data directly via db (Prisma)
    │── Pass as props to Client Component
    ▼
Client Component (*-client.tsx)
    │── Event handler calls Server Action
    ▼
Server Action
    │── getServerSession() check
    │── Role check
    │── Scope check
    │── Zod validation
    │── Service call
    │── revalidatePath()
```

---

## RBAC Enforcement Points

| Point | What It Checks |
|-------|---------------|
| `src/middleware.ts` | Session existence; route-level role access |
| `(dashboard)/admin/layout.tsx` | Role === ADMIN |
| `(dashboard)/manager/layout.tsx` | Role === MANAGER |
| `(dashboard)/employee/layout.tsx` | Role === EMPLOYEE |
| Server Actions | Full: session + role + data scope |

---

## Service Dependencies

```
gap-analysis.service.ts
    └── depends on: employee.service.ts, skill.service.ts

learning-path.service.ts
    └── depends on: skill.service.ts, gap-analysis.service.ts (planned)

talent-discovery.service.ts
    └── depends on: employee.service.ts, skill.service.ts

ai.service.ts (planned)
    └── depends on: gap-analysis.service.ts, learning-path.service.ts, report.service.ts
```

---

## Data Flow Examples

### Skill Submission
```
Employee submits form
→ submitSkill() server action
→ session.user.employeeId (scope enforced)
→ skillSubmissionSchema.parse(data)
→ db.employeeSkill.create({ status: PENDING })
→ revalidatePath('/employee/my-skills')
→ Manager sees new item in approval queue
```

### Gap Analysis Computation
```
Employee views /employee/skill-gaps
→ Server Component fetches designation target skills
→ Server Component fetches employee approved skills
→ Gap = target skills not present or below target level in approved skills
→ Renders gap-client.tsx with gap data as props
```

---

## Module Route Map

| Module | Route | Role |
|--------|-------|------|
| Auth | `/login`, `/register` | Public |
| Users | `/admin/users` | ADMIN |
| Config | `/admin/coe`, `/admin/designations`, `/admin/competency-levels` | ADMIN |
| Skills | `/admin/skills` | ADMIN |
| Skill Mapping | `/admin/skill-mapping`, `/admin/employee-mapping` | ADMIN |
| Analytics | `/admin/analytics` | ADMIN |
| Talent Discovery | `/admin/talent-discovery` | ADMIN |
| Resource Mgmt | `/admin/resource-management` | ADMIN |
| Approvals | `/manager/approvals` | MANAGER |
| Team Skills | `/manager/team-skills` | MANAGER |
| Team Reports | `/manager/team-reports` | MANAGER |
| My Skills | `/employee/my-skills` | EMPLOYEE |
| Skill Gaps | `/employee/skill-gaps` | EMPLOYEE |
| Learning Paths | `/employee/learning-paths` | EMPLOYEE |
| Transition | `/employee/transition-path` | EMPLOYEE |
| My Report | `/employee/my-report` | EMPLOYEE |
