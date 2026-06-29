"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { UnauthorizedError, ForbiddenError } from "@/lib/errors";
import { computeMatchRanking } from "@/server/services/matching.service";
import { normalizeResourceRequest } from "@/lib/role-mapping";
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

  // Bidirectional skill resolution: forward (skillset contains skill name) + reverse
  const skillsetText = (request.skillset ?? "").toLowerCase();
  let requiredSkills: { skillId: string; skillName: string; requiredLevel: number }[] = [];

  if (skillsetText.length > 0) {
    const allSkills = await db.skill.findMany({ select: { id: true, name: true } });
    const keywords = skillsetText
      .split(/[\s,;/()]+/)
      .map((k) => k.trim())
      .filter((k) => k.length >= 3);

    requiredSkills = allSkills
      .filter((s) => {
        const sl = s.name.toLowerCase();
        if (skillsetText.includes(sl)) return true;
        const primary = sl.split(/\s*[–-]\s*/)[0]?.trim() ?? sl;
        return keywords.some((kw) => sl.includes(kw) || primary.includes(kw));
      })
      .map((s) => ({ skillId: s.id, skillName: s.name, requiredLevel: 3 }));
  }

  const parsed = normalizeResourceRequest(request.resourcesRequested ?? null);

  // Compute project window from likelyStart + numberOfWeeks so leave/availability is anchored
  const windowStart = request.likelyStart ?? undefined;
  let windowEnd: Date | undefined;
  if (request.likelyStart && request.numberOfWeeks) {
    windowEnd = new Date(request.likelyStart.getTime() + request.numberOfWeeks * 7 * 24 * 60 * 60 * 1000);
  } else if (request.likelyStart) {
    windowEnd = new Date(request.likelyStart.getTime() + 90 * 24 * 60 * 60 * 1000);
  }

  return computeMatchRanking({
    requiredSkills,
    canonicalRoles: parsed.canonicalRoles.length > 0 ? parsed.canonicalRoles : undefined,
    windowStart: windowStart ? new Date(windowStart) : undefined,
    windowEnd: windowEnd ? new Date(windowEnd) : undefined,
    topN: 15,
    internalFirst: true,
    clientTier: request.clientTier ?? undefined,
    techCoe: request.techCoe ?? undefined,
    propositionCoe: request.propositionCoe ?? undefined,
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
    canonicalRoles: validated.canonicalRoles,
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
