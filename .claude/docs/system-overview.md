# System Overview — Skill Matrix Platform

> ⚠️ Run `/documentation-sync system` to update this document from the current codebase.

_Last synced: 2026-06-24_

---

## What Is This System?

The Skill Matrix Platform is an enterprise application that enables organizations to:
- Track and validate employee technical skills and competencies
- Identify skill gaps against role requirements (by designation and COE)
- Recommend and manage learning paths to close gaps
- Plan and track designation transitions
- Discover talent for project staffing
- Analyze skill coverage across the organization
- Manage project resource allocation

---

## Target Users

| Role | Who They Are | Primary Actions |
|------|-------------|----------------|
| **ADMIN** | HR, L&D managers, Platform admins | Configure COEs, designations, skills; manage users; view analytics; resource management |
| **MANAGER** | Engineering team leads, people managers | Approve/reject skill submissions; view team skills and gaps; endorse transitions |
| **EMPLOYEE** | Software engineers, consultants | Submit skills with evidence; view their gaps; follow learning paths; view reports |

---

## Feature Summary

### Live (Implemented)
- User authentication with role-based access control
- Admin configuration: COEs, designations, competency levels
- Skill catalog management (skills, frameworks, concepts, tools, certifications)
- COE and designation skill mapping with target competency levels
- Employee skill self-assessment with evidence upload
- Manager approval workflow (approve/reject with comments)

### In Progress
- Skill gap assessment (vs designation targets)
- Learning path management
- Designation transition planning
- Employee skill reports
- Talent discovery (search by skill/level)
- Analytics dashboards
- Resource management (project allocation)

### Planned
- AI-powered gap summaries and learning path recommendations
- Email and in-app notifications
- PDF report export
- JIN integration for resource management

---

## Technical Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js App Router | 16.2.9 |
| Language | TypeScript strict | 5.x |
| Database | PostgreSQL | 16 |
| ORM | Prisma | 6.19.3 |
| Auth | NextAuth.js v5 | 5.0.0-beta.31 |
| UI | shadcn/ui + Radix | Latest |
| Styling | Tailwind CSS | 4 |
| State | Zustand | 5.x |
| AI | Claude API (Anthropic) | Planned |

---

## Environment Requirements

```
DATABASE_URL=postgresql://...
AUTH_SECRET=...
NEXTAUTH_URL=http://localhost:3000
# Future
ANTHROPIC_API_KEY=sk-ant-...
```

---

## Running Locally

```bash
pnpm install
pnpm db:migrate    # Apply database migrations
pnpm db:seed       # Seed with sample data
pnpm dev           # Start dev server at http://localhost:3000
```
