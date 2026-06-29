"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ForbiddenError, UnauthorizedError } from "@/lib/errors";
import {
  getPipelineWithContext,
  getUnderUtilizedEmployees,
  getBenchResources,
  releasePipelineAllocations,
  computeConfidence,
  computeHiringLeadTimeAlert,
  resolveSolutionPriority,
} from "@/server/services/pipeline.service";
import {
  markDealLostSchema,
  updatePipelineContextSchema,
} from "@/validations/resourcing.schema";
import { revalidatePath } from "next/cache";
import type { PipelineRequestWithContext } from "@/server/services/pipeline.service";
import type { EmployeeAvailability } from "@/server/services/availability.service";

export async function getPipelineRequestsWithContext(
  includeArchived = false,
): Promise<PipelineRequestWithContext[]> {
  const session = await auth();
  if (!session) throw new UnauthorizedError();
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) throw new ForbiddenError();
  return getPipelineWithContext(includeArchived);
}

export async function markDealLost(input: unknown): Promise<{
  success: boolean;
  releasedCount: number;
  employeeCodes: string[];
}> {
  const session = await auth();
  if (!session) throw new UnauthorizedError();
  if (session.user.role !== "ADMIN") throw new ForbiddenError();

  const { pipelineRequestId, projectId } = markDealLostSchema.parse(input);

  // Mark the pipeline request as lost
  await db.pipelineRequest.update({
    where: { id: pipelineRequestId },
    data: { dealLostAt: new Date(), status: "LOST" },
  });

  // Release allocations from the associated project if provided
  let releaseResult = { releasedCount: 0, employeeCodes: [] as string[] };
  if (projectId) {
    releaseResult = await releasePipelineAllocations(projectId);
  }

  revalidatePath("/admin/resourcing/pipeline");
  revalidatePath("/admin/resourcing/allocations");

  return { success: true, ...releaseResult };
}

export async function updatePipelineContext(input: unknown): Promise<void> {
  const session = await auth();
  if (!session) throw new UnauthorizedError();
  if (session.user.role !== "ADMIN") throw new ForbiddenError();

  const {
    pipelineRequestId,
    clientTier,
    isNewClient,
    clientRelationshipMonths,
    serviceLine,
    comments,
  } = updatePipelineContextSchema.parse(input);

  const existing = await db.pipelineRequest.findUnique({
    where: { id: pipelineRequestId },
    select: { solution: true, dealStage: true, sowSigned: true, likelyStart: true },
  });
  if (!existing) return;

  const solutionPriority = resolveSolutionPriority(existing.solution);
  const confidence = computeConfidence(existing.dealStage, existing.sowSigned);
  const hiringLeadTimeAlert = computeHiringLeadTimeAlert(existing.likelyStart);

  await db.pipelineRequest.update({
    where: { id: pipelineRequestId },
    data: {
      ...(clientTier !== undefined && { clientTier }),
      ...(isNewClient !== undefined && { isNewClient }),
      ...(clientRelationshipMonths !== undefined && { clientRelationshipMonths }),
      ...(serviceLine !== undefined && { serviceLine }),
      ...(comments !== undefined && { comments }),
      solutionPriority,
      confidence,
      hiringLeadTimeAlert,
    },
  });

  revalidatePath("/admin/resourcing/pipeline");
}

export async function getUnderUtilizedResources(): Promise<EmployeeAvailability[]> {
  const session = await auth();
  if (!session) throw new UnauthorizedError();
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) throw new ForbiddenError();
  return getUnderUtilizedEmployees();
}

export async function getBenchEmployees(): Promise<EmployeeAvailability[]> {
  const session = await auth();
  if (!session) throw new UnauthorizedError();
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) throw new ForbiddenError();
  return getBenchResources();
}
