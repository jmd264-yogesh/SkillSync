# Codebase Current State — SkillSphere Platform

_Generated: 2026-06-30 | Covers actual implemented code, not planned modules_

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
| AI | Google Gemini API via `@google/generative-ai` — `gemini-1.5-pro` / `gemini-1.5-flash` |
| Excel Export | SheetJS (`xlsx` v0.18.5 CE) — cell styles, freeze rows, autofilter |
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
│   │   │   ├── copilot/           # RM Copilot chat page + copilot-chat.tsx
│   │   │   ├── designations/      # Designation management
│   │   │   ├── employee-mapping/  # Employee → COE/Designation/Manager assignment
│   │   │   ├── feedback/
│   │   │   │   └── cycles/        # Review cycle list
│   │   │   │       └── [cycleId]/
│   │   │   │           ├── page.tsx
│   │   │   │           ├── forms/page.tsx
│   │   │   │           └── employee/[employeeId]/page.tsx
│   │   │   ├── resource-management/ # Legacy project + allocation management
│   │   │   ├── resourcing/        # Resourcing CoLab (Module 15)
│   │   │   │   ├── allocations/   # Allocation Board + rolling-off strip
│   │   │   │   │   ├── page.tsx
│   │   │   │   │   ├── alloc-table-client.tsx
│   │   │   │   │   └── rolling-off-strip.tsx
│   │   │   │   ├── health/        # Health Radar (RAG signals per project)
│   │   │   │   │   ├── page.tsx
│   │   │   │   │   └── health-client.tsx
│   │   │   │   ├── match/         # Match Engine (skill × competency scoring)
│   │   │   │   │   ├── page.tsx
│   │   │   │   │   ├── match-client.tsx
│   │   │   │   │   └── excel-download-button.tsx
│   │   │   │   ├── outlook/       # Pipeline Outlook (6-month demand/supply)
│   │   │   │   │   ├── page.tsx
│   │   │   │   │   └── outlook-table-client.tsx
│   │   │   │   └── simulator/     # Capacity Simulator
│   │   │   │       ├── page.tsx
│   │   │   │       └── simulator-client.tsx
│   │   │   ├── skill-mapping/
│   │   │   ├── skills/
│   │   │   ├── talent-discovery/
│   │   │   └── users/
│   │   ├── manager/
│   │   │   ├── approvals/
│   │   │   ├── feedback/
│   │   │   ├── team-reports/
│   │   │   └── team-skills/
│   │   └── employee/
│   │       ├── learning-paths/
│   │       ├── my-report/
│   │       ├── my-skills/
│   │       ├── skill-gaps/
│   │       └── transition-path/
│   └── api/auth/[...nextauth]/
├── server/
│   ├── actions/                   # All mutations
│   │   ├── allocation-report.ts   # getEmployeeAvailabilityReport()
│   │   ├── approval.ts
│   │   ├── coe.ts / competency-level.ts / designation.ts
│   │   ├── copilot.ts             # runCopilotTurn() server action
│   │   ├── employee.ts / employee-skill.ts
│   │   ├── export-resource-excel.ts # downloadResourceExcel() → base64 xlsx
│   │   ├── feedback-assignment.ts / feedback-form.ts / feedback-submission.ts
│   │   ├── forecast.ts            # getForecastAction()
│   │   ├── gap-analysis.ts / learning-paths.ts / my-skills.ts
│   │   ├── project-health.ts      # getProjectHealthAction()
│   │   ├── proposition-simulator.ts # simulateProposition() — baseline lookup + AI recommendation
│   │   ├── recommendation.ts      # recommendForPipelineRequest(), recommendAdHoc(), getPipelineRequests()
│   │   ├── resource-management.ts
│   │   ├── review-cycle.ts
│   │   ├── skill.ts / skill-mapping.ts
│   │   ├── talent-discovery.ts
│   │   ├── team-reports.ts
│   │   ├── transition-path.ts
│   │   └── user.ts
│   └── services/
│       ├── availability.service.ts  # getEmployeeAvailability(), getAvailableFTE()
│       ├── excel-export.service.ts  # buildResourceExcel() — SheetJS pipeline export
│       ├── forecast.service.ts      # forecastNewProjects(), getPipelineOutlook()
│       ├── health.service.ts        # getProjectHealth()
│       └── matching.service.ts      # computeMatchRanking() — core scoring engine
├── components/
│   ├── ui/                          # shadcn/ui primitives (16 components)
│   ├── forms/                       # Form dialogs (9 components)
│   ├── layouts/                     # app-sidebar.tsx, dashboard-header.tsx
│   └── shared/
│       ├── agent-trace.tsx          # Collapsible AI tool-call trace panel
│       ├── confirm-dialog.tsx
│       ├── data-table.tsx
│       ├── decision-card.tsx        # Score bars + confidence badge + decision variant
│       ├── empty-state.tsx
│       ├── markdown-message.tsx     # Renders AI markdown responses safely
│       └── page-header.tsx
├── lib/
│   ├── ai/
│   │   ├── client.ts               # Gemini genAI singleton + MODELS constants
│   │   ├── confidence.ts           # Data coverage quality check (deterministic)
│   │   ├── narrative.ts            # Forecast executive early-warning narrative
│   │   ├── rationale.ts            # explainMatch() — match rationale for Excel + UI
│   │   ├── rootcause.ts            # Project health root-cause narrative
│   │   ├── agent/
│   │   │   ├── guardrails.ts       # GUARDRAIL_NOTE + AgentStep type
│   │   │   ├── health-triage.ts    # Agentic health triage loop
│   │   │   ├── plan-builder.ts     # buildStaffingPlans() — multi-plan agentic builder
│   │   │   ├── reallocation.ts     # Reallocation candidate proposals
│   │   │   ├── registry.ts         # Agent type registry
│   │   │   └── runtime.ts          # runAgent() — generic tool-use loop
│   │   └── copilot/
│   │       ├── agent.ts            # runCopilotTurn() — tool dispatch + context management
│   │       └── tools.ts            # COPILOT_TOOLS — 7 Gemini function declarations
│   ├── auth.ts
│   ├── constants.ts                # MATCH_WEIGHTS, ENGAGEMENT_PHASES, CRITICALITY_LEVELS, SOLUTION_TYPES, SERVICE_LINES, PROPOSITION_ROLES, SOURCE_SYSTEMS
│   ├── db.ts
│   ├── errors.ts
│   ├── historical-allocations.ts   # HISTORICAL_ALLOCATIONS lookup table (34 rows), lookupBaseline(), HISTORICAL_REFERENCE_TABLE (AI prompt string)
│   ├── role-mapping.ts             # normalizeResourceRequest() + employeeMatchesRole() — canonical role lookup
│   └── utils.ts
├── scripts/
│   ├── etl/ingest.ts               # ETL: ingests 8 reference files into DB
│   └── export-resource-excel.ts    # CLI: pnpm export:excel → out/07_Pipeline_Details_UPDATED.xlsx
├── middleware.ts
├── types/index.ts
└── validations/
    ├── admin.schema.ts / auth.schema.ts / employee.schema.ts
    ├── feedback.schema.ts
    ├── resourcing.schema.ts         # recommendForPipelineSchema, recommendAdHocSchema
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
| `Employee` | id, employeeCode (unique business key), name, email, jobName, department, location, coeId, designationId, managerId (self-ref), dateOfJoin, dateOfResignation, externalId |

**Note:** `employeeCode` is the primary display identifier for all user-facing output (e.g. "EMP042"). The UUID `id` is used internally for DB joins and React keys only.

### Skills
| Model | Key Fields |
|-------|-----------|
| `Skill` | id, name (unique), description, category |
| `CoeSkill` | coeId + skillId, targetCompetency |
| `DesignationSkill` | designationId + skillId, targetCompetency |
| `EmployeeSkill` | employeeId + skillId, selfAssessedLevel, validatedLevel, status, reviewComment, reviewedBy, reviewedAt |
| `Evidence` | employeeSkillId, type, title, description, fileUrl, score, issuedAt, expiresAt |
| `ExperienceDoc` | employeeId, docUrl, extractionStatus, techStack, extractedSkills (JSON) |
| `Competency` | employeeId, dimension (5 consulting behaviours), score (1–5) |

### Learning
| Model | Key Fields |
|-------|-----------|
| `LearningPath` | id, title, skillId, fromLevel, toLevel |
| `LearningItem` | learningPathId, title, type, url, duration, order |

### Resource Management (Legacy + CoLab)
| Model | Key Fields |
|-------|-----------|
| `Project` | id, name, domain, startDate, endDate, status (PLANNING/ACTIVE/COMPLETED/ON_HOLD), category (ProjectCategory enum) |
| `ProjectSkillRequirement` | projectId + skillId, requiredLevel, headcount, priority |
| `ProjectAllocation` | projectId + employeeId, allocation %, role, startDate, endDate |
| `Timesheet` | employeeId, projectId, weekStart, hoursLogged, billableHours |
| `UtilisationSnapshot` | employeeId, weekStart, utilisation (0–1), billableUtil (0–1) |
| `ShadowFlag` | employeeId, projectId, weekStart, shadowHours |
| `WeeklyStatus` | projectId, weekStart, ragStatus (GREEN/AMBER/RED), notes |

### Pipeline & Resourcing CoLab
| Model | Key Fields |
|-------|-----------|
| `PipelineRequest` | id, client, requestType, solution, skillset, resourcesRequested, numberOfWeeks, likelyStart, sowSigned (bool), dealStage, cluster, priority, status, comments, **techCoe, propositionCoe, projectKey, reporterExternalId, approverExternalId, clientExternalId, typeOfProject** (all nullable, enriched from project data) |
| `Project` | id, name, …, **projectKey, reporterExternalId, approverExternalId, techCoe, propositionCoe** (nullable enrichment fields) |
| `IngestReport` | id, runAt, totalRows, successRows, errorRows, notes |

### Feedback & Promotion Readiness
| Model | Key Fields |
|-------|-----------|
| `ReviewCycle` | id, name, startDate, endDate, status (DRAFT/ACTIVE/CLOSED/ARCHIVED), createdById |
| `FeedbackForm` | id, title, formType (PM_FEEDBACK/CDM_ASSESSMENT/HR_FEEDBACK), reviewCycleId |
| `FeedbackFormSection` | formId, title, order |
| `FeedbackFormQuestion` | sectionId, text, type (RATING/TEXT), required, order |
| `FeedbackFormAssignment` | reviewCycleId + formId + reviewerId + employeeId, status, dueDate |
| `FeedbackSubmission` | assignmentId (unique), submittedAt |
| `FeedbackResponse` | submissionId + questionId, ratingValue (1–5), textValue |
| `FeedbackSummary` | reviewCycleId + employeeId (unique), compositeScore, promotionStatus |

---

## Resourcing CoLab (Module 15)

### Six Pages Under `/admin/resourcing/`

#### Match Engine (`/resourcing/match`)
- Pipeline request dropdown: label format `[projectKey] · solution — requestType (Cluster N)`
- Context card shows: `typeOfProject` badge, `techCoe` (teal), `propositionCoe` (indigo), `clientExternalId`, `projectKey`, `reporterExternalId`, `approverExternalId`
- Select pipeline request → `recommendForPipelineRequest()` computes ranked candidates
- Scoring: `matchScore = Skill×35% + Competency×25% + Availability×20% + Billability×12% + Evidence×8%`
- Role filtering: `resourcesRequested` parsed by `normalizeResourceRequest()` → `canonicalRoles` → Prisma OR filter on `jobName`
- **COE affinity boost**: +20 pts if candidate has prior allocation on a project matching `techCoe` or `propositionCoe`; shown as "COE Match" teal badge on candidate card
- Result card headline: `[EMP042] Name · JobTitle — Match: 87/100`
- Skill breakdown accordion; signal filter (REDEPLOY / PARTIAL_HIRE / HIRE)
- **Excel Download button** — triggers `downloadResourceExcel()` server action → browser Blob download

##### How Match Engine Scores Candidates
```
1. Role filter: Prisma OR query on jobName for each canonicalRole from normalizeResourceRequest()
2. Skill score:   coverage% × 0.6 + depth% × 0.4  (coverage = skills met / skills required)
3. Competency:    avg(competency scores) / 5 × 100  (from Competency table)
4. Availability:  (1 − avgUtilisation) × 100 + clientTierBoost  (from UtilisationSnapshot)
5. Billability:   (1 − avgBillableUtil) × 100  (lower billable = more available for redeployment)
6. Evidence:      min(totalEvidence×10 + expBoost, 100)
   - expBoost += 15 per ExperienceDoc whose techStack matches required skill names
   - expBoost += 15 if candidate has prior allocation in a matching role
   - expBoost += 20 if coeAffinityMatch (prior project in requested techCoe or propositionCoe)
   - expBoost += 4 per distinct project, capped at 20
7. Final: matchScore = skill×0.35 + comp×0.25 + avail×0.20 + bill×0.12 + evidence×0.08
8. Signal: REDEPLOY (available, skills met), PARTIAL_HIRE (partial fit), HIRE (skill gap)
9. Sort: REDEPLOY → PARTIAL_HIRE → HIRE, then matchScore DESC within each tier
```

##### How Match Engine Feeds Excel Export
The same `computeMatchRanking()` service powers both the UI and the CLI Excel export (`pnpm export:excel`):
- For each pipeline request (SOW-signed first), `normalizeResourceRequest(resourcesRequested)` → canonical roles → `computeMatchRanking()`
- **Pool depletion**: a global `Set<string>` of claimed `employeeCodes`; once assigned, an employee is removed from the pool
- **Availability tiers** (assignment priority): Tier 3 (>50% free) > Tier 2 (>20%) > Tier 1 (>0%) > Tier 0 (fully allocated)
- **Role exact-match guard**: `employeeMatchesRole(jobName, canonicalRoles)` filters pool before scoring
- **AI rationale**: `explainMatch()` called on up to 15 REDEPLOY rows per batch; written to column "AI Rationale" in Excel
- Output columns appended to pipeline Excel: Employee ID (employeeCode), Match Score, Skill Score, Competency Score, Signal, Recommended Action, Unmet Skills, Plan, AI Rationale, Confidence

#### Health Radar (`/resourcing/health`)
- Per-project RAG signals: billability leakage %, shadow resource count, releasable FTE, ramp-down detection
- `health-client.tsx` with COE + status filters

#### Capacity Simulator (`/resourcing/simulator`)
Redesigned as a role-mix simulator for upcoming pipeline projects using historical project patterns.

**Inputs:** Proposition (service line) · Project Type (17 SOLUTION_TYPES) · Phase (Design & Discovery / Build) · Criticality (Stable / Medium / High) · Start Date · Weeks + optional Source Systems chips + optional Additional Context textarea

**Two outputs shown side-by-side after running:**

1. **Historical Baseline** (deterministic — no AI)
   - `lookupBaseline(projectType, phase, criticality)` queries `HISTORICAL_ALLOCATIONS` (34 rows in `src/lib/historical-allocations.ts`)
   - If exact match found: shows FTE counts per role (e.g. "0.25 FTE Technical Solutions Architect")
   - If no match: shows a "no exact match" placeholder with nearest-pattern guidance

2. **AI Recommendation** (Gemini `gemini-1.5-pro` via `simulateProposition()`)
   - System prompt includes the full `HISTORICAL_REFERENCE_TABLE` as a grounding blueprint
   - AI must anchor closely to historical patterns; deviations require justification in narrative
   - Returns percentage allocation across all 19 canonical proposition roles (UK + Chennai panels)
   - If `phase`/`criticality` selected and baseline found → specific baseline FTE counts embedded in AI prompt as primary anchor
   - Source systems bias: each system increases Chennai engineering role % (SSE, SW, SE, TA)
   - Additional context: optional free-text, wrapped in `<context>` tags in AI prompt

**Constants added:** `ENGAGEMENT_PHASES` (const array), `CRITICALITY_LEVELS` (const array) in `src/lib/constants.ts`
**Types exported:** `EngagementPhase`, `CriticalityLevel` (from constants), `BaselineAllocation`, `RoleAllocation`, `PropositionSimulatorResult` (from server action)

#### Pipeline Outlook (`/resourcing/outlook`)
- 6-month demand vs supply by cluster/month
- `outlook-table-client.tsx` with cluster + month filters

#### Allocation Board (`/resourcing/allocations`)
- Employee utilisation table: employeeCode, jobName, COE, utilisation status (OVER/FULL/UNDER/BENCH)
- Rolling-off strip: employees whose allocations end within 30 days
- Filters: role, COE, status

#### RM Copilot (`/admin/copilot`)
- Chat interface with markdown rendering via `MarkdownMessage`
- 7 tools: `recommend_resources`, `get_availability`, `plan_staffing`, `forecast_new_projects`, `get_pipeline_forecast`, `get_project_health`, `get_allocation_report`
- All tools are role-aware: `recommend_resources` passes `canonicalRoles` from pipeline request or explicit `role` param
- Agent trace panel (collapsible, shows tool calls and results)

### Excel Export (`pnpm export:excel`)
- Source: `reference_files/07. 260624_Pipeline_Details.xlsx` (sheet "Forecast")
- Output: `out/07_Pipeline_Details_UPDATED.xlsx` (3 sheets: Pipeline Resource Plan, Alternates, Summary)
- Fills columns 16–19: Resource Recommended, % Available, Skillset Match
- Appends 10 columns: Employee ID (employeeCode), Match Score, Skill Score, Competency Score, Signal, Recommended Action, Unmet Skills, Plan, AI Rationale, Confidence
- **Pool-depletion model**: global `Set<string>` of claimed employee IDs; each employee assigned at most once
- **SOW-priority**: SOW-signed requests processed first
- **Availability-first**: tier-sorted (Tier 3 >50% free > Tier 2 > Tier 1 > Tier 0); any Tier 3 beats all lower tiers regardless of match score
- **Role matching**: `normalizeResourceRequest(resourcesRequested)` → `employeeMatchesRole(jobName, canonicalRoles)` per-employee filter
- AI rationale: `explainMatch()` on up to 15 REDEPLOY rows (5s timeout, batches of 3, deterministic fallback)

### Role Mapping (`src/lib/role-mapping.ts`)
Single source of truth used by matching, recommendations, availability, plan-builder, copilot, and Excel export.
```typescript
normalizeResourceRequest("AP/P") → { canonicalRoles: ["Associate Partner", "Principal"], count: 1, isEM: false }
normalizeResourceRequest("2 SC (EM)") → { canonicalRoles: ["Senior Consultant"], count: 2, isEM: true }
employeeMatchesRole("Senior Consultant", ["Senior Consultant", "Principal"]) → true
```

### MatchResult Interface
```typescript
interface MatchResult {
  employeeId: string;          // UUID — for React keys and DB joins
  employeeCode: string;        // business key (e.g. "EMP042") — primary display identifier
  name: string;
  jobName: string | null;
  location: string | null;
  skillScore: number;          // 0–100; coverage × depth
  competencyScore: number;     // 0–100; from Competency table
  availabilityFit: number;     // 0–100; (1 − utilisation) × 100 + tierBoost
  billabilityFit: number;      // 0–100; (1 − billableUtil) × 100
  evidenceStrength: number;    // 0–100; expBoost accumulates from docs, role history, COE affinity
  matchScore: number;          // weighted composite
  trainingReadiness: number;   // 0–100; avg competency score
  skillBreakdown: SkillBreakdown[];
  unmetSkills: string[];
  availableFTE: number;        // 0–1
  signal: "REDEPLOY" | "HIRE" | "PARTIAL_HIRE";
  designationName: string | null;
  designationLevel: number | null;
  coeName: string | null;
  noticeDaysRemaining: number | null;  // null = not resigning
  plannedLeaveDays: number;           // total leave days within project window
  previousClients: string[];
  totalProjects: number;
  coeAffinityMatch: boolean;          // true = prior project in requested techCoe or propositionCoe
  riskFlags: RiskFlag[];              // LEAVER, OVER_ALLOCATED, GHOST, SKILL_GAP_FOR_ROLE, ON_LEAVE, UNDER_LEVELLED, LOW_EXPERIENCE, UNDER_UTILIZED
}
```

---

## Implemented Features by Role

### ADMIN

#### Configuration Management, Skill Catalog, Skill Mapping, Employee Management, User & Permissions
(unchanged — see previous sections)

#### Talent Discovery (`/admin/talent-discovery`)
- Search employees by: skill, minimum competency level, COE, designation
- Displays employee's approved skills with levels

#### Resource Management (`/admin/resource-management`)
- Full project CRUD with skill requirements and employee allocations
- Over-allocation guard: blocks if `totalExisting + newAllocation > 100`

#### Analytics Dashboard (`/admin/analytics`)
- KPI cards, COE/Designation distribution charts, skill approval breakdown, readiness score

#### Resourcing CoLab (`/admin/resourcing/`)
See "Resourcing CoLab" section above.

#### Feedback & Promotion (`/admin/feedback/cycles`)
- Review cycle lifecycle (DRAFT → ACTIVE → CLOSED → ARCHIVED)
- Promotion readiness summary: 50% skill readiness + 50% feedback readiness composite

---

### MANAGER
- Skill Approvals, Team Skills, Team Reports, Feedback (unchanged)

### EMPLOYEE
- My Skills, Skill Gaps, Learning Paths, Transition Path, My Report (unchanged)

---

## Server Actions Reference (Resourcing CoLab additions)

### `src/server/actions/recommendation.ts`
- `recommendForPipelineRequest(pipelineRequestId)` — ADMIN/MANAGER; parses `resourcesRequested` via `normalizeResourceRequest`, passes `canonicalRoles` to `computeMatchRanking`
- `recommendAdHoc(input)` — ad-hoc skill match
- `getPipelineRequests()` — ADMIN; returns all pipeline requests ordered by SOW + start date

### `src/server/actions/project-health.ts`
- `getProjectHealthAction(projectIds?)` — ADMIN; returns per-project RAG signals

### `src/server/actions/forecast.ts`
- `getForecastAction(params)` — ADMIN; 6-month demand/supply outlook

### `src/server/actions/allocation-report.ts`
- `getEmployeeAvailabilityReport(filters?)` — ADMIN; utilisation status per employee

### `src/server/actions/copilot.ts`
- `runCopilotTurn(history)` — ADMIN; agentic tool-use loop via Gemini

### `src/server/actions/export-resource-excel.ts`
- `downloadResourceExcel()` — ADMIN; builds Excel buffer via `buildResourceExcel()`, returns `{data: base64, filename}`

---

## Services Reference (Resourcing CoLab)

### `src/server/services/matching.service.ts`
- `computeMatchRanking({ requiredSkills, canonicalRoles?, windowStart?, windowEnd?, topN?, clientTier?, internalFirst?, techCoe?, propositionCoe? })` → `MatchResult[]`
- Role filtering: Prisma `OR` on `jobName contains` for each canonical role
- COE affinity: `+20` to evidenceStrength when candidate has prior allocation in a project with matching `techCoe` or `propositionCoe`
- Internal-first sort: REDEPLOY → PARTIAL_HIRE → HIRE, then matchScore DESC within tier

### `src/server/services/availability.service.ts`
- `getEmployeeAvailability(filters?)` → `EmployeeAvailability[]` — utilisation status, releasableFrom date
- `getAvailableFTE({ role?, skillId?, minSkillLevel?, windowStart, windowEnd })` → free capacity array
  - Role uses `normalizeResourceRequest()` → canonical OR filter; falls back to raw `contains` for unrecognised codes

### `src/server/services/health.service.ts`
- `getProjectHealth(projectIds?)` → per-project RAG signals, leakage, shadow count, releasable FTE

### `src/server/services/forecast.service.ts`
- `forecastNewProjects({ adHoc?, pipelineRequestIds? })` → demand/supply by role + reallocation candidates
- `getPipelineOutlook({ months?, cluster? })` → 6-month pipeline matrix

### `src/server/services/excel-export.service.ts`
- `buildResourceExcel(opts?)` → `Buffer` — full SheetJS pipeline export (see Excel Export section above)

---

## AI Layer

### Client (`src/lib/ai/client.ts`)
- `genAI` — GoogleGenerativeAI singleton using `GOOGLE_AI_API_KEY`
- `MODELS = { primary: "gemini-1.5-pro", fast: "gemini-1.5-flash" }`

### AI Utilities
| File | Function | Purpose |
|------|----------|---------|
| `rationale.ts` | `explainMatch(params)` | 2–4 sentence match rationale for Excel + UI |
| `rootcause.ts` | `explainHealthRootCause(params)` | 3-sentence project health diagnosis |
| `narrative.ts` | `buildForecastNarrative(params)` | Executive early-warning for Pipeline Outlook |
| `confidence.ts` | `checkDataCoverage(params)` | Deterministic data quality check (no AI call) |

### Agentic Runtime (`src/lib/ai/agent/runtime.ts`)
```typescript
runAgent({ system, tools, dispatch, messages, maxRounds, model?, serializeOutput? })
  → { finalText, trace: AgentStep[] }
```
Generic tool-use loop used by all agentic features. Each `AgentStep` records the tool name, input, output, and timestamp.

### RM Copilot (`src/lib/ai/copilot/`)
- `COPILOT_TOOLS` — 7 Gemini function declarations
- `runCopilotTurn(history)` — trims history to last 4 turns, dispatches tools, compacts responses to prevent context explosion
- `recommend_resources` tool: accepts `pipelineRequestId`, `requiredSkills[]`, and/or `role` string (raw code accepted — normalized via `normalizeResourceRequest`)

### Agentic Agents (`src/lib/ai/agent/`)
| File | Export | Purpose |
|------|--------|---------|
| `plan-builder.ts` | `buildStaffingPlans(input[])` | 2–3 distinct staffing plans with health conflict checking |
| `reallocation.ts` | `proposeReallocations(params)` | Find redeployment candidates for a project |
| `health-triage.ts` | `triageProjectHealth(params)` | Agentic health root-cause investigation |
| `guardrails.ts` | `GUARDRAIL_NOTE` | System prompt guardrail text injected into all agents |
| `registry.ts` | — | Agent type registry |

---

## Authentication & Authorization

### Session Shape
```typescript
session.user = { id, email, name, role: UserRole, employeeId: string | null }
```

### RBAC Enforcement
1. Middleware — unauthenticated guard
2. Role layouts (`admin/layout.tsx`, `manager/layout.tsx`) — role guard
3. Server actions — `auth()` (not `getServerSession`) + role check + scope check
4. All Resourcing CoLab actions require `ADMIN` role

### Scope Rules
- Employee: `employeeId` always from `session.user.employeeId`
- Manager: verifies `managerId === session.user.employeeId` before reportee access
- Admin: no scope restriction; all resourcing data is admin-only

---

## UI Component Inventory

### shadcn/ui Primitives (`src/components/ui/`)
Avatar, Badge, Button, Card, Dialog, Dropdown Menu, Input, Label, Progress, Select, Separator, Sheet, Sidebar, Skeleton, Sonner, Table, Tabs, Textarea, Tooltip

### Shared Components (`src/components/shared/`)
| Component | Purpose |
|-----------|---------|
| `agent-trace.tsx` | Collapsible accordion showing AI tool calls (name, input JSON, output preview) |
| `confirm-dialog.tsx` | Reusable confirmation modal |
| `data-table.tsx` | Sortable/filterable table with pagination |
| `decision-card.tsx` | Score bars (Skill, Competency, Availability) + YES/NO/YES_WITH_CONDITIONS badge + confidence badge |
| `empty-state.tsx` | Icon + message + optional CTA |
| `markdown-message.tsx` | Renders AI markdown responses (headers, bold, tables, lists) |
| `page-header.tsx` | Page title + description + `children` slot for action buttons |

### Form Dialogs (`src/components/forms/`)
coe, competency-level, designation, employee, employee-skills, feedback-form-builder, review-cycle, skill, user

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
- **Resourcing CoLab** (group):
  - Match Engine → `/admin/resourcing/match`
  - Health Radar → `/admin/resourcing/health`
  - Capacity Simulator → `/admin/resourcing/simulator`
  - Pipeline Outlook → `/admin/resourcing/outlook`
  - Allocation Board → `/admin/resourcing/allocations`
  - RM Copilot → `/admin/copilot`

### Manager Sidebar
- Team Skills → `/manager/team-skills`
- Approvals → `/manager/approvals`
- Team Reports → `/manager/team-reports`
- Feedback → `/manager/feedback`

### Employee Sidebar
- My Skills → `/employee/my-skills`
- Skill Gaps → `/employee/skill-gaps`
- Learning Paths → `/employee/learning-paths`
- Transition Path → `/employee/transition-path`
- My Report → `/employee/my-report`

---

## Key Business Logic Notes

### Readiness Score Computation (4 places)
```
targetMap = merge(COE + Designation targets, taking higher level when both apply)
met = approved skills where validatedLevel >= targetLevel
readiness% = round(met / total * 100)
```

### Match Score Formula
```
matchScore = skillScore×0.35 + competencyScore×0.25 + availabilityFit×0.20
           + billabilityFit×0.12 + evidenceStrength×0.08
```
Weights live in `lib/constants.ts` as `MATCH_WEIGHTS`.

### Availability Tier (Excel export pool selection)
```
Tier 3: availableFTE > 0.50  (available now — first pick)
Tier 2: availableFTE > 0.20  (partial)
Tier 1: availableFTE > 0.00  (marginal)
Tier 0: availableFTE = 0.00  (fully allocated)
Any Tier 3 employee beats ALL Tier 2 employees regardless of match score.
```

### Role Normalization
Raw codes from `resourcesRequested` → `normalizeResourceRequest(raw)` → `{ canonicalRoles: string[], count, isEM }`.
`canonicalRoles` is an OR list matched against `employee.jobName` via `contains` (case-insensitive).
Supports: single codes (SC, P, AC), multi-role patterns (AP/P, SAC/AC, SSE or SE), EM variants (SC (EM)), count prefixes (2 SE).

### Promotion Summary Scoring
```
skillReadiness  = met / requiredDesignationSkills * 100
feedbackReadiness = avg(all rating responses) / 5 * 100
compositeScore  = round((skillReadiness + feedbackReadiness) / 2)
```

---

## What Is NOT Yet Built

| Feature | Status |
|---------|--------|
| `/manager/team-learning` page | Sidebar link exists, no page file |
| Register page | Public route listed, no page file |
| Email notifications on approval/rejection | Not implemented |
| In-app notification system (badge) | Not implemented |
| PDF export for reports | Not implemented |
| Test files | Zero test files despite test infrastructure set up |
| Bulk approve/reject in approvals | Not implemented |
| Pagination on large tables | Not implemented |
| Manager endorsement for designation transitions | Not implemented |
| AI features for skill gaps / learning paths / reports | Service layer exists; not wired to these pages |
| `pnpm db:migrate` for CoLab schema | Blocked until DATABASE_URL configured |
| `pnpm etl` to seed reference data | Run after migration |
| Excel export from Allocation Board (UI button) | CLI script exists; no UI button yet |
| Response caching for identical AI prompts | Not implemented |

---

_This document reflects the actual code as of 2026-06-28. For planned/aspirational state see `.claude/memory/module-status.md`._
