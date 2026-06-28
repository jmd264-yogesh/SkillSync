"use client";

import { useState, useMemo } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface MonthlyGapRow {
  month: string;
  role: string;
  confirmedFTE: number;
  probableFTE: number;
  totalDemandFTE: number;
  supplyFTE: number;
  gap: number;
}

interface OutlookTableClientProps {
  monthlyGaps: MonthlyGapRow[];
}

export function OutlookTableClient({ monthlyGaps }: OutlookTableClientProps) {
  const [showShortfallOnly, setShowShortfallOnly] = useState(false);
  const [roleFilter, setRoleFilter] = useState("ALL");

  const distinctRoles = useMemo(
    () => Array.from(new Set(monthlyGaps.map((g) => g.role))).sort(),
    [monthlyGaps],
  );

  const filteredGaps = useMemo(
    () =>
      monthlyGaps.filter((g) => {
        const passRole = roleFilter === "ALL" || g.role === roleFilter;
        const passShortfall = !showShortfallOnly || g.gap < 0;
        return passRole && passShortfall;
      }),
    [monthlyGaps, roleFilter, showShortfallOnly],
  );

  return (
    <Card className="border-0 shadow-sm overflow-hidden">
      <CardHeader className="px-5 py-3 border-b">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-sm font-semibold">6-Month Demand vs Supply</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v ?? "ALL")}>
              <SelectTrigger className="h-7 text-xs w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All roles ({monthlyGaps.length})</SelectItem>
                {distinctRoles.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <button
              onClick={() => setShowShortfallOnly((v) => !v)}
              className={cn(
                "h-7 px-3 text-xs rounded-md border transition-colors",
                showShortfallOnly
                  ? "bg-red-50 text-red-700 border-red-200 font-semibold"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50",
              )}
            >
              Shortfall only
            </button>
            {(showShortfallOnly || roleFilter !== "ALL") && (
              <button
                onClick={() => { setShowShortfallOnly(false); setRoleFilter("ALL"); }}
                className="text-xs text-muted-foreground hover:text-slate-700"
              >
                Clear
              </button>
            )}
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {filteredGaps.length} of {monthlyGaps.length} rows
            </span>
          </div>
        </div>
      </CardHeader>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 border-b">
              {["Month", "Role", "Confirmed ✓", "Probable ~", "Total Demand", "Supply", "Gap"].map((h) => (
                <th key={h} className="px-4 py-2 text-left text-slate-500 font-semibold whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredGaps.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  No rows match the current filters.
                </td>
              </tr>
            ) : (
              filteredGaps.map((g, i) => (
                <tr key={i} className="border-b last:border-0 hover:bg-slate-50/40">
                  <td className="px-4 py-2 font-medium">{g.month}</td>
                  <td className="px-4 py-2 text-slate-600">{g.role}</td>
                  <td className="px-4 py-2 text-green-700 font-medium">{g.confirmedFTE.toFixed(1)}</td>
                  <td className="px-4 py-2 text-amber-700">{g.probableFTE.toFixed(1)}</td>
                  <td className="px-4 py-2">{g.totalDemandFTE.toFixed(1)}</td>
                  <td className="px-4 py-2">{g.supplyFTE.toFixed(1)}</td>
                  <td className={cn("px-4 py-2 font-semibold", g.gap < 0 ? "text-red-600" : "text-green-600")}>
                    {g.gap >= 0 ? `+${g.gap.toFixed(1)}` : g.gap.toFixed(1)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
