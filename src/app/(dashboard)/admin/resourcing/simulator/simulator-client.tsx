"use client";

import { useState } from "react";
import { buildPlans } from "@/server/actions/forecast";
import { DecisionCard } from "@/components/shared/decision-card";
import { AgentTrace } from "@/components/shared/agent-trace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { PROJECT_CATEGORY_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { StaffingPlanResult, StaffingPlan } from "@/lib/ai/agent/plan-builder";

const CATEGORIES = Object.entries(PROJECT_CATEGORY_LABELS);

interface AdHocItem {
  category: string;
  count: number;
  start: string;
  weeks: number;
}

const SIGNAL_STYLES: Record<string, string> = {
  REDEPLOY: "bg-green-50 text-green-700 border-green-200",
  HIRE: "bg-red-50 text-red-700 border-red-200",
  PARTIAL_HIRE: "bg-amber-50 text-amber-700 border-amber-200",
};

function PlanCard({ plan }: { plan: StaffingPlan }) {
  return (
    <DecisionCard
      headline={plan.planName}
      decisionVariant={plan.decisionVariant}
      action={plan.tradeoffSummary}
      evidence={[
        `Hires required: ${plan.hireCount}`,
        `Internal redeployments: ${plan.redeployCount}`,
        `Residual shortfall: ${plan.residualShortfall.toFixed(1)} FTE`,
        ...(plan.riskFlags.length > 0
          ? [`Risk flags: ${plan.riskFlags.slice(0, 2).join("; ")}`]
          : []),
      ]}
    >
      {/* Assignment table */}
      {plan.assignments.length > 0 && (
        <div className="mt-3 border rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 border-b">
                {["Role", "Action", "Candidate", "Fit", "Note"].map((h) => (
                  <th key={h} className="px-3 py-1.5 text-left text-slate-500 font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {plan.assignments.map((a, i) => (
                <tr key={i} className="border-b last:border-0">
                  <td className="px-3 py-1.5 font-medium text-slate-700">{a.role}</td>
                  <td className="px-3 py-1.5">
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px]",
                        SIGNAL_STYLES[a.type] ?? SIGNAL_STYLES["HIRE"],
                      )}
                    >
                      {a.type}
                    </Badge>
                  </td>
                  <td className="px-3 py-1.5 text-slate-600">
                    {a.employeeName ?? "- External hire"}
                  </td>
                  <td className="px-3 py-1.5 text-slate-600">
                    {a.fitScore !== undefined ? `${a.fitScore}%` : "-"}
                  </td>
                  <td className="px-3 py-1.5 text-amber-700 text-[10px]">
                    {a.riskNote ?? ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Apply button - disabled (propose only) */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>
            <Button size="sm" variant="outline" disabled className="mt-3 opacity-60">
              Apply Plan
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p className="text-xs">Human review required - proposals only</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </DecisionCard>
  );
}

export function SimulatorClient() {
  const [items, setItems] = useState<AdHocItem[]>([
    {
      category: "D_AND_D",
      count: 1,
      start: new Date().toISOString().slice(0, 10),
      weeks: 12,
    },
  ]);
  const [result, setResult] = useState<StaffingPlanResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addRow() {
    setItems((prev) => [
      ...prev,
      {
        category: "TACTICAL_BUILD",
        count: 1,
        start: new Date().toISOString().slice(0, 10),
        weeks: 8,
      },
    ]);
  }

  function removeRow(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateItem(idx: number, field: keyof AdHocItem, value: string | number) {
    setItems((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item)),
    );
  }

  async function handleSimulate() {
    setLoading(true);
    setError(null);
    try {
      const data = await buildPlans({
        adHoc: items.map((it) => ({
          category: it.category as never,
          count: it.count,
          start: new Date(it.start).toISOString(),
          weeks: it.weeks,
        })),
      });
      setResult(data);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Input */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="px-5 py-3 pb-0">
          <CardTitle className="text-sm font-semibold text-slate-700">Define Projects</CardTitle>
        </CardHeader>
        <CardContent className="px-5 py-4 space-y-3">
          {items.map((item, idx) => (
            <div key={idx} className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
              <div>
                <Label className="text-xs">Category</Label>
                <Select
                  value={item.category}
                  onValueChange={(v) => updateItem(idx, "category", v ?? "")}
                >
                  <SelectTrigger className="h-8 text-sm mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Count</Label>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={String(item.count)}
                  onChange={(e) => updateItem(idx, "count", parseInt(e.target.value) || 1)}
                  className="h-8 text-sm mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Start Date</Label>
                <Input
                  type="date"
                  value={item.start}
                  onChange={(e) => updateItem(idx, "start", e.target.value)}
                  className="h-8 text-sm mt-1"
                />
              </div>
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <Label className="text-xs">Weeks</Label>
                  <Input
                    type="number"
                    min={1}
                    max={104}
                    value={item.weeks}
                    onChange={(e) =>
                      updateItem(idx, "weeks", parseInt(e.target.value) || 8)
                    }
                    className="h-8 text-sm mt-1"
                  />
                </div>
                {items.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-slate-400 hover:text-red-500"
                    onClick={() => removeRow(idx)}
                    type="button"
                  >
                    ×
                  </Button>
                )}
              </div>
            </div>
          ))}
          <div className="flex gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={addRow}>
              + Add project
            </Button>
            <Button size="sm" onClick={handleSimulate} disabled={loading}>
              {loading ? "Planning…" : "Build Plans"}
            </Button>
          </div>
          {loading && (
            <p className="text-xs text-muted-foreground">
              Agent is planning - checking candidates and conflict-testing redeployments…
            </p>
          )}
          {error && <p className="text-xs text-red-600">{error}</p>}
        </CardContent>
      </Card>

      {loading && (
        <div className="space-y-3">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      )}

      {result && (
        <div className="space-y-4">
          {/* Narrative summary */}
          {result.narrative && (
            <div className="bg-violet-50 border border-violet-100 rounded-lg px-4 py-3">
              <p className="text-xs font-semibold text-violet-700 mb-1 uppercase tracking-wide">
                Agent Summary
              </p>
              <p className="text-sm text-slate-700 leading-relaxed">{result.narrative}</p>
            </div>
          )}

          {/* Plan cards */}
          {result.plans.map((plan, i) => (
            <PlanCard key={i} plan={plan} />
          ))}

          {/* Agent trace - collapsed by default */}
          <AgentTrace
            trace={result.trace}
            label="How this plan was built"
          />
        </div>
      )}
    </div>
  );
}
