import { db } from "@/lib/db";

export type UtilisationStatus = "OVER" | "FULL" | "UNDER" | "BENCH";

export interface EmployeeAvailability {
  employeeId: string;
  name: string;
  jobName: string | null;
  plannedUtil: number;
  actualUtil: number;
  billableUtil: number;
  status: UtilisationStatus;
  availableFrom: Date | null;
  mismatch: boolean;
  releasableFrom: Date | null;
}

function utilStatus(pct: number): UtilisationStatus {
  if (pct > 1.0) return "OVER";
  if (pct >= 0.85) return "FULL";
  if (pct > 0) return "UNDER";
  return "BENCH";
}

/**
 * Returns availability + utilisation for a set of employees.
 * plannedUtil = sum of active ProjectAllocation.allocation / 100
 * actualUtil  = avg of last-4-weeks UtilisationSnapshot.utilisation
 * billableUtil = avg of last-4-weeks UtilisationSnapshot.billableUtil
 */
export async function getEmployeeAvailability(
  employeeIds?: string[],
): Promise<EmployeeAvailability[]> {
  const employees = await db.employee.findMany({
    where: employeeIds ? { id: { in: employeeIds } } : undefined,
    include: {
      allocations: {
        where: { project: { status: { notIn: ["COMPLETED"] } } },
        include: { project: { select: { status: true, endDate: true } } },
      },
      utilisationSnapshots: {
        orderBy: { weekStart: "desc" },
        take: 4,
      },
    },
  });

  return employees.map((emp) => {
    // Planned utilisation from active allocations
    const plannedUtil = emp.allocations.reduce((sum, a) => sum + a.allocation, 0) / 100;

    // Actual utilisation from last 4 weeks of timesheets
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

    const mismatch = Math.abs(plannedUtil - actualUtil) > 0.2;

    return {
      employeeId: emp.id,
      name: emp.name,
      jobName: emp.jobName,
      plannedUtil,
      actualUtil,
      billableUtil,
      status: utilStatus(actualUtil || plannedUtil),
      availableFrom: emp.availableFrom,
      mismatch,
      releasableFrom,
    };
  });
}

/**
 * Returns available FTE for a role/skill within a date window.
 * "Available" = plannedUtil < 100% and no conflict with date window.
 */
export async function getAvailableFTE(params: {
  role?: string;
  skillId?: string;
  minSkillLevel?: number;
  windowStart: Date;
  windowEnd: Date;
}): Promise<{ employeeId: string; name: string; freeCapacity: number; }[]> {
  const { role, skillId, minSkillLevel, windowStart, windowEnd } = params;

  const employees = await db.employee.findMany({
    where: {
      ...(role ? { jobName: { contains: role, mode: "insensitive" } } : {}),
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
      const usedPct = emp.allocations.reduce((sum, a) => sum + a.allocation, 0);
      const freeCapacity = Math.max(0, 100 - usedPct) / 100;
      return { employeeId: emp.id, name: emp.name, freeCapacity };
    })
    .filter((e) => e.freeCapacity > 0)
    .sort((a, b) => b.freeCapacity - a.freeCapacity);
}
