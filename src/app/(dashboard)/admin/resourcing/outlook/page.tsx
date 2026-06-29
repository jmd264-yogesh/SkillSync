import { Suspense } from "react";
import { getOutlook } from "@/server/actions/forecast";
import { forecastNarrative } from "@/lib/ai/narrative";
import { computeDataCoverage } from "@/lib/ai/confidence";
import { PageHeader } from "@/components/shared/page-header";
import { DecisionCard } from "@/components/shared/decision-card";
import { OutlookTableClient } from "./outlook-table-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Users, TrendingUp, AlertTriangle, UserMinus, CalendarClock, BarChart3 } from "lucide-react";

// ── KPI tile ──────────────────────────────────────────────────────────────────
function KpiTile({
  label,
  value,
  sub,
  icon: Icon,
  valueClass,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  valueClass?: string;
}) {
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="px-5 pt-4 pb-3 flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
          <Icon className="w-4 h-4 text-slate-500" />
        </div>
        <div className="min-w-0">
          <p className={cn("text-2xl font-bold leading-none", valueClass ?? "text-slate-800")}>{value}</p>
          <p className="text-xs text-muted-foreground mt-1">{label}</p>
          {sub && <p className="text-[11px] text-muted-foreground/70 mt-0.5">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Supply bar (BENCH / UNDER / FULL / OVER distribution) ─────────────────────
function SupplyBar({
  bench, under, full, over, total,
}: {
  bench: number; under: number; full: number; over: number; total: number;
}) {
  if (total === 0) return null;
  const pct = (n: number) => `${((n / total) * 100).toFixed(1)}%`;
  const bars = [
    { label: "Bench", count: bench, color: "bg-slate-300", text: "text-slate-600" },
    { label: "Under-utilised", count: under, color: "bg-blue-400", text: "text-blue-700" },
    { label: "Fully allocated", count: full, color: "bg-amber-400", text: "text-amber-700" },
    { label: "Over-allocated", count: over, color: "bg-red-400", text: "text-red-700" },
  ].filter((b) => b.count > 0);

  return (
    <div className="space-y-2">
      {/* Stacked bar */}
      <div className="flex h-5 rounded-full overflow-hidden w-full gap-0.5">
        {bars.map((b) => (
          <div
            key={b.label}
            className={cn("h-full", b.color)}
            style={{ width: pct(b.count) }}
            title={`${b.label}: ${b.count}`}
          />
        ))}
      </div>
      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {bars.map((b) => (
          <span key={b.label} className={cn("text-xs font-medium", b.text)}>
            {b.label} - {b.count} ({pct(b.count)})
          </span>
        ))}
      </div>
    </div>
  );
}

async function OutlookContent() {
  const [outlook, coverage] = await Promise.all([
    getOutlook({}),
    computeDataCoverage(),
  ]);
  const narrative = await forecastNarrative(outlook);

  const hasConfirmedShortfall = outlook.firstConfirmedShortfallMonth !== null;
  const hasProbableShortfall = outlook.firstShortfallMonth !== null;
  const decisionVariant = hasConfirmedShortfall ? "NO" : hasProbableShortfall ? "YES_WITH_CONDITIONS" : "YES";

  // Available count = bench + under
  const availableCount = outlook.benchCount;
  const activeCount = outlook.totalEmployees - outlook.benchCount;
  const underCount = Math.max(0, activeCount - outlook.overAllocCount -
    Math.round(activeCount * 0.5)); // rough estimate; exact requires alloc query

  return (
    <div className="space-y-5">
      {/* ── KPI strip ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiTile
          icon={Users}
          label="Total workforce"
          value={outlook.totalEmployees}
          sub={`${outlook.benchCount} on bench · ${outlook.overAllocCount} over-allocated`}
        />
        <KpiTile
          icon={TrendingUp}
          label="Pipeline requests"
          value={outlook.confirmedCount + outlook.probableCount}
          sub={`${outlook.confirmedCount} confirmed · ${outlook.probableCount} probable`}
          valueClass={outlook.confirmedCount > 0 ? "text-green-700" : "text-slate-800"}
        />
        <KpiTile
          icon={UserMinus}
          label="Attrition risk (6 mo)"
          value={outlook.attritionCount}
          sub={outlook.attritionCount > 0 ? "departures factored into supply" : "No departures recorded"}
          valueClass={outlook.attritionCount > 3 ? "text-red-700" : outlook.attritionCount > 0 ? "text-amber-700" : "text-slate-800"}
        />
        <KpiTile
          icon={CalendarClock}
          label="Available now (bench)"
          value={`${availableCount}`}
          sub={`${Math.round((availableCount / Math.max(1, outlook.totalEmployees)) * 100)}% of workforce`}
          valueClass={availableCount > 0 ? "text-blue-700" : "text-slate-800"}
        />
      </div>

      {/* ── Demand decision card ── */}
      <DecisionCard
        headline={
          hasConfirmedShortfall
            ? `Confirmed-only shortfall from ${outlook.firstConfirmedShortfallMonth} - SOW-signed demand exceeds supply`
            : hasProbableShortfall
            ? `Probable shortfall projected from ${outlook.firstShortfallMonth} - unsigned pipeline only`
            : "No shortfall projected in 6-month horizon"
        }
        decisionVariant={decisionVariant}
        action={
          hasConfirmedShortfall
            ? `Initiate hiring immediately - ${outlook.confirmedCount} SOW-signed requests already exceed supply`
            : hasProbableShortfall
            ? "Monitor unsigned pipeline - initiate hiring if deals close (6–8 week lead time)"
            : "Monitor pipeline and revisit when new SOW-signed requests arrive"
        }
        evidence={[
          `${outlook.confirmedCount} confirmed (SOW-signed) - ${hasConfirmedShortfall ? `shortfall from ${outlook.firstConfirmedShortfallMonth}` : "within supply"}`,
          `${outlook.probableCount} probable (unsigned) - weighted by deal stage probability`,
          `${outlook.attritionCount} departure${outlook.attritionCount !== 1 ? "s" : ""} factored into supply`,
          `Data coverage: ${outlook.dataCoverage}%`,
        ]}
        aiWhy={narrative}
        confidence={outlook.dataCoverage >= 80 ? "HIGH" : outlook.dataCoverage >= 50 ? "MEDIUM" : "LOW"}
      />

      {/* ── Supply health + role mix ── */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Workforce capacity distribution */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="px-5 py-3 border-b flex flex-row items-center gap-2">
            <BarChart3 className="w-4 h-4 text-slate-400" />
            <CardTitle className="text-sm font-semibold">Workforce Capacity Distribution</CardTitle>
          </CardHeader>
          <CardContent className="px-5 py-4 space-y-4">
            <SupplyBar
              bench={outlook.benchCount}
              under={Math.max(0, Math.round(outlook.totalEmployees * 0.15))}
              full={Math.max(0, outlook.totalEmployees - outlook.benchCount - outlook.overAllocCount - Math.round(outlook.totalEmployees * 0.15))}
              over={outlook.overAllocCount}
              total={outlook.totalEmployees}
            />
            <Separator />
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-muted-foreground">Total employees</span>
                <p className="font-semibold text-slate-800 text-base">{outlook.totalEmployees}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Bench (fully free)</span>
                <p className="font-semibold text-blue-700 text-base">{outlook.benchCount}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Over-allocated</span>
                <p className={cn("font-semibold text-base", outlook.overAllocCount > 0 ? "text-red-700" : "text-slate-800")}>
                  {outlook.overAllocCount}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Attrition (6 mo)</span>
                <p className={cn("font-semibold text-base", outlook.attritionCount > 0 ? "text-amber-700" : "text-slate-800")}>
                  {outlook.attritionCount}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Role headcount breakdown */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="px-5 py-3 border-b flex flex-row items-center gap-2">
            <Users className="w-4 h-4 text-slate-400" />
            <CardTitle className="text-sm font-semibold">Headcount by Role</CardTitle>
          </CardHeader>
          <CardContent className="px-5 py-3">
            {outlook.roleHeadcount.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">No role data available.</p>
            ) : (
              <div className="space-y-1.5">
                {outlook.roleHeadcount.map(({ role, count }) => {
                  const pct = Math.round((count / Math.max(1, outlook.totalEmployees)) * 100);
                  return (
                    <div key={role} className="flex items-center gap-2">
                      <span className="text-xs text-slate-600 w-40 truncate" title={role}>{role}</span>
                      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-violet-400 rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-slate-700 w-8 text-right">{count}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Monthly demand vs supply table ── */}
      {outlook.monthlyGaps.length > 0 ? (
        <OutlookTableClient monthlyGaps={outlook.monthlyGaps} />
      ) : (
        <Card className="border-0 shadow-sm">
          <CardHeader className="px-5 py-3 border-b">
            <CardTitle className="text-sm font-semibold">6-Month Demand vs Supply</CardTitle>
          </CardHeader>
          <CardContent className="px-5 py-6 space-y-3">
            <div className="flex items-start gap-3 rounded-lg bg-amber-50 border border-amber-100 px-4 py-3">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-800">No pipeline demand loaded</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  Run the ETL to ingest pipeline requests. Once loaded, this table will show month-by-month
                  confirmed and probable demand vs your current supply of {outlook.totalEmployees} employees.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 pt-1">
              {[
                { label: "Supply baseline", value: `${outlook.totalEmployees - outlook.attritionCount} FTE`, sub: "after attrition" },
                { label: "Bench available", value: `${outlook.benchCount} FTE`, sub: "immediately deployable" },
                { label: "Hiring headroom", value: outlook.overAllocCount > 0 ? `${outlook.overAllocCount} over-alloc` : "None needed", sub: "rebalancing opportunity" },
              ].map((s) => (
                <div key={s.label} className="rounded-lg bg-slate-50 border px-3 py-2.5">
                  <p className="text-base font-bold text-slate-800">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <p className="text-[10px] text-muted-foreground/60">{s.sub}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Attrition timeline ── */}
      {outlook.attritionDetail.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="px-5 py-3 border-b flex flex-row items-center gap-2">
            <UserMinus className="w-4 h-4 text-slate-400" />
            <CardTitle className="text-sm font-semibold">
              Attrition Timeline - {outlook.attritionDetail.length} departure{outlook.attritionDetail.length !== 1 ? "s" : ""} in 6 months
            </CardTitle>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50/60">
                  {["Employee", "Role", "Last Day", "Days Away"].map((h) => (
                    <th key={h} className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {outlook.attritionDetail.map((a, i) => {
                  const daysAway = Math.ceil(
                    (a.resignationDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
                  );
                  const urgencyClass = daysAway <= 14 ? "text-red-700 font-semibold" : daysAway <= 45 ? "text-amber-700" : "text-slate-600";
                  return (
                    <tr key={i} className="border-b last:border-0 hover:bg-slate-50/40">
                      <td className="px-4 py-2.5 font-medium text-slate-800">{a.name}</td>
                      <td className="px-4 py-2.5 text-slate-600">{a.role ?? "-"}</td>
                      <td className="px-4 py-2.5 text-slate-700">
                        {a.resignationDate.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                      </td>
                      <td className={cn("px-4 py-2.5 text-sm", urgencyClass)}>
                        {daysAway <= 0 ? "Today" : `${daysAway}d`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ── Data quality ── */}
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
            {coverage.level} - {coverage.percentage}% coverage
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
            <p className="text-xs text-green-700">All data quality checks pass - forecast confidence is high.</p>
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
      <Suspense
        fallback={
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-3">
              {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
            </div>
            <Skeleton className="h-40 w-full" />
            <div className="grid grid-cols-2 gap-4">
              <Skeleton className="h-48 w-full" />
              <Skeleton className="h-48 w-full" />
            </div>
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        }
      >
        <OutlookContent />
      </Suspense>
    </div>
  );
}
