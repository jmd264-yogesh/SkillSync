# Troubleshooting Guide — Skill Matrix Platform

_Last updated: 2026-06-24_

---

## Common Issues

### Auth Issues

**Problem:** Redirected to login on every page load despite being logged in.
**Cause:** `AUTH_SECRET` env var missing or changed.
**Fix:** Verify `AUTH_SECRET` in `.env`. Clear cookies and log in again.

**Problem:** Login works but session.user.employeeId is null.
**Cause:** User account not linked to an Employee record.
**Fix:** In admin panel, ensure the user's `employeeId` field is set. Or run `pnpm db:studio` and manually link User → Employee.

---

### Database Issues

**Problem:** `PrismaClientInitializationError: Can't reach database server`
**Cause:** `DATABASE_URL` is wrong, or PostgreSQL is not running.
**Fix:** Verify `DATABASE_URL`. Check PostgreSQL service is running.

**Problem:** `PrismaClientKnownRequestError: Foreign key constraint failed`
**Cause:** Trying to delete a parent record with child records.
**Fix:** Check if the model has `onDelete: Cascade`. If not, delete children first.

**Problem:** `Schema drift detected` when running `prisma migrate dev`
**Cause:** Schema was changed directly in DB without a migration.
**Fix:** Run `npx prisma migrate resolve` or reset the dev DB: `npx prisma migrate reset` (dev only, destroys data).

---

### Build Issues

**Problem:** TypeScript errors on `pnpm build`
**Common causes:**
- Used `any` type
- Missing return type on exported function
- `noUncheckedIndexedAccess` — array access needs null check
- `exactOptionalPropertyTypes` — don't use `undefined` for missing optional props

**Problem:** ESLint errors after adding a new file
**Fix:** Run `pnpm lint:fix` to auto-fix. Remaining errors must be manually resolved — never use `eslint-disable`.

---

### Prisma Client Issues

**Problem:** `PrismaClient is not a constructor` or stale generated types
**Fix:** `pnpm db:generate` to regenerate Prisma client after schema changes.

**Problem:** Prisma client importing `@prisma/client` v7 behavior
**Fix:** Ensure `"prisma": "^6.19.3"` in package.json. Do not upgrade to v7 (breaking changes).

---

### Next.js Issues

**Problem:** Server Component trying to use hooks (`useState`, `useEffect`)
**Fix:** Add `"use client"` at the top of the file, or extract the interactive part to a separate client component.

**Problem:** `revalidatePath` not working (stale data shown)
**Fix:** Ensure the path string exactly matches the route. Use `revalidatePath('/...', 'layout')` to invalidate nested routes.

**Problem:** Server Action called from client but no session found
**Fix:** Confirm `getServerSession()` is called inside the `"use server"` function, not outside.

---

## Useful Debug Commands

```bash
pnpm db:studio          # Visual DB explorer
npx prisma migrate status  # Check migration state
pnpm build              # Catches TypeScript + build errors
pnpm lint               # Lint check
git log --oneline -10   # Recent commits
```
