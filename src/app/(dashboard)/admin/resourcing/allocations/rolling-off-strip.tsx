"use client";

import { useState } from "react";
import { getReallocationProposals } from "@/server/actions/allocation-report";
import { DecisionCard } from "@/components/shared/decision-card";
import { AgentTrace } from "@/components/shared/agent-trace";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { ReallocationResult } from "@/lib/ai/agent/reallocation";

interface RollingOffStripProps {
  rollingOff: {
    employeeId: string;
    employeeCode: string;
    jobName: string | null;
    releasableFrom: Date | null;
  }[];
}

export function RollingOffStrip({ rollingOff }: RollingOffStripProps) {
  const [proposals, setProposals] = useState<ReallocationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFindMatches() {
    setLoading(true);
    setError(null);
    try {
      const result = await getReallocationProposals(14);
      setProposals(result);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  if (rollingOff.length === 0) return null;

  return (
    <Card className="border-0 shadow-sm bg-blue-50/60">
      <CardHeader className="px-5 py-2.5 border-b flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold text-blue-800">
          Becoming available (next 14 days) — {rollingOff.length} employee
          {rollingOff.length !== 1 ? "s" : ""}
        </CardTitle>
        <Button
          size="sm"
          variant="outline"
          className="bg-white text-blue-700 border-blue-200 hover:bg-blue-50"
          onClick={handleFindMatches}
          disabled={loading}
        >
          {loading ? "Matching…" : "Find Matches"}
        </Button>
      </CardHeader>

      <CardContent className="px-5 py-3 space-y-3">
        {/* Employee badges */}
        <div className="flex flex-wrap gap-2">
          {rollingOff.map((r) => (
            <Badge
              key={r.employeeId}
              variant="outline"
              className="bg-white text-blue-700 border-blue-200 text-xs"
            >
              {r.employeeCode} · {r.jobName ?? "—"} · {r.releasableFrom?.toLocaleDateString()}
            </Badge>
          ))}
        </div>

        {loading && (
          <div className="space-y-2">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        )}

        {error && <p className="text-xs text-red-600">{error}</p>}

        {proposals && proposals.proposals.length > 0 && (
          <div className="space-y-3 pt-1">
            <p className="text-xs font-semibold text-blue-800">
              Proposed Reallocation Moves
            </p>

            {proposals.narrative && (
              <p className="text-xs text-slate-600">{proposals.narrative}</p>
            )}

            {proposals.proposals.map((p) => {
              const variant = p.decisionVariant === "NEUTRAL" ? "NEUTRAL" as const
                : p.decisionVariant;
              return (
                <DecisionCard
                  key={p.employeeId}
                  headline={`${p.employeeName} → ${p.proposedProjectDescription}`}
                  decisionVariant={variant}
                  action={`Start: ${p.startDate} — ${p.freeCapacityPct}% capacity available`}
                  evidence={[
                    `Fit score: ${p.fitScore}/100`,
                    p.fitRationale,
                    ...(p.currentRole ? [`Current role: ${p.currentRole}`] : []),
                  ]}
                >
                  {/* Apply button — disabled (propose only) */}
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Button size="sm" variant="outline" disabled className="mt-2 opacity-60">
                          Apply Move
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="right">
                        <p className="text-xs">Human review required — proposals only</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </DecisionCard>
              );
            })}

            <AgentTrace trace={proposals.trace} label="How matches were found" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
