# UI Guidelines — Skill Matrix Platform

## Design Principles

This is a **premium enterprise product**. The UI must feel polished, professional, and trustworthy — not like a template or a developer-built internal tool.

### Core Standards
1. **No dark mode.** This is a business tool; light mode only.
2. **No basic designs.** Every screen must feel considered and intentional.
3. **Density with clarity.** Enterprise users need information density, but not clutter.
4. **Consistent visual language.** Same spacing, same typography scale, same component patterns everywhere.
5. **Accessibility.** All interactive elements have proper ARIA attributes via Radix primitives.

---

## Component Library: shadcn/ui + Radix

Always use shadcn/ui primitives. Never build UI primitives from scratch.

Available components (from `src/components/ui/`):
- `Button` — all CTAs
- `Card`, `CardHeader`, `CardContent`, `CardFooter` — content containers
- `Dialog` — modals and confirmations
- `Sheet` — side panels
- `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableCell` — data tables
- `Badge` — status indicators
- `Tabs` — tabbed navigation
- `Select`, `Input`, `Textarea`, `Label` — form controls
- `Skeleton` — loading states
- `Avatar` — user avatars
- `Separator` — visual dividers
- `Tooltip` — contextual help
- `Progress` — progress bars
- `Dropdown Menu` — action menus
- `Sonner` — toast notifications

---

## Styling Rules

- **Tailwind CSS only.** No CSS modules, no styled-components, no inline styles.
- Use `cn()` from `@/lib/utils` for conditional class merging.
- Responsive: mobile-first with `sm:`, `md:`, `lg:`, `xl:` breakpoints.
- No magic numbers — use Tailwind's spacing scale (`p-4`, `gap-6`, `h-8`, etc.).
- No hardcoded colors — use CSS variables via Tailwind's `bg-background`, `text-foreground`, etc.

### Common Patterns
```tsx
// Card container
<Card className="border-0 shadow-sm">
  <CardHeader className="pb-3">
    <CardTitle className="text-base font-semibold">Title</CardTitle>
  </CardHeader>
  <CardContent>...</CardContent>
</Card>

// Status badge
<Badge variant="outline" className="text-green-700 bg-green-50 border-green-200">
  Approved
</Badge>

// Action button
<Button size="sm" variant="outline">Edit</Button>
<Button size="sm">Save</Button>
```

---

## Layout Standards

### Dashboard Layout
- Left sidebar (collapsible on mobile) via `src/components/layouts/app-sidebar.tsx`
- Top header via `src/components/layouts/dashboard-header.tsx`
- Main content area with `p-6` padding

### Page Structure
```tsx
// Every dashboard page follows this structure
<div className="flex flex-col gap-6 p-6">
  <PageHeader title="..." description="..." actions={<Button>...</Button>} />
  
  {/* Content: tables, cards, charts */}
</div>
```

### Data Tables
- Use `src/components/shared/data-table.tsx` for all tabular data.
- Columns: sortable where useful, filterable for large datasets.
- Pagination for > 20 rows.
- Empty state via `src/components/shared/empty-state.tsx`.
- Loading state via `Skeleton` components matching the table shape.

### Forms
- Use `Dialog` for create/edit forms.
- React Hook Form + Zod for validation.
- Inline error messages below each field.
- Submit button shows loading state (disable + spinner) during submission.
- Success: close dialog + toast notification.
- Error: keep dialog open + show toast error.

---

## Typography

Use Tailwind's text scale:
- Page title: `text-2xl font-bold`
- Section heading: `text-lg font-semibold`
- Card title: `text-base font-semibold`
- Body text: `text-sm` (default)
- Caption / metadata: `text-xs text-muted-foreground`

---

## Spacing

- Section gaps: `gap-6` between major sections
- Card padding: `p-6` (or use CardContent defaults)
- Form field gap: `gap-4`
- Action bar (header buttons): `gap-2`

---

## State Feedback

| State | Component |
|-------|-----------|
| Loading data | `Skeleton` matching the content shape |
| Empty data | `EmptyState` with icon + message + CTA |
| Form submitting | Disabled button + spinner |
| Action success | `sonner` toast: `toast.success("Skill approved")` |
| Action error | `sonner` toast: `toast.error("Failed to approve skill")` |
| Form validation error | Inline below field via React Hook Form |

---

## Animations

Framer Motion is available but use sparingly:
- Page transitions: subtle fade-in only.
- Dialog/Sheet: use shadcn's built-in transitions.
- No gratuitous animations that slow the UI.

_Last updated: 2026-06-24_
