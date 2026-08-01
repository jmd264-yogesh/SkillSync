# Codebase Deep Review — SkillSync (Skill Matrix Platform)

_Persisted 2026-07-31 after a full read of schema, auth, services, actions, AI layer, and routes.
This is ground-truth from the CODE, not the aspirational docs. Read this first to get productive fast._

---

## 0. Fast Orientation

- **App:** Next.js 16 App Router, TS strict, Prisma 6, NextAuth v5 (JWT/credentials), Tailwind 4 + shadcn/ui, Zustand (UI only), Recharts, Gemini AI, SheetJS Excel.
- **Package manager:** **npm** (`package-lock.json`). Docs say `pnpm` — that's wrong, scripts are `npm run …`.
- **DB provider is SQLite**, not PostgreSQL. `prisma/schema.prisma` line 6 = `sqlite`, `.env` = `DATABASE_URL="file:./dev.db"`. Docs (architecture.md, codebase-current-state.md) claim Postgres 16 — **schema file wins**. `migration_lock.toml` = sqlite. A seeded `dev.db` is committed.
- **Login (from `prisma/seed.ts`):**
  - Admin: `admin@skillmatrix.com` / `admin123456`
  - Managers: `manager123` (e.g. Sarah Jenkins, Michael Vance)
  - Employees: `employee123` (EMP001 Alice Chen … EMP007 Grace Hopper)
- **Run:** `npm run dev` → localhost:3000. `npm run db:seed` reseeds. `npm run etl` ingests reference files (Resourcing CoLab). `npm run export:excel` → `out/07_Pipeline_Details_UPDATED.xlsx`.

---

## 1. Auth & RBAC — how it ACTUALLY works

- **No `src/middleware.ts` exists.** The documented "middleware route-protection layer" is not present. Route protection is layout-based only:
  - `src/app/(dashboard)/layout.tsx` → `auth()`; redirects to `/login` if no session.
  - `src/app/(dashboard)/admin/layout.tsx` → redirects non-ADMIN to `/employee/my-skills`.
  - There is **no `manager/layout.tsx`** guard (only admin has a role layout). Manager pages rely on action-level checks.
- **Session shape** (`src/lib/auth.ts`): `session.user = { id, email, name, role: UserRole, employeeId: string | null }`. Role + employeeId are threaded through the JWT callback.
- **Server actions use `auth()`** (from `@/lib/auth`), NOT `getServerSession()`. The docs' code samples say `getServerSession` — ignore that; real code is `const session = await auth();`.
- **Two divergent action patterns coexist — match the file you're editing:**
  1. **Typed-throw pattern** (newer / resourcing, matches coding-standards): `if (!session) throw new UnauthorizedError(); if (!["ADMIN","MANAGER"].includes(session.user.role)) throw new ForbiddenError();` then `schema.parse(input)`. See `recommendation.ts`, `kanban-resourcing.ts`.
  2. **Return-error-object pattern** (older, e.g. `approval.ts`): `if (!session?.user) return { error: "Not authenticated" };`, reads raw `FormData`, no Zod, returns `{ error }` / `{ success }`.
- **⚠️ Known security gap:** `approval.ts` `approveSkill`/`rejectSkill` do **not** verify the target skill's employee is the manager's reportee. Any authenticated user reaching the action can approve any skill. `security-standards.md` requires a reportee-scope check here — it's missing. (`getPendingApprovals` DOES scope by `managerId` for non-admins, but the mutations don't.) Flag/fix if touching approvals.
- Error classes in `src/lib/errors.ts`: `AppError` base + `UnauthorizedError`(401), `ForbiddenError`(403), `NotFoundError`, `ValidationError`(400), `ConflictError`(409).

---

## 2. Data Model (Prisma) — real model list

38 models. Beyond the documented ones, the schema now includes (from recent Kanban/CoLab work, NOT in codebase-current-state.md):
- **Kanban resourcing:** `ProjectResourcingStatus` (PK = projectId), `ResourceDecision` (Approved/Rejected + JSON justifications), `ResourceSwap`. Keyed by `resourceKey` = `"role-index"` string.
- **Org/people:** `Cluster` (employees grouped, `clusterId`), `Client` (tier GOLD/SILVER/BRONZE), `Leave` (planned/unplanned, feeds availability), `RoleMixTemplate` (category→role→fte baselines).
- **Experience:** `ProjectExperienceDoc` (employee project history, `techStack`, `extractedSkills` JSON, `extractionStatus` DRAFT/EXTRACTED/APPLIED — feeds match evidence boost).
- **CoLab ingest:** `Timesheet`, `Competency` (5 consulting behaviours, `@@unique([employeeId, behaviour])`), `PipelineRequest` (demand side — huge, many nullable enrichment fields), `WeeklyStatus` (RAG signals), `UtilisationSnapshot` (derived weekly), `ShadowFlag` (SHADOW/GHOST), `IngestReport`.

Conventions:
- All DB columns are `snake_case` via `@map`; Prisma fields are camelCase.
- **`employeeCode`** (e.g. "EMP042") is the business/display key everywhere user-facing. UUID `id` is internal (joins, React keys) only.
- Enums are Prisma-native (UserRole, SkillCategory, SkillApprovalStatus, EvidenceType, LearningType, ProjectStatus, ProjectCategory, PipelineStage, Billability, ReviewCycleStatus, FeedbackFormType, QuestionType, AssignmentStatus, PromotionStatus, ClientTier, ShadowFlagType, RequirementPriority). TS code uses `as const` objects instead of TS enums.

---

## 3. The Matching Engine — the heart of Resourcing CoLab

`src/server/services/matching.service.ts` → `computeMatchRanking(params)` returns `MatchResult[]`. Used by: recommendation action, kanban, copilot, excel export. **Single scoring source of truth.**

Score formula (weights in `lib/constants.ts` `MATCH_WEIGHTS`, sum to 1.0):
```
matchScore = skill×0.35 + competency×0.25 + availability×0.20 + billability×0.12 + evidence×0.08
```
(A separate `MATCH_WEIGHTS_V2`, 7 dims incl. experience + coeAlignment, is used only by the CLI excel export.)

Per-dimension logic worth knowing:
- **skill:** `coverage×0.6 + depth×0.4`. If no skill filter, falls back to `min(#skills/5,1)` or 0.3.
- **competency:** avg of `Competency.score`/5×100; defaults to 50 if no competency rows.
- **availability:** `(1−avgUtil)×100 + clientTierBoost`. avgUtil from last 4 `UtilisationSnapshot`s. Detects **under-utilization** (logging <70% of nominal allocation ⇒ hidden spare capacity).
- **billability:** `(1−avgBillableUtil)×100` — low billable = more redeployable.
- **evidence:** `min(#evidence×10 + expBoost, 100)`. expBoost: +15/experience-doc matching required skills, +15 role history, **+20 COE affinity** (prior project in requested techCoe/propositionCoe), +4/distinct project (cap 20).
- **signal:** REDEPLOY / PARTIAL_HIRE / HIRE based on coverage & availability.
- **riskFlags:** LEAVER (≤60 notice days), OVER_ALLOCATED, GHOST (shadow flag), SKILL_GAP_FOR_ROLE, ON_LEAVE (>10 leave days), UNDER_LEVELLED, LOW_EXPERIENCE, UNDER_UTILIZED.
- **sort:** internalFirst ⇒ REDEPLOY→PARTIAL_HIRE→HIRE tier, then matchScore desc; `.slice(0, topN)`.

### Role normalization — `src/lib/role-mapping.ts` (critical, widely used)
- `normalizeResourceRequest(raw)` → `{ canonicalRoles[], count, isEM, display }`. Parses codes like `"2 SC (EM)"`, `"AP/P"`, `"SSE or SE"`, `"PA"` (→ both Principal Architect + Principal Technology Architect). Handles count prefixes and EM annotations.
- `employeeMatchesRole(jobName, canonicalRoles)` is **grade-exact**: "software engineer" must NOT match "senior software engineer"; rejects grade-word prefixes and extending-word suffixes. Used to filter pools before scoring.
- In `computeMatchRanking`, role filter is a Prisma `OR` of `jobName contains <role>` + a `jobNameValid` guard (excludes "NULL"/"null"/empty).

---

## 4. AI Layer (`src/lib/ai/`)

- **Client:** `client.ts` → `genAI` (GoogleGenerativeAI singleton, `GOOGLE_AI_API_KEY`), `MODELS = { primary: "gemini-1.5-pro", fast: "gemini-1.5-flash" }`.
- **Never call the SDK directly from actions/components** — go through `src/lib/ai/`.
- **Deterministic utilities:** `rationale.ts` (`explainMatch`), `rootcause.ts`, `narrative.ts`, `confidence.ts` (no AI call — pure data-coverage check). All have graceful fallback on failure.
- **Agentic runtime:** `agent/runtime.ts` `runAgent({ system, tools, dispatch, messages, maxRounds, model, serializeOutput })` → `{ finalText, trace }`. Generic tool-use loop for all agents.
- **Agents:** `agent/plan-builder.ts` (`buildStaffingPlans`), `reallocation.ts`, `health-triage.ts`, `guardrails.ts` (`GUARDRAIL_NOTE` injected into prompts), `registry.ts`.
- **RM Copilot:** `copilot/agent.ts` `runCopilotTurn(history)` + `copilot/tools.ts` (`COPILOT_TOOLS`, 7 fns). Uses **`MODELS.fast`**, `maxRounds: 3`, trims history to last 4 turns, compacts tool outputs (`MAX_ARRAY_ITEMS=10`, `MAX_RESPONSE_CHARS=3000`) to prevent context snowball. Auth lives in the wrapping action `actions/copilot.ts`, not in the agent.
- Prompt-injection rule: wrap user content in delimiters, never interpolate raw. AI output must be Zod-validated before use.

---

## 5. Routes / Pages (actual — from `src/app`)

Public: `/` (root), `/login`, `/pitch`.

**ADMIN** (`/admin/*`): analytics, coe, competency-levels, config, copilot, designations, employee-mapping, resource-management (legacy), skill-mapping, skills, talent-discovery, users, and **Resourcing CoLab** under `/admin/resourcing/`: `match`, `health`, `simulator`, `outlook`, `allocations`, **`kanban`** (new), **`pipeline`** + `pipeline/analytics`, **`questionnaire`**.

**MANAGER** (`/manager/*`): approvals, team-reports, team-skills. (No manager/feedback page despite docs; no team-learning page.)

**EMPLOYEE** (`/employee/*`): my-skills, skill-gaps, learning-paths, transition-path, my-report, **my-experience** (new).

Client components are co-located as `*-client.tsx` next to `page.tsx`. Pages are Server Components fetching via actions/Prisma directly.

### Server actions (`src/server/actions/`, 33 files)
Beyond docs: `ai-features.ts`, `cluster.ts`, `pipeline.ts`, `pitch-stats.ts`, `project-experience.ts`, `proposition-simulator.ts`, `kanban-resourcing.ts`. Plus the documented set (approval, coe, designation, skill, employee, gap-analysis, learning-paths, my-skills, recommendation, forecast, project-health, allocation-report, copilot, export-resource-excel, resource-management, review-cycle, feedback-*, talent-discovery, team-reports, transition-path, user, skill-mapping, competency-level, employee-skill).

### Services (`src/server/services/`, 9 files)
matching, availability, health, forecast, excel-export, **ai.service**, **experience.service**, **pipeline.service**, **readiness.service** (last 4 not in docs).

---

## 6. Conventions & Gotchas checklist

- Named exports only (except Next.js special files `page/layout/error/loading` which need `export default`).
- No `any`, no `as` assertions, no `!`, no TS enums, no default exports (ESLint-enforced).
- Path alias `@/*` → `src/*`. Import order: node → external → `@/` → relative.
- Light mode only; no `dark:` variants. Tailwind only, use `cn()`.
- After mutations: `revalidatePath(...)`. No SWR/React Query — Server Components + revalidate.
- `src/server/**` is server-only; never import into client components.
- Tests: **zero test files exist** (only `tests/setup.ts`). Vitest configured (`tests/unit/**`, `tests/integration/**`), Playwright scaffolded. `npx vitest run <file>` for a single file.
- Doc trust order when conflicts arise: **actual code > `prisma/schema.prisma` > `.claude/context/codebase-current-state.md` > `architecture.md` / `module-status.md`** (last two are aspirational).
- Secrets currently committed in `.env` (AUTH_SECRET, GOOGLE_AI_API_KEY) — real key present. Don't echo/leak; rotate concern noted.
- Git: on branch `feat-updates`; `main` is default. Never commit to main; branch first. Migrations dir was recently rewritten to a single `20260724152932_initial_schema`.

---

## 7. When implementing X, start here

| Task | Entry point(s) |
|------|----------------|
| Skill approval / rejection | `actions/approval.ts` (add reportee scope check!), `manager/approvals/` |
| Match / recommend resources | `services/matching.service.ts`, `actions/recommendation.ts`, `lib/role-mapping.ts` |
| Kanban resourcing board | `actions/kanban-resourcing.ts`, `admin/resourcing/kanban/` |
| Capacity / role-mix simulation | `actions/proposition-simulator.ts`, `lib/historical-allocations.ts`, `admin/resourcing/simulator/` |
| Project health / RAG | `services/health.service.ts`, `actions/project-health.ts` |
| Forecast / pipeline outlook | `services/forecast.service.ts`, `actions/forecast.ts`, `pipeline.service.ts` |
| Availability / allocation report | `services/availability.service.ts`, `actions/allocation-report.ts` |
| AI copilot | `lib/ai/copilot/{agent,tools}.ts`, `actions/copilot.ts` |
| Excel export | `services/excel-export.service.ts`, `actions/export-resource-excel.ts`, `scripts/export-resource-excel.ts` |
| Readiness / promotion | `services/readiness.service.ts`, feedback actions |
| New reference-data ingest | `scripts/etl/ingest.ts` |
| Skill gap / learning / transition | `actions/gap-analysis.ts`, `learning-paths.ts`, `transition-path.ts` |
