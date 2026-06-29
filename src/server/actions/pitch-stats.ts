// No "use server" - called directly from the Server Component at /pitch
import { db } from "@/lib/db";
import { getPipelineOutlook } from "@/server/services/forecast.service";
import { getProjectHealth } from "@/server/services/health.service";
import { computeMatchRanking } from "@/server/services/matching.service";
import { computeDataCoverage } from "@/lib/ai/confidence";
import { PROJECT_CATEGORY_LABELS } from "@/lib/constants";
import { ProjectStatus } from "@prisma/client";

export interface CategoryBreakdown {
  category: string;
  label: string;
  count: number;
}

export interface PitchStats {
  totalEmployees: number;
  architectsCount: number;
  activeProjects: number;
  projectsByCategory: CategoryBreakdown[];
  totalReleasableFTE: number;
  rampDownProjectCount: number;
  totalUnbillableHours: number;
  totalShadowCount: number;
  confirmedRequests: number;
  probableRequests: number;
  firstShortfallMonth: string | null;
  firstConfirmedShortfallMonth: string | null;
  avgTopMatchScore: number | null;
  dataCoverage: number;
  dataCoverageLevel: "HIGH" | "MEDIUM" | "LOW";
  totalTimesheetRows: number;
  totalAllocationRows: number;
}

export async function getPitchStats(): Promise<PitchStats> {
  try {
    const [
      totalEmployees,
      activeProjectsRaw,
      pipelineRequestsRaw,
      healthResults,
      outlook,
      coverage,
      timesheetCount,
      allocationCount,
    ] = await Promise.all([
      db.employee.count(),
      db.project.findMany({
        where: { status: { in: [ProjectStatus.ACTIVE, ProjectStatus.PLANNING, ProjectStatus.ON_HOLD] } },
        select: { category: true },
      }),
      db.pipelineRequest.findMany({
        select: { sowSigned: true },
      }),
      getProjectHealth().catch(() => []),
      getPipelineOutlook({}).catch(() => ({
        monthlyGaps: [],
        firstShortfallMonth: null as string | null,
        firstConfirmedShortfallMonth: null as string | null,
        confirmedCount: 0,
        probableCount: 0,
        attritionCount: 0,
        dataCoverage: 0,
      })),
      computeDataCoverage().catch(() => ({ level: "LOW" as const, percentage: 0, explanation: "", improvements: [] })),
      db.timesheet.count().catch(() => 0),
      db.projectAllocation.count().catch(() => 0),
    ]);

    // Senior/architect count via designation level
    const architectsCount = await db.employee.count({
      where: { designation: { level: { gte: 4 } } },
    }).catch(() => 0);

    // Category breakdown
    const catMap = new Map<string, number>();
    for (const p of activeProjectsRaw) {
      const cat = String(p.category ?? "OTHER");
      catMap.set(cat, (catMap.get(cat) ?? 0) + 1);
    }
    const projectsByCategory: CategoryBreakdown[] = Array.from(catMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([cat, count]) => ({
        category: cat,
        label: (PROJECT_CATEGORY_LABELS as Record<string, string>)[cat] ?? cat,
        count,
      }));

    // Health aggregates
    const totalReleasableFTE = healthResults.reduce((s, p) => s + p.releasableFTE, 0);
    const rampDownProjectCount = healthResults.filter((p) => p.isRampDown).length;
    const totalUnbillableHours = healthResults.reduce((s, p) => s + p.leakageHours, 0);
    const totalShadowCount = healthResults.reduce((s, p) => s + p.shadowCount, 0);

    // Pipeline split
    const confirmedRequests = pipelineRequestsRaw.filter((r) => r.sowSigned).length;
    const probableRequests = pipelineRequestsRaw.filter((r) => !r.sowSigned).length;

    // Avg top match score - sample up to 3 confirmed pipeline requests
    let avgTopMatchScore: number | null = null;
    try {
      const sampleReqs = await db.pipelineRequest.findMany({
        where: { sowSigned: true, skillset: { not: null } },
        take: 3,
        select: { skillset: true },
      });
      const scores: number[] = [];
      for (const req of sampleReqs) {
        if (!req.skillset) continue;
        const names = req.skillset.split(/[,;/]/).map((s) => s.trim()).filter(Boolean).slice(0, 3);
        const skills = await db.skill.findMany({
          where: { OR: names.map((n) => ({ name: { contains: n } })) },
          take: 3,
          select: { id: true, name: true },
        });
        if (skills.length === 0) continue;
        const reqSkills = skills.map((s) => ({ skillId: s.id, skillName: s.name, requiredLevel: 3 as const }));
        const results = await computeMatchRanking({ requiredSkills: reqSkills, topN: 1 });
        if (results[0]) scores.push(results[0].matchScore);
      }
      if (scores.length > 0) {
        avgTopMatchScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
      }
    } catch {
      avgTopMatchScore = null;
    }

    return {
      totalEmployees,
      architectsCount,
      activeProjects: activeProjectsRaw.length,
      projectsByCategory,
      totalReleasableFTE,
      rampDownProjectCount,
      totalUnbillableHours,
      totalShadowCount,
      confirmedRequests,
      probableRequests,
      firstShortfallMonth: outlook.firstShortfallMonth,
      firstConfirmedShortfallMonth: outlook.firstConfirmedShortfallMonth,
      avgTopMatchScore,
      dataCoverage: coverage.percentage,
      dataCoverageLevel: coverage.level,
      totalTimesheetRows: timesheetCount,
      totalAllocationRows: allocationCount,
    };
  } catch (err) {
    console.error("[getPitchStats]", err);
    return {
      totalEmployees: 0,
      architectsCount: 0,
      activeProjects: 0,
      projectsByCategory: [],
      totalReleasableFTE: 0,
      rampDownProjectCount: 0,
      totalUnbillableHours: 0,
      totalShadowCount: 0,
      confirmedRequests: 0,
      probableRequests: 0,
      firstShortfallMonth: null,
      firstConfirmedShortfallMonth: null,
      avgTopMatchScore: null,
      dataCoverage: 0,
      dataCoverageLevel: "LOW",
      totalTimesheetRows: 0,
      totalAllocationRows: 0,
    };
  }
}
