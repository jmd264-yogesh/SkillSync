/**
 * extension-forecast.service.ts
 *
 * Business logic for the Extension Radar module.
 * Reads pre-computed ForecastOverviewEntry rows from the DB and
 * assembles the view models used by the UI.
 */

import { db } from "@/lib/db";

// ── Types ─────────────────────────────────────────────────────

export type ExtensionBand =
  | "VERY_LIKELY"
  | "LIKELY"
  | "UNCERTAIN"
  | "UNLIKELY"
  | "UNKNOWN";

export interface ExtensionSignal {
  label: string;
  value: string;
  score: number;
  weight: number; // 0–1
  colour: "green" | "amber" | "red" | "muted";
}

export interface ExtensionForecastRow {
  id: string;
  fund: string;
  portCo: string;
  cluster: string | null;
  level: string | null;
  clientLead: string | null;
  accountOwner: string | null;
  accountManager: string | null;
  teamOwner: string | null;
  status: string | null;

  // Revenue data
  bookedPrior: number;
  bookedCurrent: number;
  unweightedCurrent: number;
  weightedCurrent: number;
  bookedMonth1: number;
  unweightedMonth1: number;
  weightedMonth1: number;
  bookedMonth2: number;
  unweightedMonth2: number;
  weightedMonth2: number;
  bookedMonth3: number;
  unweightedMonth3: number;
  weightedMonth3: number;
  fyBooked: number;
  fyUnweighted: number;
  fyWeighted: number;

  // Forecast output
  extensionScore: number;
  extensionBand: string;
  dataMonth: string;

  // Manual Overrides
  overrideStatus?: string | null;
  overrideNotes?: string | null;
  overrideUpdatedAt?: Date | null;

  // Derived
  forwardWeighted: number;
  signals: ExtensionSignal[];
  effectiveScore: number;
  effectiveBand: string;
}

export interface ExtensionSummary {
  totalEntries: number;
  avgScore: number;
  byBand: Record<ExtensionBand, number>;
  totalFyBooked: number;
  totalFyWeighted: number;
  topRisks: ExtensionForecastRow[]; // bottom 5 by score
  topOpportunities: ExtensionForecastRow[]; // top 5 by forward weighted
}

// ── Helpers ───────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  "▲▲": "Strong growth",
  "▲": "Growing",
  "▶": "Stable",
  "▼": "Declining",
  "▼▼": "Strong decline",
  "-": "No signal",
};

function statusColour(status: string | null): "green" | "amber" | "red" | "muted" {
  if (!status) return "muted";
  if (status === "▲▲" || status === "▲") return "green";
  if (status === "▶" || status === "-") return "amber";
  return "red";
}

function levelColour(level: string | null): "green" | "amber" | "red" | "muted" {
  if (!level) return "muted";
  if (level === "Gold") return "green";
  if (level === "Silver" || level === "Servicing") return "amber";
  return "red";
}

function bandColour(band: string): "green" | "amber" | "red" | "muted" {
  if (band === "VERY_LIKELY") return "green";
  if (band === "LIKELY") return "green";
  if (band === "UNCERTAIN") return "amber";
  if (band === "UNLIKELY") return "red";
  return "muted";
}

function fmt(n: number): string {
  if (n === 0) return "£0";
  if (n >= 1_000_000) return `£${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `£${(n / 1_000).toFixed(0)}K`;
  return `£${n.toFixed(0)}`;
}

function computeEffectiveScore(
  baseScore: number,
  baseBand: string,
  overrideStatus?: string | null
): { effectiveScore: number; effectiveBand: string } {
  if (!overrideStatus || overrideStatus === "NONE") {
    return { effectiveScore: baseScore, effectiveBand: baseBand };
  }
  switch (overrideStatus) {
    case "CONFIRMED_EXTENSION":
      return { effectiveScore: 95, effectiveBand: "VERY_LIKELY" };
    case "LIKELY_EXTENSION":
      return { effectiveScore: 80, effectiveBand: "LIKELY" };
    case "UNLIKELY_EXTENSION":
      return { effectiveScore: 35, effectiveBand: "UNCERTAIN" };
    case "CONFIRMED_DROPPING":
      return { effectiveScore: 10, effectiveBand: "UNLIKELY" };
    default:
      return { effectiveScore: baseScore, effectiveBand: baseBand };
  }
}

function buildSignals(row: {
  level: string | null;
  status: string | null;
  forwardWeighted: number;
  fyBooked: number;
  extensionScore: number;
  overrideStatus?: string | null;
}): ExtensionSignal[] {
  const levelScoreMap: Record<string, number> = {
    Gold: 100,
    Silver: 70,
    Bronze: 40,
    Servicing: 55,
  };
  const statusScoreMap: Record<string, number> = {
    "▲▲": 100,
    "▲": 80,
    "▶": 50,
    "▼": 20,
    "▼▼": 0,
    "-": 50,
  };

  const levelScore = levelScoreMap[row.level ?? ""] ?? 30;
  const statusScore = statusScoreMap[row.status ?? ""] ?? 40;

  const baseSignals: ExtensionSignal[] = [
    {
      label: "Client tier",
      value: row.level ?? "Unknown",
      score: levelScore,
      weight: 0.25,
      colour: levelColour(row.level),
    },
    {
      label: "Revenue trend",
      value: STATUS_LABEL[row.status ?? "-"] ?? "Unknown",
      score: statusScore,
      weight: 0.25,
      colour: statusColour(row.status),
    },
    {
      label: "Forward pipeline (3 months)",
      value: fmt(row.forwardWeighted),
      score: row.forwardWeighted > 50_000 ? 85 : row.forwardWeighted > 10_000 ? 60 : row.forwardWeighted > 0 ? 40 : 0,
      weight: 0.30,
      colour:
        row.forwardWeighted > 50_000
          ? "green"
          : row.forwardWeighted > 10_000
          ? "amber"
          : row.forwardWeighted > 0
          ? "amber"
          : "red",
    },
    {
      label: "FY booked revenue",
      value: fmt(row.fyBooked),
      score: row.fyBooked > 200_000 ? 90 : row.fyBooked > 50_000 ? 65 : row.fyBooked > 0 ? 40 : 5,
      weight: 0.20,
      colour:
        row.fyBooked > 200_000 ? "green" : row.fyBooked > 50_000 ? "amber" : "red",
    },
  ];

  if (row.overrideStatus && row.overrideStatus !== "NONE") {
    const overrideLabelMap: Record<string, string> = {
      CONFIRMED_EXTENSION: "Confirmed Extension (PM/RM Override)",
      LIKELY_EXTENSION: "Likely Extension (PM/RM Input)",
      UNLIKELY_EXTENSION: "Unlikely to Extend (PM/RM Input)",
      CONFIRMED_DROPPING: "Confirmed Dropping (PM/RM Override)",
    };
    baseSignals.unshift({
      label: "PM Override Signal",
      value: overrideLabelMap[row.overrideStatus] ?? row.overrideStatus,
      score: row.overrideStatus.includes("EXTENSION") ? 90 : 10,
      weight: 1.0,
      colour: row.overrideStatus.includes("EXTENSION") ? "green" : "red",
    });
  }

  return baseSignals;
}

function toRow(entry: {
  id: string;
  fund: string;
  portCo: string;
  cluster: string | null;
  level: string | null;
  clientLead: string | null;
  accountOwner: string | null;
  accountManager: string | null;
  teamOwner: string | null;
  status: string | null;
  bookedPrior: number;
  bookedCurrent: number;
  unweightedCurrent: number;
  weightedCurrent: number;
  bookedMonth1: number;
  unweightedMonth1: number;
  weightedMonth1: number;
  bookedMonth2: number;
  unweightedMonth2: number;
  weightedMonth2: number;
  bookedMonth3: number;
  unweightedMonth3: number;
  weightedMonth3: number;
  fyBooked: number;
  fyUnweighted: number;
  fyWeighted: number;
  extensionScore: number;
  extensionBand: string;
  dataMonth: string;
  overrideStatus?: string | null;
  overrideNotes?: string | null;
  overrideUpdatedAt?: Date | null;
}): ExtensionForecastRow {
  const forwardWeighted =
    entry.weightedMonth1 + entry.weightedMonth2 + entry.weightedMonth3;
  const { effectiveScore, effectiveBand } = computeEffectiveScore(
    entry.extensionScore,
    entry.extensionBand,
    entry.overrideStatus
  );
  const signals = buildSignals({
    level: entry.level,
    status: entry.status,
    forwardWeighted,
    fyBooked: entry.fyBooked,
    extensionScore: entry.extensionScore,
    overrideStatus: entry.overrideStatus,
  });
  return {
    ...entry,
    forwardWeighted,
    signals,
    effectiveScore,
    effectiveBand,
  };
}

// ── Public API ────────────────────────────────────────────────

/**
 * Returns all forecast rows for the latest data month, sorted by effectiveScore desc.
 */
export async function getExtensionForecasts(filters?: {
  cluster?: string;
  level?: string;
  band?: string;
}): Promise<ExtensionForecastRow[]> {
  // Latest data month
  const latest = await db.forecastOverviewEntry.findFirst({
    orderBy: { dataMonth: "desc" },
    select: { dataMonth: true },
  });
  if (!latest) return [];

  const entries = await db.forecastOverviewEntry.findMany({
    where: {
      dataMonth: latest.dataMonth,
      ...(filters?.cluster ? { cluster: filters.cluster } : {}),
      ...(filters?.level ? { level: filters.level } : {}),
    },
  });

  const mapped = entries.map(toRow);
  const filtered = filters?.band
    ? mapped.filter((r) => r.effectiveBand === filters.band)
    : mapped;

  return filtered.sort((a, b) => b.effectiveScore - a.effectiveScore);
}

/**
 * Update manual extension override for a PortCo record.
 */
export async function updateForecastOverride(params: {
  id: string;
  overrideStatus: string | null;
  overrideNotes?: string | null;
}): Promise<ExtensionForecastRow> {
  const updated = await db.forecastOverviewEntry.update({
    where: { id: params.id },
    data: {
      overrideStatus: params.overrideStatus === "NONE" ? null : params.overrideStatus,
      overrideNotes: params.overrideNotes || null,
      overrideUpdatedAt: new Date(),
    },
  });

  return toRow(updated);
}

/**
 * Portfolio-level summary stats.
 */
export async function getExtensionSummary(): Promise<ExtensionSummary> {
  const rows = await getExtensionForecasts();

  if (rows.length === 0) {
    return {
      totalEntries: 0,
      avgScore: 0,
      byBand: { VERY_LIKELY: 0, LIKELY: 0, UNCERTAIN: 0, UNLIKELY: 0, UNKNOWN: 0 },
      totalFyBooked: 0,
      totalFyWeighted: 0,
      topRisks: [],
      topOpportunities: [],
    };
  }

  const avgScore = Math.round(
    rows.reduce((s, r) => s + r.effectiveScore, 0) / rows.length
  );

  const byBand: Record<ExtensionBand, number> = {
    VERY_LIKELY: 0,
    LIKELY: 0,
    UNCERTAIN: 0,
    UNLIKELY: 0,
    UNKNOWN: 0,
  };
  for (const r of rows) {
    const band = r.effectiveBand as ExtensionBand;
    byBand[band] = (byBand[band] ?? 0) + 1;
  }

  const totalFyBooked = rows.reduce((s, r) => s + r.fyBooked, 0);
  const totalFyWeighted = rows.reduce((s, r) => s + r.fyWeighted, 0);

  const topRisks = [...rows]
    .sort((a, b) => a.effectiveScore - b.effectiveScore)
    .slice(0, 5);

  const topOpportunities = [...rows]
    .sort((a, b) => b.forwardWeighted - a.forwardWeighted)
    .slice(0, 5);

  return {
    totalEntries: rows.length,
    avgScore,
    byBand,
    totalFyBooked,
    totalFyWeighted,
    topRisks,
    topOpportunities,
  };
}

/**
 * Maps employee IDs to their current project extension likelihood band and score.
 * An employee allocated to a project/client with a high extension score (e.g. VERY_LIKELY/LIKELY)
 * should be prioritized AFTER employees allocated to low-extension or non-extending projects/clients.
 */
export async function getEmployeeExtensionLikelihoodMap(): Promise<Map<string, { band: string; score: number; clientName: string }>> {
  const latest = await db.forecastOverviewEntry.findFirst({
    orderBy: { dataMonth: "desc" },
    select: { dataMonth: true },
  });

  const map = new Map<string, { band: string; score: number; clientName: string }>();
  if (!latest) return map;

  const entries = await getExtensionForecasts();

  const entryMap = new Map<string, { band: string; score: number }>();
  for (const e of entries) {
    entryMap.set(e.portCo.toLowerCase(), { band: e.effectiveBand, score: e.effectiveScore });
  }

  // Get active allocations to map employees -> projects/clients
  const allocations = await db.projectAllocation.findMany({
    where: { project: { status: { not: "COMPLETED" } } },
    include: { project: { include: { clientRef: true } } },
  });

  for (const alloc of allocations) {
    const clientName = alloc.project.clientRef?.name ?? alloc.project.clientId ?? alloc.project.name;
    const projectName = alloc.project.name;
    if (!clientName && !projectName) continue;

    const matched = entryMap.get(clientName.toLowerCase()) ?? entryMap.get(projectName.toLowerCase());
    const existing = map.get(alloc.employeeId);

    if (matched) {
      if (!existing || matched.score > existing.score) {
        map.set(alloc.employeeId, { band: matched.band, score: matched.score, clientName: clientName || projectName });
      }
    } else if (!existing) {
      // Allocated to an active project that is not in the PortCo Excel forecast (0% extension score / unlisted)
      map.set(alloc.employeeId, { band: "UNLIKELY", score: 0, clientName: projectName });
    }
  }

  return map;
}

export { bandColour, fmt, STATUS_LABEL };
