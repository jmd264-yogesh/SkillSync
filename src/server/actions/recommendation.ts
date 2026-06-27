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

  // Parse skillset text into skill names and find matching skills
  const skillNames = (request.skillset ?? "").split(/[,;/]/).map((s) => s.trim()).filter(Boolean);
  const requiredSkills = await Promise.all(
    skillNames.map(async (name) => {
      const skill = await db.skill.findFirst({
        where: { name: { contains: name } },
      });
      return skill ? { skillId: skill.id, skillName: skill.name, requiredLevel: 3 } : null;
    }),
  );

  return computeMatchRanking({
    requiredSkills: requiredSkills.filter((s): s is NonNullable<typeof s> => s !== null),
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
