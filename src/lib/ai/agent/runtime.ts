import { FunctionCallingMode } from "@google/generative-ai";
import type { Tool } from "@google/generative-ai";
import { genAI, MODELS, AI_TIMEOUT_MS } from "../client";
import type { AgentStep } from "./guardrails";

export interface AgentResult {
  finalText: string;
  trace: AgentStep[];
}

function capOutput(name: string, data: unknown, maxChars = 2500): string {
  const s = JSON.stringify(data);
  return s.length > maxChars
    ? s.slice(0, maxChars) + `...[capped - showing first ${maxChars} chars of ${name} result]`
    : s;
}

function summarizeOutput(name: string, output: unknown): string {
  if (Array.isArray(output)) return `${name}: ${output.length} items`;
  if (output && typeof output === "object") {
    const o = output as Record<string, unknown>;
    if ("totalShortfall" in o)
      return `demand: ${String(o["totalDemandFTE"] ?? "?")} FTE, shortfall: ${String(o["totalShortfall"] ?? "?")} FTE`;
    if ("safe" in o)
      return `health-check: ${o["safe"] ? "SAFE - no conflicts" : `CONFLICT - ${JSON.stringify(o["conflicts"]).slice(0, 80)}`}`;
    if ("recorded" in o) return `plan #${String(o["planIndex"] ?? "?")} recorded`;
    if ("interventionIndex" in o) return `triage #${String(o["interventionIndex"] ?? "?")} recorded`;
    if ("proposalIndex" in o) return `proposal #${String(o["proposalIndex"] ?? "?")} recorded`;
    const keys = Object.keys(o).slice(0, 3).join(", ");
    return `${name}: {${keys}}`;
  }
  return String(output).slice(0, 120);
}

async function withTimeout<T>(promise: Promise<T>, ms: number, msg: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(msg)), ms)),
  ]);
}

/**
 * Reusable Gemini tool-use agent loop.
 * Returns { finalText, trace } after at most maxRounds tool-call iterations.
 */
export async function runAgent(params: {
  system: string;
  tools: Tool[];
  dispatch: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  messages: { role: "user" | "model"; text: string }[];
  maxRounds?: number;
  model?: string;
  serializeOutput?: (name: string, data: unknown) => string;
  onStep?: (step: AgentStep) => void;
}): Promise<AgentResult> {
  const {
    system,
    tools,
    dispatch,
    messages,
    maxRounds = 6,
    model = MODELS.primary,
    serializeOutput,
    onStep,
  } = params;

  const trace: AgentStep[] = [];
  if (messages.length === 0) return { finalText: "No input provided.", trace };

  const lastMsg = messages[messages.length - 1];
  const priorMsgs = messages.slice(0, -1);

  const geminiModel = genAI.getGenerativeModel({
    model,
    systemInstruction: system,
    tools,
    toolConfig: { functionCallingConfig: { mode: FunctionCallingMode.AUTO } },
  });

  const chatHistory = priorMsgs.map((m) => ({
    role: m.role as "user" | "model",
    parts: [{ text: m.text }],
  }));

  const chat = geminiModel.startChat({ history: chatHistory });

  let result = await withTimeout(
    chat.sendMessage(lastMsg?.text ?? ""),
    AI_TIMEOUT_MS * 2,
    "Initial agent request timed out",
  );

  let rounds = 0;

  while (rounds < maxRounds) {
    const calls = result.response.functionCalls();
    if (!calls || calls.length === 0) break;

    const toolParts = await Promise.all(
      calls.map(async (call) => {
        try {
          const output = await dispatch(call.name, call.args as Record<string, unknown>);
          const summary = summarizeOutput(call.name, output);
          const serialized = serializeOutput
            ? serializeOutput(call.name, output)
            : capOutput(call.name, output);

          const step: AgentStep = {
            round: rounds + 1,
            toolName: call.name,
            toolArgs: call.args as Record<string, unknown>,
            toolResultSummary: summary,
          };
          trace.push(step);
          onStep?.(step);

          return {
            functionResponse: { name: call.name, response: { output: serialized } },
          };
        } catch (err) {
          const step: AgentStep = {
            round: rounds + 1,
            toolName: call.name,
            toolArgs: call.args as Record<string, unknown>,
            toolResultSummary: `Error: ${String(err)}`,
          };
          trace.push(step);
          return {
            functionResponse: { name: call.name, response: { error: String(err) } },
          };
        }
      }),
    );

    result = await withTimeout(
      chat.sendMessage(toolParts),
      AI_TIMEOUT_MS * 2,
      "Agent tool-response timed out",
    );
    rounds++;
  }

  // Post-process: mark steps after a conflict check failure as BACKTRACK
  let lastWasConflict = false;
  for (const step of trace) {
    if (
      step.toolName === "check_health_impact" &&
      step.toolResultSummary.includes("CONFLICT")
    ) {
      lastWasConflict = true;
    } else if (
      lastWasConflict &&
      (step.toolName === "check_health_impact" || step.toolName === "find_candidates")
    ) {
      step.isBacktrack = true;
      lastWasConflict = false;
    } else {
      lastWasConflict = false;
    }
  }

  return { finalText: result.response.text(), trace };
}
