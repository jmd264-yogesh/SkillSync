import { db } from "@/lib/db";
import { normalizeResourceRequest } from "@/lib/role-mapping";

export type UtilisationStatus = "OVER" | "FULL" | "UNDER" | "BENCH";

export interface EmployeeAvailability {
  employeeId: string;
  employeeCode: string;
  name: string;
  jobName: string | null;
  activeProjectCount: number;
  actualUtil: number;
  billableUtil: number;
  status: UtilisationStatus;
  availableFrom: Date | null;
  mismatch: boolean;
  releasableFrom: Date | null;
}

export function utilStatus(pct: number): UtilisationStatus {
  if (pct > 1.0) return "OVER";
  if (pct >= 0.85) return "FULL";
  if (pct > 0) return "UNDER";
  return "BENCH";
}

/**
 * Returns availability + utilisation for a set of employees.
 * activeProjectCount = count of active ProjectAllocation rows
 * actualUtil  = avg of last-4-weeks UtilisationSnapshot.utilisation
 * billableUtil = avg of last-4-weeks UtilisationSnapshot.billableUtil
 */
export async function getEmployeeAvailability(
  employeeIds?: string[],
): Promise<EmployeeAvailability[]> {
  const now = new Date();

  const employees = await db.employee.findMany({
    where: employeeIds ? { id: { in: employeeIds } } : undefined,
    include: {
      allocations: {
        where: {
          project: { status: { notIn: ["COMPLETED"] } },
          // Only allocations that have actually started and not yet ended
          OR: [
            { startDate: null, endDate: null },
            { startDate: null, endDate: { gte: now } },
            { startDate: { lte: now }, endDate: null },
            { startDate: { lte: now }, endDate: { gte: now } },
          ],
        },
        include: { project: { select: { status: true, endDate: true } } },
      },
      utilisationSnapshots: {
        orderBy: { weekStart: "desc" },
        take: 4,
      },
    },
  });

  return employees.map((emp) => {
    const activeProjectCount = emp.allocations.length;

    // Actual utilisation from last 4 weeks of utilisation snapshots
    const snapshots = emp.utilisationSnapshots;
    const actualUtil = snapshots.length > 0
      ? snapshots.reduce((s, sn) => s + sn.utilisation, 0) / snapshots.length
      : 0;
    const billableUtil = snapshots.length > 0
      ? snapshots.reduce((s, sn) => s + sn.billableUtil, 0) / snapshots.length
      : 0;

    // Earliest end date of active allocations = when they free up
    const endDates = emp.allocations
      .map((a) => a.endDate)
      .filter((d): d is Date => d !== null);
    const releasableFrom: Date | null = endDates.length > 0 ? (endDates.sort((a, b) => a.getTime() - b.getTime())[0] ?? null) : null;

    // Mismatch: no snapshot data vs active projects
    const mismatch = activeProjectCount > 0 && snapshots.length === 0;

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
      mismatch,
      releasableFrom,
    };
  });
}

/**
 * Returns available FTE for a role/skill within a date window.
 * "Available" = has no active allocations in the date window.
 */
export async function getAvailableFTE(params: {
  role?: string;
  skillId?: string;
  minSkillLevel?: number;
  windowStart: Date;
  windowEnd: Date;
}): Promise<{ employeeId: string; name: string; freeCapacity: number; }[]> {
  const { role, skillId, minSkillLevel, windowStart, windowEnd } = params;

  // Parse role through canonical mapping so "SC" matches "Senior Consultant", "AP/P" matches both, etc.
  const canonicalRoles = role ? normalizeResourceRequest(role).canonicalRoles : [];
  const hasRoleFilter = canonicalRoles.length > 0;
  // Fall back to naive contains when the raw string is unrecognised by the mapping table
  const roleWhere = hasRoleFilter
    ? { OR: canonicalRoles.map((r) => ({ jobName: { contains: r } })) }
    : role
    ? { jobName: { contains: role } }
    : {};

  const employees = await db.employee.findMany({
    where: {
      ...roleWhere,
      ...(skillId && minSkillLevel ? {
        employeeSkills: {
          some: { skillId, status: "APPROVED", validatedLevel: { gte: minSkillLevel } },
        },
      } : {}),
    },
    include: {
      allocations: {
        where: {
          project: { status: { notIn: ["COMPLETED"] } },
          OR: [
            { startDate: null },
            { endDate: null },
            { startDate: { lte: windowEnd }, endDate: { gte: windowStart } },
          ],
        },
      },
    },
  });

  return employees
    .map((emp) => {
      // Treat 0 active allocations as fully available; any active allocation = reduce capacity
      const freeCapacity = emp.allocations.length === 0 ? 1.0 : Math.max(0, 1 - emp.allocations.length * 0.15);
      return { employeeId: emp.id, name: emp.name, freeCapacity };
    })
    .filter((e) => e.freeCapacity > 0)
    .sort((a, b) => b.freeCapacity - a.freeCapacity);
}
