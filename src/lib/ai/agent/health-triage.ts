import { SchemaType } from "@google/generative-ai";
import type { Tool } from "@google/generative-ai";
import { getProjectHealth } from "@/server/services/health.service";
import { getPipelineOutlook } from "@/server/services/forecast.service";
import { runAgent } from "./runtime";
import { GUARDRAIL_NOTE } from "./guardrails";
import type { AgentStep } from "./guardrails";
import type { ProjectHealthResult } from "@/server/services/health.service";

export interface TriageIntervention {
  projectId: string;
  projectName: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM";
  rootCause: string;
  recommendedIntervention: string;
  releasableFTE: number;
  redeployTarget?: string;
  riskFlags: string[];
}

export interface TriageResult {
  interventions: TriageIntervention[];
  portfolioHeadline: string;
  totalRecoverableFTE: number;
  projectsNeedingAction: number;
  narrative: string;
  trace: AgentStep[];
}

const SYSTEM = `You are a proactive project health triage agent.
Your job is to sweep the portfolio, AUTONOMOUSLY SELECT the highest-risk projects to investigate,
gather evidence, and draft precise interventions — "before it becomes an escalation."

MANDATORY SEQUENCE:
1. Call get_all_project_health to get the portfolio overview.
2. Independently decide which projects to investigate (your cutoff — not all projects, just the ones most at risk).
3. For each project you select (max 6), call get_project_details to gather supporting evidence.
4. If a project has releasableFTE > 0, call find_pipeline_match to check if that capacity fits any open demand.
5. Call record_intervention once per investigated project with your root-cause diagnosis and recommended action.
6. After recording all interventions, return a 2-sentence portfolio headline: "X FTE recoverable; Y projects need action this week."

You decide the cutoff — do not investigate every project. Focus on the top 3–6 by severity.
Evidence from tools must drive every claim — do not invent root causes.

${GUARDRAIL_NOTE}`;

const TRIAGE_TOOLS: Tool[] = [
  {
    functionDeclarations: [
      {
        name: "get_all_project_health",
        description:
          "Get compact health overview of all active projects — RAG flags, leakage, shadow/ghost counts, releasable FTE, ramp-down status. Returns top-risk projects first.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {},
        },
      },
      {
        name: "get_project_details",
        description:
          "Get detailed evidence for a specific project: full RAG trend, contributing factors, allocated employees, leakage breakdown.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            projectId: { type: SchemaType.STRING, description: "Project UUID" },
            projectName: { type: SchemaType.STRING, description: "Project name (for trace)" },
          },
          required: ["projectId"],
        },
      },
      {
        name: "find_pipeline_match",
        description:
          "Check if a given FTE capacity (being released from a ramp-down project) matches any open pipeline demand.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            availableFTE: { type: SchemaType.NUMBER, description: "FTE being released" },
            projectName: {
              type: SchemaType.STRING,
              description: "Source project (for trace log)",
            },
          },
          required: ["availableFTE"],
        },
      },
      {
        name: "record_intervention",
        description: "Record a triage intervention for an investigated project. Call once per project.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            projectId: { type: SchemaType.STRING },
            projectName: { type: SchemaType.STRING },
            severity: {
              type: SchemaType.STRING,
              description: "CRITICAL, HIGH, or MEDIUM",
            },
            rootCause: {
              type: SchemaType.STRING,
              description: "1-2 sentence root cause derived from evidence",
            },
            recommendedIntervention: {
              type: SchemaType.STRING,
              description: "Specific, actionable recommendation",
            },
            releasableFTE: { type: SchemaType.NUMBER },
            redeployTarget: {
              type: SchemaType.STRING,
              description: "Pipeline project to redeploy to (if found by find_pipeline_match)",
            },
            riskFlags: {
              type: SchemaType.ARRAY,
              items: { type: SchemaType.STRING },
            },
          },
          required: [
            "projectId",
            "projectName",
            "severity",
            "rootCause",
            "recommendedIntervention",
            "releasableFTE",
          ],
        },
      },
    ],
  },
];

function derivePortfolioHeadline(
  interventions: TriageIntervention[],
  totalFTE: number,
): string {
  const critical = interventions.filter((i) => i.severity === "CRITICAL").length;
  const high = interventions.filter((i) => i.severity === "HIGH").length;
  const needsAction = critical + high;
  return `${totalFTE.toFixed(1)} FTE recoverable from ramp-downs; ${needsAction} project${needsAction !== 1 ? "s" : ""} need action this week.`;
}

export async function triagePortfolio(): Promise<TriageResult> {
  let allProjects: ProjectHealthResult[] = [];
  const capturedInterventions: TriageIntervention[] = [];

  async function dispatch(name: string, args: Record<string, unknown>): Promise<unknown> {
    if (name === "get_all_project_health") {
      allProjects = await getProjectHealth();
      // Return compact overview — top 20 by risk
      return allProjects.slice(0, 20).map((p) => ({
        projectId: p.projectId,
        projectName: p.projectName,
        ragFlags: p.ragFlags,
        leakageHours: Math.round(p.leakageHours),
        shadowCount: p.shadowCount,
        ghostCount: p.ghostCount,
        releasableFTE: Math.round(p.releasableFTE * 10) / 10,
        isRampDown: p.isRampDown,
        isOverrun: p.isOverrun,
      }));
    }

    if (name === "get_project_details") {
      const projectId = String(args["projectId"] ?? "");
      const project = allProjects.find((p) => p.projectId === projectId);
      if (!project) return { error: "Project not found in health data" };
      const latest =
        project.ragTrend.length > 0
          ? project.ragTrend[project.ragTrend.length - 1]
          : null;
      return {
        projectId: project.projectId,
        projectName: project.projectName,
        ragFlags: project.ragFlags,
        latestRag: latest,
        leakageHours: Math.round(project.leakageHours),
        unbillablePct: Math.round(project.unbillablePct * 100),
        shadowCount: project.shadowCount,
        ghostCount: project.ghostCount,
        releasableFTE: project.releasableFTE,
        contributingFactors: project.contributingFactors,
        trendLength: project.ragTrend.length,
      };
    }

    if (name === "find_pipeline_match") {
      const availableFTE = Number(args["availableFTE"] ?? 0);
      const outlook = await getPipelineOutlook({ months: 3 });
      // Find months with gap ≥ the FTE being released
      const matches = outlook.monthlyGaps
        .filter((g) => g.gap < 0 && Math.abs(g.gap) <= availableFTE * 1.5)
        .slice(0, 3);
      if (matches.length === 0) return { matched: false, note: "No immediate pipeline gap found for this FTE." };
      return {
        matched: true,
        gaps: matches.map((m) => ({
          month: m.month,
          role: m.role,
          gapFTE: Math.abs(m.gap).toFixed(1),
        })),
        note: `${matches.length} pipeline gap(s) found — redeploy opportunity.`,
      };
    }

    if (name === "record_intervention") {
      const raw = args as {
        projectId?: string;
        projectName?: string;
        severity?: string;
        rootCause?: string;
        recommendedIntervention?: string;
        releasableFTE?: number;
        redeployTarget?: string;
        riskFlags?: string[];
      };
      const sev = (raw.severity?.toUpperCase() ?? "MEDIUM") as TriageIntervention["severity"];
      capturedInterventions.push({
        projectId: raw.projectId ?? "",
        projectName: raw.projectName ?? "Unknown",
        severity: ["CRITICAL", "HIGH", "MEDIUM"].includes(sev) ? sev : "MEDIUM",
        rootCause: raw.rootCause ?? "",
        recommendedIntervention: raw.recommendedIntervention ?? "",
        releasableFTE: Number(raw.releasableFTE ?? 0),
        redeployTarget: raw.redeployTarget,
        riskFlags: raw.riskFlags ?? [],
      });
      return { interventionIndex: capturedInterventions.length, recorded: true };
    }

    return { error: `Unknown triage tool: ${name}` };
  }

  try {
    const agentResult = await runAgent({
      system: SYSTEM,
      tools: TRIAGE_TOOLS,
      dispatch,
      messages: [
        {
          role: "user",
          text: "Run a portfolio health triage. Identify the highest-risk projects, gather evidence, and record your recommended interventions. Focus on at most 6 projects.",
        },
      ],
      maxRounds: 8,
    });

    const fallback =
      capturedInterventions.length === 0
        ? buildFallbackInterventions(allProjects)
        : capturedInterventions;

    const totalFTE = fallback.reduce((s, i) => s + i.releasableFTE, 0);
    return {
      interventions: fallback,
      portfolioHeadline: derivePortfolioHeadline(fallback, totalFTE),
      totalRecoverableFTE: totalFTE,
      projectsNeedingAction: fallback.filter((i) =>
        ["CRITICAL", "HIGH"].includes(i.severity),
      ).length,
      narrative: agentResult.finalText,
      trace: agentResult.trace,
    };
  } catch {
    const fallback = buildFallbackInterventions(allProjects);
    const totalFTE = fallback.reduce((s, i) => s + i.releasableFTE, 0);
    return {
      interventions: fallback,
      portfolioHeadline: derivePortfolioHeadline(fallback, totalFTE),
      totalRecoverableFTE: totalFTE,
      projectsNeedingAction: fallback.filter((i) =>
        ["CRITICAL", "HIGH"].includes(i.severity),
      ).length,
      narrative: "AI triage unavailable — showing deterministic health flags.",
      trace: [],
    };
  }
}

function buildFallbackInterventions(projects: ProjectHealthResult[]): TriageIntervention[] {
  return projects
    .filter((p) => p.ragFlags.length > 0 || p.isRampDown)
    .slice(0, 6)
    .map((p) => {
      const severity: TriageIntervention["severity"] = p.ragFlags.some((f) =>
        f.includes("RED"),
      )
        ? "CRITICAL"
        : p.ragFlags.length > 1
        ? "HIGH"
        : "MEDIUM";
      return {
        projectId: p.projectId,
        projectName: p.projectName,
        severity,
        rootCause: p.contributingFactors.slice(0, 2).join("; ") || "Health flags detected",
        recommendedIntervention: p.isRampDown
          ? `Plan redeployment of ${p.releasableFTE.toFixed(1)} FTE`
          : p.shadowCount > 0
          ? `Formalise ${p.shadowCount} shadow resource(s)`
          : `Investigate ${p.leakageHours.toFixed(0)}h unbillable leakage`,
        releasableFTE: p.releasableFTE,
        riskFlags: p.ragFlags,
      };
    });
}
