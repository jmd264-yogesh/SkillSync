# Dependencies — Skill Matrix Platform

_Last updated: 2026-06-24_

## Production Dependencies

| Package | Version | Purpose | Notes |
|---------|---------|---------|-------|
| `next` | 16.2.9 | Framework | App Router, Server Actions, Server Components |
| `react` | 19.2.4 | UI library | |
| `react-dom` | 19.2.4 | DOM renderer | |
| `typescript` | ^5 | Language | Strict mode required |
| `@prisma/client` | ^6.19.3 | DB client | **Stay on v6 — v7 has breaking datasource changes** |
| `prisma` | ^6.19.3 | ORM + migrations | Schema-first |
| `next-auth` | ^5.0.0-beta.31 | Authentication | Auth.js v5 beta — credentials + session |
| `@auth/prisma-adapter` | ^2.11.2 | Prisma adapter for NextAuth | |
| `zod` | ^4.4.3 | Schema validation | Shared client + server |
| `react-hook-form` | ^7.80.0 | Form handling | |
| `@hookform/resolvers` | ^5.4.0 | Zod + RHF integration | |
| `tailwindcss` | ^4 | Styling | Utility-first, no CSS modules |
| `shadcn` | ^4.11.0 | Component CLI | Add components: `npx shadcn add [component]` |
| `lucide-react` | ^1.21.0 | Icons | Only icon library used |
| `recharts` | ^3.8.1 | Charts | Analytics module |
| `framer-motion` | ^12.40.0 | Animations | Use sparingly |
| `sonner` | ^2.0.7 | Toast notifications | shadcn/ui's recommended toaster |
| `zustand` | ^5.0.14 | Client state | Only for UI state, not server data |
| `bcryptjs` | ^3.0.3 | Password hashing | Cost factor ≥ 12 |
| `class-variance-authority` | ^0.7.1 | Component variants (cva) | Used in shadcn components |
| `clsx` | ^2.1.1 | Class merging utility | Used in `cn()` |
| `tailwind-merge` | ^3.6.0 | Tailwind class dedup | Used in `cn()` |
| `next-themes` | ^0.4.6 | Theme switching | Currently unused (no dark mode) |
| `tw-animate-css` | ^1.4.0 | Tailwind animation utils | |
| `@base-ui/react` | ^1.6.0 | Base UI primitives | |

## Dev Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `vitest` | ^4.1.9 | Unit + integration test runner |
| `@playwright/test` | ^1.61.0 | E2E testing |
| `@testing-library/react` | ^16.3.2 | Component testing |
| `@testing-library/jest-dom` | ^6.9.1 | DOM assertions |
| `jsdom` | ^29.1.1 | Browser environment for Vitest |
| `@vitejs/plugin-react` | ^6.0.2 | React support for Vitest |
| `tsx` | ^4.22.4 | TypeScript execution (prisma seed) |
| `prettier` | ^3.8.4 | Code formatting |
| `eslint` | ^9 | Linting |
| `eslint-config-next` | 16.2.9 | Next.js ESLint rules |

## Not Installed (Intentionally Excluded)

| Package | Reason Excluded |
|---------|----------------|
| `swr` | No client-side data fetching — use Server Components |
| `@tanstack/react-query` | Same reason as SWR |
| `axios` | Built-in fetch is sufficient |
| `moment` / `date-fns` | No complex date manipulation needed yet |
| `@mui/material` | Using shadcn/ui instead |
| `@anthropic-ai/sdk` | **Not yet installed — needed for Module 14 (AI Features)** |

## Packages to Add When Needed

| Package | Purpose | When |
|---------|---------|------|
| `@anthropic-ai/sdk` | Claude API for AI features | When Module 14 starts |
| `@aws-sdk/client-s3` | S3 file storage for evidence | When file upload is implemented |
| `nodemailer` or resend | Email notifications | When approval notifications are built |
| `sharp` | Image optimization | If profile photos are added |
