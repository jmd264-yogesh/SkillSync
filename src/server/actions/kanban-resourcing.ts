"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ForbiddenError, UnauthorizedError } from "@/lib/errors";
import { revalidatePath } from "next/cache";
import { computeMatchRanking } from "@/server/services/matching.service";
import { normalizeResourceRequest } from "@/lib/role-mapping";

export interface SaveResourcingInput {
  projectId: string;
  isSubmitted: boolean;
  isNegotiated: boolean;
  decisions: Record<string, { decision: "Approved" | "Rejected"; justifications: string[] }>;
  swaps: Record<string, string>;
}

export interface KanbanCandidate {
  employeeId: string;
  name: string;
  jobName: string | null;
  fitScore: number; // 0-100 matchScore
}

export interface KanbanResourceName {
  employeeId: string;
  name: string;
  jobName: string | null;
}

// ─── Load resourcing statuses ─────────────────────────────────

export async function getProjectResourcingStatuses() {
  const session = await auth();
  if (!session) throw new UnauthorizedError();
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) {
    throw new ForbiddenError();
  }

  const statuses = await db.projectResourcingStatus.findMany({
    include: {
      resourceDecisions: true,
      resourceSwaps: true,
    },
  });

  return statuses;
}

// ─── Save resourcing decisions ────────────────────────────────

export async function saveProjectResourcingStatus(input: SaveResourcingInput) {
  const session = await auth();
  if (!session) throw new UnauthorizedError();
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) {
    throw new ForbiddenError();
  }

  const { projectId, isSubmitted, isNegotiated, decisions, swaps } = input;

  await db.$transaction(async (tx) => {
    // 1. Upsert the ProjectResourcingStatus record
    await tx.projectResourcingStatus.upsert({
      where: { projectId },
      update: {
        isSubmitted,
        isNegotiated,
      },
      create: {
        projectId,
        isSubmitted,
        isNegotiated,
      },
    });

    // 2. Clear old decisions and insert new ones
    await tx.resourceDecision.deleteMany({
      where: { projectId },
    });

    const decisionCreateInputs = Object.entries(decisions).map(([resourceKey, value]) => ({
      projectId,
      resourceKey,
      decision: value.decision,
      justifications: JSON.stringify(value.justifications),
    }));

    if (decisionCreateInputs.length > 0) {
      await tx.resourceDecision.createMany({
        data: decisionCreateInputs,
      });
    }

    // 3. Clear old swaps and insert new ones
    await tx.resourceSwap.deleteMany({
      where: { projectId },
    });

    const swapCreateInputs = Object.entries(swaps).map(([resourceKey, swappedName]) => ({
      projectId,
      resourceKey,
      swappedName,
    }));

    if (swapCreateInputs.length > 0) {
      await tx.resourceSwap.createMany({
        data: swapCreateInputs,
      });
    }
  });

  revalidatePath("/admin/resourcing/kanban");
  return { success: true };
}

// ─── Internal helper: Map real DB dealStage keys → Kanban status labels ─────
// Real DB values: LEAD | PROPOSAL | SOW_PENDING | SOW_SIGNED | ACTIVE | RAMP_DOWN | CLOSED

function dealStageToKanbanStatus(
  dealStage: string | null,
  sowSigned: boolean,
  dealLostAt: Date | null,
): string {
  if (dealLostAt) return "Deal Lost";
  if (sowSigned || dealStage === "SOW_SIGNED" || dealStage === "ACTIVE" || dealStage === "RAMP_DOWN") {
    return "Deal Won";
  }
  if (!dealStage) return "Opportunity Inception";
  switch (dealStage.toUpperCase()) {
    case "LEAD":        return "Opportunity Inception";
    case "PROPOSAL":    return "Build The Proposition";
    case "SOW_PENDING": return "SoW Pending Signature";
    case "CLOSED":      return "Deal Lost";
    default: {
      // Attempt fuzzy match for any unexpected free-text values
      const s = dealStage.toLowerCase();
      if (s.includes("inception") || s.includes("lead")) return "Opportunity Inception";
      if (s.includes("real"))                             return "Make It Real";
      if (s.includes("proposition"))                     return "Build The Proposition";
      if (s.includes("scop"))                             return "Scoping Approval";
      if (s.includes("negotiat") || s.includes("propose")) return "Propose & Negotiate";
      if (s.includes("pending") || s.includes("sow"))    return "SoW Pending Signature";
      if (s.includes("won") || s.includes("active"))     return "Deal Won";
      if (s.includes("lost") || s.includes("closed"))    return "Deal Lost";
      return "Opportunity Inception";
    }
  }
}

function confidenceLabel(confidence: number, dealLostAt: Date | null, sowSigned: boolean): string {
  if (dealLostAt) return "Lost (0%)";
  if (sowSigned)  return "Won (100%)";
  return `${confidence}%`;
}

// ─── Parse "resourcesRequested" field ─────────────────────────────────────────
// Supports both formats that exist in the DB:
//   • Abbreviation format: "2 SC", "1 P", "3 AC / SAC" (CSV-imported)
//   • Colon format:        "Cloud Architect: 1, DevOps Engineer: 2"
function parseResourcesRequested(raw: string | null): { role: string; count: number }[] {
  if (!raw?.trim()) return [];
  const allocations: { role: string; count: number }[] = [];
  const parts = raw.split(",");

  for (const p of parts) {
    const trimmed = p.trim();
    if (!trimmed) continue;

    // ── Colon format: "Role Name: 2" ──
    const colonMatch = trimmed.match(/^(.+?):\s*(\d+)$/);
    if (colonMatch) {
      allocations.push({
        role: colonMatch[1]!.trim(),
        count: parseInt(colonMatch[2]!, 10),
      });
      continue;
    }

    // ── Abbreviation format: "2 SC" or "SC" ──
    const parsed = normalizeResourceRequest(trimmed);
    const display = parsed.display && parsed.display !== "Unknown" ? parsed.display : trimmed;
    allocations.push({
      role: display,
      count: parsed.count,
    });
  }

  return allocations;
}

// ─── Load Kanban projects from PipelineRequest ────────────────

export async function getKanbanProjects() {
  const session = await auth();
  if (!session) throw new UnauthorizedError();
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) {
    throw new ForbiddenError();
  }

  const requests = await db.pipelineRequest.findMany({
    orderBy: [
      { sowSigned: "desc" },
      { likelyStart: "asc" },
    ],
  });

  return requests.map((r) => {
    const allocations = parseResourcesRequested(r.resourcesRequested);
    const status = dealStageToKanbanStatus(r.dealStage, r.sowSigned, r.dealLostAt);

    // Build a human-readable project code:
    //   Prefer projectKey from the DB, then fall back to a short UUID slice
    const code = r.projectKey
      ? r.projectKey.trim()
      : `PRJ-${r.id.slice(0, 6).toUpperCase()}`;

    // Use solution as the card title (e.g. "Digital Transformation"), fall back to client
    const name = (r.solution?.trim() || r.client?.trim() || "Unnamed Opportunity");

    // Default start date: today if no likelyStart
    const today = new Date().toISOString().split("T")[0]!;
    const startDate = r.likelyStart ? r.likelyStart.toISOString().split("T")[0]! : today;

    return {
      id: r.id,
      code,
      name,
      startDate,
      weeks: Math.round(r.numberOfWeeks ?? 12),
      status,
      client: r.client?.trim() || "Client N/A",
      description: r.comments?.trim() || r.skillset?.trim() || "No description available.",
      budget: "N/A",  // No budget field in PipelineRequest schema
      owner: r.serviceLine?.trim() || "Internal",
      confidence: confidenceLabel(r.confidence, r.dealLostAt, r.sowSigned),
      allocations,
    };
  });
}

// ─── Get allocated employees for a role in a pipeline request ─
// Used to populate the resource name list in the modal

export async function getResourceNamesForRole(
  pipelineRequestId: string,
  role: string,
  count: number,
): Promise<KanbanResourceName[]> {
  const session = await auth();
  if (!session) throw new UnauthorizedError();
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) {
    throw new ForbiddenError();
  }

  // First try: find employees already allocated to this pipeline request's project
  const request = await db.pipelineRequest.findUnique({
    where: { id: pipelineRequestId },
    select: { skillset: true, resourcesRequested: true, likelyStart: true, numberOfWeeks: true },
  });

  if (!request) return [];

  // Use matching engine to find best-fit employees for this role and return first `count`
  const parsed = normalizeResourceRequest(role);
  const canonicalRoles = parsed.canonicalRoles.length > 0 ? parsed.canonicalRoles : [role];

  const windowStart = request.likelyStart ?? undefined;
  let windowEnd: Date | undefined;
  if (request.likelyStart && request.numberOfWeeks) {
    windowEnd = new Date(
      request.likelyStart.getTime() + request.numberOfWeeks * 7 * 24 * 60 * 60 * 1000,
    );
  }

  const matches = await computeMatchRanking({
    requiredSkills: [],
    canonicalRoles,
    windowStart: windowStart ? new Date(windowStart) : undefined,
    windowEnd,
    topN: count,
  });

  if (matches.length >= count) {
    return matches.slice(0, count).map((m) => ({
      employeeId: m.employeeId,
      name: m.name,
      jobName: m.jobName,
    }));
  }

  // Fallback: query employees by jobName similarity directly
  const fallback = await db.employee.findMany({
    where: {
      jobName: {
        contains: canonicalRoles[0],
      },
    },
    select: { id: true, name: true, jobName: true },
    take: count,
  });

  return fallback.map((e) => ({
    employeeId: e.id,
    name: e.name,
    jobName: e.jobName,
  }));
}

// ─── Get swap candidates for a role, sorted best-to-worst fit ─
// Used in the Swap candidate dialog

export async function getCandidatesForKanbanRole(
  pipelineRequestId: string,
  role: string,
): Promise<KanbanCandidate[]> {
  const session = await auth();
  if (!session) throw new UnauthorizedError();
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) {
    throw new ForbiddenError();
  }

  const request = await db.pipelineRequest.findUnique({
    where: { id: pipelineRequestId },
    select: { skillset: true, likelyStart: true, numberOfWeeks: true, clientTier: true },
  });

  if (!request) return [];

  // Resolve required skills from skillset text
  let requiredSkills: { skillId: string; skillName: string; requiredLevel: number }[] = [];
  if (request.skillset) {
    const skillsetText = request.skillset.toLowerCase();
    const allSkills = await db.skill.findMany({ select: { id: true, name: true } });
    const keywords = skillsetText.split(/[\s,;/()]+/).map((k) => k.trim()).filter((k) => k.length >= 3);
    requiredSkills = allSkills
      .filter((s) => {
        const sl = s.name.toLowerCase();
        if (skillsetText.includes(sl)) return true;
        const primary = sl.split(/\s*[–-]\s*/)[0]?.trim() ?? sl;
        return keywords.some((kw) => sl.includes(kw) || primary.includes(kw));
      })
      .map((s) => ({ skillId: s.id, skillName: s.name, requiredLevel: 3 }));
  }

  const parsed = normalizeResourceRequest(role);
  const canonicalRoles = parsed.canonicalRoles.length > 0 ? parsed.canonicalRoles : [role];

  const windowStart = request.likelyStart ?? undefined;
  let windowEnd: Date | undefined;
  if (request.likelyStart && request.numberOfWeeks) {
    windowEnd = new Date(
      request.likelyStart.getTime() + request.numberOfWeeks * 7 * 24 * 60 * 60 * 1000,
    );
  }

  const matches = await computeMatchRanking({
    requiredSkills,
    canonicalRoles,
    windowStart: windowStart ? new Date(windowStart) : undefined,
    windowEnd,
    topN: 15,
    clientTier: request.clientTier ?? undefined,
  });

  return matches.map((m) => ({
    employeeId: m.employeeId,
    name: m.name,
    jobName: m.jobName,
    fitScore: m.matchScore,
  }));
}
