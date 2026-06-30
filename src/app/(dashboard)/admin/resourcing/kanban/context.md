# Pipeline Kanban Resourcing Board Context & Logic

This document provides a comprehensive overview of the Pipeline Kanban Board and details the user resourcing logic, color coding rules, search & swap features, and filters implemented in the page.

---

## 1. Overview
The Kanban Board serves as a visual pipeline resourcing overview of project opportunities starting during a selected calendar range. It organizes opportunities across 8 stages:
- Opportunity Inception
- Make It Real
- Build The Proposition
- Scoping Approval
- Propose & Negotiate
- SoW Pending Signature
- Deal Won
- Deal Lost

---

## 2. Page & Layout Scrollbar Fix
- **Constraint Rule**: To resolve double horizontal scrollbars, the page outermost wrapper is explicitly constrained with `min-w-0 w-full overflow-hidden`.
- **Clipping**: The dashboard layout (`layout.tsx`) limits its flex items and applies `overflow-x-hidden`. This clips child bleed-out, routing horizontal scroll bars exclusively to the Kanban board columns area.

---

## 3. Resourcing Configuration Modal
Clicking on any project card opens a details dialog containing project metadata and a **Configure Resources** workflow:

### A. Allocated Resources
- For each role demanded in the project allocations, the modal renders name fields for the actual people mapped to that role (retrieved from mock name pools based on required headcount).

### B. Approve / Reject Decisions
- Each resource has decision options styled explicitly:
  - **Approve**: Light green badge style (`border-emerald-200 bg-emerald-50/30 text-emerald-700`) transitioning to solid green (`bg-emerald-600 text-white`) when selected.
  - **Reject**: Light red badge style (`border-rose-200 bg-rose-50/30 text-rose-700`) transitioning to solid red (`bg-rose-600 text-white`) when selected.

### C. Swap Candidate Flow
- **Lookup Action**: Instead of a negotiate state button, each resource has a **Swap** button (with a refresh icon).
- **Candidates Modal**: Clicking Swap opens a secondary modal listing candidates for that role, sorted from **best fit to worst fit** (descending order by match percentage).
- **Fit Ranks**: Shows fit ranks (e.g. `#1 (99% Fit)`, `#2 (96% Fit)`). When searching candidates by name, ranks stay absolute relative to the original sorted index.
- **State Change**: Confirming a swap updates the resource's name in the list and tags them with a `Swapped` badge.

### D. Dynamic Justifications Selection
Under each resource name, a list of justifications chips can be multi-selected. The choices change dynamically based on the selected decision status:
- **Approved**: Skill Match, Competency Level, Immediate Availability, Relevant Experience, CoE Alignment.
- **Reject**: Allocation Conflict, Competency Gap, Billability / Cost Limit, No Evidenced Portfolio.
- **Default / Pending**: Shows "Approved" justifications as candidates.

---

## 4. Project-Level Negotiation
- **Negotiate Project**: Replaces the standard Cancel button in the modal footer.
- **Behavior**: Clicking **Negotiate Project** flags the project state as "Negotiating" at the project level, marks the project as submitted/completed, and closes the modal.
- **Clearance**: Submitting resourcing decisions clears any project-level negotiation flag.

---

## 5. Kanban View Background Colors
Project cards on the board color-code dynamically once actions are submitted:
- **Light Green** (`bg-emerald-50`): Submitted projects where all resources are resolved (Approved/Rejected) with no swaps and no project-level negotiation active.
- **Orange Shade** (`bg-amber-50`): Submitted projects where either:
  1. A project-level **Negotiate** was triggered.
  2. At least one resource in the project has been **Swapped**.
- **Default (White)**: Projects with no actions taken (still Pending).

---

## 6. Top Filter Badges
Badges at the top allow filtering cards by their resourcing status:
- **All**: Shows all projects starting in the range.
- **Pending**: Shows projects with no actions done.
- **Approved**: Shows projects submitted in clean approved/rejected state (green).
- **Swapped**: Shows submitted projects containing swapped resources.
- **Negotiate**: Shows projects submitted under project-level negotiation.
