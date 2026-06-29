import { db } from "@/lib/db";
import {
  CONFIDENCE_BY_DEAL_STAGE,
  HIRING_LEAD_TIME_MONTHS,
  SOLUTION_PRIORITY,
  UNDER_UTILIZATION_THRESHOLD,
} from "@/lib/constants";
import type { EmployeeAvailability } from "./availability.service";
import { utilStatus } from "./availability.service";

// ─── Confidence ───────────────────────────────────────────────

export function computeConfidence(dealStage: string | null, sowSigned: boolean): number {
  if (sowSigned) return 80;
  if (!dealStage) return 20;
  const stage = dealStage.toUpperCase().replace(/\s+/g, "_");
  return CONFIDENCE_BY_DEAL_STAGE[stage] ?? 20;
}

// ─── Hiring Lead Time ─────────────────────────────────────────

export function computeHiringLeadTimeAlert(likelyStart: Date | null): boolean {
  if (!likelyStart) return false;
  const now = new Date();
  const monthsUntilStart =
    (likelyStart.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
  return monthsUntilStart > 0 && monthsUntilStart < HIRING_LEAD_TIME_MONTHS;
}

export function computeMonthsUntilStart(likelyStart: Date | null): number | null {
  if (!likelyStart) return null;
  const now = new Date();
  const months = (likelyStart.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
  return Math.round(months * 10) / 10;
}

// ─── Solution Priority ────────────────────────────────────────

export function resolveSolutionPriority(solution: string | null): number {
  if (!solution) return 99;
  const normalized = solution.trim();
  return (
    SOLUTION_PRIORITY[normalized] ??
    SOLUTION_PRIORITY[normalized.toLowerCase()] ??
    99
  );
}

// ─── Deal Lost / Resource Release ────────────────────────────

export interface ReleaseResult {
  releasedCount: number;
  employeeCodes: string[];
}

export async function releasePipelineAllocations(projectId: string): Promise<ReleaseResult> {
  const allocations = await db.projectAllocation.findMany({
    where: { projectId, resourcingStatus: { not: "RELEASED" } },
    include: { employee: { select: { employeeCode: true } } },
  });

  if (allocations.length === 0) return { releasedCount: 0, employeeCodes: [] };

  await db.projectAllocation.updateMany({
    where: { projectId, resourcingStatus: { not: "RELEASED" } },
    data: { resourcingStatus: "RELEASED" },
  });

  return {
    releasedCount: allocations.length,
    employeeCodes: allocations.map((a) => a.employee.employeeCode),
  };
}

// ─── Bench & Under-Utilization ────────────────────────────────

export async function getUnderUtilizedEmployees(
  threshold = UNDER_UTILIZATION_THRESHOLD,
): Promise<EmployeeAvailability[]> {
  const now = new Date();

  const employees = await db.employee.findMany({
    include: {
      allocations: {
        where: {
          project: { status: { notIn: ["COMPLETED"] } },
          OR: [
            { startDate: null, endDate: null },
            { startDate: null, endDate: { gte: now } },
            { startDate: { lte: now }, endDate: null },
            { startDate: { lte: now }, endDate: { gte: now } },
          ],
        },
        include: { project: { select: { status: true, endDate: true } } },
      },
      utilisationSnapshots: { orderBy: { weekStart: "desc" }, take: 4 },
    },
    orderBy: { name: "asc" },
  });

  return employees
    .map((emp) => {
      const activeProjectCount = emp.allocations.length;
      const snapshots = emp.utilisationSnapshots;
      const actualUtil =
        snapshots.length > 0
          ? snapshots.reduce((s, sn) => s + sn.utilisation, 0) / snapshots.length
          : 0;
      const billableUtil =
        snapshots.length > 0
          ? snapshots.reduce((s, sn) => s + sn.billableUtil, 0) / snapshots.length
          : 0;

      const endDates = emp.allocations
        .map((a) => a.endDate)
        .filter((d): d is Date => d !== null);
      const releasableFrom: Date | null =
        endDates.length > 0
          ? (endDates.sort((a, b) => a.getTime() - b.getTime())[0] ?? null)
          : null;

      return {
        employeeId: emp.id,
        employeeCode: emp.employeeCode,
        name: emp.name,
        jobName: emp.jobName,
        activeProjectCount,
        actualUtil,
        billableUtil,
        status: utilStatus(actualUtil),
        availableFrom: emp.availableFrom,
        mismatch: activeProjectCount > 0 && snapshots.length === 0,
        releasableFrom,
      } satisfies EmployeeAvailability;
    })
    .filter((e) => e.actualUtil < threshold)
    .sort((a, b) => a.actualUtil - b.actualUtil);
}

export async function getBenchResources(): Promise<EmployeeAvailability[]> {
  return getUnderUtilizedEmployees(0.01);
}

// ─── Pipeline with computed context ──────────────────────────

export interface PipelineRequestWithContext {
  id: string;
  cluster: number | null;
  client: string | null;
  clientTier: string | null;
  isNewClient: boolean;
  clientRelationshipMonths: number | null;
  dealStage: string | null;
  solution: string | null;
  solutionPriority: number;
  serviceLine: string | null;
  confidence: number;
  sowSigned: boolean;
  likelyStart: Date | null;
  numberOfWeeks: number | null;
  resourcesRequested: string | null;
  resourceRecommended: number | null;
  skillset: string | null;
  status: string | null;
  comments: string | null;
  hiringLeadTimeAlert: boolean;
  monthsUntilStart: number | null;
  dealLostAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export async function getPipelineWithContext(
  includeArchived = false,
): Promise<PipelineRequestWithContext[]> {
  const requests = await db.pipelineRequest.findMany({
    where: includeArchived ? undefined : { dealLostAt: null },
    orderBy: [{ sowSigned: "desc" }, { likelyStart: "asc" }],
    take: 200,
  });

  return requests.map((r) => {
    const confidence = computeConfidence(r.dealStage, r.sowSigned);
    const solutionPriority = resolveSolutionPriority(r.solution);
    const hiringLeadTimeAlert = computeHiringLeadTimeAlert(r.likelyStart);
    const monthsUntilStart = computeMonthsUntilStart(r.likelyStart);

    return {
      id: r.id,
      cluster: r.cluster,
      client: r.client,
      clientTier: r.clientTier,
      isNewClient: r.isNewClient,
      clientRelationshipMonths: r.clientRelationshipMonths,
      dealStage: r.dealStage,
      solution: r.solution,
      solutionPriority,
      serviceLine: r.serviceLine,
      confidence,
      sowSigned: r.sowSigned,
      likelyStart: r.likelyStart,
      numberOfWeeks: r.numberOfWeeks,
      resourcesRequested: r.resourcesRequested,
      resourceRecommended: r.resourceRecommended,
      skillset: r.skillset,
      status: r.status,
      comments: r.comments,
      hiringLeadTimeAlert,
      monthsUntilStart,
      dealLostAt: r.dealLostAt,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  });
}
