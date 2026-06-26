# Architecture — Skill Matrix Platform

## System Overview

Enterprise platform for managing employee skills, competencies, validations, skill gap analysis, learning path recommendations, designation transitions, talent discovery, and resource management.

**Stack:** Next.js 16 (App Router) · TypeScript 5 (strict) · PostgreSQL 16 · Prisma 6 · Tailwind CSS 4 · shadcn/ui · NextAuth.js v5 · Zustand

---

## Layered Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Browser (React)                   │
│  Client Components ("use client") + Zustand stores  │
└──────────────────────┬──────────────────────────────┘
                       │ RSC / Server Actions
┌──────────────────────▼──────────────────────────────┐
│              Next.js App Router (Server)             │
│  Server Components + Route Handlers + Middleware     │
└──────────────────────┬──────────────────────────────┘
                       │ Direct import
┌──────────────────────▼──────────────────────────────┐
│              Server Actions (src/server/actions/)    │
│  Auth check → Role check → Zod validation → Service │
└──────────────────────┬──────────────────────────────┘
                       │ Function call
┌──────────────────────▼──────────────────────────────┐
│               Services (src/server/services/)        │
│            Pure business logic, no auth concerns     │
└──────────────────────┬──────────────────────────────┘
                       │ Prisma ORM
┌──────────────────────▼──────────────────────────────┐
│                  PostgreSQL 16                       │
└─────────────────────────────────────────────────────┘
```

---

## Directory Structure

```
src/
├── app/
│   ├── (auth)/                 # Public routes: login, register
│   ├── (dashboard)/            # Authenticated routes (all roles)
│   │   ├── admin/              # ADMIN-only pages
│   │   ├── manager/            # MANAGER-only pages
│   │   └── employee/           # EMPLOYEE-only pages
│   ├── api/                    # REST API routes (auth + webhooks only)
│   └── layout.tsx              # Root layout
├── server/
│   ├── actions/                # Server actions (mutations)
│   └── services/               # Business logic (pure functions)
├── components/
│   ├── ui/                     # shadcn/ui primitives
│   ├── forms/                  # Form components with validation
│   ├── tables/                 # Data table components
│   ├── charts/                 # Recharts analytics components
│   ├── layouts/                # Sidebar, Header, Navigation
│   └── shared/                 # EmptyState, StatusBadge, ConfirmDialog
├── lib/
│   ├── db.ts                   # Prisma client singleton
│   ├── auth.ts                 # NextAuth configuration
│   ├── utils.ts                # cn(), general utilities
│   ├── constants.ts            # ROLE_PERMISSIONS, COMPETENCY_LEVELS
│   └── errors.ts               # UnauthorizedError, ForbiddenError, etc.
├── hooks/                      # Custom React hooks (client-side only)
├── stores/                     # Zustand stores (client-side state)
├── types/                      # TypeScript type definitions
└── validations/                # Zod schemas (shared client + server)
```

---

## Data Flow: Skill Submission

```
Employee (browser)
  → fills SkillSubmissionForm (Client Component)
  → calls submitSkill() server action
    → getServerSession() — unauthorized if no session
    → verify role === EMPLOYEE
    → skillSubmissionSchema.parse(data) — validates input
    → employeeSkillService.submitSkill(employeeId, data)
      → db.employeeSkill.create({ ... })
    → revalidatePath('/employee/my-skills')
  → form shows success toast (sonner)
```

## Data Flow: Manager Approval

```
Manager (browser)
  → views pending approvals (Server Component fetches via Prisma directly)
  → clicks Approve/Reject
  → calls approveSkill() / rejectSkill() server action
    → getServerSession() — checks role === MANAGER
    → validates employeeId is in manager's reportee list
    → approvalService.processApproval(...)
      → db.employeeSkill.update({ status: 'APPROVED', validatedLevel, reviewedBy })
    → revalidatePath('/manager/approvals')
```

---

## Authentication Flow

```
Request
  → src/middleware.ts
    → checks session via NextAuth
    → if no session AND route requires auth → redirect /login
    → if session AND wrong role for route → redirect /dashboard
  → Layout auth check (secondary guard)
  → Server Component renders
```

---

## RBAC Enforcement Points

1. **Middleware** (`src/middleware.ts`) — route-level protection
2. **Role layouts** (`admin/layout.tsx`, etc.) — role-level protection
3. **Server Actions** — action-level auth + role + scope validation
4. **Service layer** — data scoping (never trusts input employeeId for employees)

---

## Key Architectural Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Data fetching | Server Components + Prisma direct | No API round-trip overhead |
| Mutations | Server Actions | CSRF-safe, no separate API needed |
| External API routes | NextAuth only | Keeps surface area small |
| Client state | Zustand (minimal) | Only for UI state, not server data |
| Component library | shadcn/ui + Radix | Accessible, composable, not a black box |
| Validation | Zod shared | Client + server share same schema |
| ORM | Prisma 6 | Type-safe, migration-first |

---

## Module Map

| # | Module | Route Group | Status |
|---|--------|-------------|--------|
| 1 | Auth & User Management | (auth), admin/users | Complete |
| 2 | Admin Configuration | admin/coe, admin/designations, admin/competency-levels | Complete |
| 3 | Skill Management | admin/skills | Complete |
| 4 | Skill Mapping | admin/skill-mapping | Complete |
| 5 | Employee Skill Submission | employee/my-skills | Complete |
| 6 | Manager Approval Workflow | manager/approvals | ~95% |
| 7 | Skill Gap Assessment | employee/skill-gaps | ~70% |
| 8 | Learning Path | employee/learning-paths | ~60% |
| 9 | Designation Transition | employee/transition-path | ~50% |
| 10 | Employee Skill Report | employee/my-report | ~40% |
| 11 | Talent Discovery | admin/talent-discovery | ~60% |
| 12 | Analytics & Reporting | admin/analytics | ~50% |
| 13 | Resource Management | admin/resource-management | ~65% |
| 14 | AI Features | (service layer only) | 0% |

_Last updated: 2026-06-24_
