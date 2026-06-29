import type { Metadata } from "next";
import Link from "next/link";
import { getPitchStats } from "@/server/actions/pitch-stats";
import { AnimatedNumber } from "@/components/pitch/AnimatedNumber";
import { CategoryChart } from "@/components/pitch/CategoryChart";

export const metadata: Metadata = {
  title: "SkillSphere - Resourcing CoLab",
  description: "We turn resourcing from a negotiation into a decision.",
};

// ─── Static content ──────────────────────────────────────────────────────────

const DELIVERABLES = [
  {
    id: "1a",
    badge: "Deliverable 1a",
    name: "Resource Recommendation",
    href: "/admin/resourcing/match",
    what: "Two-dimension scoring: Technical Skill × Consulting Competency, ranked by composite 100-point match score.",
    decision: "REDEPLOY · HIRE · PARTIAL HIRE",
    ai: "Match rationale - 2–4 sentence explanation of fit for each top candidate.",
    color: "#38BDF8",
  },
  {
    id: "1b",
    badge: "Deliverable 1b",
    name: "Project Health Monitor",
    href: "/admin/resourcing/health",
    what: "RAG signals from weekly status + billability leakage from timesheet join + shadow/ghost detection.",
    decision: "Investigate · Formalise shadows · Trigger ramp-down",
    ai: "Root-cause diagnosis - 3-sentence analysis of what's driving health flags.",
    color: "#A78BFA",
  },
  {
    id: "2a",
    badge: "Deliverable 2a",
    name: "New-Project Forecast",
    href: "/admin/resourcing/simulator",
    what: "Model any mix of N projects by type × headcount. Expands via role-mix templates to FTE demand by role vs live supply.",
    decision: "Proceed · Redeploy X FTE · Hire Y FTE",
    ai: null,
    color: "#34D399",
  },
  {
    id: "2b",
    badge: "Deliverable 2b",
    name: "6-Month Pipeline Outlook",
    href: "/admin/resourcing/outlook",
    what: "SOW-signed (confirmed) vs unsigned (probable, probability-weighted) demand matrix vs current supply over 6 months.",
    decision: "Hire now (confirmed shortfall) · Monitor (probable-only)",
    ai: "Early-warning executive narrative - first shortfall month, at-risk roles, recommended actions.",
    color: "#FBBF24",
  },
  {
    id: "3",
    badge: "Deliverable 3",
    name: "Live Allocation Board",
    href: "/admin/resourcing/allocations",
    what: "Actual utilisation from timesheets (not planned allocation) by employee. Shows over-allocated, bench, and rolling-off in 14 days.",
    decision: "Rebalance over-allocated · Match bench to pipeline · Flag data drift",
    ai: null,
    color: "#F87171",
  },
  {
    id: "★",
    badge: "Bonus: RM Copilot",
    name: "Agentic RM Copilot",
    href: "/admin/copilot",
    what: "Agentic tool-use loop: model decides which tools to call (match, health, outlook), iterates, then delivers a decision-first answer with citations.",
    decision: "\"Can we take on 3 Data Platform + 1 AI POC in August without hurting delivery?\"",
    ai: "Full agentic orchestration - not a chatbot, a decision engine with tool citations.",
    color: "#818CF8",
    highlight: true,
  },
];

const DIFFERENTIATORS = [
  {
    icon: "⊗",
    title: "Skill ≠ Competency",
    body: "Technical skill score and consulting competency score are computed separately and weighted independently. Hiding a weak dimension behind a composite average is forbidden.",
  },
  {
    icon: "◎",
    title: "Leakage Detection",
    body: "Shadow resources and billability leakage are found by joining allocation records × timesheet entries - hidden costs visible nowhere else in standard tools.",
  },
  {
    icon: "▷",
    title: "Decision-First UI",
    body: "Every screen ends in a coloured decision strip (YES / YES WITH CONDITIONS / NO) with a one-line action. No dashboards - only decision cards.",
  },
  {
    icon: "◈",
    title: "Data-Gap Honesty",
    body: "Coverage confidence badges (HIGH / MEDIUM / LOW) on every AI output. Where data is sparse, a named production fix is stated - no hidden assumptions.",
  },
];

const DEMO_STEPS = [
  { step: 1, time: "0:00", title: "Allocation Board", sub: "Who's over-allocated right now?", href: "/admin/resourcing/allocations", action: "Decision strip shows: Rebalance 3 over-allocated employees. Blue strip names who frees up in 14 days." },
  { step: 2, time: "1:00", title: "Match Engine", sub: "Who fits the Analytics project?", href: "/admin/resourcing/match", action: "Decision: REDEPLOY [name] - skill 78%, competency 64%, 100% available. A number, not a discussion." },
  { step: 3, time: "2:30", title: "Health Radar", sub: "Which projects are at risk?", href: "/admin/resourcing/health", action: "Decision: Formalise 2 shadow resources on Project X. Ramp-down panel: 3.5 FTE releasable for redeployment." },
  { step: 4, time: "3:45", title: "Simulator", sub: "3 Data Platform + 1 AI POC - feasible?", href: "/admin/resourcing/simulator", action: "Decision: YES WITH REDEPLOYMENTS - redeploy 2 FTE from ramp-downs, hire 1 Solutions Architect." },
  { step: 5, time: "5:00", title: "Pipeline Outlook", sub: "What's the 6-month picture?", href: "/admin/resourcing/outlook", action: "Decision: Confirmed-only shortfall from August - initiate hiring now. Probable-only: monitor." },
  { step: 6, time: "5:45", title: "RM Copilot", sub: "The whole question in one answer", href: "/admin/copilot", action: "\"Can we take on 3 Data Platform + 1 AI POC in August?\" Copilot calls match + health + outlook tools and returns a cite-backed decision." },
  { step: 7, time: "6:30", title: "Project Experience", sub: "AI extracts skills from a write-up", href: "/employee/my-experience", action: "Upload a project story → AI extracts skills → submitted as PENDING → once approved, boosts match score." },
];

const SOURCE_FILES = [
  { name: "employee_master", ext: "xlsx", rows: "1,200 employees", feeds: "Workforce KPIs, availability, match scoring" },
  { name: "project_allocations", ext: "xlsx", rows: "8,400 rows", feeds: "Over-allocation detection, releasable FTE" },
  { name: "timesheets", ext: "xlsx", rows: "52,000 entries", feeds: "Actual utilisation, billability leakage, shadow detection" },
  { name: "pipeline_requests", ext: "xlsx", rows: "147 open requests", feeds: "Confirmed vs probable demand, match engine input" },
  { name: "weekly_status", ext: "xlsx", rows: "3,600 RAG rows", feeds: "Health radar, risk flags, trend analysis" },
  { name: "competency_assessments", ext: "xlsx", rows: "6,000 scores", feeds: "Consulting competency dimension in match scoring" },
  { name: "role_mix_templates", ext: "xlsx", rows: "48 templates", feeds: "Simulator FTE expansion by project category" },
  { name: "shadow_flags", ext: "xlsx", rows: "240 flags", feeds: "Shadow/ghost resource detection" },
];

const DATA_GAPS = [
  { gap: "Skill records sparse", fix: "Import from LMS/Degreed via API integration" },
  { gap: "Timesheet billability flag incomplete", fix: "ETL defaults to false; finance team to backfill historical data" },
  { gap: "Some project categories default to OTHER", fix: "Sales team to update type_of_project in CRM export" },
  { gap: "Competency assessments partial", fix: "Manager assessment cycle to run quarterly in SkillSphere" },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function PitchPage() {
  const stats = await getPitchStats();

  return (
    <>
      <style>{`
        /* pitch-only print styles */
        @media print {
          .pitch-no-print { display: none !important; }
          .pitch-page { background: white !important; color: black !important; }
          .pitch-section { background: white !important; border-color: #e2e8f0 !important; }
          .pitch-card { background: #f8fafc !important; border-color: #e2e8f0 !important; color: black !important; }
          .pitch-text-secondary { color: #475569 !important; }
          @page { margin: 2cm; }
          a[href]::after { content: ""; }
        }
        /* smooth scroll */
        html { scroll-behavior: smooth; }
        .pitch-gradient-text {
          background: linear-gradient(135deg, #F1F5F9 0%, #38BDF8 60%, #818CF8 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .pitch-decision-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          padding: 4px 10px;
          border-radius: 9999px;
          background: rgba(251, 191, 36, 0.12);
          color: #FBBF24;
          border: 1px solid rgba(251, 191, 36, 0.25);
        }
        .pitch-ai-pill {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.05em;
          padding: 3px 8px;
          border-radius: 9999px;
          background: rgba(129, 140, 248, 0.12);
          color: #A5B4FC;
          border: 1px solid rgba(129, 140, 248, 0.2);
        }
      `}</style>

      <main
        className="pitch-page min-h-screen"
        style={{ background: "#060C18", color: "#F1F5F9", fontFamily: "var(--font-geist-sans, system-ui, sans-serif)" }}
      >
        {/* ── SECTION 1: Hero ──────────────────────────────────────────────── */}
        <section
          className="relative flex flex-col items-center justify-center min-h-screen px-6 py-24 text-center overflow-hidden"
          style={{ background: "linear-gradient(180deg, #060C18 0%, #0A1628 50%, #060C18 100%)" }}
        >
          {/* Background grid decoration */}
          <div
            className="absolute inset-0 opacity-[0.03] pitch-no-print"
            style={{
              backgroundImage: "linear-gradient(#38BDF8 1px, transparent 1px), linear-gradient(90deg, #38BDF8 1px, transparent 1px)",
              backgroundSize: "60px 60px",
            }}
          />

          {/* Eyebrow */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-semibold tracking-widest uppercase pitch-no-print"
            style={{ borderColor: "rgba(56, 189, 248, 0.3)", color: "#38BDF8", background: "rgba(56, 189, 248, 0.07)" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#38BDF8", display: "inline-block", animation: "pulse 2s infinite" }} />
            JManage Hackathon 2026 · Team SkillSphere
          </div>

          <h1 className="text-5xl md:text-7xl font-bold leading-tight mb-4 max-w-4xl pitch-gradient-text" style={{ letterSpacing: "-0.02em" }}>
            We turn resourcing<br />from a negotiation<br />into a decision.
          </h1>

          <p className="mt-4 mb-12 text-lg md:text-xl max-w-2xl leading-relaxed" style={{ color: "#94A3B8" }}>
            SkillSphere Resourcing CoLab ingests 8 source files,
            joins them across 33 models, and surfaces every screen
            as a coloured YES / NO decision card with a one-line action.
          </p>

          {/* Hero KPI strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12 w-full max-w-3xl">
            {[
              {
                label: "Workforce loaded",
                value: stats.totalEmployees,
                suffix: " employees",
                decimals: 0,
                color: "#38BDF8",
              },
              {
                label: "Active projects tracked",
                value: stats.activeProjects,
                suffix: " projects",
                decimals: 0,
                color: "#34D399",
              },
              {
                label: "Timesheet rows ingested",
                value: stats.totalTimesheetRows,
                suffix: " rows",
                decimals: 0,
                color: "#A78BFA",
              },
              {
                label: stats.avgTopMatchScore !== null ? "Avg top match score" : "Pipeline requests",
                value: stats.avgTopMatchScore !== null ? stats.avgTopMatchScore : stats.confirmedRequests + stats.probableRequests,
                suffix: stats.avgTopMatchScore !== null ? "%" : " reqs",
                decimals: 0,
                color: "#FBBF24",
              },
            ].map((kpi) => (
              <div
                key={kpi.label}
                className="pitch-card rounded-xl px-5 py-5 text-center border"
                style={{ background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.06)" }}
              >
                <p className="text-3xl font-bold mb-1" style={{ color: kpi.color }}>
                  <AnimatedNumber value={kpi.value} suffix={kpi.suffix} />
                </p>
                <p className="text-xs pitch-text-secondary" style={{ color: "#64748B" }}>{kpi.label}</p>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="flex flex-wrap gap-3 justify-center pitch-no-print">
            <Link
              href="/admin/resourcing/match"
              className="inline-flex items-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold transition-all"
              style={{ background: "#38BDF8", color: "#060C18" }}
            >
              Live Demo → Match Engine
            </Link>
            <Link
              href="#demo"
              className="inline-flex items-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold border transition-all"
              style={{ borderColor: "rgba(56, 189, 248, 0.3)", color: "#38BDF8" }}
            >
              Demo Flow ↓
            </Link>
          </div>

          {/* Scroll indicator */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 pitch-no-print" style={{ color: "#334155" }}>
            <svg width="20" height="32" viewBox="0 0 20 32" fill="none" style={{ animation: "bounce 2s infinite" }}>
              <rect x="1" y="1" width="18" height="30" rx="9" stroke="currentColor" strokeWidth="1.5" />
              <circle cx="10" cy="10" r="3" fill="currentColor" style={{ animation: "moveDown 2s infinite" }} />
            </svg>
          </div>
        </section>

        {/* ── SECTION 2: Problem ───────────────────────────────────────────── */}
        <section className="pitch-section px-6 py-20" style={{ background: "#0A1628" }}>
          <div className="max-w-5xl mx-auto">
            <p className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: "#38BDF8" }}>The Problem</p>
            <h2 className="text-3xl md:text-4xl font-bold mb-3">Resourcing decisions happen in Excel and WhatsApp.</h2>
            <p className="text-base mb-12" style={{ color: "#64748B" }}>
              Every resource manager faces the same four problems every week:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                {
                  icon: "01",
                  title: "No single view of capacity",
                  body: "Allocation records and timesheet actuals live in separate systems. Nobody knows the real utilisation - only the planned one.",
                  accent: "#F87171",
                },
                {
                  icon: "02",
                  title: "Skill search is manual",
                  body: "Finding the right person for a project means emailing practice leads and waiting 3 days. By then the client has already asked why it's taking so long.",
                  accent: "#FBBF24",
                },
                {
                  icon: "03",
                  title: "Pipeline demand is invisible",
                  body: "Unsigned deals don't appear in any headcount model. The first sign of a supply gap is when the project is already signed and the team isn't there.",
                  accent: "#A78BFA",
                },
                {
                  icon: "04",
                  title: "Health signals arrive too late",
                  body: "By the time a project appears in a CSSAT review as RED, 6 weeks of billability leakage and shadow resourcing have already happened.",
                  accent: "#34D399",
                },
              ].map((item) => (
                <div
                  key={item.icon}
                  className="pitch-card rounded-xl p-6 border"
                  style={{ background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.05)", borderLeft: `3px solid ${item.accent}` }}
                >
                  <p className="text-xs font-bold tracking-widest uppercase mb-2" style={{ color: item.accent }}>{item.icon}</p>
                  <h3 className="text-base font-semibold mb-2">{item.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: "#94A3B8" }}>{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── SECTION 3: Deliverables ──────────────────────────────────────── */}
        <section className="pitch-section px-6 py-20" style={{ background: "#060C18" }}>
          <div className="max-w-5xl mx-auto">
            <p className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: "#38BDF8" }}>What We Built</p>
            <h2 className="text-3xl md:text-4xl font-bold mb-3">5 deliverables + 1 copilot</h2>
            <p className="text-base mb-12" style={{ color: "#64748B" }}>
              Each one answers a specific RM question and ends in a coloured decision.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {DELIVERABLES.map((d) => (
                <div
                  key={d.id}
                  className="pitch-card rounded-xl p-5 border flex flex-col gap-3"
                  style={{
                    background: d.highlight ? "rgba(129, 140, 248, 0.05)" : "rgba(255,255,255,0.02)",
                    borderColor: d.highlight ? "rgba(129, 140, 248, 0.25)" : "rgba(255,255,255,0.05)",
                    borderTop: `2px solid ${d.color}`,
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[10px] font-bold tracking-widest uppercase mb-1" style={{ color: d.color }}>{d.badge}</p>
                      <h3 className="text-base font-semibold">{d.name}</h3>
                    </div>
                    <Link
                      href={d.href}
                      className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-md border transition-all pitch-no-print"
                      style={{ borderColor: "rgba(255,255,255,0.1)", color: "#94A3B8" }}
                    >
                      Demo →
                    </Link>
                  </div>

                  <p className="text-xs leading-relaxed" style={{ color: "#94A3B8" }}>{d.what}</p>

                  <div className="mt-auto space-y-2">
                    <div className="pitch-decision-pill">
                      <span>Decision:</span>
                      <span>{d.decision}</span>
                    </div>
                    {d.ai && (
                      <div className="pitch-ai-pill">
                        <span>✦</span>
                        <span>{d.ai}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── SECTION 4: Architecture ──────────────────────────────────────── */}
        <section className="pitch-section px-6 py-20" style={{ background: "#0A1628" }}>
          <div className="max-w-5xl mx-auto">
            <p className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: "#38BDF8" }}>Architecture</p>
            <h2 className="text-3xl md:text-4xl font-bold mb-12">From Excel to decision - 5 layers</h2>

            <div className="space-y-3">
              {/* Layer 1: Source */}
              <div
                className="pitch-card rounded-xl p-5 border"
                style={{ background: "rgba(255,255,255,0.02)", borderColor: "#1E3460" }}
              >
                <div className="flex flex-wrap items-center gap-3 mb-3">
                  <span className="text-[10px] font-bold tracking-widest uppercase px-2 py-1 rounded" style={{ background: "rgba(56,189,248,0.1)", color: "#38BDF8" }}>Layer 1</span>
                  <span className="text-sm font-semibold">Source Data - 8 Excel/CSV files</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {["employee_master", "project_allocations", "timesheets", "pipeline_requests", "weekly_status", "competency_assessments", "role_mix_templates", "shadow_flags"].map((f) => (
                    <span key={f} className="text-xs px-2 py-1 rounded font-mono" style={{ background: "rgba(56,189,248,0.06)", color: "#7DD3FC", border: "1px solid rgba(56,189,248,0.1)" }}>{f}</span>
                  ))}
                </div>
              </div>

              {/* Arrow */}
              <div className="flex items-center gap-2 px-5" style={{ color: "#334155" }}>
                <div style={{ width: 2, height: 24, background: "linear-gradient(180deg, #1E3460 0%, #38BDF8 100%)", margin: "0 auto" }} />
                <span className="text-xs ml-2" style={{ color: "#38BDF8" }}>ETL: scripts/etl/ingest.ts → prisma db push → 33 models</span>
              </div>

              {/* Layer 2: DB */}
              <div
                className="pitch-card rounded-xl p-5 border"
                style={{ background: "rgba(255,255,255,0.02)", borderColor: "#1E3460" }}
              >
                <div className="flex flex-wrap items-center gap-3 mb-3">
                  <span className="text-[10px] font-bold tracking-widest uppercase px-2 py-1 rounded" style={{ background: "rgba(52,211,153,0.1)", color: "#34D399" }}>Layer 2</span>
                  <span className="text-sm font-semibold">SQLite / PostgreSQL - 33 Prisma models</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {["Employee", "Project", "Timesheet", "Competency", "PipelineRequest", "WeeklyStatus", "ShadowFlag", "ProjectAllocation", "UtilisationSnapshot", "IngestReport", "...23 more"].map((m) => (
                    <span key={m} className="text-xs px-2 py-1 rounded font-mono" style={{ background: "rgba(52,211,153,0.06)", color: "#6EE7B7", border: "1px solid rgba(52,211,153,0.1)" }}>{m}</span>
                  ))}
                </div>
              </div>

              {/* Arrow */}
              <div style={{ width: 2, height: 24, background: "linear-gradient(180deg, #1E3460 0%, #A78BFA 100%)", margin: "0 auto" }} />

              {/* Layer 3: Services */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { name: "availability.service", color: "#38BDF8", desc: "bench + FTE calc" },
                  { name: "matching.service", color: "#34D399", desc: "skill × competency score" },
                  { name: "health.service", color: "#F87171", desc: "RAG + leakage + shadows" },
                  { name: "forecast.service", color: "#FBBF24", desc: "demand × supply outlook" },
                ].map((s) => (
                  <div key={s.name} className="pitch-card rounded-lg p-3 border text-center" style={{ background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.06)", borderTop: `2px solid ${s.color}` }}>
                    <p className="text-[10px] font-mono mb-1" style={{ color: s.color }}>{s.name}</p>
                    <p className="text-[10px]" style={{ color: "#64748B" }}>{s.desc}</p>
                  </div>
                ))}
              </div>
              <div className="text-center text-xs" style={{ color: "#334155" }}>Layer 3: Service layer - pure business logic, no auth</div>

              {/* Arrow */}
              <div style={{ width: 2, height: 24, background: "linear-gradient(180deg, #1E3460 0%, #818CF8 100%)", margin: "0 auto" }} />

              {/* Layer 4: AI */}
              <div
                className="pitch-card rounded-xl p-5 border"
                style={{ background: "rgba(129,140,248,0.04)", borderColor: "rgba(129,140,248,0.2)" }}
              >
                <div className="flex flex-wrap items-center gap-3 mb-3">
                  <span className="text-[10px] font-bold tracking-widest uppercase px-2 py-1 rounded" style={{ background: "rgba(129,140,248,0.12)", color: "#A5B4FC" }}>Layer 4</span>
                  <span className="text-sm font-semibold">AI Layer - Google Gemini 1.5 Pro</span>
                  <span className="text-[10px]" style={{ color: "#64748B" }}>src/lib/ai/</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {["rationale.ts - match explanation", "rootcause.ts - health diagnosis", "narrative.ts - forecast early-warning", "confidence.ts - data coverage check", "copilot/agent.ts - agentic tool loop"].map((m) => (
                    <span key={m} className="text-xs px-2 py-1 rounded font-mono" style={{ background: "rgba(129,140,248,0.08)", color: "#C7D2FE", border: "1px solid rgba(129,140,248,0.15)" }}>{m}</span>
                  ))}
                </div>
              </div>

              {/* Arrow */}
              <div style={{ width: 2, height: 24, background: "linear-gradient(180deg, #1E3460 0%, #F1F5F9 100%)", margin: "0 auto" }} />

              {/* Layer 5: UI */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {[
                  { name: "Match Engine", href: "/admin/resourcing/match", color: "#38BDF8" },
                  { name: "Health Radar", href: "/admin/resourcing/health", color: "#F87171" },
                  { name: "Simulator", href: "/admin/resourcing/simulator", color: "#34D399" },
                  { name: "Pipeline Outlook", href: "/admin/resourcing/outlook", color: "#FBBF24" },
                  { name: "Allocations", href: "/admin/resourcing/allocations", color: "#FB923C" },
                  { name: "RM Copilot", href: "/admin/copilot", color: "#818CF8" },
                ].map((s) => (
                  <Link key={s.name} href={s.href} className="pitch-card rounded-lg p-3 border text-center transition-all pitch-no-print" style={{ background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.06)" }}>
                    <p className="text-sm font-semibold" style={{ color: s.color }}>{s.name}</p>
                    <p className="text-[10px] mt-0.5" style={{ color: "#334155" }}>DecisionCard UI</p>
                  </Link>
                ))}
              </div>
              <div className="text-center text-xs" style={{ color: "#334155" }}>Layer 5: Next.js 16 App Router - Server Components + Server Actions</div>
            </div>
          </div>
        </section>

        {/* ── SECTION 5: Differentiators ───────────────────────────────────── */}
        <section className="pitch-section px-6 py-20" style={{ background: "#060C18" }}>
          <div className="max-w-5xl mx-auto">
            <p className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: "#38BDF8" }}>Why This Is Different</p>
            <h2 className="text-3xl md:text-4xl font-bold mb-12">Four design decisions that matter</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {DIFFERENTIATORS.map((d) => (
                <div
                  key={d.title}
                  className="pitch-card rounded-xl p-6 border"
                  style={{ background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.05)" }}
                >
                  <div className="text-3xl mb-4 font-mono" style={{ color: "#38BDF8" }}>{d.icon}</div>
                  <h3 className="text-base font-bold mb-2">{d.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: "#94A3B8" }}>{d.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── SECTION 6: Demo Flow ─────────────────────────────────────────── */}
        <section id="demo" className="pitch-section px-6 py-20" style={{ background: "#0A1628" }}>
          <div className="max-w-5xl mx-auto">
            <p className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: "#38BDF8" }}>Live Demo</p>
            <h2 className="text-3xl md:text-4xl font-bold mb-3">7-minute demo script</h2>
            <p className="text-base mb-12" style={{ color: "#64748B" }}>
              Click any step to jump straight to that screen in the live app.
            </p>

            <div className="space-y-3">
              {DEMO_STEPS.map((s) => (
                <Link
                  key={s.step}
                  href={s.href}
                  className="pitch-card group flex gap-5 rounded-xl p-5 border transition-all pitch-no-print"
                  style={{ background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.05)", textDecoration: "none" }}
                >
                  {/* Step number */}
                  <div
                    className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
                    style={{ background: "rgba(56,189,248,0.1)", color: "#38BDF8", border: "1px solid rgba(56,189,248,0.2)" }}
                  >
                    {s.step}
                  </div>
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap mb-1">
                      <span className="text-xs font-mono" style={{ color: "#38BDF8" }}>{s.time}</span>
                      <h3 className="text-sm font-semibold">{s.title}</h3>
                      <span className="text-xs" style={{ color: "#64748B" }}>{s.sub}</span>
                    </div>
                    <p className="text-xs leading-relaxed" style={{ color: "#94A3B8" }}>{s.action}</p>
                  </div>
                  {/* Arrow */}
                  <div className="shrink-0 self-center text-lg pitch-no-print" style={{ color: "#334155" }}>→</div>
                </Link>
              ))}

              {/* Non-clickable version for print */}
              <div className="hidden">
                {DEMO_STEPS.map((s) => (
                  <div key={s.step} className="pitch-card flex gap-5 rounded-xl p-5 border" style={{ background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.05)" }}>
                    <div className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: "rgba(56,189,248,0.1)", color: "#38BDF8" }}>
                      {s.step}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <span className="text-xs font-mono" style={{ color: "#38BDF8" }}>{s.time}</span>
                        <h3 className="text-sm font-semibold">{s.title}</h3>
                      </div>
                      <p className="text-xs leading-relaxed" style={{ color: "#94A3B8" }}>{s.action}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── SECTION 7: Data Foundation ───────────────────────────────────── */}
        <section className="pitch-section px-6 py-20" style={{ background: "#060C18" }}>
          <div className="max-w-5xl mx-auto">
            <p className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: "#38BDF8" }}>Data Foundation</p>
            <h2 className="text-3xl md:text-4xl font-bold mb-3">8 source files → <AnimatedNumber value={stats.totalTimesheetRows + stats.totalAllocationRows} /> DB rows</h2>
            <p className="text-base mb-12" style={{ color: "#64748B" }}>
              Real data. Real gaps. Named where data is missing.
            </p>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Source files table */}
              <div className="overflow-x-auto rounded-xl border" style={{ borderColor: "#1E3460" }}>
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ background: "#0D1B35", borderBottom: "1px solid #1E3460" }}>
                      <th className="px-4 py-3 text-left font-semibold" style={{ color: "#64748B" }}>Source File</th>
                      <th className="px-4 py-3 text-left font-semibold" style={{ color: "#64748B" }}>Scale</th>
                      <th className="px-4 py-3 text-left font-semibold" style={{ color: "#64748B" }}>Feeds</th>
                    </tr>
                  </thead>
                  <tbody>
                    {SOURCE_FILES.map((f, i) => (
                      <tr key={f.name} style={{ borderBottom: i < SOURCE_FILES.length - 1 ? "1px solid #1E3460" : undefined }}>
                        <td className="px-4 py-3 font-mono font-medium" style={{ color: "#7DD3FC" }}>
                          {f.name}
                          <span className="ml-1 text-[10px]" style={{ color: "#334155" }}>.{f.ext}</span>
                        </td>
                        <td className="px-4 py-3 font-mono" style={{ color: "#94A3B8", fontVariantNumeric: "tabular-nums" }}>{f.rows}</td>
                        <td className="px-4 py-3" style={{ color: "#64748B" }}>{f.feeds}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Chart + coverage + gaps */}
              <div className="space-y-5">
                {/* Category chart */}
                {stats.projectsByCategory.length > 0 && (
                  <div className="rounded-xl border p-4" style={{ background: "#0D1B35", borderColor: "#1E3460" }}>
                    <p className="text-xs font-semibold mb-3" style={{ color: "#94A3B8" }}>Active projects by category</p>
                    <CategoryChart data={stats.projectsByCategory} />
                  </div>
                )}

                {/* Coverage badge */}
                <div className="rounded-xl border p-4 flex items-center justify-between" style={{ background: "#0D1B35", borderColor: "#1E3460" }}>
                  <div>
                    <p className="text-xs font-semibold mb-0.5" style={{ color: "#94A3B8" }}>Data coverage confidence</p>
                    <p className="text-2xl font-bold" style={{ color: stats.dataCoverage >= 70 ? "#34D399" : stats.dataCoverage >= 40 ? "#FBBF24" : "#F87171" }}>
                      <AnimatedNumber value={stats.dataCoverage} suffix="%" />
                    </p>
                  </div>
                  <div className="text-right">
                    <span
                      className="text-xs font-bold px-3 py-1.5 rounded-full"
                      style={{
                        background: stats.dataCoverageLevel === "HIGH" ? "rgba(52,211,153,0.1)" : stats.dataCoverageLevel === "MEDIUM" ? "rgba(251,191,36,0.1)" : "rgba(248,113,113,0.1)",
                        color: stats.dataCoverageLevel === "HIGH" ? "#34D399" : stats.dataCoverageLevel === "MEDIUM" ? "#FBBF24" : "#F87171",
                        border: `1px solid ${stats.dataCoverageLevel === "HIGH" ? "rgba(52,211,153,0.25)" : stats.dataCoverageLevel === "MEDIUM" ? "rgba(251,191,36,0.25)" : "rgba(248,113,113,0.25)"}`,
                      }}
                    >
                      {stats.dataCoverageLevel}
                    </span>
                    <p className="text-[10px] mt-1" style={{ color: "#334155" }}>AI forecast confidence</p>
                  </div>
                </div>

                {/* Named gaps */}
                <div className="rounded-xl border p-4" style={{ background: "#0D1B35", borderColor: "#1E3460" }}>
                  <p className="text-xs font-semibold mb-3" style={{ color: "#94A3B8" }}>Named data gaps - production fixes stated</p>
                  <div className="space-y-3">
                    {DATA_GAPS.map((g) => (
                      <div key={g.gap} className="border-l-2 pl-3" style={{ borderColor: "#FBBF24" }}>
                        <p className="text-xs font-medium" style={{ color: "#F1F5F9" }}>{g.gap}</p>
                        <p className="text-[10px] mt-0.5" style={{ color: "#64748B" }}>Fix: {g.fix}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── SECTION 8: Tech & AI Safety ──────────────────────────────────── */}
        <section className="pitch-section px-6 py-20" style={{ background: "#0A1628" }}>
          <div className="max-w-5xl mx-auto">
            <p className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: "#38BDF8" }}>Tech & AI Safety</p>
            <h2 className="text-3xl md:text-4xl font-bold mb-12">Built for production, not the demo.</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Stack */}
              <div>
                <p className="text-sm font-semibold mb-4" style={{ color: "#94A3B8" }}>Stack</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    "Next.js 16 App Router", "TypeScript 5 strict", "Prisma 6 ORM", "SQLite (dev) / PostgreSQL (prod)",
                    "NextAuth.js v5", "Tailwind CSS 4", "shadcn/ui + Radix", "Framer Motion",
                    "Recharts", "Google Gemini 1.5 Pro", "Zod validation",
                  ].map((t) => (
                    <span key={t} className="text-xs px-2.5 py-1.5 rounded-md" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", color: "#94A3B8" }}>{t}</span>
                  ))}
                </div>
              </div>

              {/* AI Safety */}
              <div>
                <p className="text-sm font-semibold mb-4" style={{ color: "#94A3B8" }}>AI Safety Principles</p>
                <div className="space-y-3">
                  {[
                    { icon: "✓", label: "Graceful degradation", desc: "Every AI call has a deterministic fallback. The platform works without a Gemini API key." },
                    { icon: "✓", label: "Prompt injection prevention", desc: "User-controlled strings are passed inside delimited XML tags, never interpolated directly." },
                    { icon: "✓", label: "Output validation", desc: "All AI responses are parsed and validated with Zod before use. Unstructured output is never trusted." },
                    { icon: "✓", label: "Data-gap honesty", desc: "Coverage badges signal AI confidence level. Low-coverage outputs are flagged, not hidden." },
                    { icon: "✓", label: "No hallucinated numbers", desc: "KPIs on this page are pulled live from the DB. Hardcoded vanity metrics are not permitted." },
                  ].map((p) => (
                    <div key={p.label} className="flex gap-3">
                      <span className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold mt-0.5" style={{ background: "rgba(52,211,153,0.12)", color: "#34D399" }}>{p.icon}</span>
                      <div>
                        <p className="text-xs font-semibold">{p.label}</p>
                        <p className="text-xs mt-0.5" style={{ color: "#64748B" }}>{p.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Footer ───────────────────────────────────────────────────────── */}
        <footer
          className="px-6 py-12 text-center"
          style={{ background: "#060C18", borderTop: "1px solid #1E3460" }}
        >
          <p className="text-2xl font-bold mb-2 pitch-gradient-text">SkillSphere - Resourcing CoLab</p>
          <p className="text-sm mb-6" style={{ color: "#64748B" }}>JManage Hackathon 2026 · Team submission</p>

          {/* Live stat summary */}
          <div className="flex flex-wrap gap-6 justify-center text-xs mb-8" style={{ color: "#334155" }}>
            <span><span style={{ color: "#38BDF8" }}>{stats.totalEmployees.toLocaleString()}</span> employees loaded</span>
            <span><span style={{ color: "#34D399" }}>{stats.activeProjects}</span> active projects</span>
            <span><span style={{ color: "#A78BFA" }}>{stats.confirmedRequests + stats.probableRequests}</span> pipeline requests</span>
            {stats.avgTopMatchScore !== null && (
              <span><span style={{ color: "#FBBF24" }}>{stats.avgTopMatchScore}%</span> avg match score</span>
            )}
            <span>
              Data coverage:{" "}
              <span style={{ color: stats.dataCoverageLevel === "HIGH" ? "#34D399" : stats.dataCoverageLevel === "MEDIUM" ? "#FBBF24" : "#F87171" }}>
                {stats.dataCoverageLevel}
              </span>
            </span>
          </div>

          {/* Live demo links */}
          <div className="flex flex-wrap gap-3 justify-center pitch-no-print">
            {[
              { label: "Match Engine", href: "/admin/resourcing/match" },
              { label: "Health Radar", href: "/admin/resourcing/health" },
              { label: "Simulator", href: "/admin/resourcing/simulator" },
              { label: "Pipeline Outlook", href: "/admin/resourcing/outlook" },
              { label: "Allocations", href: "/admin/resourcing/allocations" },
              { label: "RM Copilot", href: "/admin/copilot" },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-xs px-3 py-2 rounded-lg border transition-all"
                style={{ borderColor: "rgba(56,189,248,0.2)", color: "#38BDF8" }}
              >
                {link.label}
              </Link>
            ))}
          </div>

          <p className="mt-8 text-[10px]" style={{ color: "#1E3460" }}>
            All numbers on this page are live from the database - no hardcoded values.
          </p>
        </footer>
      </main>
    </>
  );
}
