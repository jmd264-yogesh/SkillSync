"use client";

import { useState } from "react";
import { forecastProjects } from "@/server/actions/forecast";
import { DecisionCard } from "@/components/shared/decision-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PROJECT_CATEGORY_LABELS } from "@/lib/constants";
import type { NewProjectForecast } from "@/server/services/forecast.service";

const CATEGORIES = Object.entries(PROJECT_CATEGORY_LABELS);

interface AdHocItem {
  category: string;
  count: number;
  start: string;
  weeks: number;
}

export function SimulatorClient() {
  const [items, setItems] = useState<AdHocItem[]>([
    { category: "D_AND_D", count: 1, start: new Date().toISOString().slice(0, 10), weeks: 12 },
  ]);
  const [result, setResult] = useState<NewProjectForecast | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addRow() {
    setItems((prev) => [...prev, { category: "TACTICAL_BUILD", count: 1, start: new Date().toISOString().slice(0, 10), weeks: 8 }]);
  }

  function updateItem(idx: number, field: keyof AdHocItem, value: string | number) {
    setItems((prev) => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  }

  async function handleSimulate() {
    setLoading(true);
    setError(null);
    try {
      const data = await forecastProjects({
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

  const decisionVariant = result
    ? result.decision === "YES" ? "YES"
    : result.decision === "YES_WITH_REDEPLOYMENTS" ? "YES_WITH_CONDITIONS"
    : "NO"
    : "NEUTRAL";

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
                <Select value={item.category} onValueChange={(v) => updateItem(idx, "category", v ?? "")}>
                  <SelectTrigger className="h-8 text-sm mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Count</Label>
                <Input type="number" min={1} max={20} value={String(item.count)} onChange={(e) => updateItem(idx, "count", parseInt(e.target.value) || 1)} className="h-8 text-sm mt-1" />
              </div>
              <div>
                <Label className="text-xs">Start Date</Label>
                <Input type="date" value={item.start} onChange={(e) => updateItem(idx, "start", e.target.value)} className="h-8 text-sm mt-1" />
              </div>
              <div>
                <Label className="text-xs">Weeks</Label>
                <Input type="number" min={1} max={104} value={item.weeks} onChange={(e) => updateItem(idx, "weeks", parseInt(e.target.value) || 8)} className="h-8 text-sm mt-1" />
              </div>
            </div>
          ))}
          <div className="flex gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={addRow}>+ Add project</Button>
            <Button size="sm" onClick={handleSimulate} disabled={loading}>
              {loading ? "Simulating…" : "Simulate"}
            </Button>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </CardContent>
      </Card>

      {loading && <Skeleton className="h-48 w-full" />}

      {result && (
        <div className="space-y-4">
          <DecisionCard
            headline={result.decisionDetail}
            decisionVariant={decisionVariant}
            action={
              result.decision === "NO_HIRE_REQUIRED"
                ? `Hire ${Math.ceil(result.totalShortfall)} FTE — see role breakdown below`
                : result.reallocationCandidates.length > 0
                ? `Redeploy ${result.reallocationCandidates.slice(0, 3).map((c) => c.name).join(", ")}`
                : "Proceed — sufficient supply"
            }
            evidence={[
              `Total demand: ${result.totalDemandFTE.toFixed(1)} FTE`,
              `Available supply: ${result.totalSupplyFTE.toFixed(1)} FTE`,
              `Shortfall: ${result.totalShortfall.toFixed(1)} FTE`,
            ]}
          >
            {/* Role breakdown */}
            {result.byRole.length > 0 && (
              <div className="mt-3 border rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b">
                      {["Role", "Demand", "Supply", "Shortfall"].map((h) => (
                        <th key={h} className="px-3 py-1.5 text-left text-slate-500 font-semibold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.byRole.map((r) => (
                      <tr key={r.role} className="border-b last:border-0">
                        <td className="px-3 py-1.5 font-medium">{r.role}</td>
                        <td className="px-3 py-1.5">{r.demandFTE.toFixed(1)}</td>
                        <td className="px-3 py-1.5">{r.supplyFTE.toFixed(1)}</td>
                        <td className={`px-3 py-1.5 font-semibold ${r.shortfall > 0 ? "text-red-600" : "text-green-600"}`}>
                          {r.shortfall > 0 ? `-${r.shortfall.toFixed(1)}` : "✓"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </DecisionCard>

          {/* Redeployment candidates */}
          {result.reallocationCandidates.length > 0 && (
            <Card className="border-0 shadow-sm">
              <CardHeader className="px-5 py-3 pb-0">
                <CardTitle className="text-sm font-semibold">Redeployment Candidates</CardTitle>
              </CardHeader>
              <CardContent className="px-5 py-3">
                <div className="space-y-1.5">
                  {result.reallocationCandidates.map((c) => (
                    <div key={c.employeeId} className="flex items-center justify-between text-sm">
                      <span className="font-medium">{c.name}</span>
                      <span className="text-muted-foreground text-xs">{c.role ?? "—"} · {Math.round(c.freeCapacity * 100)}% free</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
