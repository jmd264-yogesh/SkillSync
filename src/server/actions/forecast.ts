"use server";

import { auth } from "@/lib/auth";
import { UnauthorizedError, ForbiddenError } from "@/lib/errors";
import { forecastNewProjects, getPipelineOutlook, getResourceForecast } from "@/server/services/forecast.service";
import { buildStaffingPlans } from "@/lib/ai/agent/plan-builder";
import { resourceForecastNarrative } from "@/lib/ai/narrative";
import { forecastNewProjectsSchema, pipelineOutlookSchema, resourceForecastSchema, scenarioCompareSchema } from "@/validations/resourcing.schema";
import type { NewProjectForecast, PipelineOutlook, ResourceForecast } from "@/server/services/forecast.service";

const SCENARIO_LABELS: Record<string, string> = {
  confirmed: "Confirmed (SOW-signed only)",
  weighted: "Weighted (signed + probability-weighted pipeline)",
  all: "All-in (signed + full unsigned pipeline)",
};
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

export async function getResourceForecastAction(input: unknown): Promise<ResourceForecast> {
  const session = await auth();
  if (!session) throw new UnauthorizedError();
  if (session.user.role !== "ADMIN") throw new ForbiddenError();

  const validated = resourceForecastSchema.parse(input);
  return getResourceForecast({
    horizonMonths: validated.horizonMonths,
    scenario: validated.scenario,
    revenueTarget: validated.revenueTarget,
    targetPeriod: validated.targetPeriod,
  });
}

export async function narrateResourceForecastAction(input: unknown): Promise<string> {
  const session = await auth();
  if (!session) throw new UnauthorizedError();
  if (session.user.role !== "ADMIN") throw new ForbiddenError();

  const validated = resourceForecastSchema.parse(input);
  const forecast = await getResourceForecast({
    horizonMonths: validated.horizonMonths,
    scenario: validated.scenario,
    revenueTarget: validated.revenueTarget,
    targetPeriod: validated.targetPeriod,
  });
  return resourceForecastNarrative(forecast, SCENARIO_LABELS[validated.scenario]);
}

export interface ScenarioForecast {
  id: string;
  name: string;
  wonStages: string[];
  forecast: ResourceForecast;
}

export async function compareScenariosAction(input: unknown): Promise<ScenarioForecast[]> {
  const session = await auth();
  if (!session) throw new UnauthorizedError();
  if (session.user.role !== "ADMIN") throw new ForbiddenError();

  const { scenarios } = scenarioCompareSchema.parse(input);
  return Promise.all(
    scenarios.map(async (s) => ({
      id: s.id,
      name: s.name,
      wonStages: s.wonStages,
      forecast: await getResourceForecast({
        horizonMonths: s.horizonMonths,
        scenario: "confirmed",
        wonStages: s.wonStages,
        revenueTarget: s.revenueTarget,
      }),
    })),
  );
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
