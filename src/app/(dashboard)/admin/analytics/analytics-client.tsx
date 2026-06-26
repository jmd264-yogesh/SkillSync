"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import {
  Users,
  Award,
  Briefcase,
  Network,
  CheckCircle,
  Clock,
  XCircle,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AnalyticsClientProps {
  metrics: {
    totalEmployees: number;
    totalSkillsMapped: number;
    totalCoes: number;
    totalDesignations: number;
  };
  coeData: { name: string; count: number }[];
  designationData: { name: string; count: number }[];
  approvalData: { status: string; count: number }[];
  recentMappings: {
    id: string;
    employeeName: string;
    skillName: string;
    status: string;
    level: number;
  }[];
  orgReadiness: number;
  employeesWithNoGaps: number;
  readinessBands: { low: number; medium: number; high: number };
  coeReadinessData: { name: string; readiness: number }[];
}

const PRIMARY = "#19105b";
const SECONDARY = "#ff6196";
const PRIMARY_SOFT = "#EEF0F8";
const SECONDARY_SOFT = "#fff0f5";

function coeBarColor(readiness: number): string {
  if (readiness >= 70) return PRIMARY;
  if (readiness >= 40) return SECONDARY;
  return "#94a3b8";
}

function bandColor(band: "high" | "medium" | "low"): string {
  if (band === "high") return PRIMARY;
  if (band === "medium") return SECONDARY;
  return "#94a3b8";
}

function bandBg(band: "high" | "medium" | "low"): string {
  if (band === "high") return PRIMARY_SOFT;
  if (band === "medium") return SECONDARY_SOFT;
  return "#f8fafc";
}

// SVG circular gauge
function ReadinessGauge({ value }: { value: number }) {
  const r = 52;
  const circ = 2 * Math.PI * r;
  const offset = circ - (value / 100) * circ;
  return (
    <svg width="136" height="136" viewBox="0 0 136 136" aria-label={`${value}% readiness`}>
      <circle cx="68" cy="68" r={r} fill="none" stroke={PRIMARY_SOFT} strokeWidth="11" />
      <circle
        cx="68"
        cy="68"
        r={r}
        fill="none"
        stroke={PRIMARY}
        strokeWidth="11"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform="rotate(-90 68 68)"
      />
      <text
        x="68"
        y="62"
        textAnchor="middle"
        fontSize="22"
        fontWeight="700"
        fill={PRIMARY}
        fontFamily="system-ui, sans-serif"
      >
        {value}%
      </text>
      <text
        x="68"
        y="79"
        textAnchor="middle"
        fontSize="10"
        fill="#94a3b8"
        fontFamily="system-ui, sans-serif"
      >
        org readiness
      </text>
    </svg>
  );
}

interface StatCardProps {
  title: string;
  value: string | number;
  sub: string;
  icon: React.ReactNode;
  featured?: boolean;
}

function StatCard({ title, value, sub, icon, featured }: StatCardProps) {
  if (featured) {
    return (
      <div
        className="rounded-xl p-5 flex flex-col justify-between min-h-[120px] shadow-card"
        style={{ background: PRIMARY }}
      >
        <div
          className="p-2 rounded-lg w-fit"
          style={{ background: "rgba(255,255,255,0.12)" }}
        >
          {icon}
        </div>
        <div>
          <div className="text-3xl font-bold text-white tracking-tight">{value}</div>
          <p className="text-sm font-semibold mt-0.5" style={{ color: "rgba(255,255,255,0.75)" }}>
            {title}
          </p>
          <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.45)" }}>
            {sub}
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="stat-card hover-lift">
      <div className="mb-4">
        <div className="p-2 rounded-lg w-fit" style={{ background: PRIMARY_SOFT }}>
          {icon}
        </div>
      </div>
      <div className="text-2xl font-bold tracking-tight mb-0.5 text-slate-900">{value}</div>
      <p className="text-sm font-semibold" style={{ color: PRIMARY }}>
        {title}
      </p>
      <p className="text-xs text-slate-400 mt-0.5">{sub}</p>
    </div>
  );
}

function SectionCard({
  title,
  description,
  children,
  className,
  flush,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  className?: string;
  flush?: boolean;
}) {
  return (
    <div
      className={cn(
        "bg-white rounded-xl border border-slate-200 shadow-card flex flex-col overflow-hidden",
        className
      )}
    >
      <div className="px-6 pt-5 pb-3 border-b border-slate-100 shrink-0">
        <h3 className="font-semibold text-[15px]" style={{ color: PRIMARY }}>
          {title}
        </h3>
        <p className="text-xs text-slate-400 mt-0.5">{description}</p>
      </div>
      <div className={cn("flex-1", flush ? "" : "px-6 pb-6")}>{children}</div>
    </div>
  );
}

export function AnalyticsClient({
  metrics,
  coeData,
  designationData,
  approvalData,
  recentMappings,
  orgReadiness,
  employeesWithNoGaps,
  readinessBands,
  coeReadinessData,
}: AnalyticsClientProps) {
  const maxCoeCount = Math.max(...coeData.map((d) => d.count), 1);
  const bandTotal = readinessBands.high + readinessBands.medium + readinessBands.low;
  const safeBandTotal = bandTotal > 0 ? bandTotal : 1;
  const sortedCoe = [...coeReadinessData].sort((a, b) => b.readiness - a.readiness);

  // Approval total for %
  const approvalTotal = approvalData.reduce((s, d) => s + d.count, 0);
  const safeApprovalTotal = approvalTotal > 0 ? approvalTotal : 1;

  const pieFills = [PRIMARY, SECONDARY, "#94a3b8"];

  return (
    <div className="space-y-5">

      {/* ── Row 1: 5 stat cards — last one featured (navy) ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard
          title="Total Employees"
          value={metrics.totalEmployees}
          sub="Registered in system"
          icon={<Users className="h-5 w-5" style={{ color: PRIMARY }} />}
        />
        <StatCard
          title="Skills Mapped"
          value={metrics.totalSkillsMapped}
          sub="Employee skill entries"
          icon={<Award className="h-5 w-5" style={{ color: PRIMARY }} />}
        />
        <StatCard
          title="Active COEs"
          value={metrics.totalCoes}
          sub="Centers of Excellence"
          icon={<Network className="h-5 w-5" style={{ color: PRIMARY }} />}
        />
        <StatCard
          title="Designations"
          value={metrics.totalDesignations}
          sub="Roles defined"
          icon={<Briefcase className="h-5 w-5" style={{ color: PRIMARY }} />}
        />
        <StatCard
          title="Org Readiness"
          value={`${orgReadiness}%`}
          sub="Avg skill coverage"
          icon={<TrendingUp className="h-5 w-5 text-white" />}
          featured
        />
      </div>

      {/* ── Row 2: COE Readiness ranked (2/3) + Readiness Gauge panel (1/3) ── */}
      <div className="grid grid-cols-3 gap-5">

        {/* COE Readiness — ranked list */}
        <SectionCard
          title="COE Readiness"
          description="Ranked by average skill coverage per Center of Excellence"
          className="col-span-2"
        >
          <div className="space-y-4 pt-4">
            {sortedCoe.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">No COE data available</p>
            ) : (
              sortedCoe.map((item, i) => {
                const color = coeBarColor(item.readiness);
                return (
                  <div key={item.name}>
                    <div className="flex items-center gap-3 mb-1.5">
                      <span className="text-[11px] font-bold text-slate-300 font-mono w-5 shrink-0 tabular-nums">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="text-sm font-medium text-slate-700 flex-1 truncate">
                        {item.name}
                      </span>
                      <span
                        className="text-sm font-bold tabular-nums shrink-0"
                        style={{ color }}
                      >
                        {item.readiness}%
                      </span>
                      <span
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0"
                        style={{
                          background: color + "18",
                          color,
                        }}
                      >
                        {item.readiness >= 70 ? "High" : item.readiness >= 40 ? "Medium" : "Low"}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-5 shrink-0" />
                      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "#f1f5f9" }}>
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${item.readiness}%`, background: color }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </SectionCard>

        {/* Readiness Gauge + bands */}
        <SectionCard title="Readiness Snapshot" description="Workforce skill coverage distribution">
          <div className="flex flex-col items-center pt-4 gap-4">
            <ReadinessGauge value={orgReadiness} />

            <div className="w-full space-y-2.5">
              {(
                [
                  {
                    band: "high" as const,
                    label: "High ≥70%",
                    count: readinessBands.high,
                  },
                  {
                    band: "medium" as const,
                    label: "Medium 40–70%",
                    count: readinessBands.medium,
                  },
                  {
                    band: "low" as const,
                    label: "Low <40%",
                    count: readinessBands.low,
                  },
                ]
              ).map(({ band, label, count }) => (
                <div
                  key={band}
                  className="flex items-center justify-between rounded-lg px-3 py-2"
                  style={{ background: bandBg(band) }}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="h-2 w-2 rounded-full shrink-0"
                      style={{ background: bandColor(band) }}
                    />
                    <span className="text-xs font-medium text-slate-600">{label}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span
                      className="text-sm font-bold tabular-nums"
                      style={{ color: bandColor(band) }}
                    >
                      {count}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {Math.round((count / safeBandTotal) * 100)}%
                    </span>
                  </div>
                </div>
              ))}

              <div
                className="flex items-center justify-between rounded-lg px-3 py-2 mt-1"
                style={{ background: PRIMARY, opacity: 0.92 }}
              >
                <span className="text-xs font-semibold text-white/80">Fully skill-covered</span>
                <span className="text-sm font-bold text-white tabular-nums">
                  {employeesWithNoGaps}
                </span>
              </div>
            </div>
          </div>
        </SectionCard>
      </div>

      {/* ── Row 3: Employees by COE (1/2) + Employees by Designation (1/2) ── */}
      <div className="grid grid-cols-2 gap-5">

        {/* Employees by COE — custom horizontal bars */}
        <SectionCard title="Employees by COE" description="Headcount and share per Center of Excellence">
          <div className="space-y-3.5 pt-4">
            {coeData.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">No data</p>
            ) : (
              coeData.map((item) => {
                const pct = Math.round((item.count / metrics.totalEmployees) * 100);
                const barPct = (item.count / maxCoeCount) * 100;
                return (
                  <div key={item.name} className="flex items-center gap-3">
                    <span className="text-xs font-medium text-slate-600 truncate w-36 shrink-0">
                      {item.name}
                    </span>
                    <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "#f1f5f9" }}>
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${barPct}%`, background: PRIMARY }}
                      />
                    </div>
                    <span
                      className="text-xs font-bold tabular-nums w-5 text-right shrink-0"
                      style={{ color: PRIMARY }}
                    >
                      {item.count}
                    </span>
                    <span className="text-[10px] text-slate-400 w-8 text-right shrink-0 tabular-nums">
                      {pct}%
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </SectionCard>

        {/* Employees by Designation — recharts horizontal bar */}
        <SectionCard title="Employees by Designation" description="Headcount grouped by official designation">
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={designationData}
                layout="vertical"
                margin={{ top: 8, right: 16, left: 40, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis
                  dataKey="name"
                  type="category"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  width={130}
                />
                <Tooltip
                  cursor={{ fill: "rgba(25,16,91,0.04)" }}
                  contentStyle={{
                    borderRadius: "10px",
                    border: "none",
                    boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
                    fontSize: "12px",
                  }}
                />
                <Bar dataKey="count" fill={PRIMARY} radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      </div>

      {/* ── Row 4: Skill Validation (1/3) + Recent Updates (2/3) ── */}
      <div className="grid grid-cols-3 gap-5">

        {/* Skill Validation — stats + mini donut */}
        <SectionCard title="Skill Validation" description="Status breakdown of all mapped employee skills">
          {/* Stat rows */}
          <div className="space-y-2 pt-4 mb-4">
            {approvalData.map((item, i) => {
              const fill = pieFills[i] ?? "#94a3b8";
              const pct = Math.round((item.count / safeApprovalTotal) * 100);
              return (
                <div
                  key={item.status}
                  className="flex items-center justify-between rounded-lg px-3 py-2.5"
                  style={{ background: fill + "12" }}
                >
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full shrink-0" style={{ background: fill }} />
                    <span className="text-xs font-medium text-slate-600 capitalize">
                      {item.status.toLowerCase()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold tabular-nums" style={{ color: fill }}>
                      {item.count}
                    </span>
                    <span className="text-[10px] text-slate-400 tabular-nums">{pct}%</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Mini donut */}
          <div className="h-[160px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={approvalData}
                  dataKey="count"
                  nameKey="status"
                  cx="50%"
                  cy="50%"
                  innerRadius={44}
                  outerRadius={68}
                  paddingAngle={3}
                >
                  {approvalData.map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={pieFills[index] ?? "#94a3b8"}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    borderRadius: "10px",
                    border: "none",
                    boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
                    fontSize: "11px",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        {/* Recent Updates — wide, flush layout */}
        <SectionCard
          title="Recent Skill Updates"
          description="Latest employee skill mappings - most recent first"
          className="col-span-2"
          flush
        >
          {recentMappings.length === 0 ? (
            <div className="text-sm text-slate-400 text-center py-12">No recent activity</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {recentMappings.slice(0, 7).map((mapping) => {
                const initials = mapping.employeeName
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase();

                const statusColor =
                  mapping.status === "APPROVED"
                    ? PRIMARY
                    : mapping.status === "PENDING"
                    ? SECONDARY
                    : "#94a3b8";

                const statusBg =
                  mapping.status === "APPROVED"
                    ? PRIMARY_SOFT
                    : mapping.status === "PENDING"
                    ? SECONDARY_SOFT
                    : "#f8fafc";

                return (
                  <div
                    key={mapping.id}
                    className="flex items-center justify-between px-6 py-3.5 hover:bg-slate-50/70 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0 text-white text-xs font-bold"
                        style={{ background: PRIMARY }}
                      >
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">
                          {mapping.employeeName}
                        </p>
                        <p className="text-xs text-slate-400 truncate">
                          {mapping.skillName}&ensp;·&ensp;Level {mapping.level}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 ml-4">
                      {mapping.status === "APPROVED" && (
                        <CheckCircle className="h-3.5 w-3.5" style={{ color: PRIMARY }} />
                      )}
                      {mapping.status === "PENDING" && (
                        <Clock className="h-3.5 w-3.5" style={{ color: SECONDARY }} />
                      )}
                      {mapping.status === "REJECTED" && (
                        <XCircle className="h-3.5 w-3.5 text-slate-400" />
                      )}
                      <span
                        className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full"
                        style={{ background: statusBg, color: statusColor }}
                      >
                        {mapping.status.charAt(0) + mapping.status.slice(1).toLowerCase()}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>

      </div>
    </div>
  );
}
