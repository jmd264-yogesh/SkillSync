import { db } from "@/lib/db";
import {
  DEAL_STAGE_PROBABILITY,
  rateForRole,
  rateRoleKey,
  WORKING_DAYS_PER_MONTH,
  TARGET_UTILISATION,
  HIRING_LEAD_TIME_WEEKS,
} from "@/lib/constants";
import { normalizeResourceRequest } from "@/lib/role-mapping";
import { getEmployeeExtensionLikelihoodMap } from "@/server/services/extension-forecast.service";
import type { ProjectCategory } from "@prisma/client";

export interface RoleDemand {
  role: string;
  demandFTE: number;
  supplyFTE: number;
  shortfall: number;
  redeployableFTE: number;
}

export interface NewProjectForecast {
  totalDemandFTE: number;
  totalSupplyFTE: number;
  totalShortfall: number;
  byRole: RoleDemand[];
  reallocationCandidates: { employeeId: string; name: string; role: string | null; freeCapacity: number }[];
  decision: "YES" | "YES_WITH_REDEPLOYMENTS" | "NO_HIRE_REQUIRED";
  decisionDetail: string;
}

export interface MonthlyGap {
  month: string;
  role: string;
  confirmedFTE: number;
  probableFTE: number;
  totalDemandFTE: number;
  supplyFTE: number;
  gap: number;
}

export interface AttritionRecord {
  name: string;
  role: string | null;
  resignationDate: Date;
}

export interface PipelineOutlook {
  monthlyGaps: MonthlyGap[];
  firstShortfallMonth: string | null;
  firstConfirmedShortfallMonth: string | null;
  confirmedCount: number;
  probableCount: number;
  attritionCount: number;
  dataCoverage: number;
  // Supply-side enrichment
  totalEmployees: number;
  benchCount: number;
  overAllocCount: number;
  attritionDetail: AttritionRecord[];
  roleHeadcount: { role: string; count: number }[];
}

/**
 * Forecast demand for a set of pipeline requests (or ad-hoc params).
 * Uses RoleMixTemplate to expand category → role FTEs.
 */
export async function forecastNewProjects(params: {
  pipelineRequestIds?: string[];
  adHoc?: { category: ProjectCategory; count: number; start: Date; weeks: number }[];
}): Promise<NewProjectForecast> {
  const { pipelineRequestIds, adHoc } = params;
  const roleDemand = new Map<string, number>();

  // Build demand from pipeline requests
  if (pipelineRequestIds && pipelineRequestIds.length > 0) {
    const requests = await db.pipelineRequest.findMany({
      where: { id: { in: pipelineRequestIds } },
    });
    for (const req of requests) {
      const count = req.resourcesRequested ? parseInt(req.resourcesRequested, 10) || 1 : 1;
      // Derive category from skillset text (simplified mapping)
      const category: ProjectCategory = "OTHER";
      const templates = await db.roleMixTemplate.findMany({ where: { category } });
      for (const t of templates) {
        roleDemand.set(t.role, (roleDemand.get(t.role) ?? 0) + t.fte * count);
      }
    }
  }

  // Build demand from ad-hoc
  if (adHoc && adHoc.length > 0) {
    for (const item of adHoc) {
      const templates = await db.roleMixTemplate.findMany({ where: { category: item.category } });
      for (const t of templates) {
        roleDemand.set(t.role, (roleDemand.get(t.role) ?? 0) + t.fte * item.count);
      }
    }
  }

  if (roleDemand.size === 0) {
    return {
      totalDemandFTE: 0, totalSupplyFTE: 0, totalShortfall: 0,
      byRole: [], reallocationCandidates: [],
      decision: "YES", decisionDetail: "No demand requirements specified.",
    };
  }

  // Compute supply: employees by role with available capacity
  const allEmployees = await db.employee.findMany({
    include: {
      allocations: { where: { project: { status: { notIn: ["COMPLETED"] } } } },
    },
  });

  const supplyByRole = new Map<string, number>();
  const redeployable: { employeeId: string; name: string; role: string | null; freeCapacity: number }[] = [];

  // Also fetch ramp-down/ghost candidates
  const shadowFlags = await db.shadowFlag.findMany({ where: { flagType: "GHOST" } });
  const ghostEmpIds = new Set(shadowFlags.map((f) => f.employeeId));

  for (const emp of allEmployees) {
    const usedPct = emp.allocations.reduce((s, a) => s + a.allocation, 0);
    const freePct = Math.max(0, 100 - usedPct) / 100;
    if (freePct > 0) {
      const role = emp.jobName ?? "Unknown";
      supplyByRole.set(role, (supplyByRole.get(role) ?? 0) + freePct);
      if (freePct > 0.2 || ghostEmpIds.has(emp.id)) {
        redeployable.push({ employeeId: emp.id, name: emp.name, role: emp.jobName, freeCapacity: freePct });
      }
    }
  }

  redeployable.sort((a, b) => b.freeCapacity - a.freeCapacity);

  const byRole: RoleDemand[] = [];
  let totalDemand = 0, totalSupply = 0, totalShortfall = 0;

  for (const [role, demandFTE] of roleDemand) {
    const supplyFTE = supplyByRole.get(role) ?? 0;
    const redeployableFTE = redeployable
      .filter((r) => r.role === role)
      .reduce((s, r) => s + r.freeCapacity, 0);
    const shortfall = Math.max(0, demandFTE - supplyFTE);
    byRole.push({ role, demandFTE, supplyFTE, shortfall, redeployableFTE });
    totalDemand += demandFTE;
    totalSupply += supplyFTE;
    totalShortfall += shortfall;
  }

  const redeployCount = redeployable.filter((r) => {
    const demand = roleDemand.get(r.role ?? "Unknown") ?? 0;
    return demand > 0;
  }).length;

  let decision: NewProjectForecast["decision"];
  let decisionDetail: string;

  if (totalShortfall === 0) {
    decision = redeployCount > 0 ? "YES_WITH_REDEPLOYMENTS" : "YES";
    decisionDetail = redeployCount > 0
      ? `Yes - ${redeployCount} redeployment(s) recommended to cover demand.`
      : "Yes - sufficient supply available with no redeployments needed.";
  } else {
    decision = "NO_HIRE_REQUIRED";
    const shortRoles = byRole.filter((r) => r.shortfall > 0).map((r) => `${r.role} (${r.shortfall.toFixed(1)} FTE)`);
    decisionDetail = `Shortfall detected: ${shortRoles.join(", ")}. Hiring required.`;
  }

  return {
    totalDemandFTE: totalDemand,
    totalSupplyFTE: totalSupply,
    totalShortfall,
    byRole,
    reallocationCandidates: redeployable.slice(0, 10),
    decision,
    decisionDetail,
  };
}

/**
 * 6-month pipeline outlook by cluster.
 * Weights unsigned pipeline by HubSpot deal stage probability.
 */
export async function getPipelineOutlook(params: {
  months?: number;
  cluster?: number;
}): Promise<PipelineOutlook> {
  const { months = 6, cluster } = params;
  const now = new Date();

  const requests = await db.pipelineRequest.findMany({
    where: {
      ...(cluster ? { cluster } : {}),
      likelyStart: { not: null },
    },
  });

  // Attrition: employees resigning in the next N months
  const windowEnd = new Date(now);
  windowEnd.setMonth(windowEnd.getMonth() + months);
  const attrition = await db.employee.findMany({
    where: { dateOfResignation: { gte: now, lte: windowEnd } },
  });
  const attritionCount = attrition.length;

  // Current supply by role (approved + active)
  const activeEmployees = await db.employee.findMany({
    include: { allocations: { where: { project: { status: { notIn: ["COMPLETED"] } } } } },
  });

  const confirmedCount = requests.filter((r) => r.sowSigned).length;
  const probableCount = requests.filter((r) => !r.sowSigned).length;

  // Build month × role demand matrix
  const monthlyGapMap = new Map<string, Map<string, { confirmed: number; probable: number }>>();

  for (const req of requests) {
    if (!req.likelyStart) continue;
    const start = new Date(req.likelyStart);
    if (start > windowEnd) continue;

    const weekDuration = req.numberOfWeeks ?? 4;
    const endReq = new Date(start.getTime() + weekDuration * 7 * 24 * 3600 * 1000);

    const stageProb = req.sowSigned ? 1.0 : (DEAL_STAGE_PROBABILITY[req.dealStage ?? ""] ?? 0.3);
    const headcount = req.resourcesRequested ? parseInt(req.resourcesRequested, 10) || 1 : 1;

    // Distribute across months
    const cursor = new Date(start);
    while (cursor <= endReq && cursor <= windowEnd) {
      const monthKey = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
      const role = "General"; // simplified; real version expands via role-mix template

      if (!monthlyGapMap.has(monthKey)) monthlyGapMap.set(monthKey, new Map());
      const roleMap = monthlyGapMap.get(monthKey)!;
      const existing = roleMap.get(role) ?? { confirmed: 0, probable: 0 };

      if (req.sowSigned) existing.confirmed += headcount;
      else existing.probable += headcount * stageProb;
      roleMap.set(role, existing);

      cursor.setMonth(cursor.getMonth() + 1);
    }
  }

  // Build supply by month (subtract attrition)
  const baseSupply = activeEmployees.length - attritionCount;

  const monthlyGaps: MonthlyGap[] = [];
  const sortedMonths = Array.from(monthlyGapMap.keys()).sort();
  let firstShortfallMonth: string | null = null;
  let firstConfirmedShortfallMonth: string | null = null;

  for (const month of sortedMonths) {
    const roleMap = monthlyGapMap.get(month)!;
    for (const [role, { confirmed, probable }] of roleMap) {
      const totalDemand = confirmed + probable;
      const supplyFTE = baseSupply;
      const gap = supplyFTE - totalDemand;
      if (gap < 0 && !firstShortfallMonth) firstShortfallMonth = month;
      if (supplyFTE < confirmed && !firstConfirmedShortfallMonth) firstConfirmedShortfallMonth = month;
      monthlyGaps.push({
        month, role,
        confirmedFTE: confirmed, probableFTE: probable,
        totalDemandFTE: totalDemand, supplyFTE, gap,
      });
    }
  }

  // Data coverage: % of requests with valid likelyStart
  const dataCoverage = requests.length > 0
    ? Math.round(requests.filter((r) => r.likelyStart).length / requests.length * 100)
    : 0;

  // Supply-side enrichment
  const totalEmployees = activeEmployees.length;
  const benchCount = activeEmployees.filter((e) => e.allocations.length === 0).length;
  const overAllocCount = activeEmployees.filter((e) => {
    const totalAlloc = e.allocations.reduce((s, a) => s + a.allocation, 0);
    return totalAlloc > 100;
  }).length;

  const attritionDetail: AttritionRecord[] = attrition
    .filter((e) => e.dateOfResignation !== null)
    .map((e) => ({
      name: e.name,
      role: e.jobName,
      resignationDate: e.dateOfResignation as Date,
    }))
    .sort((a, b) => a.resignationDate.getTime() - b.resignationDate.getTime());

  // Role headcount (top 10 by count, ignoring null)
  const roleMap = new Map<string, number>();
  for (const e of activeEmployees) {
    const role = e.jobName ?? "Unclassified";
    roleMap.set(role, (roleMap.get(role) ?? 0) + 1);
  }
  const roleHeadcount = Array.from(roleMap.entries())
    .map(([role, count]) => ({ role, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    monthlyGaps, firstShortfallMonth, firstConfirmedShortfallMonth,
    confirmedCount, probableCount, attritionCount, dataCoverage,
    totalEmployees, benchCount, overAllocCount, attritionDetail, roleHeadcount,
  };
}

// ─── Revenue-Aware Resource Forecast ─────────────────────────
// Answers two questions from the meeting notes:
//   1. "How many resources are we short, by role and month?"
//   2. "What revenue can we make with our resources, and how many do we need
//       to hit a monthly/annual revenue target?"

export type ForecastScenario = "confirmed" | "weighted" | "all";

export interface MonthlyForecastPoint {
  month: string;                 // "2026-03"
  label: string;                 // "Mar 2026"
  confirmedDemandFTE: number;
  probableDemandFTE: number;
  demandFTE: number;
  supplyFTE: number;
  gapFTE: number;                // supply − demand (negative = short)
  filledFTE: number;             // min(demand, supply), billable if staffed
  projectedRevenue: number;      // filled × role rate
  revenueAtRisk: number;         // shortfall × role rate
}

export interface RoleForecastRow {
  role: string;
  peakDemandFTE: number;
  supplyFTE: number;             // avg free capacity over horizon
  shortfallFTE: number;          // peak shortfall
  hireCount: number;             // ceil(peak shortfall)
  hireByDate: string | null;     // first-shortfall month − hiring lead time
  billRate: number;              // day rate
  revenueAtRiskMonthly: number;
}

export interface RevenueTargetResult {
  target: number;
  period: "monthly" | "annual";
  targetMonthly: number;
  avgBillRateMonthly: number;
  requiredBillableFTE: number;
  currentBillableFTE: number;
  additionalFTENeeded: number;
  coverableFromBench: boolean;
  hiresByRole: { role: string; hireCount: number }[];
  achievable: boolean;
}

export interface ResourceForecast {
  horizonMonths: number;
  scenario: ForecastScenario;
  monthly: MonthlyForecastPoint[];
  byRole: RoleForecastRow[];
  totalShortfallFTE: number;
  totalHireCount: number;
  firstShortfallMonth: string | null;
  hireByDate: string | null;
  // Revenue (annualised)
  projectedAnnualRevenue: number;
  projectedAnnualCost: number;
  projectedMarginPct: number;
  revenueAtRiskAnnual: number;
  // Supply edges
  totalEmployees: number;
  benchFTE: number;
  attritionCount: number;
  overAllocCount: number;
  dataCoverage: number;
  // Optional reverse solve
  revenueTarget: RevenueTargetResult | null;
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function monthLabel(d: Date): string {
  return d.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}
function overlapDays(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): number {
  const start = Math.max(aStart.getTime(), bStart.getTime());
  const end = Math.min(aEnd.getTime(), bEnd.getTime());
  if (end <= start) return 0;
  return Math.ceil((end - start) / (1000 * 60 * 60 * 24));
}

function normStage(raw: string | null): string {
  if (!raw) return "UNKNOWN";
  return raw.toUpperCase().replace(/\s+/g, "_");
}

export async function getResourceForecast(params: {
  horizonMonths?: number;
  scenario?: ForecastScenario;
  revenueTarget?: number;
  targetPeriod?: "monthly" | "annual";
  wonStages?: string[]; // Scenario Planner: only these deal stages count, treated as confirmed demand
}): Promise<ResourceForecast> {
  const horizonMonths = Math.min(24, Math.max(1, params.horizonMonths ?? 6));
  const scenario: ForecastScenario = params.scenario ?? "weighted";
  const wonStages = params.wonStages;
  const now = new Date();

  // Build the month grid: [now-month … +horizon)
  const months = Array.from({ length: horizonMonths }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const start = new Date(d.getFullYear(), d.getMonth(), 1);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
    return { key: monthKey(d), label: monthLabel(d), start, end };
  });
  const horizonEnd = months[months.length - 1]!.end;

  // ── Demand: month → role → { confirmed, probableWeighted, probableRaw } ──
  const demand = new Map<string, Map<string, { confirmed: number; probW: number; probRaw: number }>>();
  for (const m of months) demand.set(m.key, new Map());

  const requests = await db.pipelineRequest.findMany({ where: { likelyStart: { not: null } } });
  for (const req of requests) {
    if (!req.likelyStart) continue;
    // Scenario Planner: keep only deals in the assumed-won stages, and treat them as confirmed
    if (wonStages && !wonStages.includes(normStage(req.dealStage))) continue;
    const start = new Date(req.likelyStart);
    if (start > horizonEnd) continue;
    const weeks = req.numberOfWeeks ?? 8;
    const end = new Date(start.getTime() + weeks * 7 * 24 * 3600 * 1000);

    const parsed = normalizeResourceRequest(req.resourcesRequested ?? null);
    const roleKey = rateRoleKey(parsed.display === "Unknown" ? req.resourcesRequested : parsed.display);
    const count = parsed.count > 0 ? parsed.count : 1;
    const prob = req.sowSigned ? 1 : (DEAL_STAGE_PROBABILITY[req.dealStage ?? ""] ?? 0.3);
    const treatAsWon = wonStages ? true : req.sowSigned;

    for (const m of months) {
      if (overlapDays(start, end, m.start, m.end) <= 0) continue;
      const roleMap = demand.get(m.key)!;
      const cur = roleMap.get(roleKey) ?? { confirmed: 0, probW: 0, probRaw: 0 };
      if (treatAsWon) {
        cur.confirmed += count;
      } else {
        cur.probW += count * prob;
        cur.probRaw += count;
      }
      roleMap.set(roleKey, cur);
    }
  }

  // ── Supply: employees → per-month free FTE by role ──
  // Extension Radar signal: people on engagements likely to extend will NOT roll off
  // when their allocation end-date says, so we hold them "allocated" through the horizon.
  const extensionMap = await getEmployeeExtensionLikelihoodMap().catch(
    () => new Map<string, { band: string; score: number; clientName: string }>(),
  );

  const employees = await db.employee.findMany({
    select: {
      id: true,
      weeklyCapacity: true,
      jobName: true,
      dateOfResignation: true,
      allocations: {
        where: { project: { status: { notIn: ["COMPLETED"] } } },
        select: { allocation: true, startDate: true, endDate: true },
      },
      leaves: {
        where: { endDate: { gte: now } },
        select: { startDate: true, endDate: true },
      },
    },
  });

  const supply = new Map<string, Map<string, number>>();
  for (const m of months) supply.set(m.key, new Map());

  let benchFTE = 0;
  let attritionCount = 0;
  let overAllocCount = 0;

  for (const emp of employees) {
    const baseFTE = Math.min(1, (emp.weeklyCapacity || 40) / 40);
    const roleKey = rateRoleKey(emp.jobName);
    const resign = emp.dateOfResignation;
    if (resign && resign >= now && resign <= horizonEnd) attritionCount++;

    // Extension Radar: score >= 65 = LIKELY/VERY_LIKELY to extend, so this person
    // is unlikely to actually free up at their allocation end-date.
    const ext = extensionMap.get(emp.id);
    const extensionLikely = ext ? ext.score >= 65 : false;

    // Over-allocation and bench are "as of now": only allocations overlapping today
    // count, so non-overlapping past/future allocations do not inflate the total.
    const activeNow = emp.allocations.filter((a) => {
      const aStart = a.startDate ?? new Date(0);
      const aEnd = a.endDate ?? horizonEnd;
      return aStart <= now && aEnd >= now;
    });
    const nowAllocPct = activeNow.reduce((s, a) => s + a.allocation, 0);
    if (nowAllocPct > 100) overAllocCount++;
    if (activeNow.length === 0 && (!resign || resign > now)) benchFTE += baseFTE;

    for (const m of months) {
      // Gone by this month?
      if (resign && resign < m.start) continue;
      const workingDays = WORKING_DAYS_PER_MONTH;

      // Allocated fraction: alloc% of employees overlapping the month
      let allocatedFraction = 0;
      for (const a of emp.allocations) {
        const aStart = a.startDate ?? new Date(0);
        // Hold likely-to-extend allocations open through the horizon: they won't roll off on time.
        const aEnd = (extensionLikely && a.endDate && a.endDate <= horizonEnd)
          ? horizonEnd
          : (a.endDate ?? horizonEnd);
        if (overlapDays(aStart, aEnd, m.start, m.end) > 0) {
          allocatedFraction += a.allocation / 100;
        }
      }
      let free = Math.max(0, baseFTE - Math.min(baseFTE, allocatedFraction));

      // Planned leave reduces free capacity for the covered fraction of the month
      let leaveDays = 0;
      for (const lv of emp.leaves) {
        leaveDays += overlapDays(lv.startDate, lv.endDate, m.start, m.end);
      }
      if (leaveDays > 0) free = Math.max(0, free - baseFTE * Math.min(1, leaveDays / workingDays));

      supply.get(m.key)!.set(roleKey, (supply.get(m.key)!.get(roleKey) ?? 0) + free);
    }
  }

  // ── Assemble monthly points + per-role aggregation ──
  const roleAgg = new Map<string, { peakDemand: number; supplySum: number; peakShortfall: number; firstShort: string | null; revRiskMonthly: number }>();
  const monthly: MonthlyForecastPoint[] = [];
  let firstShortfallMonth: string | null = null;

  for (const m of months) {
    const dRoles = demand.get(m.key)!;
    const sRoles = supply.get(m.key)!;
    const allRoles = new Set<string>([...dRoles.keys(), ...sRoles.keys()]);

    let confirmedDemandFTE = 0, probableDemandFTE = 0, demandFTE = 0, supplyFTE = 0, filledFTE = 0;
    let projectedRevenue = 0, revenueAtRisk = 0;

    for (const role of allRoles) {
      const d = dRoles.get(role) ?? { confirmed: 0, probW: 0, probRaw: 0 };
      const probable = scenario === "confirmed" ? 0 : scenario === "all" ? d.probRaw : d.probW;
      const roleDemand = d.confirmed + probable;
      const roleSupply = sRoles.get(role) ?? 0;
      const roleFilled = Math.min(roleDemand, roleSupply);
      const roleShort = Math.max(0, roleDemand - roleSupply);
      const rate = rateForRole(role);
      const billMonthly = rate.billRate * WORKING_DAYS_PER_MONTH;

      confirmedDemandFTE += d.confirmed;
      probableDemandFTE += probable;
      demandFTE += roleDemand;
      supplyFTE += roleSupply;
      filledFTE += roleFilled;
      projectedRevenue += roleFilled * billMonthly;
      revenueAtRisk += roleShort * billMonthly;

      const agg = roleAgg.get(role) ?? { peakDemand: 0, supplySum: 0, peakShortfall: 0, firstShort: null, revRiskMonthly: 0 };
      agg.peakDemand = Math.max(agg.peakDemand, roleDemand);
      agg.supplySum += roleSupply;
      if (roleShort > agg.peakShortfall) {
        agg.peakShortfall = roleShort;
        agg.revRiskMonthly = roleShort * billMonthly;
      }
      if (roleShort > 0 && !agg.firstShort) agg.firstShort = m.key;
      roleAgg.set(role, agg);
    }

    const gapFTE = supplyFTE - demandFTE;
    if (gapFTE < 0 && !firstShortfallMonth) firstShortfallMonth = m.key;

    monthly.push({
      month: m.key, label: m.label,
      confirmedDemandFTE: round1(confirmedDemandFTE),
      probableDemandFTE: round1(probableDemandFTE),
      demandFTE: round1(demandFTE),
      supplyFTE: round1(supplyFTE),
      gapFTE: round1(gapFTE),
      filledFTE: round1(filledFTE),
      projectedRevenue: Math.round(projectedRevenue),
      revenueAtRisk: Math.round(revenueAtRisk),
    });
  }

  // Per-role rows (drop the "Other" bucket if it has no real signal)
  const leadTimeMs = HIRING_LEAD_TIME_WEEKS * 7 * 24 * 3600 * 1000;
  const byRole: RoleForecastRow[] = [...roleAgg.entries()]
    .filter(([role, a]) => role !== "Other" || a.peakDemand > 0)
    .map(([role, a]) => {
      let hireByDate: string | null = null;
      if (a.firstShort) {
        const fm = months.find((m) => m.key === a.firstShort);
        if (fm) hireByDate = monthKey(new Date(fm.start.getTime() - leadTimeMs));
      }
      return {
        role,
        peakDemandFTE: round1(a.peakDemand),
        supplyFTE: round1(a.supplySum / horizonMonths),
        shortfallFTE: round1(a.peakShortfall),
        hireCount: Math.ceil(a.peakShortfall - 1e-9),
        hireByDate,
        billRate: rateForRole(role).billRate,
        revenueAtRiskMonthly: Math.round(a.revRiskMonthly),
      };
    })
    .sort((x, y) => y.shortfallFTE - x.shortfallFTE);

  const totalShortfallFTE = round1(byRole.reduce((s, r) => s + r.shortfallFTE, 0));
  const totalHireCount = byRole.reduce((s, r) => s + r.hireCount, 0);

  // ── Revenue annualisation ──
  const monthsCount = monthly.length || 1;
  const revSum = monthly.reduce((s, p) => s + p.projectedRevenue, 0);
  const riskSum = monthly.reduce((s, p) => s + p.revenueAtRisk, 0);
  const filledSum = monthly.reduce((s, p) => s + p.filledFTE, 0);
  const avgFilledFTE = filledSum / monthsCount;
  // Deployed cost from the roles actually filled (blended)
  const blendedCostMonthly = blendedRate(demand, supply, months, scenario, "cost");
  const costSum = monthly.reduce((s, p) => s + p.filledFTE * blendedCostMonthly, 0);

  const projectedAnnualRevenue = Math.round((revSum / monthsCount) * 12);
  const projectedAnnualCost = Math.round((costSum / monthsCount) * 12);
  const revenueAtRiskAnnual = Math.round((riskSum / monthsCount) * 12);
  const projectedMarginPct = projectedAnnualRevenue > 0
    ? Math.round(((projectedAnnualRevenue - projectedAnnualCost) / projectedAnnualRevenue) * 100)
    : 0;

  // ── Reverse solve: revenue target → resources needed ──
  let revenueTarget: RevenueTargetResult | null = null;
  if (params.revenueTarget && params.revenueTarget > 0) {
    const period = params.targetPeriod ?? "annual";
    const targetMonthly = period === "annual" ? params.revenueTarget / 12 : params.revenueTarget;
    const avgBillRateMonthly = blendedRate(demand, supply, months, scenario, "bill");
    const perFteRevenueMonthly = avgBillRateMonthly * TARGET_UTILISATION;
    const requiredBillableFTE = perFteRevenueMonthly > 0 ? targetMonthly / perFteRevenueMonthly : 0;
    const currentBillableFTE = avgFilledFTE;
    const additionalFTENeeded = Math.max(0, requiredBillableFTE - currentBillableFTE);
    const coverableFromBench = additionalFTENeeded <= benchFTE + 1e-9;

    // Distribute hires across roles proportional to peak demand mix
    const demandMixTotal = byRole.reduce((s, r) => s + r.peakDemandFTE, 0) || 1;
    const hiresByRole = byRole
      .filter((r) => r.peakDemandFTE > 0)
      .map((r) => ({ role: r.role, hireCount: Math.round((r.peakDemandFTE / demandMixTotal) * additionalFTENeeded) }))
      .filter((r) => r.hireCount > 0);

    revenueTarget = {
      target: params.revenueTarget,
      period,
      targetMonthly: Math.round(targetMonthly),
      avgBillRateMonthly: Math.round(avgBillRateMonthly),
      requiredBillableFTE: round1(requiredBillableFTE),
      currentBillableFTE: round1(currentBillableFTE),
      additionalFTENeeded: round1(additionalFTENeeded),
      coverableFromBench,
      hiresByRole,
      achievable: additionalFTENeeded <= 0,
    };
  }

  const dataCoverage = requests.length > 0
    ? Math.round((requests.filter((r) => r.likelyStart).length / requests.length) * 100)
    : 0;

  return {
    horizonMonths,
    scenario,
    monthly,
    byRole,
    totalShortfallFTE,
    totalHireCount,
    firstShortfallMonth,
    hireByDate: firstShortfallMonth
      ? monthKey(new Date((months.find((m) => m.key === firstShortfallMonth)?.start.getTime() ?? now.getTime()) - leadTimeMs))
      : null,
    projectedAnnualRevenue,
    projectedAnnualCost,
    projectedMarginPct,
    revenueAtRiskAnnual,
    totalEmployees: employees.length,
    benchFTE: round1(benchFTE),
    attritionCount,
    overAllocCount,
    dataCoverage,
    revenueTarget,
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// Demand-weighted blended monthly rate across roles present in the horizon.
function blendedRate(
  demand: Map<string, Map<string, { confirmed: number; probW: number; probRaw: number }>>,
  _supply: Map<string, Map<string, number>>,
  months: { key: string }[],
  scenario: ForecastScenario,
  kind: "bill" | "cost",
): number {
  let weighted = 0;
  let total = 0;
  for (const m of months) {
    const dRoles = demand.get(m.key);
    if (!dRoles) continue;
    for (const [role, d] of dRoles) {
      const probable = scenario === "confirmed" ? 0 : scenario === "all" ? d.probRaw : d.probW;
      const fte = d.confirmed + probable;
      if (fte <= 0) continue;
      const rate = rateForRole(role);
      const monthlyRate = (kind === "bill" ? rate.billRate : rate.costRate) * WORKING_DAYS_PER_MONTH;
      weighted += monthlyRate * fte;
      total += fte;
    }
  }
  if (total > 0) return weighted / total;
  // Fallback: flat default
  const fallback = rateForRole(null);
  return (kind === "bill" ? fallback.billRate : fallback.costRate) * WORKING_DAYS_PER_MONTH;
}
