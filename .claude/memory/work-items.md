# Work Items — Skill Matrix Platform

_Last updated: 2026-06-24_

---

## Open

### WI-001: Build AI Service Infrastructure
- **Type:** Feature
- **Module:** 14 — AI Features
- **Priority:** P1
- **Status:** Open
- **Created:** 2026-06-24
- **Estimate:** M (1–3 days)

**Description:**
Build the foundational AI service layer before any AI features can be added to individual modules.

**Acceptance Criteria:**
- [ ] `src/lib/ai.ts` — Anthropic client singleton using `ANTHROPIC_API_KEY`
- [ ] `src/server/services/ai.service.ts` — service wrapper with typed methods
- [ ] `src/lib/ai-prompts/` directory with at least one example prompt builder
- [ ] Rate limiting: track AI calls per user in DB or in-memory store
- [ ] Response validation: all AI responses parsed and validated with Zod
- [ ] Graceful degradation: AI failure returns fallback, not crash
- [ ] `ANTHROPIC_API_KEY` documented in `.env.example`

**Technical Notes:** Install `@anthropic-ai/sdk`. Follow guidelines in `.claude/context/ai-guidelines.md`.

---

### WI-002: Write Tests for P0 Modules
- **Type:** Task
- **Module:** 1–6 (Auth, Admin Config, Skills, Skill Mapping, Submissions, Approvals)
- **Priority:** P1
- **Status:** Open
- **Created:** 2026-06-24
- **Estimate:** L (3–7 days)

**Description:**
Zero test coverage is the highest-risk tech debt. P0 modules need unit + integration tests before new features are built on top of them.

**Acceptance Criteria:**
- [ ] Unit tests for all service functions in P0 modules
- [ ] Integration tests covering: unauthorized, forbidden, invalid input, happy path for all server actions
- [ ] Coverage ≥ 80% for P0 service files
- [ ] All tests pass on `pnpm test`

---

### WI-003: Complete Skill Gap Assessment (Module 7)
- **Type:** Feature
- **Module:** 7 — Skill Gap Assessment
- **Priority:** P1
- **Status:** Open
- **Created:** 2026-06-24
- **Estimate:** M (1–3 days)

**Description:**
Gap analysis page exists but readiness score and AI narrative are missing.

**Acceptance Criteria:**
- [ ] Readiness score (0–100%) computed from gap analysis
- [ ] Score stored or cached (not re-computed on every page load)
- [ ] Manager can view team gap summary
- [ ] AI narrative section (depends on WI-001)

---

### WI-004: Add Approval Notifications
- **Type:** Feature
- **Module:** 6 — Manager Approval Workflow
- **Priority:** P1
- **Status:** Open
- **Created:** 2026-06-24
- **Estimate:** M (1–3 days)

**Description:**
Employees receive no notification when skills are approved or rejected.

**Acceptance Criteria:**
- [ ] Email sent to employee on approval
- [ ] Email sent to employee on rejection with comment
- [ ] In-app notification badge in sidebar (notification count)
- [ ] Employee can mark notifications as read

---

### WI-005: Complete Designation Transition Module (Module 9)
- **Type:** Feature
- **Module:** 9 — Designation Transition
- **Priority:** P1
- **Status:** Open
- **Created:** 2026-06-24
- **Estimate:** L (3–7 days)

**Description:**
Transition page exists but lacks formal tracking and endorsement workflow.

**Acceptance Criteria:**
- [ ] Employee selects target designation
- [ ] Gap analysis shown for target designation
- [ ] Readiness score for the transition
- [ ] Manager can endorse/decline the transition plan
- [ ] Timeline tracking (when will employee be ready?)

---

### WI-006: Complete Employee Skill Report (Module 10)
- **Type:** Feature
- **Module:** 10 — Employee Skill Report
- **Priority:** P1
- **Status:** Open
- **Created:** 2026-06-24
- **Estimate:** L (3–7 days)

**Description:**
The report page is a placeholder. A full structured report is needed.

**Acceptance Criteria:**
- [ ] Report sections: Profile, Skills Summary, Gap Analysis, Learning Progress, Achievements
- [ ] AI narrative for each section (depends on WI-001)
- [ ] Manager can view any reportee's report
- [ ] PDF export

---

### WI-007: Build Analytics Dashboards (Module 12)
- **Type:** Feature
- **Module:** 12 — Analytics & Reporting
- **Priority:** P2
- **Status:** Open
- **Created:** 2026-06-24
- **Estimate:** L (3–7 days)

**Description:**
Analytics page exists but data visualizations are incomplete.

**Acceptance Criteria:**
- [ ] Skill coverage heatmap per COE
- [ ] Competency level distribution per designation
- [ ] Gap trend chart (historical)
- [ ] Approval rate metrics
- [ ] Export to Excel/CSV

---

## In Progress

_(None currently)_

---

## Blocked

_(None currently)_

---

## Done

_(None yet — tracking starts 2026-06-24)_
