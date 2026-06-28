"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { UnauthorizedError, ForbiddenError } from "@/lib/errors";
import { computeMatchRanking } from "@/server/services/matching.service";
import { recommendForPipelineSchema, recommendAdHocSchema } from "@/validations/resourcing.schema";
import type { MatchResult } from "@/server/services/matching.service";

export async function recommendForPipelineRequest(
  pipelineRequestId: string,
): Promise<MatchResult[]> {
  const session = await auth();
  if (!session) throw new UnauthorizedError();
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) throw new ForbiddenError();

  const { pipelineRequestId: id } = recommendForPipelineSchema.parse({ pipelineRequestId });

  const request = await db.pipelineRequest.findUnique({ where: { id } });
  if (!request) return [];

  // Match skills whose names appear within the skillset string (correct direction for partial tokens like "Python 3.x")
  const skillsetText = (request.skillset ?? "").toLowerCase();
  let requiredSkills: { skillId: string; skillName: string; requiredLevel: number }[] = [];

  if (skillsetText.length > 0) {
    const allSkills = await db.skill.findMany({ select: { id: true, name: true } });
    requiredSkills = allSkills
      .filter((s) => skillsetText.includes(s.name.toLowerCase()))
      .map((s) => ({ skillId: s.id, skillName: s.name, requiredLevel: 3 }));
  }

  return computeMatchRanking({
    requiredSkills,
    topN: 10,
  });
}

export async function recommendAdHoc(
  input: unknown,
): Promise<MatchResult[]> {
  const session = await auth();
  if (!session) throw new UnauthorizedError();
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) throw new ForbiddenError();

  const validated = recommendAdHocSchema.parse(input);
  return computeMatchRanking({
    requiredSkills: validated.requiredSkills,
    windowStart: validated.windowStart ? new Date(validated.windowStart) : undefined,
    windowEnd: validated.windowEnd ? new Date(validated.windowEnd) : undefined,
    topN: validated.topN,
  });
}

export async function getPipelineRequests() {
  const session = await auth();
  if (!session) throw new UnauthorizedError();
  if (session.user.role !== "ADMIN") throw new ForbiddenError();

  return db.pipelineRequest.findMany({
    orderBy: [{ sowSigned: "desc" }, { likelyStart: "asc" }],
    take: 100,
  });
}
