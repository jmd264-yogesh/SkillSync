# Testing Standards — Skill Matrix Platform

## Test Stack
- **Unit + Integration:** Vitest + React Testing Library
- **E2E:** Playwright
- **Coverage:** Vitest's built-in V8 coverage

## Coverage Targets
| Scope | Target |
|-------|--------|
| Service functions | 80% |
| Server actions | All exported functions |
| Critical user flows | E2E covered |
| Overall | 70% |

---

## Test Structure

```
tests/
├── unit/
│   ├── services/           # Business logic tests (mock Prisma)
│   └── utils/              # Utility function tests
├── integration/
│   ├── actions/            # Server action tests (real test DB)
│   └── api/                # API route tests (if REST routes exist)
└── e2e/
    ├── admin/              # Admin user flows
    ├── manager/            # Manager user flows
    └── employee/           # Employee user flows
```

## File Naming
- Unit/integration: `{module}.test.ts`
- E2E: `{flow}.spec.ts`

---

## Unit Tests

### Setup (vitest.config.ts)
```typescript
import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
  },
});
```

### Mocking Prisma
```typescript
vi.mock("@/lib/db", () => ({
  db: {
    employee: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));
```

### Test Data Factories
```typescript
// tests/factories/employee.factory.ts
export function createEmployee(overrides: Partial<Employee> = {}): Employee {
  return {
    id: "test-uuid-1",
    name: "Test Employee",
    email: "test@example.com",
    employeeCode: "EMP001",
    coeId: "coe-uuid-1",
    designationId: "des-uuid-1",
    managerId: null,
    ...overrides,
  };
}
```

Always use factories; never inline object literals in test assertions.

---

## Integration Tests

### Database Setup
- Use a separate test database (`DATABASE_URL_TEST`).
- Wrap each test in a transaction; roll back after.
- Seed prerequisite data in `beforeEach`.

### Session Mocking
```typescript
vi.mock("@/lib/auth", () => ({
  getServerSession: vi.fn(),
}));

// In test
(getServerSession as Mock).mockResolvedValue({
  user: { id: "u1", role: "ADMIN", employeeId: "e1" },
});
```

### Coverage per Action
Every server action must have tests for:
1. Unauthenticated (no session → throws UnauthorizedError)
2. Wrong role (EMPLOYEE calling ADMIN action → throws ForbiddenError)
3. Invalid input (Zod parse failure → throws ValidationError)
4. Valid request (happy path → expected DB change + return value)
5. Scope violation (manager accessing another manager's team → ForbiddenError)

---

## E2E Tests (Playwright)

### Auth State
Pre-authenticate using saved storage state:
```typescript
// playwright.config.ts
use: {
  storageState: "tests/e2e/.auth/employee.json",
}
```

### Selectors
Priority order (most robust first):
1. `page.getByRole(...)` — ARIA roles
2. `page.getByLabel(...)` — form labels
3. `page.getByTestId(...)` — explicit `data-testid` attributes
4. `page.getByText(...)` — visible text (last resort)

Never use CSS selectors (`.class-name`) or XPath.

### Test Independence
Each test must create its own data and clean up after. No test should depend on another test's data.

---

## Running Tests

```bash
pnpm test              # All unit + integration
pnpm test:unit         # Unit only
pnpm test:integration  # Integration only
pnpm test:coverage     # Coverage report
pnpm test:e2e          # Playwright E2E
```

## CI Requirements
- All tests must pass on every PR.
- Coverage must not drop below the targets.
- E2E must pass for: skill submission flow, approval flow, gap analysis view.

_Last updated: 2026-06-24_
