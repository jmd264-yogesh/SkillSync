# SkillSphere — Hackathon Presentation Guide

> **One-line pitch:** SkillSphere is an AI-powered skills intelligence platform that connects what your people can do with what your business needs — from individual career growth to real-time resource deployment.

---

## Table of Contents

1. [The Problem We Solve](#1-the-problem-we-solve)
2. [What SkillSphere Is](#2-what-skillsphere-is)
3. [Tech Stack](#3-tech-stack)
4. [How to Navigate the App](#4-how-to-navigate-the-app)
5. [Feature Walkthrough by Role](#5-feature-walkthrough-by-role)
   - [Admin](#51-admin--platform-configuration)
   - [Manager](#52-manager--team-intelligence)
   - [Employee](#53-employee--my-workspace)
6. [Resourcing CoLab — The AI Command Centre](#6-resourcing-colab--the-ai-command-centre)
7. [AI Features Deep-Dive](#7-ai-features-deep-dive)
8. [Data Model — What We Track](#8-data-model--what-we-track)
9. [End-to-End Demo Flow](#9-end-to-end-demo-flow)
10. [Key Differentiators](#10-key-differentiators)

---

## 1. The Problem We Solve

Consulting and professional services firms face three silent crises every day:

| Problem | What happens today | Cost |
|---|---|---|
| **Skills are invisible** | No one knows who knows what until a project is staffed | Wrong people on wrong projects |
| **Gaps go unmanaged** | Employees don't know what they need to learn for the next level | Attrition, missed promotions |
| **Resourcing is reactive** | Managers email around, check spreadsheets, miss pipeline | Revenue leakage, over/under allocation |

SkillSphere fixes all three in one platform.

---

## 2. What SkillSphere Is

SkillSphere is a **full-stack enterprise platform** with three interconnected layers:

```
┌──────────────────────────────────────────────────────────────┐
│  PEOPLE LAYER                                                │
│  Skills · Gaps · Learning · Career Transitions · Reports     │
├──────────────────────────────────────────────────────────────┤
│  INTELLIGENCE LAYER                                          │
│  Talent Discovery · Analytics · Skill Mapping                │
├──────────────────────────────────────────────────────────────┤
│  RESOURCING LAYER  ← Resourcing CoLab                        │
│  Match Engine · Health Radar · Forecasting · RM Copilot AI   │
└──────────────────────────────────────────────────────────────┘
```

**Three user roles. One platform.**

- **Admin** — configures the platform, manages all data, runs analytics, uses the full Resourcing CoLab
- **Manager** — approves team skills, views team reports, tracks learning, runs feedback cycles
- **Employee** — submits skills, views their gaps, plans their career, documents project experience

---

## 3. Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router) · TypeScript 5 strict · Tailwind CSS 4 · shadcn/ui |
| Backend | Next.js Server Actions (no REST API needed) · Server Components |
| Database | PostgreSQL 16 (production) / SQLite (dev) · Prisma ORM 6 |
| Auth | NextAuth.js v5 · JWT sessions · RBAC middleware |
| AI | Google Gemini API (`gemini-1.5-pro` + `gemini-1.5-flash`) |
| ETL | Node.js · csv-parse · xlsx · custom ingest pipeline (8 reference files) |
| UI Components | Recharts (analytics) · Radix UI · Sonner (toasts) · Framer Motion |

**Architecture principle:** Server Components fetch data directly from Prisma — no API round-trips. Server Actions handle mutations with built-in CSRF protection. This keeps the stack simple and fast.

---

## 4. How to Navigate the App

### Login
Go to `http://localhost:3000` → you are redirected to `/login`.

After login, the sidebar changes based on your role:

```
ADMIN sees:
  Administration ──── Dashboard · Config · Employee Mapping · Skill Mapping
                      Users & Permissions · Talent Discovery · Resource Management
                      Feedback & Promotion
  Resourcing CoLab ── Match Engine · Health Radar · Simulator · Pipeline Outlook
                      Allocations · RM Copilot
  My Workspace ────── (same as Employee)

MANAGER sees:
  Team Management ─── Team Skills · Approvals · Team Reports · Team Learning · Feedback
  My Workspace ────── (same as Employee)

EMPLOYEE sees:
  My Workspace ────── My Skills · Skill Gaps · Learning Paths · Transition Path
                      My Report · Project Experience
```

---

## 5. Feature Walkthrough by Role

---

### 5.1 Admin — Platform Configuration

#### Dashboard (`/admin/analytics`)
The home screen for admins. Shows platform-wide metrics:
- Total employees, total skills, approval rates
- Skill coverage heatmaps per Centre of Excellence (COE)
- Competency distribution charts per designation level
- Built with Recharts — interactive, filterable charts

#### Configuration (`/admin/config`)
One-stop admin panel for three setup entities:

| Sub-page | What it manages |
|---|---|
| **COE Management** | Centres of Excellence (e.g., Data Engineering, Cloud, Analytics). Every employee belongs to one COE. |
| **Designation Management** | Job levels (e.g., Associate Consultant → Consultant → Senior → Principal). Each designation has required skills. |
| **Competency Levels** | The 1–5 scale used everywhere: 1=Awareness, 2=Beginner, 3=Working, 4=Advanced, 5=Expert |

> All three are CRUD panels — create, edit, delete. Changes cascade into skill mappings automatically.

#### Skill Management (`/admin/skills`)
The master catalogue of all skills in the organisation.

- **5 categories:** SKILL · FRAMEWORK · CONCEPT · TOOL · CERTIFICATION
- Examples: `Python` (SKILL), `Databricks` (FRAMEWORK), `CI/CD` (CONCEPT), `Power BI` (TOOL), `AWS SAA` (CERTIFICATION)
- Filterable by category, searchable by name
- Used everywhere — skill mappings, employee submissions, gap analysis, project requirements

#### Skill Mapping (`/admin/skill-mapping`)
Two-tab panel connecting skills to the org structure:

**COE → Skills tab:** "The Data Engineering COE needs Python at level 3 minimum, Spark at level 4, SQL at level 3."

**Designation → Skills tab:** "A Senior Consultant must have Cloud Architecture at level 3 and Stakeholder Management at level 4."

This mapping drives the gap analysis engine — without it, gaps cannot be computed.

#### Employee Mapping (`/admin/employee-mapping`)
Assign employees to:
- Their COE (which COE they belong to)
- Their current designation (their job level)
- Their reporting manager

This creates the org hierarchy that drives team-scoped reporting and approvals.

#### Users & Permissions (`/admin/users`)
Manage platform access:
- Create, edit, deactivate user accounts
- Assign roles: ADMIN / MANAGER / EMPLOYEE
- Each user is linked to an employee profile

#### Talent Discovery (`/admin/talent-discovery`)
Search the entire organisation for people with specific skills at specific levels:

1. Select one or more skills
2. Set minimum competency level per skill
3. See all matching employees ranked by fit

Used by resourcing managers when staffing a new project manually.

#### Resource Management (`/admin/resource-management`)
Project portfolio management:
- Create/edit projects with full metadata (client, status, category, billing rate, pipeline stage)
- Add skill requirements to a project ("this project needs 2× Python L4, 1× Power BI L3")
- Allocate employees to projects with start/end dates and allocation %

The data here feeds into the Resourcing CoLab analytics.

#### Feedback & Promotion (`/admin/feedback/cycles`)
360° feedback and promotion readiness engine:
- Create **review cycles** (DRAFT → ACTIVE → CLOSED)
- Build **feedback forms** with custom sections and questions (RATING or TEXT type)
- Three form types: PM Feedback · CDM Assessment · HR Feedback
- Assign reviewers to reviewees
- Generate **promotion readiness scores** (composite of all feedback responses)

---

### 5.2 Manager — Team Intelligence

#### Team Skills (`/manager/team-skills`)
A full view of every skill across the manager's direct reports:
- Which employee has which skill at which level
- Approval status of each skill (PENDING / APPROVED / REJECTED)
- Identify team-wide skill gaps at a glance

#### Approvals (`/manager/approvals`)
The manager's action queue. When an employee submits a skill claim, it lands here.

**Approval flow:**
1. Employee submits: "I have Python at level 4"
2. Appears in manager's queue with supporting evidence
3. Manager reviews: sets the **validated level** (may differ from self-assessed)
4. Approve → skill becomes part of the employee's verified profile
5. Reject → employee gets a reason/comment

This validation step is what makes skill data trustworthy.

#### Team Reports (`/manager/team-reports`)
Aggregated view of the entire team:
- Skill coverage vs. COE requirements
- Who has gaps in required skills
- Learning completion rates
- Useful for 1:1 conversations and team planning

#### Team Learning (`/manager/team-learning`)
Track the team's progress through assigned learning paths.

#### Feedback (`/manager/feedback`)
Run and review feedback cycles for direct reports. See individual feedback scores and readiness summaries.

---

### 5.3 Employee — My Workspace

#### My Skills (`/employee/my-skills`)
The employee's skill portfolio — the starting point of everything.

**How to submit a skill:**
1. Click "Add Skill"
2. Select the skill from the catalogue
3. Set your self-assessed level (1–5)
4. Optionally attach evidence:
   - **Certification** — uploaded certificate
   - **Assessment Score** — test result
   - **Project Document** — work artifact
   - **Supporting Document** — any other proof
5. Submit → goes to manager for approval

Status track: `PENDING → APPROVED / REJECTED`

Only **APPROVED** skills count in gap analysis and talent discovery.

#### Skill Gaps (`/employee/skill-gaps`)
Shows the gap between what the employee has (approved skills) and what their current designation requires (from the Designation → Skills mapping).

For each skill in the designation:
- Current level vs. required level
- Gap size (how many levels to close)
- Color-coded: green = met, amber = close, red = gap

This page answers: **"What do I need to learn to fully qualify for my current role?"**

#### Learning Paths (`/employee/learning-paths`)
Curated learning resources to close skill gaps:
- Each path is linked to a specific skill
- Contains multiple **learning items**: VIDEO · ARTICLE · COURSE · BOOK · WORKSHOP · PODCAST
- Employee can track progress through each item
- Admin creates and manages the path catalogue

#### Transition Path (`/employee/transition-path`)
Career planning for the next promotion:

1. Employee selects a **target designation** (the next level up)
2. Platform computes: "To reach Senior Consultant from Consultant, you still need..."
3. Shows the gap to the target role — separate from the current-role gap
4. Manager can formally **endorse** the transition plan

This answers: **"What do I need to learn for my next promotion?"**

#### My Report (`/employee/my-report`)
A personal skills dashboard summarising:
- Profile overview (COE, designation, tenure)
- Approved skill inventory
- Gap summary
- Learning progress
- Achievement highlights

#### Project Experience (`/employee/my-experience`) ← *New*
The newest feature — turns project work into verified skills.

**The full flow:**
1. Employee clicks **"Add Experience"** after completing a project
2. Fills in:
   - Project title and type (Reporting / Data Migration / Platform Build / Analytics / Exit Transition / etc.)
   - Client industry, team size, their specific role
   - Tech stack used (comma-separated: "Python, Spark, Databricks, Azure DevOps")
   - Business context — what problem was being solved
   - Solution provided — what they personally built or delivered
3. Saves the document
4. Clicks **"Extract Skills with AI"**
5. **Gemini AI reads the description** and returns:
   - A list of skills with inferred competency levels (1–5)
   - A reasoning note for each skill ("Led the architecture — level 4")
   - A 2–3 sentence summary of what the employee demonstrated
6. Employee reviews the extracted skills, **checks/unchecks** each one
7. Clicks **Apply** → selected skills are submitted as PENDING to the manager

> The skill extraction uses `gemini-1.5-pro` with structured JSON output and Zod validation. Level inference follows: "led/architected = 4–5, built/implemented = 3–4, used/worked with = 2–3, exposure = 1–2."

**Why this matters for resourcing:** Project experience documents feed into the Match Engine — employees who have documented relevant project work get a higher evidence score when being recommended for similar projects.

---

## 6. Resourcing CoLab — The AI Command Centre

This is SkillSphere's most advanced module. Available to **ADMIN only**. Powered by Google Gemini AI.

> **Concept:** Resourcing CoLab is a real-time intelligence layer on top of project data, timesheets, and skills — answering the hardest question in consulting: *"Who do we put on what, when?"*

The data comes from an ETL pipeline that ingests 8 reference files:
- Employee roster, project allocations, timesheets, skill assessments, competencies, pipeline requests, weekly project statuses, utilisation snapshots

---

### Match Engine (`/admin/resourcing/match`)
**"Who should I put on this project?"**

Select a pipeline request (an incoming project) and instantly see a ranked shortlist of employees scored on 5 dimensions:

| Dimension | What it measures | Weight |
|---|---|---|
| **Skill Score** | How many required skills they have at the right level | 35% |
| **Competency Score** | Consulting behaviour ratings (from assessments) | 25% |
| **Availability Fit** | How much of their time is free (from timesheet utilisation) | 20% |
| **Billability Fit** | Whether moving them to this project recovers bench cost | 10% |
| **Evidence Strength** | How much proof exists for their skills + relevant project experience | 10% |

Each result shows:
- **Match Score** (0–100) with colour-coded confidence
- Skill-by-skill breakdown — which skills are met/unmet
- Signal badge: `REDEPLOY` (ready now) · `PARTIAL_HIRE` (partial match) · `HIRE` (need external hire)
- **AI Match Rationale** — a 2–4 sentence Gemini-generated explanation: *"EMP744 is a strong fit for this analytics project. They have validated Python L4 and Databricks L3, and their project experience includes a similar BI migration for a financial services client."*

### Health Radar (`/admin/resourcing/health`)
**"Which of my active projects are at risk?"**

Pulls RAG status signals from weekly project reporting and combines them with:
- Timesheet data (is anyone not logging hours = shadow resource?)
- Billability trends (are hours being billed or leaking?)
- Shadow flags (people allocated on paper but not timesheet-logging)

**AI Root Cause Analysis:** Gemini reads the combined signals and produces a 3-sentence diagnosis: *"PROJECT_127_002 is showing red on scope and amber on schedule. Billability dropped 18% last week with two shadow resources detected. Likely cause: scope creep without allocation adjustment — recommend immediate resource review."*

### Capacity Simulator (`/admin/resourcing/simulator`)
**"What if we win this deal — can we staff it?"**

Input a hypothetical project:
- Required skills and levels
- Start date, duration, team size

The simulator models demand vs. current supply and shows:
- FTE gap by skill
- Which employees could be redeployed
- Risk level (GREEN / AMBER / RED) with rationale

### Pipeline Outlook (`/admin/resourcing/outlook`)
**"What's coming in the next 6 months?"**

A forward-looking view of all pipeline requests by:
- Month of expected start
- Cluster / COE
- Probability-weighted headcount demand

**AI Forecast Narrative:** Gemini generates an executive early-warning: *"Q3 shows a critical gap in Data Engineering capacity — 4 FTE demand against 1.5 available. The first shortfall hits July. Recommend accelerating hiring for Senior Data Engineers or upskilling 2× Associate consultants from the Analytics pool."*

### Live Allocation Board (`/admin/resourcing/allocations`)
**"Who is doing what right now?"**

A live view of every employee showing:
- Employee Code
- Role / Job Name
- COE
- Number of active project allocations
- **Actual utilisation %** (from last 4 weeks of timesheets — real, not estimated)
- **Billable utilisation %** (how much of their time is on billable work)
- Status: `Fully allocated` · `Under-utilised` · `Over-allocated` · `Bench`
- `Data drift` flag when timesheet data is missing for allocated employees

### RM Copilot (`/admin/copilot`)
**"I need to answer a staffing question right now."**

A conversational AI assistant backed by real platform data. The user asks a free-text question, and Gemini:
1. Decides which **tool(s)** to call (from 6 available)
2. Executes tool calls using real DB data
3. Synthesises results into a **decision-first answer**

**Available tools the Copilot can call:**
| Tool | What it does |
|---|---|
| `recommend_resources` | Rank employees for a pipeline request or ad-hoc skill set |
| `forecast_new_projects` | Model headcount needs for hypothetical new work |
| `get_pipeline_forecast` | 6-month demand vs supply by cluster |
| `get_project_health` | RAG signals + billability + shadow resource flags |
| `get_allocation_report` | Full utilisation report for all or filtered employees |
| `get_availability` | Available FTE for a role/skill in a given date window |

**Example questions:**
- *"Who can I put on a Python ML project starting next month?"*
- *"Which projects are at risk this week?"*
- *"How many data engineers do I have free in Q3?"*
- *"Is EMP744 available and what are they currently working on?"*

The Copilot answers in the format: **Decision → Evidence → Caveats** — not a wall of data, a recommendation.

---

## 7. AI Features Deep-Dive

All AI runs through `src/lib/ai/` — never exposed to the client, never called from components.

| Feature | Model | Input | Output |
|---|---|---|---|
| Match Rationale | `gemini-1.5-pro` | Skill scores + employee profile | 2–4 sentence fit explanation |
| Health Root-Cause | `gemini-1.5-pro` | RAG trends + billability + shadow flags | 3-sentence diagnosis |
| Forecast Narrative | `gemini-1.5-pro` | 6-month demand/supply matrix | Executive early-warning with first shortfall date |
| Data Coverage Check | Deterministic | DB record counts | Confidence level: HIGH/MEDIUM/LOW + improvement tips |
| Experience Extractor | `gemini-1.5-pro` | Free-text project description | Structured JSON: skills + levels + reasoning + summary |
| RM Copilot | `gemini-1.5-pro` | User question + tool results | Decision-first answer (up to 5 tool-call rounds) |

**AI safety principles applied:**
- User content is always wrapped in `<project>` XML delimiters — prompt injection protection
- Every AI response is validated with **Zod** before being used
- All AI calls have a **timeout** (race against a Promise.reject) — graceful degradation to deterministic fallback if Gemini is slow
- Rate limiting: per-session guard on Copilot
- API key is server-only — never in the client bundle

---

## 8. Data Model — What We Track

**33 database models** organised into 5 domains:

```
ORGANISATION          SKILLS                LEARNING
─────────────         ──────────────        ──────────────
User                  Skill                 LearningPath
Employee              CoeSkill              LearningItem
Coe                   DesignationSkill
Designation           EmployeeSkill         FEEDBACK
CompetencyLevel       Evidence              ReviewCycle
                      ProjectExperienceDoc  FeedbackForm
PROJECTS                                    FeedbackFormSection
─────────────         RESOURCING            FeedbackFormQuestion
Project               Timesheet             FeedbackFormAssignment
ProjectSkillReq       Competency            FeedbackSubmission
ProjectAllocation     PipelineRequest       FeedbackResponse
RoleMixTemplate       WeeklyStatus          FeedbackSummary
Leave                 UtilisationSnapshot
                      ShadowFlag
                      IngestReport
```

**Key relationships to understand:**
- `Employee` → `Coe` + `Designation` + `Manager (Employee)` — org hierarchy
- `EmployeeSkill` → `Skill` + `Employee` — with `status: PENDING|APPROVED|REJECTED` and both self-assessed and manager-validated levels
- `Evidence` → `EmployeeSkill` — proof attached to a skill claim
- `ProjectExperienceDoc` → `Employee` — AI-extracted experience with lifecycle `DRAFT→EXTRACTED→APPLIED`
- `UtilisationSnapshot` — pre-computed weekly metrics derived from timesheets (truth source for the Allocation Board)

---

## 9. End-to-End Demo Flow

Here is a recommended demo script that covers the platform end-to-end in ~10 minutes:

---

### Part A — Employee Growth Story (5 min)

**Step 1 — Employee logs in**
> Navigate to `/employee/my-skills`
- Show the existing skill portfolio
- Explain: approved skills are the verified profile

**Step 2 — Add a skill manually**
> Click "Add Skill" → select "Python" → self-assess at Level 4 → submit
- Status shows PENDING

**Step 3 — Add project experience**
> Navigate to `/employee/my-experience`
- Click "Add Experience"
- Fill in: "ETL Pipeline for Financial Client" | Reporting | Industry: Banking | Role: Lead Data Engineer | Tech: Python, Spark, Azure Data Factory, Databricks | Describe what they built
- Save → click "Extract Skills with AI"
- *Watch Gemini analyse the description and return a skill list with levels and reasoning*
- Review extracted skills → apply selected ones

**Step 4 — Check the gap**
> Navigate to `/employee/skill-gaps`
- Show which skills are met and which are missing for the current designation
- Navigate to `/employee/transition-path` → show the gap to the next level

---

### Part B — Manager Approval Flow (2 min)

**Step 5 — Manager logs in**
> Navigate to `/manager/approvals`
- The skill submitted in Step 2 is waiting
- Click Approve → set validated level (can adjust from self-assessed)
- Return to employee view — skill is now APPROVED

---

### Part C — Resourcing Intelligence (3 min)

**Step 6 — Admin opens Resourcing CoLab**
> Navigate to `/admin/resourcing/match`
- Select a pipeline request (e.g., a data analytics project)
- Watch the ranked shortlist appear with match scores
- Click on the top result — show the AI rationale explaining the recommendation

**Step 7 — RM Copilot**
> Navigate to `/admin/copilot`
- Type: *"Who should I put on a Python ML project starting next month?"*
- Watch Gemini call `recommend_resources` and return a structured recommendation

**Step 8 — Allocation Board**
> Navigate to `/admin/resourcing/allocations`
- Show real utilisation data — who is at 99%, who is on bench
- Point out the Status badges and what they mean for capacity planning

---

## 10. Key Differentiators

### 1. Skills have evidence, not just assertions
Every approved skill has been reviewed by a manager and optionally backed by a certification, assessment score, or project document. This makes the skill data trustworthy for resourcing.

### 2. AI extracts skills from work, not just surveys
The Project Experience feature turns prose descriptions of project work into a structured skill profile. Employees document *what they built*; AI translates that into *what they can do*.

### 3. The gap engine is bidirectional
- **Current role gap:** "What do you need to fully qualify for your current designation?"
- **Transition gap:** "What do you need for your next promotion?"
- **Project fit gap:** "Which required skills does this employee not have for this project?"

### 4. Resourcing is evidence-driven, not guess-driven
The Match Engine scores candidates on 5 weighted dimensions using real timesheet data, validated skills, and project experience. The Copilot then explains the recommendation in plain language.

### 5. Fully integrated lifecycle
```
Employee submits skill
    ↓
Manager approves (with validated level)
    ↓
Skill enters verified profile
    ↓
Gap analysis updates automatically
    ↓
Employee appears in Talent Discovery
    ↓
Match Engine recommends them for projects
    ↓
Project experience → new skills extracted by AI
    ↓  (loop)
```

Everything feeds everything else. One action by an employee ripples into resourcing intelligence.

---

## Quick Reference — All Routes

| Route | Role | What it is |
|---|---|---|
| `/login` | All | Authentication |
| `/admin/analytics` | Admin | Platform-wide analytics dashboard |
| `/admin/config` | Admin | COE / Designation / Competency Level management |
| `/admin/employee-mapping` | Admin | Assign employees to COE/designation/manager |
| `/admin/skill-mapping` | Admin | Map skills to COEs and designations with target levels |
| `/admin/users` | Admin | User accounts and role management |
| `/admin/talent-discovery` | Admin | Search employees by skill and level |
| `/admin/resource-management` | Admin | Project CRUD and employee allocation |
| `/admin/feedback/cycles` | Admin | Feedback cycle and form management |
| `/admin/resourcing/match` | Admin | AI-powered match engine |
| `/admin/resourcing/health` | Admin | Project health radar with AI root cause |
| `/admin/resourcing/simulator` | Admin | Capacity simulation for new projects |
| `/admin/resourcing/outlook` | Admin | 6-month pipeline demand forecast |
| `/admin/resourcing/allocations` | Admin | Live allocation board with real utilisation |
| `/admin/copilot` | Admin | Agentic RM Copilot (natural language) |
| `/manager/team-skills` | Manager | Full team skill view |
| `/manager/approvals` | Manager | Pending skill approval queue |
| `/manager/team-reports` | Manager | Team skill summary report |
| `/manager/team-learning` | Manager | Team learning progress |
| `/manager/feedback` | Manager | Feedback cycle participation |
| `/employee/my-skills` | Employee | Personal skill portfolio + submission |
| `/employee/skill-gaps` | Employee | Gap vs current designation |
| `/employee/learning-paths` | Employee | Curated learning resources |
| `/employee/transition-path` | Employee | Gap vs target designation |
| `/employee/my-report` | Employee | Personal skills report |
| `/employee/my-experience` | Employee | Project experience + AI skill extraction |

---

*Built for the JManGroup Hackathon 2026 · SkillSphere v1.0*
