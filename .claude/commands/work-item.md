Work item management command. Usage: /work-item [create|update|list|close] [details]

## Usage Patterns

- `/work-item create [title]` — create a new work item
- `/work-item list` — list all open work items
- `/work-item update [id] [status]` — update a work item's status
- `/work-item close [id]` — mark a work item as done

---

## Creating a Work Item

When `/work-item create [title]` is called, generate a full work item in `.claude/memory/work-items.md`:

```markdown
### WI-[next-number]: [Title]
- **Type:** Feature | Bug | Task | Spike | Debt
- **Module:** [Module name from the 14 modules]
- **Priority:** P0 | P1 | P2
- **Status:** Open | In Progress | Blocked | Done
- **Created:** [YYYY-MM-DD]
- **Estimate:** S | M | L | XL

**Description:**
[What needs to be done and why]

**Acceptance Criteria:**
- [ ] ...
- [ ] ...

**Technical Notes:**
[DB changes, RBAC impact, dependencies]

**Dependencies:**
[Other WIs this blocks or is blocked by]
```

## Listing Work Items

When `/work-item list` is called:
- Read `.claude/memory/work-items.md`
- Output a table:

| ID | Title | Module | Priority | Status | Estimate |
|----|-------|--------|----------|--------|----------|
| WI-001 | ... | ... | P0 | Open | M |

Group by status: Open → In Progress → Blocked.

## Updating a Work Item

When `/work-item update [id] [status]` is called:
- Find the work item in `.claude/memory/work-items.md`
- Update its Status field
- Add an update entry: `**Updated [YYYY-MM-DD]:** [what changed]`

## Closing a Work Item

When `/work-item close [id]` is called:
- Update Status to `Done`
- Add: `**Closed [YYYY-MM-DD]:** [brief summary of what was delivered]`
- Update `.claude/memory/module-status.md` if this completes a module milestone

---

After any work item operation, update today's daily log.
