import { db } from "@/lib/db";
import { DEAL_STAGE_PROBABILITY } from "@/lib/constants";
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
