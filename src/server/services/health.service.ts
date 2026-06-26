import { db } from "@/lib/db";

export type RagColor = "GREEN" | "AMBER" | "RED" | "UNKNOWN";

export interface RagTrend {
  week: string;
  scope: RagColor;
  schedule: RagColor;
  quality: RagColor;
  csat: RagColor;
  team: RagColor;
}

export interface ProjectHealthResult {
  projectId: string;
  projectName: string;
  ragFlags: string[];
  ragTrend: RagTrend[];
  leakageHours: number;
  unbillablePct: number;
  shadowCount: number;
  ghostCount: number;
  releasableFTE: number;
  isOverrun: boolean;
  isRampDown: boolean;
  contributingFactors: string[];
}

function toRag(raw: string | null): RagColor {
  if (!raw) return "UNKNOWN";
  const v = raw.toUpperCase().trim();
  if (v === "GREEN" || v === "G") return "GREEN";
  if (v === "AMBER" || v === "A" || v === "YELLOW") return "AMBER";
  if (v === "RED" || v === "R") return "RED";
  return "UNKNOWN";
}

function isWorseningTrend(trend: RagColor[]): boolean {
  // RED for 2+ consecutive weeks
  let consecutive = 0;
  for (const r of trend) {
    if (r === "RED") { consecutive++; if (consecutive >= 2) return true; }
    else consecutive = 0;
  }
  return false;
}

export async function getProjectHealth(projectIds?: string[]): Promise<ProjectHealthResult[]> {
  const projects = await db.project.findMany({
    where: projectIds ? { id: { in: projectIds } } : { status: { notIn: ["COMPLETED"] } },
    include: {
      weeklyStatuses: { orderBy: { weekStart: "asc" } },
      allocations: { include: { employee: { select: { id: true, name: true } } } },
      timesheets: { select: { isBillable: true, hours: true, employeeId: true } },
    },
  });

  const results: ProjectHealthResult[] = [];

  for (const project of projects) {
    // ── RAG Trend from WeeklyStatus ───────────────────────────
    const weeklyStatuses = project.weeklyStatuses ?? [];
    const timesheets = project.timesheets ?? [];
    const allocations = project.allocations ?? [];

    const ragTrend: RagTrend[] = weeklyStatuses.map((ws) => ({
      week: ws.weekStart.toISOString().slice(0, 10),
      scope: toRag(ws.scopeStatus),
      schedule: toRag(ws.scheduleStatus),
      quality: toRag(ws.qualityStatus),
      csat: toRag(ws.csatStatus),
      team: toRag(ws.teamStatus),
    }));

    const ragFlags: string[] = [];
    const factors: string[] = [];

    if (ragTrend.length > 0 && ragTrend[ragTrend.length - 1]) {
      const schedules = ragTrend.map((r) => r.schedule);
      const teams = ragTrend.map((r) => r.team);
      const csats = ragTrend.map((r) => r.csat);
      const latest = ragTrend[ragTrend.length - 1] ?? { schedule: "UNKNOWN" as const, quality: "UNKNOWN" as const, csat: "UNKNOWN" as const, team: "UNKNOWN" as const, scope: "UNKNOWN" as const, week: "" };

      if (latest.schedule === "RED") ragFlags.push("SCHEDULE_RED");
      if (latest.schedule === "AMBER") ragFlags.push("SCHEDULE_AMBER");
      if (latest.csat === "RED") ragFlags.push("CSAT_RED");
      if (latest.team === "RED") ragFlags.push("TEAM_RED");

      if (isWorseningTrend(schedules)) factors.push("Schedule slippage over 2+ consecutive weeks");
      if (isWorseningTrend(teams)) factors.push("Team health deteriorating — possible resourcing issue");
      if (isWorseningTrend(csats)) factors.push("CSAT declining — client satisfaction at risk");
    }

    const isOverrun = ragFlags.includes("SCHEDULE_RED") &&
      weeklyStatuses.filter((ws) => toRag(ws.scheduleStatus) === "RED").length >= 2;

    // ── Billability Leakage from Timesheets ──────────────────
    const totalHours = timesheets.reduce((s, t) => s + t.hours, 0);
    const billableHours = timesheets.filter((t) => t.isBillable).reduce((s, t) => s + t.hours, 0);
    const leakageHours = totalHours - billableHours;
    const unbillablePct = totalHours > 0 ? leakageHours / totalHours : 0;

    if (leakageHours > 40) {
      ragFlags.push("BILLABILITY_LEAK");
      factors.push(`${leakageHours.toFixed(0)}h unbillable (${Math.round(unbillablePct * 100)}% of total hours)`);
    }

    // ── Shadow / Ghost from ShadowFlags ──────────────────────
    const shadowFlags = await db.shadowFlag.findMany({ where: { projectId: project.id } });
    const shadowCount = shadowFlags.filter((f) => f.flagType === "SHADOW").length;
    const ghostCount = shadowFlags.filter((f) => f.flagType === "GHOST").length;

    if (shadowCount > 0) {
      ragFlags.push("SHADOW_RESOURCES");
      factors.push(`${shadowCount} employee(s) logging time without allocation (shadow cost)`);
    }
    if (ghostCount > 0) {
      factors.push(`${ghostCount} employee(s) allocated but not logging time (ghost allocation)`);
    }

    // ── Ramp-Down & Releasable FTE ────────────────────────────
    const now = new Date();
    const thirtyDays = new Date(now.getTime() + 30 * 24 * 3600 * 1000);
    const isRampDown =
      project.pipelineStage === "RAMP_DOWN" ||
      (project.endDate !== null && project.endDate <= thirtyDays);

    const releasableFTE = isRampDown
      ? allocations.reduce((sum, a) => sum + a.allocation / 100, 0)
      : ghostCount * 0.5; // partial estimate for ghost allocations

    if (isRampDown) ragFlags.push("RAMP_DOWN");

    results.push({
      projectId: project.id,
      projectName: project.name,
      ragFlags,
      ragTrend,
      leakageHours,
      unbillablePct,
      shadowCount,
      ghostCount,
      releasableFTE,
      isOverrun,
      isRampDown,
      contributingFactors: factors,
    });
  }

  return results.sort((a, b) => b.leakageHours - a.leakageHours);
}
