Perform an impact analysis for the following proposed change: $ARGUMENTS

Do NOT start implementing. This command produces an analysis report only.

---

## Analysis Framework

### 1. Change Summary
Describe in 2–3 sentences what is being changed and why.

### 2. Affected Files
List every file that will need to change or that is at risk of breaking:
- **Direct changes:** Files that will be edited.
- **Dependent files:** Files that import from or call into the changed code.
- **Transitive risk:** Files that might be indirectly affected.

Use Grep to find all imports of the changed module/function.

### 3. Module Impact
Cross-reference against the 14 modules in `.claude/memory/module-status.md`:
| Module | Impact Level | Reason |
|--------|-------------|--------|
| Auth & User Management | None / Low / Medium / High | ... |
| Admin Configuration | ... | ... |
| ... | ... | ... |

### 4. Database Impact
- Schema changes required? (Yes / No — detail if yes)
- Migration required? (Yes / No)
- Migration safety: SAFE (additive) / RISKY (destructive, requires backfill)
- Estimated migration time on production data

### 5. RBAC Impact
- Does this change add, remove, or modify any permission?
- Does this change affect what data a role can see?
- Are any existing auth/role checks invalidated?

### 6. API Impact
- New endpoints added?
- Existing endpoint signatures changed?
- Breaking changes for any client?

### 7. Test Impact
- Which existing tests will break?
- What new tests are required?
- Are E2E flows affected?

### 8. Performance Impact
- New DB queries introduced?
- Existing queries made more/less efficient?
- Any caching invalidated?
- Any AI calls added (latency/cost implications)?

### 9. Risk Assessment
| Risk | Likelihood | Severity | Mitigation |
|------|-----------|----------|-----------|
| ... | Low/Med/High | Low/Med/High | ... |

**Overall risk level:** LOW / MEDIUM / HIGH / CRITICAL

### 10. Implementation Order
If the change is approved, suggest the correct order of implementation to minimize breakage:
1. Step 1...
2. Step 2...

### 11. Rollback Plan
If the change causes issues in production, how to roll back:
- DB migration rollback steps
- Feature flag (if applicable)
- Git revert strategy

---

## Output
Present the full analysis report. Do NOT write any code.
After analysis, update today's daily log with the key findings.
