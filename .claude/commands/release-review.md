Generate a release readiness report for: $ARGUMENTS

If no version/tag given, assess the current state of the main branch.

---

## Release Readiness Checklist

### Module Completion
Read `.claude/memory/module-status.md` and report:
| Module | Status | Completion % | Blockers |
|--------|--------|-------------|---------|
| Auth & User Management | ... | ...% | ... |
| Admin Configuration | ... | ...% | ... |
| ... | | | |

**P0 modules (must be 100% for release):**
- Auth & User Management
- Admin Configuration
- Skill Management
- Skill Mapping
- Employee Skill Submission
- Manager Approval Workflow

### Test Coverage
- Run `pnpm test:coverage` and report coverage %.
- Flag any module with < 70% coverage.

### Security
- Run `/security-review`.
- CRITICAL or HIGH findings block release.
- MEDIUM findings must be documented as known issues.

### Performance
- Run `/performance-review`.
- HIGH findings must be addressed or documented.

### RBAC Completeness
- Run `/audit-rbac`.
- Any FAIL blocks release.

### Documentation Coverage
Check `.claude/docs/` — report which documents exist vs missing:
- [ ] system-overview.md
- [ ] architecture-overview.md
- [ ] database-design.md
- [ ] api-documentation.md
- [ ] deployment-guide.md

### Tech Debt Assessment
Read `.claude/memory/tech-debt.md`:
- List all CRITICAL tech debt items.
- List items that should be resolved before release.
- List items acceptable as post-release follow-up.

### Known Issues
List all known bugs or limitations that will ship with this release.

---

## Release Report Output

```
RELEASE VERSION: [version]
DATE: [date]
OVERALL STATUS: GO | NO-GO | CONDITIONAL GO

P0 MODULES: [X/6 complete]
TEST COVERAGE: [X%]
SECURITY: [CLEAR / X critical issues]
RBAC: [PASS / X failures]

BLOCKERS (must fix before release):
  1. ...

CONDITIONAL ITEMS (fix or document):
  1. ...

KNOWN ISSUES SHIPPING:
  1. ...

RECOMMENDATION: [GO / NO-GO with reason]
```

After generating the report, update today's daily log.
