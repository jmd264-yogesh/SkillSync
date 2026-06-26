"use server";

import { auth } from "@/lib/auth";
import { UnauthorizedError, ForbiddenError } from "@/lib/errors";
import { getProjectHealth } from "@/server/services/health.service";
import type { ProjectHealthResult } from "@/server/services/health.service";

export async function getHealthRadar(filter?: {
  projectIds?: string[];
}): Promise<ProjectHealthResult[]> {
  const session = await auth();
  if (!session) throw new UnauthorizedError();
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) throw new ForbiddenError();

  return getProjectHealth(filter?.projectIds);
}
