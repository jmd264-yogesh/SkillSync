"use server";

import { auth } from "@/lib/auth";
import { UnauthorizedError, ForbiddenError } from "@/lib/errors";
import { forecastNewProjects, getPipelineOutlook } from "@/server/services/forecast.service";
import { buildStaffingPlans } from "@/lib/ai/agent/plan-builder";
import { forecastNewProjectsSchema, pipelineOutlookSchema } from "@/validations/resourcing.schema";
import type { NewProjectForecast, PipelineOutlook } from "@/server/services/forecast.service";
import type { StaffingPlanResult } from "@/lib/ai/agent/plan-builder";
import type { ProjectCategory } from "@prisma/client";

export async function forecastProjects(input: unknown): Promise<NewProjectForecast> {
  const session = await auth();
  if (!session) throw new UnauthorizedError();
  if (session.user.role !== "ADMIN") throw new ForbiddenError();

  const validated = forecastNewProjectsSchema.parse(input);

  return forecastNewProjects({
    pipelineRequestIds: validated.pipelineRequestIds,
    adHoc: validated.adHoc?.map((a) => ({
      category: a.category as ProjectCategory,
      count: a.count,
      start: new Date(a.start),
      weeks: a.weeks,
    })),
  });
}

export async function getOutlook(input: unknown): Promise<PipelineOutlook> {
  const session = await auth();
  if (!session) throw new UnauthorizedError();
  if (session.user.role !== "ADMIN") throw new ForbiddenError();

  const validated = pipelineOutlookSchema.parse(input);
  return getPipelineOutlook({ months: validated.months, cluster: validated.cluster });
}

export async function buildPlans(input: unknown): Promise<StaffingPlanResult> {
  const session = await auth();
  if (!session) throw new UnauthorizedError();
  if (session.user.role !== "ADMIN") throw new ForbiddenError();

  const validated = forecastNewProjectsSchema.parse(input);
  if (!validated.adHoc || validated.adHoc.length === 0) {
    throw new Error("adHoc projects are required for plan building.");
  }

  return buildStaffingPlans(
    validated.adHoc.map((a) => ({
      category: a.category as ProjectCategory,
      count: a.count,
      start: new Date(a.start),
      weeks: a.weeks,
    })),
  );
}
