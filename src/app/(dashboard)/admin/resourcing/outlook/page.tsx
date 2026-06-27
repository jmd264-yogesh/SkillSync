import { Suspense } from "react";
import { getOutlook } from "@/server/actions/forecast";
import { forecastNarrative } from "@/lib/ai/narrative";
import { computeDataCoverage } from "@/lib/ai/confidence";
import { PageHeader } from "@/components/shared/page-header";
import { DecisionCard } from "@/components/shared/decision-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

async function OutlookContent() {
  const [outlook, coverage] = await Promise.all([
    getOutlook({}),
    computeDataCoverage(),
  ]);
  const narrative = await forecastNarrative(outlook);

  const hasConfirmedShortfall = outlook.firstConfirmedShortfallMonth !== null;
  const hasProbableShortfall = outlook.firstShortfallMonth !== null;
  const decisionVariant = hasConfirmedShortfall ? "NO" : hasProbableShortfall ? "YES_WITH_CONDITIONS" : "YES";

  return (
    <div className="space-y-5">
      {/* P2 — Confirmed vs probable decision card */}
      <DecisionCard
        headline={
          hasConfirmedShortfall
            ? `Confirmed-only shortfall from ${outlook.firstConfirmedShortfallMonth} — SOW-signed demand exceeds supply`
            : hasProbableShortfall
            ? `Probable shortfall projected from ${outlook.firstShortfallMonth} — unsigned pipeline only`
            : "No shortfall projected in 6-month horizon"
        }
        decisionVariant={decisionVariant}
        action={
          hasConfirmedShortfall
            ? `Initiate hiring immediately — ${outlook.confirmedCount} SOW-signed requests already exceed supply`
            : hasProbableShortfall
            ? "Monitor unsigned pipeline — initiate hiring if deals close (6–8 week lead time)"
            : "Monitor pipeline and revisit when new SOW-signed requests arrive"
        }
        evidence={[
          `${outlook.confirmedCount} confirmed (SOW-signed) — ${hasConfirmedShortfall ? `shortfall from ${outlook.firstConfirmedShortfallMonth}` : "within supply"}`,
          `${outlook.probableCount} probable (unsigned) — weighted by deal stage probability`,
          `${outlook.attritionCount} departure${outlook.attritionCount !== 1 ? "s" : ""} factored into supply`,
          `Data coverage: ${outlook.dataCoverage}%`,
        ]}
        aiWhy={narrative}
        confidence={outlook.dataCoverage >= 80 ? "HIGH" : outlook.dataCoverage >= 50 ? "MEDIUM" : "LOW"}
      />

      {/* Month × role matrix */}
      {outlook.monthlyGaps.length > 0 && (
        <Card className="border-0 shadow-sm overflow-hidden">
          <CardHeader className="px-5 py-3 border-b">
            <CardTitle className="text-sm font-semibold">6-Month Demand vs Supply</CardTitle>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-b">
                  {["Month", "Role", "Confirmed ✓", "Probable ~", "Total Demand", "Supply", "Gap"].map((h) => (
                    <th key={h} className="px-4 py-2 text-left text-slate-500 font-semibold whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {outlook.monthlyGaps.map((g, i) => (
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
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {outlook.monthlyGaps.length === 0 && (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-12 text-center text-muted-foreground text-sm">
            No pipeline data available. Run the ETL to load pipeline requests.
          </CardContent>
        </Card>
      )}

      {/* P6 — Data quality card */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="px-5 py-3 border-b flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold">Data Quality</CardTitle>
          <Badge
            variant="outline"
            className={cn(
              "text-xs font-semibold",
              coverage.level === "HIGH" ? "bg-green-50 text-green-700 border-green-200"
              : coverage.level === "MEDIUM" ? "bg-amber-50 text-amber-700 border-amber-200"
              : "bg-red-50 text-red-700 border-red-200",
            )}
          >
            {coverage.level} — {coverage.percentage}% coverage
          </Badge>
        </CardHeader>
        <CardContent className="px-5 py-4">
          <p className="text-xs text-muted-foreground mb-3">{coverage.explanation}</p>
          {coverage.improvements.length > 0 ? (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-slate-700">To improve forecast confidence:</p>
              {coverage.improvements.map((item, i) => (
                <p key={i} className="text-xs text-slate-600">• {item}</p>
              ))}
            </div>
          ) : (
            <p className="text-xs text-green-700">All data quality checks pass — forecast confidence is high.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function OutlookPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="6-Month Pipeline Outlook"
        description="SOW-weighted demand vs supply forecast by cluster. Confirmed (signed) and probable (unsigned) shown separately."
      />
      <Suspense fallback={<div className="space-y-3"><Skeleton className="h-40 w-full" /><Skeleton className="h-64 w-full" /><Skeleton className="h-32 w-full" /></div>}>
        <OutlookContent />
      </Suspense>
    </div>
  );
}
