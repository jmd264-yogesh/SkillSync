import { SchemaType } from "@google/generative-ai";
import type { Tool } from "@google/generative-ai";
import { getEmployeeAvailability } from "@/server/services/availability.service";
import { computeMatchRanking } from "@/server/services/matching.service";
import { getPipelineOutlook } from "@/server/services/forecast.service";
import { runAgent } from "./runtime";
import { GUARDRAIL_NOTE } from "./guardrails";
import type { AgentStep } from "./guardrails";
import type { EmployeeAvailability } from "@/server/services/availability.service";

export interface ReallocationProposal {
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  currentRole: string | null;
  releasableFrom: Date | null;
  freeCapacityPct: number;
  proposedProjectDescription: string;
  fitScore: number;
  fitRationale: string;
  startDate: string;
  decisionVariant: "YES" | "YES_WITH_CONDITIONS" | "NO" | "NEUTRAL";
}

export interface ReallocationResult {
  proposals: ReallocationProposal[];
  narrative: string;
  trace: AgentStep[];
  windowDays: number;
}

const SYSTEM = `You are a reallocation matchmaker. For each rolling-off employee, find the best
available open pipeline demand and propose a move with a fit score and start date.

MANDATORY SEQUENCE:
1. Call get_rolling_off to see which employees are rolling off in the window.
2. For each rolling-off employee, call find_open_demand to find the best matching pipeline need.
3. Call record_proposal once per employee with a concise fit rationale and a start date.
4. Return a brief summary.

Keep each proposal concrete: name the employee, the target demand, the fit score, and the start date.
${GUARDRAIL_NOTE}`;

const REALLOCATION_TOOLS: Tool[] = [
  {
    functionDeclarations: [
      {
        name: "get_rolling_off",
        description: "Get employees rolling off active projects within the given window.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {},
        },
      },
      {
        name: "find_open_demand",
        description:
          "Find the best open pipeline demand that matches an employee's role and skills. Returns top pipeline gaps and a match score.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            employeeId: { type: SchemaType.STRING, description: "Employee UUID" },
            employeeName: { type: SchemaType.STRING },
            role: { type: SchemaType.STRING, description: "Employee's current job name/role" },
          },
          required: ["employeeId"],
        },
      },
      {
        name: "record_proposal",
        description: "Record a reallocation proposal for an employee. Call once per employee.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            employeeId: { type: SchemaType.STRING },
            employeeName: { type: SchemaType.STRING },
            proposedProjectDescription: {
              type: SchemaType.STRING,
              description: "Short description of the target project/pipeline demand",
            },
            fitScore: { type: SchemaType.NUMBER, description: "0–100 match fit score" },
            fitRationale: {
              type: SchemaType.STRING,
              description: "1–2 sentence rationale",
            },
            startDate: { type: SchemaType.STRING, description: "ISO date when this person could start" },
          },
          required: [
            "employeeId",
            "employeeName",
            "proposedProjectDescription",
            "fitScore",
            "fitRationale",
            "startDate",
          ],
        },
      },
    ],
  },
];

export async function proposeReallocations(windowDays = 14): Promise<ReallocationResult> {
  const now = new Date();
  const cutoff = new Date(now.getTime() + windowDays * 86_400_000);

  let rollingOff: EmployeeAvailability[] = [];
  const capturedProposals: Omit<ReallocationProposal, "employeeCode" | "currentRole" | "releasableFrom" | "freeCapacityPct" | "decisionVariant">[] = [];

  async function dispatch(name: string, args: Record<string, unknown>): Promise<unknown> {
    if (name === "get_rolling_off") {
      const all = await getEmployeeAvailability();
      rollingOff = all.filter(
        (r) => r.releasableFrom && r.releasableFrom >= now && r.releasableFrom <= cutoff,
      );
      return rollingOff.slice(0, 10).map((e) => ({
        employeeId: e.employeeId,
        name: e.name,
        role: e.jobName,
        releasableFrom: e.releasableFrom?.toISOString().slice(0, 10),
        availablePct: Math.round((1 - e.actualUtil) * 100),
      }));
    }

    if (name === "find_open_demand") {
      const employeeId = String(args["employeeId"] ?? "");
      // Get match ranking for this employee (availability-only mode)
      const candidates = await computeMatchRanking({ requiredSkills: [], topN: 50 });
      const emp = candidates.find((c) => c.employeeId === employeeId);
      const fitScore = emp?.matchScore ?? 50;

      // Get pipeline gaps as potential targets
      const outlook = await getPipelineOutlook({ months: 3 });
      const gaps = outlook.monthlyGaps.filter((g) => g.gap < 0).slice(0, 3);

      return {
        fitScore,
        pipelineGaps: gaps.map((g) => ({
          month: g.month,
          role: g.role,
          gapFTE: Math.abs(g.gap).toFixed(1),
        })),
        note:
          gaps.length > 0
            ? `${gaps.length} open gap(s) found in pipeline - good redeployment opportunity.`
            : "No confirmed pipeline gaps found in the next 3 months.",
      };
    }

    if (name === "record_proposal") {
      capturedProposals.push({
        employeeId: String(args["employeeId"] ?? ""),
        employeeName: String(args["employeeName"] ?? ""),
        proposedProjectDescription: String(args["proposedProjectDescription"] ?? ""),
        fitScore: Number(args["fitScore"] ?? 50),
        fitRationale: String(args["fitRationale"] ?? ""),
        startDate: String(args["startDate"] ?? ""),
      });
      return { proposalIndex: capturedProposals.length, recorded: true };
    }

    return { error: `Unknown reallocation tool: ${name}` };
  }

  const userMessage = `Propose reallocation moves for employees rolling off in the next ${windowDays} days.
Call get_rolling_off first, then find matches for each person, then record a proposal per person.`;

  try {
    const agentResult = await runAgent({
      system: SYSTEM,
      tools: REALLOCATION_TOOLS,
      dispatch,
      messages: [{ role: "user", text: userMessage }],
      maxRounds: 6,
    });

    // Enrich proposals with employee details from rollingOff
    const proposals: ReallocationProposal[] = capturedProposals.map((p) => {
      const emp = rollingOff.find((r) => r.employeeId === p.employeeId);
      return {
        ...p,
        employeeCode: emp?.employeeCode ?? "-",
        currentRole: emp?.jobName ?? null,
        releasableFrom: emp?.releasableFrom ?? null,
        freeCapacityPct: emp ? Math.round((1 - emp.actualUtil) * 100) : 100,
        decisionVariant:
          p.fitScore >= 70 ? "YES" : p.fitScore >= 45 ? "YES_WITH_CONDITIONS" : "NO",
      };
    });

    return { proposals, narrative: agentResult.finalText, trace: agentResult.trace, windowDays };
  } catch {
    // Deterministic fallback: rolling-off list with no proposals
    const fallback = rollingOff.slice(0, 8).map((e) => ({
      employeeId: e.employeeId,
      employeeName: e.name,
      employeeCode: e.employeeCode,
      currentRole: e.jobName,
      releasableFrom: e.releasableFrom,
      freeCapacityPct: Math.round((1 - e.actualUtil) * 100),
      proposedProjectDescription: "Match Engine - run manually to find open pipeline",
      fitScore: 0,
      fitRationale: "AI unavailable - use Match Engine for a ranked recommendation.",
      startDate: e.releasableFrom?.toISOString().slice(0, 10) ?? "",
      decisionVariant: "NEUTRAL" as const,
    }));
    return { proposals: fallback, narrative: "AI reallocation unavailable.", trace: [], windowDays };
  }
}
