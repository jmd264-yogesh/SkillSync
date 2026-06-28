# Demo Runbook — SkillSphere Hackathon 2026

> How to start, run, and present the app end-to-end.
> Keep this open in a second monitor during the demo.

---

## Pre-Demo Checklist (do this before presenting)

```
[ ] App is running:        pnpm dev                 → http://localhost:3000
[ ] Database is seeded:    pnpm db:seed             (if fresh machine)
[ ] ETL data is loaded:    npm run etl              (Resourcing CoLab data)
[ ] Pitch page is live:    http://localhost:3000/pitch
[ ] GOOGLE_AI_API_KEY is set in .env                (AI features)
[ ] Browser is logged out so you can show login
```

---

## 1. Start the App

```bash
# Install dependencies (first time only)
pnpm install

# Start the dev server
pnpm dev
```

App runs at **http://localhost:3000**

---

## 2. Database Setup

### First-time setup on a new machine

```bash
# Push schema to SQLite (creates dev.db)
pnpm db:push

# Seed baseline data (COEs, designations, skills, users, employees)
pnpm db:seed
```

### Load Resourcing CoLab reference data (ETL)

```bash
# Ingest all 8 reference files into the DB
npm run etl
```

This ingests:
- `employee_master.xlsx` — 1,200 employees
- `project_allocations.xlsx` — 8,400 allocation rows
- `timesheets.xlsx` — 52,000 timesheet entries
- `pipeline_requests.xlsx` — 147 pipeline requests
- `weekly_status.xlsx` — 3,600 RAG status rows
- `competency_assessments.xlsx` — 6,000 behaviour scores
- `role_mix_templates.xlsx` — 48 role-mix templates
- `shadow_flags.xlsx` — 240 flags

> If ETL fails midway: the `IngestReport` table tracks which files loaded. Re-run safely — it uses upsert.

---

## 3. Login Credentials

| Role | Email | Password | Where to go first |
|------|-------|----------|-------------------|
| Admin | `admin@skillsphere.com` | `password` | `/admin/analytics` |
| Manager | `manager@skillsphere.com` | `password` | `/manager/approvals` |
| Employee | `employee@skillsphere.com` | `password` | `/employee/my-skills` |

> Check `prisma/seed.ts` for the full list if these don't work.

---

## 4. The Pitch Page (start here with judges)

Open **http://localhost:3000/pitch** — no login required.

This is the judge-facing companion page. It shows:
- Live KPIs pulled from the DB (employees, projects, timesheets, match scores)
- All 5 deliverables + Copilot with decision callouts
- Architecture diagram (5 layers)
- Clickable demo flow (7 steps deep-linked to live screens)
- Data foundation table + named gaps
- AI safety principles

**Use this to frame the problem before going live in the app.**

To print to PDF for submission: browser → Print → Save as PDF.

---

## 5. Recommended Demo Script (~10 minutes)

### Opening (0:00 — 1:00)

> Start at `/pitch`. Walk through the 4 problem tiles.
> Point to the hero KPIs — these are live from the DB, not hardcoded.

---

### Act 1 — Employee Growth Story (1:00 — 5:00)

**Log in as Employee**

| Step | Route | What to show |
|------|-------|--------------|
| 1 | `/employee/my-skills` | Existing skill portfolio. Click "Add Skill" → select Python → Level 4 → Submit. Status = PENDING. |
| 2 | `/employee/my-experience` | Click "Add Experience". Fill in a project story (see script below). Click "Extract Skills with AI". Watch Gemini return a structured skill list with levels and reasoning. Apply selected skills. |
| 3 | `/employee/skill-gaps` | Show gap vs current designation. Green = met, red = gap. |
| 4 | `/employee/transition-path` | Show the gap to next promotion level. |

**Project experience script (copy-paste into the form):**

```
Project: ETL Pipeline for Financial Services Client
Type: Data Migration
Industry: Banking
Role: Lead Data Engineer
Tech Stack: Python, Spark, Azure Data Factory, Databricks, SQL

Context: Client was migrating 10 years of transactional data from an
on-prem Oracle warehouse into Azure Data Lake. Regulatory requirement
to maintain full audit trail.

Delivery: Designed and implemented a 12-stage Spark pipeline handling
4TB of data. Built custom reconciliation framework in Python. Led a
team of 3 engineers. Deployed to production with zero data loss.
```

---

### Act 2 — Manager Approval (5:00 — 6:30)

**Log in as Manager**

| Step | Route | What to show |
|------|-------|--------------|
| 5 | `/manager/approvals` | The pending Python skill is waiting. Click Approve. Set validated level (can adjust self-assessed). |
| 6 | `/manager/team-skills` | Employee's skill now appears as APPROVED in team view. |

---

### Act 3 — Resourcing Intelligence (6:30 — 10:00)

**Log in as Admin**

| Step | Route | What to show | Decision card |
|------|-------|--------------|---------------|
| 7 | `/admin/resourcing/allocations` | Live utilisation board. Point out: over-allocated employees, bench, rolling off in 14 days (blue strip). | Workforce health decision |
| 8 | `/admin/resourcing/match` | Select a pipeline request. Show ranked employees with match score breakdown (skill %, competency %, availability). Expand top result for AI rationale. | REDEPLOY / HIRE |
| 9 | `/admin/resourcing/health` | Show RAG signals per project. Ramp-down panel. Point out leakage hours and shadow resource count. | Investigate / Formalise |
| 10 | `/admin/resourcing/simulator` | Add 3× Data Platform + 1× AI POC. Hit Simulate. Show role-by-role FTE gap and redeployment candidates. | YES WITH REDEPLOYMENTS |
| 11 | `/admin/resourcing/outlook` | Show 6-month demand vs supply matrix. Confirmed (✓) vs probable (~). First shortfall month. AI narrative. | Hire now / Monitor |
| 12 | `/admin/copilot` | Ask: *"Can we take on 3 Data Platform builds and 1 AI POC starting next month without hurting current delivery?"* Show tool-call loop and decision-first answer. | Agentic decision |

---

## 6. Key Talking Points per Screen

### Match Engine
> "Two dimensions are scored separately. Technical skill score tells you *can they do the work*. Consulting competency score tells you *can they own the client relationship*. We never hide a weak competency behind a composite average."

### Health Radar
> "Shadow resources are found by joining allocation records against timesheet entries. If someone is allocated on paper but not logging hours, that's a flag. This billability leakage is invisible in any standard tool."

### Pipeline Outlook
> "We distinguish confirmed (SOW-signed) from probable (unsigned, probability-weighted). The decision card is either 'hire now — confirmed demand already exceeds supply' or 'monitor — this is still unsigned.' That's a very different action."

### Allocation Board
> "Utilisation is computed from the last 4 weeks of actual timesheet data, not planned allocation. If the two diverge by more than 20%, we flag it as data drift. The blue strip shows who frees up in the next 14 days — those are your first candidates for the next pipeline request."

### RM Copilot
> "This is not a chatbot. It's an agentic loop. Gemini decides which tools to call, calls them with real DB data, and returns a decision-first answer with citations. Ask it a real question and it will call match + health + outlook in a single response."

### AI Safety (when asked)
> "Every AI output has a data coverage badge: HIGH, MEDIUM, or LOW. Where data is sparse, we state the production fix — we don't hide it behind a confident-sounding number. Every AI call has a deterministic fallback so the platform works even if Gemini is unavailable."

---

## 7. If Something Breaks

| Problem | Fix |
|---------|-----|
| No data on Allocation Board | Run `npm run etl` — timesheets and allocations not loaded |
| Match Engine returns 0 results | ETL not run OR no APPROVED employee skills — run `pnpm db:seed` then ETL |
| AI features return "unavailable" | `GOOGLE_AI_API_KEY` missing in `.env` — add it and restart `pnpm dev` |
| Pipeline Outlook shows no rows | `npm run etl` — pipeline_requests.xlsx not ingested |
| `/pitch` redirects to login | Check `src/middleware.ts` — `/pitch` must be in `openRoutes` array |
| DB errors after schema change | `pnpm db:push` to sync schema, then `pnpm db:seed` |

---

## 8. All Routes at a Glance

| Route | Role | Screen |
|-------|------|--------|
| `/pitch` | Public | Judge pitch companion (start here) |
| `/admin/analytics` | Admin | Platform analytics dashboard |
| `/admin/config` | Admin | COE / Designation / Competency Level setup |
| `/admin/employee-mapping` | Admin | Assign employees to COE / designation / manager |
| `/admin/skill-mapping` | Admin | Map skills to COEs and designations |
| `/admin/users` | Admin | User accounts and roles |
| `/admin/talent-discovery` | Admin | Search employees by skill and level |
| `/admin/resource-management` | Admin | Project CRUD + employee allocation |
| `/admin/feedback/cycles` | Admin | 360° feedback and promotion cycles |
| `/admin/resourcing/match` | Admin | Match Engine |
| `/admin/resourcing/health` | Admin | Project Health Radar |
| `/admin/resourcing/simulator` | Admin | Capacity Simulator |
| `/admin/resourcing/outlook` | Admin | 6-Month Pipeline Outlook |
| `/admin/resourcing/allocations` | Admin | Live Allocation Board |
| `/admin/copilot` | Admin | RM Copilot (agentic AI) |
| `/manager/team-skills` | Manager | Full team skill view |
| `/manager/approvals` | Manager | Pending skill approvals |
| `/manager/team-reports` | Manager | Team skills summary |
| `/employee/my-skills` | Employee | Skill portfolio + submission |
| `/employee/skill-gaps` | Employee | Gap vs current designation |
| `/employee/learning-paths` | Employee | Learning resources |
| `/employee/transition-path` | Employee | Gap vs next designation |
| `/employee/my-report` | Employee | Personal skills report |
| `/employee/my-experience` | Employee | Project experience + AI extraction |

---

*SkillSphere · JManGroup Hackathon 2026*
