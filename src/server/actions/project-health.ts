"use server";

import { auth } from "@/lib/auth";
import { UnauthorizedError, ForbiddenError } from "@/lib/errors";
import { getProjectHealth } from "@/server/services/health.service";
import { triagePortfolio } from "@/lib/ai/agent/health-triage";
import type { ProjectHealthResult } from "@/server/services/health.service";
import type { TriageResult } from "@/lib/ai/agent/health-triage";

export async function getHealthRadar(filter?: {
  projectIds?: string[];
}): Promise<ProjectHealthResult[]> {
  const session = await auth();
  if (!session) throw new UnauthorizedError();
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) throw new ForbiddenError();

  return getProjectHealth(filter?.projectIds);
}

export async function triageHealth(): Promise<TriageResult> {
  const session = await auth();
  if (!session) throw new UnauthorizedError();
  if (session.user.role !== "ADMIN") throw new ForbiddenError();

  return triagePortfolio();
}
