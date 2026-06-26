# API Documentation — Skill Matrix Platform

> Run `/documentation-sync api` to regenerate from current server actions.

_Last synced: 2026-06-24_

---

## Overview

This application uses **Server Actions** for all mutations (no REST API for internal use). The only HTTP API route is NextAuth for authentication.

All server actions:
- Require authentication (`getServerSession()` check)
- Return typed TypeScript values (not HTTP responses)
- Throw `UnauthorizedError`, `ForbiddenError`, or `ValidationError` on failure
- Call `revalidatePath()` to invalidate Next.js cache after mutations

---

## Authentication Endpoint

### `GET/POST /api/auth/[...nextauth]`
**Handler:** NextAuth.js v5
**Purpose:** Login, session management, signout
**Auth:** None (public)

---

## Server Actions Reference

See `.claude/memory/api-registry.md` for the complete, always-current listing.

Key patterns:

### Input Validation
All actions validate inputs with Zod schemas from `src/validations/`:
```typescript
const validated = skillSubmissionSchema.parse(data);
// Throws ZodError if invalid
```

### Auth Pattern
```typescript
const session = await getServerSession();
if (!session) throw new UnauthorizedError();
if (session.user.role !== "ADMIN") throw new ForbiddenError();
```

### Response Pattern
Actions return typed data directly (TypeScript inference), not wrapped in `{ success, data }`.
The client handles errors via try-catch.

---

## Planned REST Routes (Future)

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/ai/gap-summary` | POST | Streaming AI gap analysis |
| `/api/ai/learning-path` | POST | AI learning path generation |
| `/api/reports/[id]/pdf` | GET | PDF export |
| `/api/webhooks/jin` | POST | JIN integration |

---

## Error Codes

| Error Class | HTTP Equivalent | When Thrown |
|-------------|----------------|-------------|
| `UnauthorizedError` | 401 | No session |
| `ForbiddenError` | 403 | Wrong role or out-of-scope |
| `NotFoundError` | 404 | Resource not found |
| `ValidationError` | 400 | Zod parse failure |

_Last synced: 2026-06-24_
