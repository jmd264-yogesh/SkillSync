import { Suspense } from "react";
import { getOutlook } from "@/server/actions/forecast";
import { forecastNarrative } from "@/lib/ai/narrative";
import { PageHeader } from "@/components/shared/page-header";
import { DecisionCard } from "@/components/shared/decision-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

async function OutlookContent() {
  const outlook = await getOutlook({});
  const narrative = await forecastNarrative(outlook);

  const hasShortfall = outlook.firstShortfallMonth !== null;
  const variant = hasShortfall ? "YES_WITH_CONDITIONS" : "YES";

  return (
    <div className="space-y-5">
      {/* AI narrative decision card */}
      <DecisionCard
        headline={
          hasShortfall
            ? `First shortfall projected: ${outlook.firstShortfallMonth}`
            : "No shortfall projected in 6-month horizon"
        }
        decisionVariant={variant}
        action={
          hasShortfall
            ? "Initiate hiring for shortfall roles now — lead time typically 6–8 weeks"
            : "Monitor pipeline and revisit when new SOW-signed requests arrive"
        }
        evidence={[
          `${outlook.confirmedCount} confirmed (SOW-signed) requests`,
          `${outlook.probableCount} probable (unsigned) requests — weighted by deal stage`,
          `${outlook.attritionCount} departures factored into supply`,
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
                  {["Month", "Role", "Confirmed", "Probable", "Total Demand", "Supply", "Gap"].map((h) => (
                    <th key={h} className="px-4 py-2 text-left text-slate-500 font-semibold whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {outlook.monthlyGaps.map((g, i) => (
                  <tr key={i} className="border-b last:border-0 hover:bg-slate-50/40">
                    <td className="px-4 py-2 font-medium">{g.month}</td>
                    <td className="px-4 py-2 text-slate-600">{g.role}</td>
                    <td className="px-4 py-2 text-green-700">{g.confirmedFTE.toFixed(1)}</td>
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
      <Suspense fallback={<div className="space-y-3"><Skeleton className="h-40 w-full" /><Skeleton className="h-64 w-full" /></div>}>
        <OutlookContent />
      </Suspense>
    </div>
  );
}
