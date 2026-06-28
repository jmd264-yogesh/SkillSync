"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { UnauthorizedError, ForbiddenError } from "@/lib/errors";
import { getEmployeeAvailability } from "@/server/services/availability.service";
import { proposeReallocations } from "@/lib/ai/agent/reallocation";
import { allocationReportFilterSchema } from "@/validations/resourcing.schema";
import type { EmployeeAvailability } from "@/server/services/availability.service";
import type { ReallocationResult } from "@/lib/ai/agent/reallocation";

export interface AllocationReportRow extends EmployeeAvailability {
  coe: string | null;
  designation: string | null;
  activeProjectCount: number;
}

export async function getAllocationReport(input: unknown): Promise<AllocationReportRow[]> {
  const session = await auth();
  if (!session) throw new UnauthorizedError();
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) throw new ForbiddenError();

  const { status, coeId, designationId } = allocationReportFilterSchema.parse(input ?? {});

  // Determine employee scope
  let employeeIds: string[] | undefined;
  if (session.user.role === "MANAGER" && session.user.employeeId) {
    const reportees = await db.employee.findMany({
      where: { managerId: session.user.employeeId },
      select: { id: true },
    });
    employeeIds = reportees.map((r) => r.id);
  }

  const availability = await getEmployeeAvailability(employeeIds);

  // Join with coe/designation names
  const enriched: AllocationReportRow[] = await Promise.all(
    availability.map(async (a) => {
      const emp = await db.employee.findUnique({
        where: { id: a.employeeId },
        include: {
          coe: { select: { name: true } },
          designation: { select: { name: true } },
          allocations: { where: { project: { status: { notIn: ["COMPLETED"] } } } },
        },
      });

      return {
        ...a,
        coe: emp?.coe?.name ?? null,
        designation: emp?.designation?.name ?? null,
        activeProjectCount: emp?.allocations.length ?? 0,
      };
    }),
  );

  // Filter by COE/Designation if requested
  let filtered = enriched;
  if (coeId) {
    const empIds = await db.employee.findMany({ where: { coeId }, select: { id: true } });
    const idSet = new Set(empIds.map((e) => e.id));
    filtered = filtered.filter((r) => idSet.has(r.employeeId));
  }
  if (designationId) {
    const empIds = await db.employee.findMany({ where: { designationId }, select: { id: true } });
    const idSet = new Set(empIds.map((e) => e.id));
    filtered = filtered.filter((r) => idSet.has(r.employeeId));
  }

  // Filter by utilisation status
  if (status !== "ALL") {
    filtered = filtered.filter((r) => r.status === status);
  }

  return filtered.sort((a, b) => b.actualUtil - a.actualUtil);
}

export async function getReallocationProposals(windowDays = 14): Promise<ReallocationResult> {
  const session = await auth();
  if (!session) throw new UnauthorizedError();
  if (session.user.role !== "ADMIN") throw new ForbiddenError();

  return proposeReallocations(windowDays);
}
