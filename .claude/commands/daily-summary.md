Generate today's end-of-day summary and update the daily log.

Today's date: use the current date in YYYY-MM-DD format.

---

## Step 1 — Gather Work Done Today

Collect information from:
1. `git log --since="today" --oneline` — commits made today.
2. `git diff HEAD~[n] --name-only` — files changed today.
3. The existing `.claude/memory/daily/[YYYY-MM-DD].md` if it exists — partial notes.
4. `.claude/memory/module-status.md` — current module states.
5. `.claude/memory/work-items.md` — open and recently updated items.

---

## Step 2 — Create or Update Daily Log

Write to `.claude/memory/daily/[YYYY-MM-DD].md`:

```markdown
# Daily Log — [YYYY-MM-DD]

## Summary
[2–3 sentence overview of the day's work]

## Features Worked On
- [Feature name] — [brief description of what was done]
- ...

## Files Changed
- [file path] — [what changed and why]
- ...

## Modules Impacted
- [Module name] — [how it was affected]
- ...

## Bugs Fixed
- [bug description] — [fix applied]
- ...

## Decisions Made
- [decision] — [rationale]
- ...

## Issues Found / Risks
- [issue or risk] — [severity and mitigation]
- ...

## In-Progress Work
- [what is not complete yet and what remains]
- ...

## Next Steps
- [what to do in the next session]
- ...

## Stats
- Files created: [n]
- Files modified: [n]
- Tests written: [n]
- Modules updated: [n]
```

---

## Step 3 — EOD Report

After updating the log, output a clean EOD report to the chat:

```
=== EOD REPORT — [YYYY-MM-DD] ===

COMPLETED TODAY:
  ✓ [item]
  ✓ [item]

IN PROGRESS:
  → [item] ([% complete estimate])

BLOCKERS:
  ✗ [blocker or "None"]

NEXT SESSION PRIORITY:
  1. [top priority task]
  2. [second priority task]

MODULE STATUS CHANGES:
  [Module] : [old status] → [new status]
================================
```
