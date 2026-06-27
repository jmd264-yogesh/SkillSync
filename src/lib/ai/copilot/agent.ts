import { FunctionCallingMode } from "@google/generative-ai";
import { genAI, MODELS } from "../client";
import { COPILOT_TOOLS } from "./tools";
import { computeMatchRanking } from "@/server/services/matching.service";
import { getProjectHealth } from "@/server/services/health.service";
import { forecastNewProjects, getPipelineOutlook } from "@/server/services/forecast.service";
import { getEmployeeAvailability, getAvailableFTE } from "@/server/services/availability.service";
import { db } from "@/lib/db";
import type { ProjectCategory } from "@prisma/client";

export interface CopilotMessage {
  role: "user" | "assistant";
  content: string;
}

const SYSTEM = `You are the RM Copilot for a professional-services resource team (JMAN-style delivery).
Answer staffing and capacity questions grounded ONLY in tool results. Do not invent numbers.

Plan your tool calls, execute them, then answer DECISION-FIRST:
1. One-line decision (Yes / No / Yes-with-conditions)
2. Evidence citing exact figures from tool results
3. Recommended action including hire-vs-redeploy trigger
4. Confidence note if data coverage is low

Rules:
- SOW-signed requests are confirmed demand. Unsigned = probable, weighted by deal stage.
- Skill and competency are separate dimensions — name them separately when relevant.
- If a tool is unavailable for something, say so and state what data you'd need.
- Keep it readable by a non-technical RM. No jargon without explanation.`;

async function dispatchTool(name: string, input: Record<string, unknown>): Promise<unknown> {
  if (name === "recommend_resources") {
    if (input["pipelineRequestId"]) {
      const req = await db.pipelineRequest.findUnique({ where: { id: String(input["pipelineRequestId"]) } });
      if (!req) return { error: "Pipeline request not found" };
      const skillNames = (req.skillset ?? "").split(/[,;/]/).map((s) => s.trim()).filter(Boolean);
      const requiredSkills = (await Promise.all(
        skillNames.map(async (n) => {
          const skill = await db.skill.findFirst({ where: { name: { contains: n } } });
          return skill ? { skillId: skill.id, skillName: skill.name, requiredLevel: 3 } : null;
        }),
      )).filter((s): s is NonNullable<typeof s> => s !== null);
      return computeMatchRanking({ requiredSkills, topN: 5 });
    }
    const skills = (input["requiredSkills"] as { skillId: string; skillName: string; requiredLevel: number }[]) ?? [];
    return computeMatchRanking({ requiredSkills: skills, topN: 5 });
  }

  if (name === "forecast_new_projects") {
    const adHoc = (input["adHoc"] as { category: string; count: number; start: string; weeks: number }[] | undefined);
    const pipelineRequestIds = input["pipelineRequestIds"] as string[] | undefined;
    return forecastNewProjects({
      pipelineRequestIds,
      adHoc: adHoc?.map((a) => ({
        category: a.category as ProjectCategory,
        count: a.count,
        start: new Date(a.start),
        weeks: a.weeks,
      })),
    });
  }

  if (name === "get_pipeline_forecast") {
    return getPipelineOutlook({
      months: (input["months"] as number | undefined) ?? 6,
      cluster: input["cluster"] as number | undefined,
    });
  }

  if (name === "get_project_health") {
    const projectIds = input["projectIds"] as string[] | undefined;
    return getProjectHealth(projectIds);
  }

  if (name === "get_allocation_report") {
    return getEmployeeAvailability();
  }

  if (name === "get_availability") {
    return getAvailableFTE({
      role: input["role"] as string | undefined,
      skillId: input["skillId"] as string | undefined,
      minSkillLevel: input["minSkillLevel"] as number | undefined,
      windowStart: new Date(String(input["windowStart"])),
      windowEnd: new Date(String(input["windowEnd"])),
    });
  }

  return { error: `Unknown tool: ${name}` };
}

export async function runCopilotTurn(history: CopilotMessage[]): Promise<string> {
  // Split prior conversation vs current user message
  const priorMessages = history.slice(0, -1);
  const currentMsg = history[history.length - 1];

  if (!currentMsg || currentMsg.role !== "user") {
    return "No user message provided.";
  }

  const model = genAI.getGenerativeModel({
    model: MODELS.primary,
    systemInstruction: SYSTEM,
    tools: COPILOT_TOOLS,
    toolConfig: { functionCallingConfig: { mode: FunctionCallingMode.AUTO } },
  });

  // Map prior visible turns into Gemini history format (assistant → model)
  const chatHistory = priorMessages.map((m) => ({
    role: m.role === "assistant" ? ("model" as const) : ("user" as const),
    parts: [{ text: m.content }],
  }));

  const chat = model.startChat({ history: chatHistory });

  const MAX_TOOL_ROUNDS = 5;
  let rounds = 0;
  let result = await chat.sendMessage(currentMsg.content);

  while (rounds < MAX_TOOL_ROUNDS) {
    const calls = result.response.functionCalls();

    if (!calls || calls.length === 0) {
      return result.response.text();
    }

    // Execute all tool calls in parallel
    const toolParts = await Promise.all(
      calls.map(async (call) => {
        try {
          const output = await dispatchTool(call.name, call.args as Record<string, unknown>);
          return {
            functionResponse: {
              name: call.name,
              response: { output: JSON.stringify(output) },
            },
          };
        } catch (err) {
          return {
            functionResponse: {
              name: call.name,
              response: { error: String(err) },
            },
          };
        }
      }),
    );

    result = await chat.sendMessage(toolParts);
    rounds++;
  }

  return "I reached the maximum number of tool calls. Please try a more specific question.";
}
