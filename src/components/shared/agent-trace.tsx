"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { AgentStep } from "@/lib/ai/agent/guardrails";

interface AgentTraceProps {
  trace: AgentStep[];
  label?: string;
  defaultOpen?: boolean;
}

const TOOL_COLORS: Record<string, string> = {
  get_demand: "text-blue-700",
  find_candidates: "text-violet-700",
  check_health_impact: "text-orange-700",
  record_plan: "text-green-700",
  record_intervention: "text-green-700",
  record_proposal: "text-green-700",
  get_all_project_health: "text-orange-700",
  find_pipeline_match: "text-violet-700",
  get_project_details: "text-blue-700",
};

function getArgsSummary(args: Record<string, unknown>): string {
  const keys = Object.keys(args).filter((k) => k !== "assignments" && k !== "riskFlags");
  if (keys.length === 0) return "";
  const parts = keys.slice(0, 2).map((k) => {
    const v = args[k];
    const str = typeof v === "object" ? JSON.stringify(v) : String(v);
    return `${k}: ${str.slice(0, 24)}`;
  });
  return `(${parts.join(", ")}${keys.length > 2 ? " …" : ""})`;
}

export function AgentTrace({
  trace,
  label = "How this was decided",
  defaultOpen = false,
}: AgentTraceProps) {
  const [open, setOpen] = useState(defaultOpen);

  if (trace.length === 0) return null;

  const backtrackCount = trace.filter((s) => s.isBacktrack).length;
  const uniqueTools = new Set(trace.map((s) => s.toolName)).size;

  return (
    <div className="mt-3 border rounded-lg overflow-hidden text-xs">
      {/* Header / toggle */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-violet-500" />
          <span className="font-semibold text-slate-600">{label}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">
            {trace.length} step{trace.length !== 1 ? "s" : ""} · {uniqueTools} tool
            {uniqueTools !== 1 ? "s" : ""}
            {backtrackCount > 0 && (
              <span className="ml-1 text-amber-600 font-semibold">
                · {backtrackCount} backtrack{backtrackCount !== 1 ? "s" : ""}
              </span>
            )}
          </span>
          <span className="text-muted-foreground text-[10px]">{open ? "▲" : "▼"}</span>
        </div>
      </button>

      {/* Step list */}
      {open && (
        <ol className="divide-y">
          {trace.map((step, i) => (
            <li
              key={i}
              className={cn(
                "flex gap-3 px-4 py-2.5",
                step.isBacktrack ? "bg-amber-50" : "bg-white",
              )}
            >
              {/* Round badge */}
              <div className="shrink-0 mt-0.5 w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center font-mono text-[10px] text-slate-500 font-semibold">
                {step.round}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span
                    className={cn(
                      "font-mono font-semibold",
                      TOOL_COLORS[step.toolName] ?? "text-slate-700",
                    )}
                  >
                    {step.toolName}
                  </span>
                  <span className="text-slate-400 truncate max-w-[200px]">
                    {getArgsSummary(step.toolArgs)}
                  </span>
                  {step.isBacktrack && (
                    <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-semibold text-[10px] uppercase tracking-wide">
                      ↺ backtrack
                    </span>
                  )}
                </div>
                <p className="text-slate-500 mt-0.5 leading-relaxed">{step.toolResultSummary}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
