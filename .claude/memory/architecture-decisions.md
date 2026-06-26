# Architecture Decisions — Skill Matrix Platform

_Last updated: 2026-06-24_

---

## ADR-001: Server Actions over REST API for Mutations

**Date:** 2026-06-01 | **Status:** Accepted

**Context:**
Next.js 15 App Router provides Server Actions as a first-class mechanism for mutations. The alternative is to build REST API routes for every mutation.

**Decision:**
Use Server Actions for all mutations. REST API routes are used only for auth (NextAuth) and future webhook/external integrations.

**Consequences:**
- CSRF protection built-in (same-origin token enforcement by Next.js)
- No separate API client needed in frontend
- Type safety end-to-end (no API serialization boundary)
- Harder to test via curl/Postman (not a concern for this internal app)
- Cannot be consumed by a mobile app without an API layer (acceptable for now)

---

## ADR-002: Server Components as Default

**Date:** 2026-06-01 | **Status:** Accepted

**Context:**
Next.js 15 renders components on the server by default. The previous Pages Router pattern was to fetch everything client-side.

**Decision:**
All components are Server Components unless they need interactivity (state, event handlers, browser APIs). Client Components use the `"use client"` directive.

**Consequences:**
- Faster initial page load (no JS waterfall for data)
- No client-side data fetching libraries needed (no SWR/React Query)
- Cannot use hooks in Server Components (acceptable — hooks are UI concerns)
- Client Components that need data call server actions (one round-trip per mutation)

---

## ADR-003: No Client-Side Data Fetching Libraries

**Date:** 2026-06-01 | **Status:** Accepted

**Context:**
SWR and React Query are popular for client-side data fetching with caching, revalidation, and optimistic updates.

**Decision:**
Banned. Rely on Server Components for reads + `revalidatePath`/`revalidateTag` for cache invalidation after mutations.

**Consequences:**
- Simpler dependency graph
- Cache management is explicit (revalidate after mutation)
- Less client-side JS bundle
- No optimistic UI updates (acceptable — this is a low-frequency-mutation admin tool)

---

## ADR-004: Prisma 6 (Not v7)

**Date:** 2026-06-10 | **Status:** Accepted

**Context:**
Prisma v7 introduced breaking changes to datasource configuration. The `@prisma/client` v7 requires a different import pattern and schema structure.

**Decision:**
Remain on Prisma 6 (`^6.19.3`). Do not upgrade to v7 without a dedicated migration task.

**Consequences:**
- Current schema and imports remain valid
- v7 performance improvements not available
- Must explicitly pin to `^6` in package.json to avoid accidental upgrade

---

## ADR-005: shadcn/ui as Component Library

**Date:** 2026-06-01 | **Status:** Accepted

**Context:**
Options: build from scratch, use Material UI, Ant Design, Chakra UI, or shadcn/ui.

**Decision:**
Use shadcn/ui. Components are copied into the repo (not a package dependency), built on Radix UI primitives, and styled with Tailwind CSS.

**Consequences:**
- Full control over component code (can modify without forking a package)
- Accessible by default via Radix primitives
- Consistent with the project's Tailwind-only styling rule
- Must manually add new shadcn components when needed (`npx shadcn add [component]`)

---

## ADR-006: No TypeScript Enums

**Date:** 2026-06-01 | **Status:** Accepted

**Context:**
TypeScript enums compile to runtime objects and have counterintuitive behavior. Prisma generates its own enum types from the schema.

**Decision:**
No TypeScript `enum` keyword. Use `as const` objects + union literal types instead. Prisma-generated enums (from schema) are used directly.

**Consequences:**
- Consistent with Prisma's own enum pattern
- No dual enum representation (TS enum + Prisma enum)
- Slightly more verbose type definitions (`(typeof X)[keyof typeof X]`)

---

## ADR-007: No Dark Mode

**Date:** 2026-06-01 | **Status:** Accepted

**Context:**
Tailwind CSS 4 and shadcn/ui support dark mode via the `dark:` variant. `next-themes` is in the dependency list.

**Decision:**
Light mode only. This is a premium enterprise business tool. A single polished light theme is more appropriate than supporting two themes at lower quality.

**Consequences:**
- `next-themes` dependency is present but unused (can be removed later)
- `dark:` Tailwind variants must not be used in any component
- Simpler CSS — no dual-color-scheme maintenance

---

## ADR-008: Named Exports Only

**Date:** 2026-06-01 | **Status:** Accepted

**Context:**
Default exports make refactoring harder (can be renamed on import without detecting the change) and are inconsistent with the rest of the codebase.

**Decision:**
All exports are named exports. No default exports, including React components and Next.js pages.

**Consequences:**
- `export default` is banned (ESLint rule enforced)
- Next.js special files (`layout.tsx`, `page.tsx`, `error.tsx`, `loading.tsx`) require `export default` — these are the only exceptions
- All component files use `export function ComponentName`
