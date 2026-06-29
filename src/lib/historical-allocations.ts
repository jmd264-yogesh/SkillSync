export type Criticality = "Stable" | "Medium" | "High";

export type ResourceLine = {
  role: string;
  fte: number;
};

export type HistoricalAllocation = {
  solution: string;
  phase: string;
  criticality: Criticality;
  resources: ResourceLine[];
};

// Canonical abbreviations → exact role names matching PROPOSITION_ROLES
const R = {
  TA:  "Technical Solutions Architect",
  C:   "Consultant",
  AC:  "Associate Consultant",
  SC:  "Solutions Consultant",
  SE:  "Solutions Enabler",
  SSE: "Senior Software Engineer",
  SW:  "Software Engineer",
} as const;

// Solutions in this table map to SOLUTION_TYPES values (e.g. "Customer", "Sales").
// Phase values match ENGAGEMENT_PHASES in constants.ts.
export const HISTORICAL_ALLOCATIONS: HistoricalAllocation[] = [
  // ── Customer ── Design & Discovery ────────────────────────────────────────
  { solution: "Customer", phase: "Design & Discovery", criticality: "Stable",
    resources: [{ role: R.TA, fte: 0.12 }, { role: R.C, fte: 0.5 }, { role: R.AC, fte: 1 }, { role: R.SE, fte: 1 }, { role: R.SW, fte: 1 }] },
  { solution: "Customer", phase: "Design & Discovery", criticality: "Medium",
    resources: [{ role: R.TA, fte: 0.25 }, { role: R.C, fte: 1 }, { role: R.AC, fte: 1 }, { role: R.SE, fte: 1 }, { role: R.SW, fte: 1 }] },
  { solution: "Customer", phase: "Design & Discovery", criticality: "High",
    resources: [{ role: R.TA, fte: 0.5 }, { role: R.C, fte: 1 }, { role: R.AC, fte: 2 }, { role: R.SC, fte: 1 }, { role: R.SW, fte: 2 }] },

  // ── Customer ── Build ───────────────────────────────────────────────────
  { solution: "Customer", phase: "Build", criticality: "Stable",
    resources: [{ role: R.TA, fte: 0.12 }, { role: R.C, fte: 0.5 }, { role: R.AC, fte: 1 }, { role: R.SC, fte: 0.5 }, { role: R.SE, fte: 1 }, { role: R.SSE, fte: 1 }, { role: R.SW, fte: 2 }] },
  { solution: "Customer", phase: "Build", criticality: "Medium",
    resources: [{ role: R.TA, fte: 0.25 }, { role: R.C, fte: 1 }, { role: R.AC, fte: 1 }, { role: R.SC, fte: 1 }, { role: R.SE, fte: 1 }, { role: R.SSE, fte: 1 }, { role: R.SW, fte: 2 }] },
  { solution: "Customer", phase: "Build", criticality: "High",
    resources: [{ role: R.TA, fte: 0.5 }, { role: R.C, fte: 1 }, { role: R.AC, fte: 2 }, { role: R.SC, fte: 1 }, { role: R.SE, fte: 1 }, { role: R.SSE, fte: 2 }, { role: R.SW, fte: 3 }] },

  // ── Sales ── Design & Discovery ─────────────────────────────────────────
  { solution: "Sales", phase: "Design & Discovery", criticality: "Stable",
    resources: [{ role: R.TA, fte: 0.12 }, { role: R.C, fte: 0.5 }, { role: R.AC, fte: 1 }, { role: R.SE, fte: 1 }, { role: R.SW, fte: 1 }] },
  { solution: "Sales", phase: "Design & Discovery", criticality: "Medium",
    resources: [{ role: R.TA, fte: 0.25 }, { role: R.C, fte: 1 }, { role: R.AC, fte: 1 }, { role: R.SE, fte: 1 }, { role: R.SW, fte: 1 }] },
  { solution: "Sales", phase: "Design & Discovery", criticality: "High",
    resources: [{ role: R.TA, fte: 0.5 }, { role: R.C, fte: 1 }, { role: R.AC, fte: 2 }, { role: R.SC, fte: 1 }, { role: R.SW, fte: 2 }] },

  // ── Sales ── Build ──────────────────────────────────────────────────────
  { solution: "Sales", phase: "Build", criticality: "Stable",
    resources: [{ role: R.C, fte: 0.5 }, { role: R.AC, fte: 1 }, { role: R.SC, fte: 0.5 }, { role: R.SE, fte: 1 }, { role: R.SSE, fte: 1 }, { role: R.SW, fte: 2 }] },
  { solution: "Sales", phase: "Build", criticality: "Medium",
    resources: [{ role: R.C, fte: 1 }, { role: R.AC, fte: 1 }, { role: R.SC, fte: 1 }, { role: R.SE, fte: 1 }, { role: R.SSE, fte: 1 }, { role: R.SW, fte: 2 }] },
  { solution: "Sales", phase: "Build", criticality: "High",
    resources: [{ role: R.C, fte: 1 }, { role: R.AC, fte: 2 }, { role: R.SC, fte: 1 }, { role: R.SE, fte: 1 }, { role: R.SSE, fte: 2 }, { role: R.SW, fte: 3 }] },

  // ── Finance ── Design & Discovery ───────────────────────────────────────
  { solution: "Finance", phase: "Design & Discovery", criticality: "Stable",
    resources: [{ role: R.TA, fte: 0.12 }, { role: R.C, fte: 0.5 }, { role: R.AC, fte: 1 }, { role: R.SE, fte: 1 }, { role: R.SW, fte: 1 }] },
  { solution: "Finance", phase: "Design & Discovery", criticality: "Medium",
    resources: [{ role: R.TA, fte: 0.25 }, { role: R.C, fte: 1 }, { role: R.AC, fte: 1 }, { role: R.SE, fte: 1 }, { role: R.SW, fte: 1 }] },
  { solution: "Finance", phase: "Design & Discovery", criticality: "High",
    resources: [{ role: R.TA, fte: 0.5 }, { role: R.C, fte: 1 }, { role: R.AC, fte: 2 }, { role: R.SC, fte: 1 }, { role: R.SW, fte: 2 }] },

  // ── Finance ── Build ────────────────────────────────────────────────────
  { solution: "Finance", phase: "Build", criticality: "Stable",
    resources: [{ role: R.C, fte: 0.5 }, { role: R.AC, fte: 1 }, { role: R.SC, fte: 0.5 }, { role: R.SE, fte: 1 }, { role: R.SSE, fte: 1 }, { role: R.SW, fte: 2 }] },
  { solution: "Finance", phase: "Build", criticality: "Medium",
    resources: [{ role: R.C, fte: 1 }, { role: R.AC, fte: 1 }, { role: R.SC, fte: 1 }, { role: R.SE, fte: 1 }, { role: R.SSE, fte: 1 }, { role: R.SW, fte: 2 }] },
  { solution: "Finance", phase: "Build", criticality: "High",
    resources: [{ role: R.C, fte: 1 }, { role: R.AC, fte: 2 }, { role: R.SC, fte: 1 }, { role: R.SE, fte: 1 }, { role: R.SSE, fte: 2 }, { role: R.SW, fte: 3 }] },

  // ── Operations ── Design & Discovery ────────────────────────────────────
  { solution: "Operations", phase: "Design & Discovery", criticality: "Stable",
    resources: [{ role: R.TA, fte: 0.12 }, { role: R.C, fte: 0.5 }, { role: R.AC, fte: 1 }, { role: R.SE, fte: 1 }, { role: R.SW, fte: 1 }] },
  { solution: "Operations", phase: "Design & Discovery", criticality: "Medium",
    resources: [{ role: R.TA, fte: 0.25 }, { role: R.C, fte: 1 }, { role: R.AC, fte: 1 }, { role: R.SE, fte: 1 }, { role: R.SW, fte: 1 }] },
  { solution: "Operations", phase: "Design & Discovery", criticality: "High",
    resources: [{ role: R.TA, fte: 0.5 }, { role: R.C, fte: 1 }, { role: R.AC, fte: 2 }, { role: R.SC, fte: 1 }, { role: R.SW, fte: 2 }] },

  // ── Operations ── Build ──────────────────────────────────────────────────
  { solution: "Operations", phase: "Build", criticality: "Stable",
    resources: [{ role: R.C, fte: 0.5 }, { role: R.AC, fte: 1 }, { role: R.SC, fte: 0.5 }, { role: R.SE, fte: 1 }, { role: R.SSE, fte: 1 }, { role: R.SW, fte: 2 }] },
  { solution: "Operations", phase: "Build", criticality: "Medium",
    resources: [{ role: R.C, fte: 1 }, { role: R.AC, fte: 1 }, { role: R.SC, fte: 1 }, { role: R.SE, fte: 1 }, { role: R.SSE, fte: 1 }, { role: R.SW, fte: 2 }] },
  { solution: "Operations", phase: "Build", criticality: "High",
    resources: [{ role: R.C, fte: 1 }, { role: R.AC, fte: 2 }, { role: R.SC, fte: 1 }, { role: R.SE, fte: 1 }, { role: R.SSE, fte: 2 }, { role: R.SW, fte: 3 }] },

  // ── People ── Design & Discovery ────────────────────────────────────────
  { solution: "People", phase: "Design & Discovery", criticality: "Stable",
    resources: [{ role: R.TA, fte: 0.12 }, { role: R.C, fte: 0.5 }, { role: R.AC, fte: 1 }, { role: R.SE, fte: 1 }, { role: R.SW, fte: 1 }] },
  { solution: "People", phase: "Design & Discovery", criticality: "Medium",
    resources: [{ role: R.TA, fte: 0.25 }, { role: R.C, fte: 1 }, { role: R.AC, fte: 1 }, { role: R.SE, fte: 1 }, { role: R.SW, fte: 1 }] },
  { solution: "People", phase: "Design & Discovery", criticality: "High",
    resources: [{ role: R.TA, fte: 0.5 }, { role: R.C, fte: 1 }, { role: R.AC, fte: 2 }, { role: R.SC, fte: 1 }, { role: R.SW, fte: 2 }] },

  // ── People ── Build ──────────────────────────────────────────────────────
  { solution: "People", phase: "Build", criticality: "Stable",
    resources: [{ role: R.C, fte: 0.5 }, { role: R.AC, fte: 1 }, { role: R.SC, fte: 0.5 }, { role: R.SE, fte: 1 }, { role: R.SSE, fte: 1 }, { role: R.SW, fte: 2 }] },
  { solution: "People", phase: "Build", criticality: "Medium",
    resources: [{ role: R.C, fte: 1 }, { role: R.AC, fte: 1 }, { role: R.SC, fte: 1 }, { role: R.SE, fte: 1 }, { role: R.SSE, fte: 1 }, { role: R.SW, fte: 2 }] },
  { solution: "People", phase: "Build", criticality: "High",
    resources: [{ role: R.C, fte: 1 }, { role: R.AC, fte: 2 }, { role: R.SC, fte: 1 }, { role: R.SE, fte: 1 }, { role: R.SSE, fte: 2 }, { role: R.SW, fte: 3 }] },

  // ── Analytics / ML / Platform ── Build ──────────────────────────────────
  { solution: "Churn Prediction", phase: "Build", criticality: "Medium",
    resources: [{ role: R.TA, fte: 0.5 }, { role: R.C, fte: 1 }, { role: R.AC, fte: 2 }, { role: R.SC, fte: 1 }, { role: R.SW, fte: 2 }] },
  { solution: "Lead Scoring", phase: "Build", criticality: "Medium",
    resources: [{ role: R.TA, fte: 0.5 }, { role: R.C, fte: 1 }, { role: R.AC, fte: 2 }, { role: R.SC, fte: 1 }, { role: R.SW, fte: 2 }] },
  { solution: "Migration", phase: "Build", criticality: "Medium",
    resources: [{ role: R.TA, fte: 0.5 }, { role: R.C, fte: 1 }, { role: R.AC, fte: 2 }, { role: R.SC, fte: 1 }, { role: R.SW, fte: 2 }] },
  { solution: "Full Stack", phase: "Build", criticality: "Medium",
    resources: [{ role: R.TA, fte: 0.5 }, { role: R.C, fte: 1 }, { role: R.AC, fte: 2 }, { role: R.SC, fte: 1 }, { role: R.SW, fte: 2 }] },
];

export function lookupBaseline(
  solution: string,
  phase: string,
  criticality: string,
): HistoricalAllocation | null {
  const key = (s: string) => s.toLowerCase().trim().replace(/\s+/g, " ");
  return (
    HISTORICAL_ALLOCATIONS.find(
      (row) =>
        key(row.solution) === key(solution) &&
        key(row.phase) === key(phase) &&
        key(row.criticality) === key(criticality),
    ) ?? null
  );
}

// Compact text table used in AI system prompt for grounding
export const HISTORICAL_REFERENCE_TABLE = `
COMPANY HISTORICAL ALLOCATION REFERENCE (FTE counts, use as primary blueprint):
TA=Technical Solutions Architect, C=Consultant, AC=Associate Consultant,
SC=Solutions Consultant, SE=Solutions Enabler, SSE=Senior Software Engineer, SW=Software Engineer.
"—" means 0 FTE for that role. Criticality: Stable=lean, Medium=standard, High=expanded.

Solution          Phase               Criticality  TA    C    AC   SC   SE   SSE  SW
Customer          Design & Discovery  Stable       0.12  0.5  1    —    1    —    1
Customer          Design & Discovery  Medium       0.25  1    1    —    1    —    1
Customer          Design & Discovery  High         0.5   1    2    1    —    —    2
Customer          Build               Stable       0.12  0.5  1    0.5  1    1    2
Customer          Build               Medium       0.25  1    1    1    1    1    2
Customer          Build               High         0.5   1    2    1    1    2    3
Sales             Design & Discovery  Stable       0.12  0.5  1    —    1    —    1
Sales             Design & Discovery  Medium       0.25  1    1    —    1    —    1
Sales             Design & Discovery  High         0.5   1    2    1    —    —    2
Sales             Build               Stable       —     0.5  1    0.5  1    1    2
Sales             Build               Medium       —     1    1    1    1    1    2
Sales             Build               High         —     1    2    1    1    2    3
Finance           Design & Discovery  (same as Sales Design & Discovery above)
Finance           Build               (same as Sales Build above)
Operations        Design & Discovery  (same as Customer Design & Discovery above)
Operations        Build               (same as Sales Build above)
People            Design & Discovery  (same as Customer Design & Discovery above)
People            Build               (same as Sales Build above)
Churn Prediction  Build               Medium       0.5   1    2    1    —    —    2
Lead Scoring      Build               Medium       0.5   1    2    1    —    —    2
Migration         Build               Medium       0.5   1    2    1    —    —    2
Full Stack        Build               Medium       0.5   1    2    1    —    —    2

Pattern rules:
- Design & Discovery phase: lighter footprint, TA present, no SSE (discovery = consulting-led)
- Build phase: TA optional for Customer only, adds SSE for engineering delivery
- Stable→Medium→High: headcounts scale up; same role mix, higher counts
- High criticality: AC doubles, SSE doubles (build phase only)
`;
