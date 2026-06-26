Display and update the live module status dashboard.

Usage: /module-status [update|init]

- `/module-status` — display current status table
- `/module-status update [module-name] [status] [completion%]` — update a specific module
- `/module-status init` — rebuild the status file from scratch by scanning the codebase

---

## Display Mode

Read `.claude/memory/module-status.md` and output a formatted table:

```
=== SKILL MATRIX — MODULE STATUS ===
Date: [YYYY-MM-DD]

MODULE                        | STATUS       | COMPLETION | BLOCKERS
-----------------------------|--------------|------------|----------
Auth & User Management       | Complete     | 100%       | —
Admin Configuration          | Complete     | 100%       | —
Skill Management             | Complete     | 100%       | —
Skill Mapping                | Complete     | 100%       | —
Employee Skill Submission    | Complete     | 100%       | —
Manager Approval Workflow    | Complete     |  95%       | Bulk approve, notifications
Skill Gap Assessment         | In Progress  |  70%       | AI summary, readiness score
Learning Path                | In Progress  |  60%       | AI generation, progress tracking
Designation Transition       | In Progress  |  50%       | TransitionPlan model, readiness scoring
Employee Skill Report        | In Progress  |  40%       | PDF export, full report generation
Talent Discovery             | In Progress  |  60%       | Advanced matching
Analytics & Reporting        | In Progress  |  50%       | Heatmaps, skill coverage metrics
Resource Management          | In Progress  |  65%       | JIN integration, conflict detection
AI Features                  | Not Started  |   0%       | No AI infrastructure built

Overall: 7 modules complete, 6 in progress, 1 not started
P0 modules complete: 5/6 (83%)
```

## Init Mode

When `/module-status init` is called, scan the codebase to build status from scratch:
1. Check which pages exist in `src/app/(dashboard)/`.
2. Check which server actions exist in `src/server/actions/`.
3. Check which services exist in `src/server/services/`.
4. Check which tests exist in `tests/`.
5. Read `prisma/schema.prisma` to check DB models.
6. Write the full module-status.md file with findings.

## Update Mode

When `/module-status update [module] [status] [%]` is called:
- Find the module in `.claude/memory/module-status.md`.
- Update its status, completion %, and pending work.
- Update the "Last updated" timestamp.
- Update today's daily log with the change.
