Run the full pre-PR checklist for the current branch.

This command runs all quality gates before a PR is opened. Do not approve a PR that fails any CRITICAL check.

---

## Step 1 — Code Compilation
```
pnpm build
```
- [ ] Zero TypeScript errors
- [ ] Zero build errors

## Step 2 — Lint
```
pnpm lint
```
- [ ] Zero lint errors (warnings acceptable if pre-existing)

## Step 3 — Tests
```
pnpm test
```
- [ ] All unit tests pass
- [ ] All integration tests pass

## Step 4 — RBAC Audit
Run `/audit-rbac` on all files changed in this branch.
- [ ] No FAIL findings
- [ ] All WARN findings documented or accepted

## Step 5 — Security Review
Run `/security-review` on all files changed in this branch.
- [ ] No CRITICAL or HIGH findings unmitigated

## Step 6 — Performance Review
Run `/performance-review` on changed service and action files.
- [ ] No HIGH performance issues unaddressed

## Step 7 — Regression Analysis
Run `/regression-review`.
- [ ] No breaking changes without a migration plan
- [ ] No RBAC regressions

## Step 8 — Documentation
- [ ] CLAUDE.md updated if new patterns were introduced
- [ ] `.claude/memory/module-status.md` updated
- [ ] `.claude/memory/api-registry.md` updated if new routes added
- [ ] `.claude/docs/` updated if architecture changed
- [ ] Today's daily log updated

## Step 9 — Definition of Done
Read `.claude/context/definition-of-done.md` and verify all items for the changed modules.

---

## PR Description Template

Generate a PR description in this format:

```markdown
## Summary
[1–3 bullet points describing what changed]

## Modules Affected
- [Module name] — [what changed]

## DB Changes
- [Migration name or "None"]

## RBAC Impact
- [What roles are affected or "None"]

## Test Coverage
- Unit: [new tests added]
- Integration: [new tests added]
- E2E: [new tests added or "Not required"]

## Pre-PR Checklist
- [x] TypeScript compiles
- [x] Lint passes
- [x] Tests pass
- [x] RBAC audit: PASS
- [x] Security review: no HIGH/CRITICAL findings
- [x] Documentation updated
- [x] Module status updated
```

After generating the PR description, update today's daily log.
