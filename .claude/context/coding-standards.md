# Coding Standards — Skill Matrix Platform

## TypeScript (Strict)

### Compiler Rules (do not disable)
```jsonc
{
  "strict": true,
  "noUncheckedIndexedAccess": true,
  "noImplicitReturns": true,
  "noFallthroughCasesInSwitch": true,
  "exactOptionalPropertyTypes": true
}
```

### Hard Rules
| Rule | What to do instead |
|------|--------------------|
| No `any` | Use `unknown` and narrow, or define a proper type |
| No type assertions (`as`) | Narrow from `unknown` with a runtime check first |
| No non-null assertions (`!`) | Handle `null`/`undefined` explicitly |
| No `@ts-ignore` / `@ts-expect-error` | Fix the type error |
| No `enum` | Use `as const` objects + union literal types |
| No default exports | Named exports everywhere |

### Naming Conventions
| Element | Convention | Example |
|---------|------------|---------|
| Files (components) | PascalCase | `SkillCard.tsx` |
| Files (non-component) | kebab-case | `gap-analysis.service.ts` |
| Interfaces | PascalCase | `SkillGapResult` |
| Types | PascalCase | `ApprovalStatus` |
| Variables / Functions | camelCase | `calculateGapScore` |
| Constants | UPPER_SNAKE_CASE | `MAX_COMPETENCY_LEVEL` |
| React Components | PascalCase | `SkillSubmissionForm` |
| Custom Hooks | camelCase (use-) | `useSkillGaps` |
| Server Actions | camelCase | `submitSkillForApproval` |
| Zod schemas | camelCase + Schema | `skillSubmissionSchema` |
| DB fields (Prisma) | snake_case via `@map` | `competency_level` |
| API routes | kebab-case | `/api/gap-analysis` |

### Type Patterns
```typescript
// Discriminated unions for state
type SkillStatus =
  | { status: "pending" }
  | { status: "approved"; approvedBy: string; approvedAt: Date }
  | { status: "rejected"; reason: string };

// Const objects instead of enums
const COMPETENCY_LEVELS = { BEGINNER: 1, BASIC: 2, INTERMEDIATE: 3, ADVANCED: 4, EXPERT: 5 } as const;
type CompetencyLevel = (typeof COMPETENCY_LEVELS)[keyof typeof COMPETENCY_LEVELS];

// Derive types from Prisma (source of truth)
type EmployeeWithSkills = Prisma.EmployeeGetPayload<{
  include: { employeeSkills: { include: { skill: true } } };
}>;
```

---

## Next.js Conventions

### Component Rules
- **Server Components by default.** Only add `"use client"` when the component needs state, event handlers, or browser APIs.
- One component per file. File name = component name.
- Props interface named `{ComponentName}Props`, co-located in the same file.
- Destructure props in the function signature.

### Data Fetching
- Server Components fetch data directly via Prisma (no self-calling API).
- Client Components call server actions or API routes.
- No SWR, no React Query.
- Use `revalidatePath` or `revalidateTag` after mutations.

### Server Actions
```typescript
"use server";

export async function myAction(data: InputType): Promise<ResultType> {
  // 1. Auth
  const session = await getServerSession();
  if (!session) throw new UnauthorizedError();
  
  // 2. Role check
  if (session.user.role !== "ADMIN") throw new ForbiddenError();
  
  // 3. Validate input
  const validated = mySchema.parse(data);
  
  // 4. Business logic via service
  const result = await myService.doThing(validated);
  
  // 5. Invalidate cache
  revalidatePath("/...");
  return result;
}
```

---

## Comments

Default to NO comments. Only add a comment when:
- The **why** is non-obvious (a hidden constraint, a workaround for a known bug)
- A business rule that would surprise a reader
- A subtle invariant that must be maintained

Never comment **what** the code does. Well-named identifiers do that.
Never write multi-line comment blocks. One short line max.

---

## Error Handling

### Custom Error Classes (src/lib/errors.ts)
```typescript
throw new UnauthorizedError();   // 401 — no session
throw new ForbiddenError();      // 403 — wrong role or scope
throw new NotFoundError("Skill"); // 404
throw new ValidationError(zodError); // 400
```

### Server Actions
- Wrap in try-catch.
- Throw typed errors (never raw `new Error("DB error: ...")` to client).
- Log detailed error server-side; return sanitized message to client.

### Client
- `error.tsx` boundary per route segment.
- `sonner` toasts for action feedback (success/error).
- React Hook Form inline errors for form validation.

---

## File Organization Rules

- One thing per file: one component, one service, one schema.
- Co-locate client component (`-client.tsx`) with its page in the same directory.
- Shared types in `src/types/`, not scattered.
- No circular imports: `components` → `lib`, never `lib` → `components`.
- `src/server/` is server-only. Never import it in client components.

---

## Imports

Use path aliases always:
```typescript
import { db } from "@/lib/db";         // ✓
import { db } from "../../lib/db";     // ✗
```

Import order (enforced by ESLint):
1. Node built-ins
2. External packages
3. Internal `@/...` imports
4. Relative imports

_Last updated: 2026-06-24_
