/**
 * excel-export.service.ts  -  Resourcing CoLab export engine  (v2)
 *
 * Produces the "Pipeline Resource Plan" workbook:
 *   Sheet 1: Pipeline Resource Plan  - source rows + 14 appended columns
 *   Sheet 2: Alternates              - top-3 alternatives per request
 *   Sheet 3: Summary                 - portfolio stats + full methodology notes
 *
 * ── Scoring dimensions (v2, 7 factors, sum = 1.0) ────────────────────────────
 *   Skill Coverage + Depth   0.32  - required-skill coverage × proficiency level
 *   Consulting Competency    0.22  - avg of 5 behaviour scores (1-5 scale)
 *   Experience Depth         0.08  - skill-level depth proxy for years of experience
 *   Availability Fit         0.18  - WINDOW-AWARE free capacity in request period;
 *                                    rolling-off bonus +15 pts
 *   Billability Fit          0.10  - low current billability = high cost-recovery opportunity
 *   Evidence Strength        0.06  - certifications + project-doc tech overlap
 *                                    + role-history match on prior allocations
 *   COE Alignment            0.04  - employee COE matches skillset/solution domain
 *
 * ── Selection & conflict resolution ─────────────────────────────────────────
 *   Processing order:  Priority (High/Critical) → SOW-Signed → likelyStart ASC
 *   Within candidates: availability tier DESC (>50% > 20–50% > 0–20%) → matchScore DESC
 *   Conflict tracking: WINDOW-AWARE (same employee may fill non-overlapping requests)
 *   Pool exhaustion:   role pool → full active pool → shared resource (clearly flagged)
 *   Leaver filter:     employees resigning ≤60 days are excluded from active pool
 *
 * ── Risk flags ───────────────────────────────────────────────────────────────
 *   GHOST          - allocated but logging no timesheet hours (−25 pts availability)
 *   SHADOW         - logging hours without formal allocation (team-health signal)
 *   LEAVER         - resignation ≤60 days, excluded from pool, signal = HIRE
 *   OVER_ALLOCATED - current utilisation > 100%
 *   UNDER_LEVELLED - designation ≥2 grades below requested role (−15 pts skill)
 *
 * ── Output columns ───────────────────────────────────────────────────────────
 *   Original cols 0–21 (pipeline xlsx) - fills cols 16, 17, 19 (Resource Recommended,
 *     % Available, Skillset Match)
 *   Appended cols 22–35 (14 new cols) - Employee ID, Match Score, Skill Score,
 *     Competency Score, Experience Score, Availability Score, COE Alignment,
 *     Signal, Risk Flags, Recommended Action, Unmet Skills, Plan, AI Rationale, Confidence
 */

import path from "path";
import * as XLSX from "xlsx";
import { db } from "@/lib/db";
import { MATCH_WEIGHTS_V2 } from "@/lib/constants";
import { explainMatch } from "@/lib/ai/rationale";
import { normalizeResourceRequest, employeeMatchesRole } from "@/lib/role-mapping";
import type { ParsedRole } from "@/lib/role-mapping";
import type { MatchResult, MatchSignal, SkillBreakdown, RiskFlag } from "@/server/services/matching.service";

// ── Source file ───────────────────────────────────────────────────────────────
const SOURCE_REL = path.join("reference_files", "07. 260624_Pipeline_Details.xlsx");
const SOURCE_SHEET = "Forecast";

// ── Column index map ──────────────────────────────────────────────────────────
/** All column positions within the output workbook (0-indexed). */
const C = {
  // Original pipeline xlsx columns (22 cols - 0 through 21)
  CLUSTER: 0,
  REQUEST_RECEIVED: 1,
  ORIG_START: 2,
  REQUEST_TYPE: 3,
  CLIENT_PRIORITY: 4,
  CLIENT: 5,
  EM: 6,
  LIKELY_START: 7,
  START_CONFIRMED: 8,
  NUM_WEEKS: 9,
  DEAL_STAGE: 10,
  SOLUTION: 11,
  PRIORITY: 12,
  STATUS: 13,
  RESOURCES_REQUESTED: 14,
  PCT: 15,
  RESOURCE_RECOMMENDED: 16, // ← FILL
  PCT_AVAILABLE: 17,        // ← FILL
  SKILLSET: 18,
  SKILLSET_MATCH: 19,       // ← FILL
  SOW_SIGNED: 20,
  COMMENTS: 21,
  // Appended value-add columns (14 cols - 22 through 35)
  EMPLOYEE_ID: 22,
  MATCH_SCORE: 23,
  SKILL_SCORE: 24,
  COMPETENCY_SCORE: 25,
  EXPERIENCE_SCORE: 26,   // NEW - experience depth proxy
  AVAILABILITY_SCORE: 27, // window-aware %
  COE_ALIGNMENT: 28,      // NEW - COE match flag
  SIGNAL: 29,
  RISK_FLAGS: 30,          // NEW - GHOST / SHADOW / LEAVER / etc
  ACTION: 31,
  UNMET_SKILLS: 32,
  PLAN: 33,
  AI_RATIONALE: 34,
  CONFIDENCE: 35,
} as const;

const APPENDED_HEADERS = [
  "Employee ID",
  "Match Score (0–100)",
  "Skill Score",
  "Competency Score",
  "Experience Score",    // v2 new
  "Availability Score",
  "COE Alignment",       // v2 new
  "Signal",
  "Risk Flags",          // v2 new
  "Recommended Action",
  "Unmet Skills",
  "Plan",
  "AI Rationale",
  "Confidence",
] as const;

const TOTAL_COLS = 36;

// ── Configurable thresholds ───────────────────────────────────────────────────
const LEAVER_HORIZON_DAYS = 60;      // employees resigning within this window are excluded
const ROLLING_OFF_BONUS_PTS = 15;    // availability bonus for employees rolling off at window start
const GHOST_AVAIL_PENALTY = 25;      // availability penalty for GHOST-flagged employees
const UNDER_LEVEL_SKILL_PENALTY = 15;// skill score penalty when designation is ≥2 grades below request

// ── Request priority sort order ───────────────────────────────────────────────
const PRIORITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 0,
  medium: 1,
  normal: 1,
  low: 2,
  tbd: 3,
};

// ── HubSpot deal stage → conversion probability ───────────────────────────────
// Source: pipeline stage framework — conversion % = resource confirmability %.
// Stages < 60%: resource is pre-identified but NOT claimed in the ConflictTracker.
// Stages ≥ 60%: resource is hard-reserved (claimed for the window).
// Stages = 0%:  row is skipped (deal lost, release any held resources).
const DEAL_STAGE_CONVERSION: Record<string, number> = {
  "opportunity inception":    0.20,
  "make it real":             0.40,
  "build the proposition":    0.50,
  "scoping approval":         0.60,
  "propose & negotiate":      0.80,
  "propose and negotiate":    0.80,
  "sow pending signature":    0.90,
  "sow with customer":        0.90,
  "deal won":                 1.00,
  "signed":                   1.00,
  "replacement":              0.80,  // committed replacement work
  "deal lost":                0.00,
};

function parseDealStageConversion(raw: unknown): { pct: number; label: string } {
  const label = String(raw ?? "").trim();
  const pct = DEAL_STAGE_CONVERSION[label.toLowerCase()] ?? 0.60; // unknown → Scoping default
  return { pct, label };
}

/** Parse the pipeline "%" column into a 0–1 fraction. Defaults to 1.0 (100%) if blank. */
function parseRequiredAllocationPct(raw: unknown): number {
  if (raw === null || raw === undefined || String(raw).trim() === "") return 1.0;
  const str = String(raw).trim().replace("%", "").replace(",", ".");
  const num = parseFloat(str);
  if (isNaN(num)) return 1.0;
  return num > 1 ? num / 100 : num; // handle both "80" and "0.80"
}

// ── Role → seniority level (1-8) for designation gap calculation ──────────────
const ROLE_SENIORITY: Record<string, number> = {
  "analyst": 1,
  "junior analyst": 1,
  "associate": 1,
  "business analyst": 2,
  "consultant": 2,
  "associate consultant": 2,
  "software engineer": 2,
  "data analyst": 2,
  "solutions enabler": 2,
  "senior business analyst": 3,
  "senior software engineer": 3,
  "data scientist": 3,
  "solutions consultant": 3,
  "senior consultant": 4,
  "delivery manager": 4,
  "senior data scientist": 4,
  "senior solutions consultant": 4,
  "solution architect": 5,
  "principal": 5,
  "principal architect": 6,
  "principal technology architect": 6,
  "senior solution architect": 6,
  "associate partner": 6,
  "partner": 7,
  "senior partner": 8,
};

function roleToSeniority(role: string): number {
  const lower = role.toLowerCase().trim();
  if (ROLE_SENIORITY[lower] !== undefined) return ROLE_SENIORITY[lower]!;
  for (const [key, val] of Object.entries(ROLE_SENIORITY)) {
    if (lower.includes(key) || key.includes(lower)) return val;
  }
  return 3; // default: mid-level
}

// ── Cell styles ───────────────────────────────────────────────────────────────
type CellStyle = Record<string, unknown>;

const S = {
  headerOrig: {
    font: { bold: true, color: { rgb: "FFFFFFFF" } },
    fill: { fgColor: { rgb: "FF1F3864" }, patternType: "solid" },
    alignment: { horizontal: "center", wrapText: true, vertical: "center" },
  } as CellStyle,
  headerAppended: {
    font: { bold: true, color: { rgb: "FFFFFFFF" } },
    fill: { fgColor: { rgb: "FF7030A0" }, patternType: "solid" },
    alignment: { horizontal: "center", wrapText: true, vertical: "center" },
  } as CellStyle,
  sowRow: {
    fill: { fgColor: { rgb: "FFDDEEFF" }, patternType: "solid" },
  } as CellStyle,
  good: {
    fill: { fgColor: { rgb: "FFC6EFCE" }, patternType: "solid" },
    font: { color: { rgb: "FF375623" } },
  } as CellStyle,
  warn: {
    fill: { fgColor: { rgb: "FFFFEB9C" }, patternType: "solid" },
    font: { color: { rgb: "FF7D6608" } },
  } as CellStyle,
  bad: {
    fill: { fgColor: { rgb: "FFFFC7CE" }, patternType: "solid" },
    font: { color: { rgb: "FF9C0006" } },
  } as CellStyle,
  risk: {
    fill: { fgColor: { rgb: "FFFFCCCC" }, patternType: "solid" },
    font: { bold: true, color: { rgb: "FF990000" } },
  } as CellStyle,
  coeGood: {
    fill: { fgColor: { rgb: "FFE2EFDA" }, patternType: "solid" },
    font: { color: { rgb: "FF215732" } },
  } as CellStyle,
};

function scoreStyle(v: number | null): CellStyle | null {
  if (v === null) return null;
  if (v >= 80) return S.good;
  if (v >= 60) return S.warn;
  return S.bad;
}
function signalStyle(sig: string | null): CellStyle | null {
  if (sig === "REDEPLOY")    return S.good;
  if (sig === "PARTIAL_HIRE") return S.warn;
  if (sig === "HIRE")         return S.bad;
  return null;
}
function matchStyle(m: "Complete" | "Partial" | "No" | null): CellStyle | null {
  if (m === "Complete") return S.good;
  if (m === "Partial")  return S.warn;
  if (m === "No")       return S.bad;
  return null;
}
function applyStyle(ws: XLSX.WorkSheet, r: number, c: number, style: CellStyle) {
  const addr = XLSX.utils.encode_cell({ r, c });
  if (!ws[addr]) ws[addr] = { t: "z", v: null };
  (ws[addr] as Record<string, unknown>)["s"] = style;
}

// ── Extended MatchResult ──────────────────────────────────────────────────────
/** v2 match result - extends base MatchResult with all new scoring dimensions. */
export interface MatchResultV2 extends MatchResult {
  experienceScore: number;
  coeAlignmentScore: number;
  coeAligned: boolean;
  empCoeName: string | null;
  requestedDomain: string | null;  // COE domain derived from request skillset
  releasableFrom: Date | null;
  isRollingOff: boolean;
  designationGap: number;
  windowFreeCapacity: number;
}

// ── Pre-fetched employee type ─────────────────────────────────────────────────
type EmployeeRow = Awaited<ReturnType<typeof fetchAllEmployees>>[number];

async function fetchAllEmployees() {
  return db.employee.findMany({
    include: {
      designation: { select: { name: true, level: true } },
      coe: { select: { name: true } },
      shadowFlags: { select: { flagType: true } },
      employeeSkills: {
        where: { status: "APPROVED" },
        include: {
          skill: { select: { id: true, name: true } },
          evidences: { select: { id: true } },
        },
      },
      competencies: { select: { score: true } },
      allocations: {
        // Fetch ALL allocations - COMPLETED ones give project-breadth experience signals.
        // computeWindowAvailability() already skips COMPLETED; we filter in-memory below.
        include: {
          project: {
            select: {
              status: true,
              name: true,
              clientId: true,
              techCoe: true,
              propositionCoe: true,
              category: true,
            },
          },
        },
      },
      utilisationSnapshots: { orderBy: { weekStart: "desc" }, take: 4 },
      experienceDocs: {
        // ETL now creates "ETL-SkillProfile" docs (EXTRACTED) for every employee from
        // File 05 - these carry actual experience-years data per skill (Gap 8 fix).
        where: { extractionStatus: { in: ["EXTRACTED", "APPLIED"] } },
        select: { techStack: true, extractedSkills: true },
      },
    },
  });
}

// ── Leaver detection ──────────────────────────────────────────────────────────
function isLeavingSoon(emp: EmployeeRow): boolean {
  if (!emp.dateOfResignation) return false;
  const daysToLeave =
    (emp.dateOfResignation.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  return daysToLeave <= LEAVER_HORIZON_DAYS;
}

// ── Window-aware availability ─────────────────────────────────────────────────
/**
 * Calculate how much of this employee's capacity is FREE within the request window
 * using allocation startDate/endDate overlap, rather than just last-4-week averages.
 */
function computeWindowAvailability(
  emp: EmployeeRow,
  windowStart: Date,
  windowEnd: Date,
): { freeCapacity: number; releasableFrom: Date | null; isRollingOff: boolean } {
  let totalAllocatedPct = 0;
  const endDatesInWindow: Date[] = [];

  for (const alloc of emp.allocations) {
    if (alloc.project.status === "COMPLETED") continue;

    // Treat null dates as open-ended: no start = from epoch, no end = far future
    const allocStart = alloc.startDate ?? new Date(0);
    const allocEnd = alloc.endDate ?? new Date("2099-12-31");

    const overlaps = allocStart <= windowEnd && allocEnd >= windowStart;
    if (overlaps) {
      totalAllocatedPct += alloc.allocation; // allocation is stored as 0-100
      if (alloc.endDate) endDatesInWindow.push(alloc.endDate);
    }
  }

  const freeCapacity = Math.max(0, Math.min(1, 1 - totalAllocatedPct / 100));

  // Releasable-from: earliest allocation end date that falls within the window
  const releasableFrom =
    endDatesInWindow.length > 0
      ? endDatesInWindow.sort((a, b) => a.getTime() - b.getTime())[0] ?? null
      : null;

  // Rolling-off: any allocation ends in the first 2 weeks of the window
  const rollingOffCutoff = new Date(windowStart.getTime() + 14 * 24 * 60 * 60 * 1000);
  const isRollingOff = endDatesInWindow.some(
    (d) => d >= windowStart && d <= rollingOffCutoff,
  );

  return { freeCapacity, releasableFrom, isRollingOff };
}

// ── Experience depth score ─────────────────────────────────────────────────────
// Uses three signals blended together:
//   50% - actual years-of-experience per skill from ETL-populated ExperienceDoc
//           (File 05 Experience column → ingestExperienceDocs ETL step)
//   25% - validated skill-level depth (validatedLevel / 5)
//   25% - tenure from Employee.dateOfJoin (capped at 5 years = max score)
// Bonus: +10 pts per skill where validatedLevel exceeds the required level.
type ExtractedSkillEntry = { name: string; years?: number; score?: number };

function computeExperienceScore(
  emp: EmployeeRow,
  requiredSkills: { skillId: string; requiredLevel: number }[],
): number {
  // ── Tenure signal ─────────────────────────────────────────────────────────
  const tenureYears = emp.dateOfJoin
    ? (Date.now() - emp.dateOfJoin.getTime()) / (1000 * 60 * 60 * 24 * 365.25)
    : 0;
  const tenureScore = Math.min(tenureYears / 5, 1); // 0 = 0 yrs … 1.0 = 5+ yrs

  if (emp.employeeSkills.length === 0) return Math.round(tenureScore * 25);

  // ── Build experience-years map from ExperienceDoc.extractedSkills ─────────
  // ETL populates one "ETL-SkillProfile" doc per employee from File 05.
  // extractedSkills = JSON array of {name, years, score}
  const expYearsBySkill = new Map<string, number>(); // skillName.lower → years
  for (const doc of emp.experienceDocs) {
    let extracted: ExtractedSkillEntry[] = [];
    try {
      extracted = doc.extractedSkills
        ? (JSON.parse(doc.extractedSkills) as ExtractedSkillEntry[])
        : [];
    } catch { /* ignore malformed JSON */ }
    for (const es of extracted) {
      if (es.name && (es.years ?? 0) > 0) {
        const key = es.name.toLowerCase();
        expYearsBySkill.set(key, Math.max(expYearsBySkill.get(key) ?? 0, es.years!));
      }
    }
  }

  // ── No skill filter: breadth signal (how skilled is this person overall?) ─
  if (requiredSkills.length === 0) {
    const avgLevel =
      emp.employeeSkills.reduce(
        (sum, es) => sum + (es.validatedLevel ?? es.selfAssessedLevel),
        0,
      ) / emp.employeeSkills.length;
    const breadthScore = Math.round((avgLevel / 5) * 100);
    return Math.round(breadthScore * 0.75 + tenureScore * 100 * 0.25);
  }

  // ── Per required-skill: combine years + depth ─────────────────────────────
  let yearsSum = 0;
  let depthSum = 0;
  let bonusPts = 0;
  let matchedCount = 0;

  for (const req of requiredSkills) {
    const empSkill = emp.employeeSkills.find((es) => es.skill.id === req.skillId);
    if (!empSkill) continue;

    const level = empSkill.validatedLevel ?? empSkill.selfAssessedLevel;
    depthSum += level / 5;                             // 1→0.20 … 5→1.00
    if (level > req.requiredLevel) bonusPts += 10;    // exceeds requirement

    // Experience years: prefer actual data; fall back to level-derived proxy
    const skillKey = empSkill.skill.name.toLowerCase();
    const yearsKnown = expYearsBySkill.get(skillKey)
      // Also try prefix match for SubSkill variants (e.g. "Python – Data Analysis" → "python")
      ?? [...expYearsBySkill.entries()].find(([k]) => k.startsWith(skillKey) || skillKey.startsWith(k))?.[1]
      ?? 0;

    if (yearsKnown > 0) {
      yearsSum += Math.min(yearsKnown / 5, 1); // normalise: 5 yrs = 1.0
    } else {
      // Proxy: level 1=0yrs, level 5≈4+ yrs; discounted to avoid over-confidence
      yearsSum += Math.min((level - 1) / 4, 1) * 0.6;
    }
    matchedCount++;
  }

  if (matchedCount === 0) return Math.round(tenureScore * 25);

  const yearsScore = (yearsSum / matchedCount) * 100;
  const depthScore = (depthSum / matchedCount) * 100;

  // 50% years-of-experience, 25% skill depth, 25% tenure
  const blended = Math.round(yearsScore * 0.50 + depthScore * 0.25 + tenureScore * 100 * 0.25);
  return Math.min(100, blended + bonusPts);
}

// ── Skill → COE domain mapping ────────────────────────────────────────────────
// Maps skillset keywords and solution types to the exact company team names.
// Company teams: Data Engineering | BI and Reporting | Data Science & ML |
//                Full Stack Engineering | TechOps and Automation | Consulting
// Each entry: [lowercase keyword, exact team name (case-insensitive match)].
const SKILL_COE_DOMAIN: Array<[string, string]> = [
  // ── Data Engineering ───────────────────────────────────────────────────────
  ["pyspark",             "data engineering"],
  ["snowflake",           "data engineering"],
  ["airflow",             "data engineering"],
  ["kafka",               "data engineering"],
  ["dbt",                 "data engineering"],
  ["scd",                 "data engineering"],
  ["etl",                 "data engineering"],
  ["data pipeline",       "data engineering"],
  ["data model",          "data engineering"],
  ["data warehouse",      "data engineering"],
  ["data lake",           "data engineering"],
  ["databricks",          "data engineering"],
  ["anomaly detection",   "data engineering"],
  ["ltv",                 "data engineering"],
  // ── BI and Reporting ───────────────────────────────────────────────────────
  ["power bi",            "bi and reporting"],
  ["tableau",             "bi and reporting"],
  ["looker",              "bi and reporting"],
  ["qlik",                "bi and reporting"],
  ["ssrs",                "bi and reporting"],
  ["dashboard",           "bi and reporting"],
  ["data visuali",        "bi and reporting"],
  // ── Data Science & ML ─────────────────────────────────────────────────────
  ["machine learning",    "data science & ml"],
  ["scikit",              "data science & ml"],
  ["tensorflow",          "data science & ml"],
  ["pytorch",             "data science & ml"],
  ["nlp",                 "data science & ml"],
  ["data science",        "data science & ml"],
  ["predictive model",    "data science & ml"],
  // ── TechOps and Automation ────────────────────────────────────────────────
  ["kubernetes",          "techops and automation"],
  ["docker",              "techops and automation"],
  ["terraform",           "techops and automation"],
  ["jenkins",             "techops and automation"],
  ["helm",                "techops and automation"],
  ["ansible",             "techops and automation"],
  ["ci/cd",               "techops and automation"],
  ["devops",              "techops and automation"],
  // ── Full Stack Engineering ────────────────────────────────────────────────
  ["react",               "full stack engineering"],
  ["node.js",             "full stack engineering"],
  ["express",             "full stack engineering"],
  ["graphql",             "full stack engineering"],
  ["typescript",          "full stack engineering"],
  ["javascript",          "full stack engineering"],
  ["rest api",            "full stack engineering"],
  ["microservices",       "full stack engineering"],
  ["vue",                 "full stack engineering"],
  ["angular",             "full stack engineering"],
  ["spring",              "full stack engineering"],
  ["django",              "full stack engineering"],
  ["fastapi",             "full stack engineering"],
  ["playwright",          "full stack engineering"],
  ["selenium",            "full stack engineering"],
  ["tailwind",            "full stack engineering"],
  // ── Solution types (pipeline "Solution" column) ───────────────────────────
  // "Data Advisory" is a data-platform concern → Data Engineering.
  // "Core Reporting" spans two teams: data platform setup (Data Engineering) +
  //   cube creation & report delivery (BI and Reporting).
  //   Both get one vote; skillset keywords (e.g. Power BI vs Snowflake) break the tie.
  // "Due Diligence", "Value Creation", "Exit Support", "Managed Service" are
  //   deliberately left unmapped — any team may be involved.
  ["data advisory",       "data engineering"],
  ["core reporting",      "data engineering"],
  ["core reporting",      "bi and reporting"],
];

/** Returns the most-voted COE domain for this request based on skillset keywords. */
function deriveRequestCoeDomain(skillset: string | null, solution: string | null): string | null {
  const text = `${skillset ?? ""} ${solution ?? ""}`.toLowerCase();
  const votes: Record<string, number> = {};
  for (const [kw, domain] of SKILL_COE_DOMAIN) {
    if (text.includes(kw)) {
      votes[domain] = (votes[domain] ?? 0) + 1;
    }
  }
  if (Object.keys(votes).length === 0) return null;
  return Object.entries(votes).sort((a, b) => b[1] - a[1])[0]![0]!;
}

// ── Role adjacency for cross-role cascade ─────────────────────────────────────
// Only grade-based acting-up is permitted within the same role family.
//   Software Engineer → no fallback (SSE is over-graded; exact match only)
//   Senior Software Engineer → SE can act up (flagged as "acting as SSE")
//   Solutions Enabler → no fallback (separate family from SE/SSE; cannot substitute)
const ROLE_ADJACENCY: Record<string, string[]> = {
  "senior software engineer": ["software engineer"],
  "software engineer":        [],
  "solutions enabler":        ["senior software engineer"],
};

function getAdjacentRoles(canonicalRoles: string[]): string[] {
  const lowerRoles = canonicalRoles.map((r) => r.toLowerCase());
  const adj = new Set<string>();
  for (const role of lowerRoles) {
    for (const a of ROLE_ADJACENCY[role] ?? []) {
      if (!lowerRoles.includes(a)) adj.add(a);
    }
  }
  return [...adj];
}

function coeDomainMatches(emp: EmployeeRow, requestedDomain: string | null): boolean {
  if (!requestedDomain) return true; // no domain derivable → don't penalise any COE
  const empCoe = emp.coe?.name?.toLowerCase().trim();
  return empCoe === requestedDomain.toLowerCase();
}

// ── COE alignment ─────────────────────────────────────────────────────────────
// Multi-signal check - gap 7 fix (tech_coe / proposition_coe previously unused).
// Scoring: 0–100 across up to 4 signals.
//  Signal A (weight 2): employee COE name appears in pipeline skillset/solution text
//  Signal B (weight 1): active project's techCoe or propositionCoe overlaps request
//  Signal C (weight 1): employee COE matches their active project's COE domain
function computeCoeAlignment(
  emp: EmployeeRow,
  reqSkillset: string | null,
  reqSolution: string | null,
): { aligned: boolean; score: number; requestedDomain: string | null } {
  const coeName = emp.coe?.name?.toLowerCase().trim();
  const searchText = `${reqSkillset ?? ""} ${reqSolution ?? ""}`.toLowerCase();
  const searchTokens = searchText.split(/[\s,;/()]+/).filter((t) => t.length >= 3);
  const requestedDomain = deriveRequestCoeDomain(reqSkillset, reqSolution);

  let signals = 0;
  const MAX_SIGNALS = 4;

  // Signal A (weight 2): employee COE name literally in request text
  if (coeName && searchText.includes(coeName)) signals += 2;

  // Signal A2 (weight 2): employee COE matches the skill-derived domain
  if (signals < 2 && coeName && requestedDomain && coeName === requestedDomain) signals += 2;

  // Signal B (weight 1): active project techCoe/propositionCoe overlaps request keywords
  const activeProjCoes = emp.allocations
    .filter((a) => a.project.status !== "COMPLETED")
    .flatMap((a) => [
      (a.project.techCoe ?? "").toLowerCase().trim(),
      (a.project.propositionCoe ?? "").toLowerCase().trim(),
    ])
    .filter(Boolean);

  if (
    activeProjCoes.some((pc) =>
      searchTokens.some((t) => pc.includes(t) || t.includes(pc)),
    )
  ) signals++;

  // Signal C (weight 1): employee COE = derived domain AND they're on matching project
  // (guarded by derived domain — prevents false positives from in-own-domain projects)
  if (
    requestedDomain &&
    coeName &&
    coeName === requestedDomain &&
    activeProjCoes.some((pc) => pc.includes(coeName) || coeName.includes(pc))
  ) {
    signals++;
  }

  const score = Math.round((signals / MAX_SIGNALS) * 100);
  return { aligned: signals >= 2, score, requestedDomain };
}

// ── Designation seniority gap ─────────────────────────────────────────────────
/**
 * Positive = over-levelled (employee more senior than requested).
 * Negative = under-levelled (employee more junior than requested).
 */
function computeDesignationGap(emp: EmployeeRow, canonicalRoles: string[]): number {
  if (canonicalRoles.length === 0) return 0;
  // Use Designation.level from DB if available; fall back to jobName → ROLE_SENIORITY map
  const empLevel =
    emp.designation?.level ?? roleToSeniority(emp.jobName ?? "");
  const reqLevel = Math.round(
    canonicalRoles.reduce((sum, r) => sum + roleToSeniority(r), 0) / canonicalRoles.length,
  );
  return empLevel - reqLevel;
}

// ── Risk flags ────────────────────────────────────────────────────────────────
function computeRiskFlags(
  emp: EmployeeRow,
  designationGap: number,
  avgUtil: number,
  underUtilized: boolean,
): RiskFlag[] {
  const flags: RiskFlag[] = [];
  if (isLeavingSoon(emp)) flags.push("LEAVER");
  if (emp.shadowFlags.some((f) => f.flagType === "GHOST"))   flags.push("GHOST");
  if (avgUtil > 1.0)       flags.push("OVER_ALLOCATED");
  if (designationGap <= -2) flags.push("UNDER_LEVELLED");
  if (underUtilized)       flags.push("UNDER_UTILIZED");
  return flags;
}

// ── Core v2 scoring function ──────────────────────────────────────────────────
function scoreEmployee(
  emp: EmployeeRow,
  requiredSkills: { skillId: string; skillName: string; requiredLevel: number }[],
  opts: {
    windowStart: Date;
    windowEnd: Date;
    canonicalRoles: string[];
    reqSkillset: string | null;
    reqSolution: string | null;
  },
): MatchResultV2 {
  const { windowStart, windowEnd, canonicalRoles, reqSkillset, reqSolution } = opts;
  const hasSkillFilter = requiredSkills.length > 0;
  const skillIdSet = new Set(requiredSkills.map((s) => s.skillId));

  // ── Skill Score ────────────────────────────────────────────────────────────
  const relevantSkills = hasSkillFilter
    ? emp.employeeSkills.filter((es) => skillIdSet.has(es.skill.id))
    : emp.employeeSkills;

  let skillCoverage = 0;
  let skillDepth = 0;
  const breakdown: SkillBreakdown[] = [];
  const unmet: string[] = [];

  if (hasSkillFilter) {
    for (const req of requiredSkills) {
      const empSkill = relevantSkills.find((es) => es.skill.id === req.skillId);
      const current = empSkill?.validatedLevel ?? 0;
      const met = current >= req.requiredLevel;
      if (met) skillCoverage++;
      else unmet.push(req.skillName);
      skillDepth += Math.min(current / Math.max(req.requiredLevel, 1), 1);
      breakdown.push({ skillName: req.skillName, required: req.requiredLevel, current, met });
    }
  }

  const coveragePct = hasSkillFilter ? skillCoverage / requiredSkills.length : 1;
  const depthPct =
    hasSkillFilter && requiredSkills.length > 0
      ? skillDepth / requiredSkills.length
      : 1;
  let skillScore = hasSkillFilter
    ? Math.round((coveragePct * 0.6 + depthPct * 0.4) * 100)
    : Math.round(
        (emp.employeeSkills.length > 0
          ? Math.min(emp.employeeSkills.length / 5, 1)
          : 0.3) * 100,
      );

  // ── Competency Score ───────────────────────────────────────────────────────
  const competencyScore =
    emp.competencies.length > 0
      ? Math.round(
          (emp.competencies.reduce((s, c) => s + c.score, 0) /
            emp.competencies.length /
            5) *
            100,
        )
      : 50; // default 50 when no competency data

  // ── Experience Depth Score ─────────────────────────────────────────────────
  const experienceScore = computeExperienceScore(emp, requiredSkills);

  // ── Window-Aware Availability ──────────────────────────────────────────────
  // We now fetch ALL allocations (including COMPLETED) for project-breadth signals.
  // Restrict availability/utilisation checks to non-completed allocations only.
  const activeAllocations = emp.allocations.filter(
    (a) => a.project.status !== "COMPLETED",
  );

  const {
    freeCapacity: windowFreeCapacity,
    releasableFrom,
    isRollingOff,
  } = computeWindowAvailability(emp, windowStart, windowEnd);

  // Snapshot-based fallback: last 4 weeks of utilisation data
  const snapshots = emp.utilisationSnapshots;
  const avgUtil =
    snapshots.length > 0
      ? snapshots.reduce((s, sn) => s + sn.utilisation, 0) / snapshots.length
      : activeAllocations.length > 0
      ? 1.0 // active allocations but no snapshots = assume fully utilised
      : 0;  // bench

  // Prefer window-based availability when we have allocation date data;
  // fall back to snapshot-derived utilisation otherwise
  const hasWindowData = activeAllocations.some((a) => a.startDate || a.endDate);
  const effectiveFreeCapacity = hasWindowData
    ? windowFreeCapacity
    : Math.max(0, 1 - avgUtil);

  // Under-utilization: if actual logged hours are significantly below nominal allocation,
  // the employee has hidden spare capacity we should surface.
  const nominalAllocPct = Math.min(
    1,
    activeAllocations.reduce((sum, a) => sum + a.allocation, 0) / 100,
  );
  const underUtilized = snapshots.length >= 2 && nominalAllocPct > 0.1 && avgUtil < nominalAllocPct * 0.7;
  const spareCapacity = underUtilized ? Math.max(0, nominalAllocPct - avgUtil) : 0;
  const trueAvailableFTE = Math.min(1, effectiveFreeCapacity + spareCapacity);

  // Rolling-off bonus: employee's commitments end right at the start of the window
  let availabilityFit = Math.round(Math.min(trueAvailableFTE, 1) * 100);
  if (isRollingOff && availabilityFit < 100) {
    availabilityFit = Math.min(100, availabilityFit + ROLLING_OFF_BONUS_PTS);
  }

  const availableFTE = trueAvailableFTE;

  // ── Billability Fit ────────────────────────────────────────────────────────
  const avgBillable =
    snapshots.length > 0
      ? snapshots.reduce((s, sn) => s + sn.billableUtil, 0) / snapshots.length
      : 1; // no data = assume billable
  const billabilityFit = Math.round((1 - avgBillable) * 100);

  // ── Evidence Strength ──────────────────────────────────────────────────────
  const totalEvidence = emp.employeeSkills.reduce(
    (s, es) => s + es.evidences.length,
    0,
  );

  // Tech-stack / skill-overlap boost from ExperienceDoc (now ETL-populated from File 05)
  const reqNames = new Set(requiredSkills.map((r) => r.skillName.toLowerCase()));
  let expBoost = 0;
  for (const doc of emp.experienceDocs) {
    const techTerms = (doc.techStack ?? "")
      .split(/[,;]/)
      .map((t) => t.trim().toLowerCase());
    let docExtracted: { name: string }[] = [];
    try {
      docExtracted = doc.extractedSkills
        ? (JSON.parse(doc.extractedSkills) as { name: string }[])
        : [];
    } catch { /* ignore malformed JSON */ }
    const docNames = [...techTerms, ...docExtracted.map((s) => s.name.toLowerCase())];
    if (docNames.some((n) => reqNames.has(n))) expBoost += 15;
  }

  // Role-history boost: ETL now populates alloc.role = employee.jobName at allocation time.
  // Falls back to current jobName so even employees with no prior allocation.role get credit
  // when they ARE in the requested role.
  if (canonicalRoles.length > 0) {
    const hasRoleHistory = emp.allocations.some((alloc) => {
      const roleToCheck = alloc.role ?? emp.jobName ?? "";
      if (!roleToCheck) return false;
      const roleLower = roleToCheck.toLowerCase();
      return canonicalRoles.some(
        (cr) => roleLower.includes(cr.toLowerCase()) || cr.toLowerCase().includes(roleLower),
      );
    });
    if (hasRoleHistory) expBoost += 15;
  }

  // Project breadth bonus: more distinct delivery projects = proven, versatile resource.
  // Uses ALL allocations (including completed) - this is the entire track record.
  const distinctProjectCount = new Set(emp.allocations.map((a) => a.projectId)).size;
  expBoost += Math.min(distinctProjectCount * 4, 20); // max +20 pts for 5+ projects

  const evidenceStrength = Math.min(totalEvidence * 10 + expBoost, 100);

  // ── COE Alignment ──────────────────────────────────────────────────────────
  const { aligned: coeAligned, score: coeAlignmentScore, requestedDomain } = computeCoeAlignment(
    emp,
    reqSkillset,
    reqSolution,
  );

  // ── Designation gap & Risk Flags ───────────────────────────────────────────
  const designationGap = computeDesignationGap(emp, canonicalRoles);
  const riskFlags = computeRiskFlags(emp, designationGap, avgUtil, underUtilized);

  // Apply penalties for identified risks
  // Under-levelled by ≥2 grades: reduce skill score
  if (designationGap <= -2) {
    skillScore = Math.max(0, skillScore - UNDER_LEVEL_SKILL_PENALTY);
  }
  // GHOST penalty: unreliable availability
  let effectiveAvailabilityFit = availabilityFit;
  if (riskFlags.includes("GHOST")) {
    effectiveAvailabilityFit = Math.max(0, availabilityFit - GHOST_AVAIL_PENALTY);
  }

  // ── Weighted Match Score (v2 - 7 dimensions) ───────────────────────────────
  const matchScore = Math.round(
    skillScore               * MATCH_WEIGHTS_V2.skill +
    competencyScore          * MATCH_WEIGHTS_V2.competency +
    experienceScore          * MATCH_WEIGHTS_V2.experience +
    effectiveAvailabilityFit * MATCH_WEIGHTS_V2.availability +
    billabilityFit           * MATCH_WEIGHTS_V2.billability +
    evidenceStrength         * MATCH_WEIGHTS_V2.evidence +
    coeAlignmentScore        * MATCH_WEIGHTS_V2.coeAlignment,
  );

  // ── Signal ─────────────────────────────────────────────────────────────────
  // Technical executor roles (SE / SSE / Enabler) are generalist implementors
  // who can be onboarded to a new stack — always prefer internal over external hire.
  // Consulting/management roles need more specific expertise; stricter thresholds apply.
  const techExec = canonicalRoles.some((r) =>
    ["software engineer", "senior software engineer", "solutions enabler"].includes(r.toLowerCase()),
  );
  const redeployMinCoverage = techExec ? 0.5 : 0.7;
  const redeployMinSkill    = techExec ? 40  : 60;
  const hireCovCutoff       = techExec ? 0.2 : 0.4; // below this → external hire (consulting only)

  let signal: MatchSignal;
  if (riskFlags.includes("LEAVER")) {
    // Leavers should never be deployed - force external hire signal
    signal = "HIRE";
  } else if (!hasSkillFilter) {
    // No DB skills matched from pipeline skillset — signal driven purely by availability
    if (availableFTE > 0.3)               signal = "REDEPLOY";
    else if (availableFTE > 0.05)         signal = "PARTIAL_HIRE";
    else if (techExec)                    signal = "PARTIAL_HIRE"; // SSE/SE: internal coordination over external hire
    else                                  signal = "HIRE";
  } else if (coveragePct >= redeployMinCoverage && skillScore >= redeployMinSkill && availableFTE > 0.1) {
    signal = "REDEPLOY";
  } else if (!techExec && coveragePct < hireCovCutoff) {
    // Consulting roles: low skill coverage alone justifies external hire
    signal = "HIRE";
  } else {
    // techExec: always PARTIAL_HIRE — internal coordination / training preferred over external hire
    // Consulting mid-coverage: PARTIAL_HIRE (coverage ≥ hireCovCutoff but below REDEPLOY threshold)
    signal = "PARTIAL_HIRE";
  }

  // ── Notice period + planned leave (base MatchResult fields) ─────────────────
  const now = new Date();
  const noticeDaysRemaining = emp.dateOfResignation
    ? Math.max(0, Math.round((emp.dateOfResignation.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
    : null;

  const previousClients = [
    ...new Set(
      emp.allocations
        .map((a) => a.project.clientId ?? a.project.name)
        .filter((c): c is string => Boolean(c)),
    ),
  ].slice(0, 5);

  return {
    employeeId: emp.id,
    employeeCode: emp.employeeCode,
    name: emp.name,
    jobName: emp.jobName,
    location: emp.location,
    skillScore,
    competencyScore,
    availabilityFit: effectiveAvailabilityFit,
    billabilityFit,
    evidenceStrength,
    matchScore,
    skillBreakdown: breakdown,
    unmetSkills: unmet,
    availableFTE,
    signal,
    // Base MatchResult new fields
    designationName: emp.designation?.name ?? null,
    designationLevel: emp.designation?.level ?? null,
    coeName: emp.coe?.name ?? null,
    noticeDaysRemaining,
    plannedLeaveDays: 0,  // excel export uses window-aware availability; leave from snapshots
    previousClients,
    totalProjects: distinctProjectCount,
    riskFlags,
    trainingReadiness: emp.competencies.length > 0
      ? Math.round((emp.competencies.reduce((s, c) => s + c.score, 0) / emp.competencies.length / 5) * 100)
      : 0,
    // v2 extensions
    experienceScore,
    coeAlignmentScore,
    coeAligned,
    empCoeName: emp.coe?.name ?? null,
    requestedDomain,
    releasableFrom,
    isRollingOff,
    designationGap,
    windowFreeCapacity,
  };
}

// ── Skillset text → required skills ──────────────────────────────────────────
// Bidirectional: request text contains skill name (forward) OR any keyword in
// the request is contained in the skill name (reverse). The reverse path catches
// composite ExperienceDoc names like "Python – Data Analysis" when the pipeline
// request simply says "Python".
function textToRequiredSkills(
  text: string,
  allSkills: { id: string; name: string }[],
): { skillId: string; skillName: string; requiredLevel: number }[] {
  if (!text) return [];
  const lower = text.toLowerCase();
  const keywords = lower
    .split(/[\s,;/()]+/)
    .map((k) => k.trim())
    .filter((k) => k.length >= 3);

  return allSkills
    .filter((s) => {
      const skillLower = s.name.toLowerCase();
      if (lower.includes(skillLower)) return true;
      const primaryPart = skillLower.split(/\s*[–-]\s*/)[0]?.trim() ?? skillLower;
      return keywords.some(
        (kw) => skillLower.includes(kw) || primaryPart.includes(kw),
      );
    })
    .map((s) => ({ skillId: s.id, skillName: s.name, requiredLevel: 3 }));
}

// ── Availability tier (pool selection hierarchy) ───────────────────────────────
function availabilityTier(fteAvailable: number): 0 | 1 | 2 | 3 {
  if (fteAvailable > 0.5) return 3;  // >50% free - first pick
  if (fteAvailable > 0.2) return 2;  // 20–50% - partial, coordinate handoff
  if (fteAvailable > 0)   return 1;  // <20%   - marginal, confirm commitment
  return 0;                           // 0%     - fully allocated, release required
}

// ── Derived column helpers ────────────────────────────────────────────────────
function toSkillsetMatch(
  signal: MatchSignal,
  skillScore: number,
  availFTE: number,
): "Complete" | "Partial" | "No" {
  if (signal === "HIRE" || availFTE === 0)    return "No";
  if (skillScore >= 70 && availFTE > 0.2)     return "Complete";
  return "Partial";
}

function toAction(
  match: MatchResultV2,
  parsed: ParsedRole,
  roleFiltered: boolean,
  fallbackUsed: boolean,
  poolExhausted: boolean,
  conversionPct: number,
  crossCoe: boolean,
  actingRole: string | null,
  reqAllocationPct: number,
): string {
  const availPct   = Math.round(match.availableFTE * 100);
  const neededPct  = Math.round(reqAllocationPct * 100);
  const partialFit = neededPct > 0 && match.availableFTE < reqAllocationPct;
  const allocNote  = partialFit ? ` (${neededPct}% needed — partial fit)` : "";
  const tier       = availabilityTier(match.availableFTE);
  const roleTag  = roleFiltered
    ? ` [${parsed.display}]`
    : fallbackUsed
    ? " [role unrecognised - any grade]"
    : "";
  // Cross-mapping annotations
  const crossCoeTag  = crossCoe
    ? ` ⟡ Cross-COE [${match.empCoeName ?? "other COE"}]`
    : "";
  const actingTag = actingRole && actingRole !== "grade-fallback"
    ? ` ⟡ ${match.jobName ?? "adjacent role"} acting as ${parsed.display}`
    : actingRole === "grade-fallback"
    ? " [grade fallback]"
    : "";
  const underUtilTag = match.riskFlags.includes("UNDER_UTILIZED")
    ? " ↑ under-utilised (spare capacity)"
    : "";
  const visibleRisks = match.riskFlags.filter((f) => f !== "UNDER_UTILIZED");
  const riskNote   = visibleRisks.length > 0 ? ` ⚠ ${visibleRisks.join(", ")}` : "";
  const sharedNote = poolExhausted ? " (shared - pool exhausted)" : "";
  const coeTag     = match.coeAligned ? ` ✓ COE:${match.requestedDomain ?? match.empCoeName ?? ""}` : "";
  const rollingTag = match.isRollingOff ? " (rolling off - natural window)" : "";

  // Early-stage deals (< 60%): resource is pre-identified but NOT committed.
  // Reservation happens only at Scoping Approval (60%) and above.
  if (conversionPct < 0.60) {
    const stagePct  = Math.round(conversionPct * 100);
    const stageVerb = conversionPct <= 0.40 ? "Pre-identified" : "Soft-reserved";
    return `${stageVerb} (${stagePct}% deal confidence)${roleTag}${crossCoeTag}${actingTag} — ${match.name}, not yet committed${riskNote}`;
  }

  if (match.signal === "HIRE") {
    return `Hire externally${roleTag} - no suitable internal candidate${riskNote}`;
  }
  if (match.isRollingOff) {
    return `Rolling off${roleTag}${crossCoeTag}${actingTag} - ${match.name} naturally free at window start${coeTag}${riskNote}${sharedNote}`;
  }
  if (tier === 3) {
    return `Redeploy ${match.name}${roleTag}${crossCoeTag}${actingTag} - ${availPct}% free now${allocNote}${coeTag}${underUtilTag}${riskNote}${sharedNote}`;
  }
  if (tier === 2) {
    return `Redeploy ${match.name}${roleTag}${crossCoeTag}${actingTag} - ${availPct}% free, coordinate handoff${allocNote}${coeTag}${underUtilTag}${riskNote}${sharedNote}`;
  }
  if (tier === 1) {
    return `Redeploy ${match.name}${roleTag}${crossCoeTag}${actingTag} - ${availPct}% free, confirm commitment${allocNote}${coeTag}${rollingTag}${underUtilTag}${riskNote}${sharedNote}`;
  }
  return `${match.name}${roleTag}${crossCoeTag}${actingTag} - currently allocated (${availPct}% free)${allocNote}, release required${coeTag}${underUtilTag}${riskNote}${sharedNote}`;
}

function toPlan(
  signal: MatchSignal,
  sowSigned: boolean,
  priorityLabel: string | null,
  tier: number,
  roleFiltered: boolean,
  fallbackUsed: boolean,
  poolExhausted: boolean,
  isRollingOff: boolean,
  coeAligned: boolean,
  conversionPct: number,
  crossCoe: boolean,
  actingRole: string | null,
  reqAllocationPct: number,
  availableFTE: number,
): string {
  const partialAlloc = reqAllocationPct > 0 && availableFTE < reqAllocationPct;
  const stagePct = Math.round(conversionPct * 100);
  const stageTag = `Stage-${stagePct}%`;
  if (signal === "HIRE" && conversionPct >= 0.60) return `${stageTag} · External Hire Required`;
  if (conversionPct < 0.60) {
    const commitment = conversionPct <= 0.40 ? "Pre-Pipeline" : "Soft-Reserved";
    const roleTag    = roleFiltered ? "Role-Matched" : fallbackUsed ? "Grade-Fallback" : "No-Role-Filter";
    const crossTag   = crossCoe ? "Cross-COE" : "";
    const adjTag     = actingRole && actingRole !== "grade-fallback" ? "Acting-Role" : "";
    return [stageTag, commitment, roleTag, crossTag, adjTag].filter(Boolean).join(" · ");
  }
  const prioTag = priorityLabel
    ? `Priority-${priorityLabel}`
    : sowSigned
    ? "SOW-Priority"
    : "Date-Priority";
  const availTag = isRollingOff
    ? "RollingOff"
    : tier === 3
    ? "Available"
    : tier === 2
    ? "Partial"
    : tier === 1
    ? "Marginal"
    : "Allocated";
  const roleTag        = roleFiltered ? "Role-Matched" : fallbackUsed ? "Grade-Fallback" : "No-Role-Filter";
  const coeTag         = coeAligned ? "COE-Aligned" : "";
  const poolTag        = poolExhausted ? "Pool-Exhausted" : "";
  const crossTag       = crossCoe ? "Cross-COE" : "";
  const adjTag         = actingRole && actingRole !== "grade-fallback"
    ? "Acting-Role"
    : actingRole === "grade-fallback" ? "Grade-Fallback" : "";
  const partialAllocTag = partialAlloc ? `Partial-Alloc(${Math.round(availableFTE * 100)}%/${Math.round(reqAllocationPct * 100)}%)` : "";
  return [stageTag, prioTag, availTag, roleTag, coeTag, poolTag, crossTag, adjTag, partialAllocTag].filter(Boolean).join(" · ");
}

// ── Window-aware, allocation-percentage-aware conflict tracking ───────────────
/**
 * Tracks promised allocation (0–1) per employee per time window.
 * An employee can be assigned to multiple projects in the same window as long
 * as the sum of promised allocations does not exceed their available FTE.
 * Non-overlapping windows are always independent (project ending Aug → free in Sep).
 */
class AllocationTracker {
  private readonly schedule = new Map<string, Array<{ start: Date; end: Date; allocPct: number }>>();

  /** Total allocation already promised to this employee in the given window (0–1). */
  promisedAlloc(employeeId: string, windowStart: Date, windowEnd: Date): number {
    const intervals = this.schedule.get(employeeId) ?? [];
    return intervals
      .filter((iv) => iv.start <= windowEnd && iv.end >= windowStart)
      .reduce((sum, iv) => sum + iv.allocPct, 0);
  }

  /**
   * Returns true if the employee cannot supply at least neededPct in this window.
   * availableFTE is the employee's current free capacity from DB/timesheets;
   * we subtract any pipeline allocations already promised in this run.
   */
  hasConflict(
    employeeId: string,
    windowStart: Date,
    windowEnd: Date,
    availableFTE: number,
    neededPct: number,
  ): boolean {
    const alreadyPromised = this.promisedAlloc(employeeId, windowStart, windowEnd);
    const remainingCapacity = Math.max(0, availableFTE - alreadyPromised);
    return remainingCapacity < neededPct;
  }

  claim(employeeId: string, windowStart: Date, windowEnd: Date, allocPct: number): void {
    const intervals = this.schedule.get(employeeId) ?? [];
    intervals.push({ start: windowStart, end: windowEnd, allocPct });
    this.schedule.set(employeeId, intervals);
  }
}

// ── Request window helpers ────────────────────────────────────────────────────
function toWindow(
  likelyStart: Date | null,
  numberOfWeeks: number | null,
): { windowStart: Date; windowEnd: Date } {
  const windowStart = likelyStart ?? new Date();
  const weeks = numberOfWeeks ?? 12;
  const windowEnd = new Date(windowStart.getTime() + weeks * 7 * 24 * 60 * 60 * 1000);
  return { windowStart, windowEnd };
}

// ── Main export function ──────────────────────────────────────────────────────
export interface ExcelExportOptions {
  sourcePath?: string;
  maxAiCalls?: number;
}

export async function buildResourceExcel(opts: ExcelExportOptions = {}): Promise<Buffer> {
  const sourcePath = opts.sourcePath ?? path.join(process.cwd(), SOURCE_REL);
  const maxAiCalls = opts.maxAiCalls ?? 15;

  // ── Step 1: Read source pipeline xlsx ──────────────────────────────────────
  const sourceWb = XLSX.readFile(sourcePath, { cellStyles: true });
  const sourceWs = sourceWb.Sheets[SOURCE_SHEET];
  if (!sourceWs) throw new Error(`Sheet "${SOURCE_SHEET}" not found in ${sourcePath}`);

  const sourceRows = XLSX.utils.sheet_to_json<unknown[]>(sourceWs, {
    header: 1,
    defval: null,
  }) as unknown[][];
  const [originalHeaders, ...dataRows] = sourceRows;
  if (!originalHeaders) throw new Error("Source pipeline file is empty");

  // ── Step 2: Fetch all DB data in parallel ──────────────────────────────────
  const [dbRequests, allSkills, allEmployees] = await Promise.all([
    db.pipelineRequest.findMany({ orderBy: { createdAt: "asc" } }),
    db.skill.findMany({ select: { id: true, name: true } }),
    fetchAllEmployees(),
  ]);

  // Partition candidates: leavers are excluded from the active pool
  const activeCandidates = allEmployees.filter(
    (emp) =>
      !isLeavingSoon(emp) &&
      emp.jobName !== null &&
      emp.jobName.trim() !== "" &&
      emp.jobName.trim().toLowerCase() !== "null",
  );
  const leaverCount = allEmployees.length - activeCandidates.length;

  // ── Step 3: Build requestsWithContext - join DB rows to xlsx rows ───────────
  interface RequestContext {
    req: (typeof dbRequests)[number];
    srcRow: unknown[];       // original xlsx row (padded to 22 cols)
    rowIndex: number;        // position in xlsx data rows (0-based)
    priorityLabel: string | null;   // read from xlsx col 12 (Priority)
    priorityOrder: number;   // 0 = highest
    windowStart: Date;
    windowEnd: Date;
    reqSkillset: string | null;
    reqSolution: string | null;
    conversionPct: number;      // HubSpot deal stage → 0.20…1.00 (resource confirmability)
    dealStageLabel: string;     // raw stage string for display
    reqAllocationPct: number;   // pipeline "%" column → required resource allocation (0–1)
  }

  const requestsWithContext: RequestContext[] = [];
  for (let i = 0; i < dataRows.length; i++) {
    const req = dbRequests[i];
    if (!req) continue;

    const srcRow = [...(dataRows[i] as unknown[])];
    while (srcRow.length < 22) srcRow.push(null);

    // Priority is stored only in the source xlsx - DB PipelineRequest has no priority field
    const priorityLabel = String(srcRow[C.PRIORITY] ?? "").trim() || null;
    const priorityOrder = PRIORITY_ORDER[priorityLabel?.toLowerCase() ?? ""] ?? 2;

    const { windowStart, windowEnd } = toWindow(req.likelyStart, req.numberOfWeeks);

    const { pct: conversionPct, label: dealStageLabel } = parseDealStageConversion(srcRow[C.DEAL_STAGE]);
    const reqAllocationPct = parseRequiredAllocationPct(srcRow[C.PCT]);

    requestsWithContext.push({
      req,
      srcRow,
      rowIndex: i,
      priorityLabel,
      priorityOrder,
      windowStart,
      windowEnd,
      reqSkillset: req.skillset,
      reqSolution: req.solution,
      conversionPct,
      dealStageLabel,
      reqAllocationPct,
    });
  }

  // ── Step 4: Sort requests for processing ───────────────────────────────────
  // Conversion % DESC → Priority → SOW-Signed → likelyStart ASC
  // Higher-confidence deals (90%, 80%) get first pick of the talent pool.
  // Deal Lost (0%) rows are skipped entirely in the assignment loop.
  const processOrder = [...requestsWithContext].sort((a, b) => {
    if (a.conversionPct !== b.conversionPct) return b.conversionPct - a.conversionPct;
    if (a.priorityOrder !== b.priorityOrder) return a.priorityOrder - b.priorityOrder;
    if (a.req.sowSigned !== b.req.sowSigned) return a.req.sowSigned ? -1 : 1;
    const ad = a.req.likelyStart?.getTime() ?? Infinity;
    const bd = b.req.likelyStart?.getTime() ?? Infinity;
    return ad - bd;
  });

  // ── Step 5: Score and assign ───────────────────────────────────────────────
  const tracker = new AllocationTracker();

  interface RowAssignment {
    match: MatchResultV2;
    topMatches: MatchResultV2[];  // top-3 for Alternates sheet
    plan: string;
    rationale: string;
    confidence: string;
    parsed: ParsedRole;
    roleFiltered: boolean;
    fallbackUsed: boolean;
    poolExhausted: boolean;
    crossCoe: boolean;            // employee from different COE than request requires
    actingRole: string | null;    // null = exact role; string = acting as this role label
    priorityLabel: string | null;
    conversionPct: number;        // deal stage confidence — drives claim gating + action text
    reqAllocationPct: number;     // pipeline "%" column — required resource allocation (0–1)
  }
  const assignments = new Map<string, RowAssignment>();

  // Sort scored pool: GHOST last, HIRE last, full-allocation-fit before partial, tier DESC, score DESC
  function sortByPriority(scored: MatchResultV2[], reqAllocationPct: number): MatchResultV2[] {
    return [...scored].sort((a, b) => {
      const ghostA = a.riskFlags.includes("GHOST") ? 0 : 1;
      const ghostB = b.riskFlags.includes("GHOST") ? 0 : 1;
      if (ghostA !== ghostB) return ghostB - ghostA;
      const hireA = a.signal === "HIRE" ? 0 : 1;
      const hireB = b.signal === "HIRE" ? 0 : 1;
      if (hireA !== hireB) return hireB - hireA;
      // Prefer employees who can fully meet the required allocation %
      const meetsA = a.availableFTE >= reqAllocationPct ? 1 : 0;
      const meetsB = b.availableFTE >= reqAllocationPct ? 1 : 0;
      if (meetsA !== meetsB) return meetsB - meetsA;
      const ta = availabilityTier(a.availableFTE);
      const tb = availabilityTier(b.availableFTE);
      if (ta !== tb) return tb - ta;
      return b.matchScore - a.matchScore;
    });
  }

  for (const ctx of processOrder) {
    const { req, windowStart, windowEnd, reqSkillset, reqSolution, conversionPct } = ctx;

    // Deal Lost — skip matching entirely; row is copied as-is with no appended data
    if (conversionPct === 0) continue;

    // Already resourced — no need to run matching; original recommendation is preserved in output
    if (String(ctx.srcRow[C.STATUS] ?? "").trim().toLowerCase() === "resourced") continue;

    const reqSkills  = textToRequiredSkills(req.skillset ?? "", allSkills);
    // Parse role from DB value; if the DB value is null/stale, fall back to the raw xlsx cell.
    let parsed = normalizeResourceRequest(req.resourcesRequested);
    if (parsed.canonicalRoles.length === 0) {
      const xlsxRaw = String(ctx.srcRow[C.RESOURCES_REQUESTED] ?? "").trim();
      if (xlsxRaw) {
        const parsedFromXlsx = normalizeResourceRequest(xlsxRaw);
        if (parsedFromXlsx.canonicalRoles.length > 0) parsed = parsedFromXlsx;
      }
    }
    const scoreOpts  = { windowStart, windowEnd, canonicalRoles: parsed.canonicalRoles, reqSkillset, reqSolution };

    const roleFiltered = parsed.canonicalRoles.length > 0;
    const fallbackUsed = parsed.canonicalRoles.length === 0;

    // Score ALL active candidates once — reused by every cascade level and Alternates sheet
    const allScored: MatchResultV2[] = activeCandidates.map((emp) =>
      scoreEmployee(emp, reqSkills, scoreOpts),
    );
    const scoreById = new Map<string, MatchResultV2>(allScored.map((r) => [r.employeeId, r]));

    // Top-3 by pure match score for the Alternates sheet (full pool — best options regardless of role)
    const topByScore = [...allScored]
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 3);

    // ── Claim gating: stages < 60% are soft reservations ─────────────────────
    const hardClaim = conversionPct >= 0.60;

    // ── Cross-role/cross-COE cascade ─────────────────────────────────────────
    // Cascade order (tried in sequence, stops at first successful pick):
    //   A: Exact role + COE-aligned      — best match
    //   B: Exact role + any COE           — cross-COE flag
    //   C: Adjacent role + COE-aligned    — acting-role flag
    //   D: Adjacent role + any COE        — cross-role + cross-COE
    //   E: Any internal (grade fallback)  — last resort before external hire
    const requestedDomain = deriveRequestCoeDomain(reqSkillset, reqSolution);
    const adjRoles = getAdjacentRoles(parsed.canonicalRoles);

    // Helper: get sorted pre-scored results for a subset of employees
    function poolOf(filter: (emp: EmployeeRow) => boolean): MatchResultV2[] {
      return sortByPriority(
        activeCandidates.filter(filter).map((e) => scoreById.get(e.id)!).filter(Boolean),
        ctx.reqAllocationPct,
      );
    }

    type CascadeLevel = { pool: MatchResultV2[]; crossCoe: boolean; actingRole: string | null };
    const cascadeLevels: CascadeLevel[] = [];

    if (parsed.canonicalRoles.length > 0) {
      const isExact = (emp: EmployeeRow) => employeeMatchesRole(emp.jobName, parsed.canonicalRoles);
      const isAdj   = (emp: EmployeeRow) => adjRoles.length > 0 && employeeMatchesRole(emp.jobName, adjRoles) && !isExact(emp);
      const isCoe   = (emp: EmployeeRow) => coeDomainMatches(emp, requestedDomain);

      // A: exact role + COE-aligned
      cascadeLevels.push({ pool: poolOf((e) => isExact(e) && isCoe(e)),  crossCoe: false,            actingRole: null });
      // B: exact role + cross-COE (only meaningful when a domain was actually derived)
      cascadeLevels.push({ pool: poolOf((e) => isExact(e) && !isCoe(e)), crossCoe: !!requestedDomain, actingRole: null });
      // C: adjacent role + COE-aligned
      cascadeLevels.push({ pool: poolOf((e) => isAdj(e) && isCoe(e)),   crossCoe: false,            actingRole: parsed.display });
      // D: adjacent role + cross-COE
      cascadeLevels.push({ pool: poolOf((e) => isAdj(e) && !isCoe(e)),  crossCoe: !!requestedDomain, actingRole: parsed.display });
      // No Pool E — unrelated job titles (e.g. "Head of Talent" for a PA request) must not be used.
      // If A–D are all exhausted the system falls through to HIRE.
    } else {
      // Role completely unrecognised — do not match ANY internal employee; recommend HIRE.
      // Matching the full pool here would surface wrong-role employees (e.g. SE for a PA request).
      // Leave cascadeLevels empty; the picked===null path below emits a HIRE row.
    }

    let picked: MatchResultV2 | null = null;
    let pickedTier = 0;
    let poolExhausted = false;
    let pickedCrossCoe = false;
    let pickedActingRole: string | null = null;

    for (const level of cascadeLevels) {
      for (const candidate of level.pool) {
        if (!tracker.hasConflict(candidate.employeeId, windowStart, windowEnd, candidate.availableFTE, ctx.reqAllocationPct)) {
          picked          = candidate;
          pickedTier      = availabilityTier(candidate.availableFTE);
          pickedCrossCoe  = level.crossCoe;
          pickedActingRole = level.actingRole;
          if (hardClaim) tracker.claim(candidate.employeeId, windowStart, windowEnd, ctx.reqAllocationPct);
          break;
        }
      }
      if (picked) break;
    }

    // Pool exhaustion fallback — only triggers when the role is recognised and at least one
    // matching employee exists but all were claimed in the cascade. Picks the best role-matching
    // candidate as a shared resource (flagged as poolExhausted) rather than falling to HIRE.
    const anyRoleMatchExists = roleFiltered
      ? allScored.some((m) => employeeMatchesRole(m.jobName, parsed.canonicalRoles))
      : false;
    if (!picked && anyRoleMatchExists) {
      const rolePool = allScored
        .filter((m) => employeeMatchesRole(m.jobName, parsed.canonicalRoles))
        .sort((a, b) => b.matchScore - a.matchScore);
      picked = rolePool[0] ?? null;
      poolExhausted = true;
      if (picked && hardClaim) tracker.claim(picked.employeeId, windowStart, windowEnd, ctx.reqAllocationPct);
    }

    if (picked) {
      assignments.set(req.id, {
        match: picked,
        topMatches: topByScore,
        plan: toPlan(
          picked.signal,
          req.sowSigned,
          ctx.priorityLabel,
          pickedTier,
          roleFiltered,
          fallbackUsed,
          poolExhausted,
          picked.isRollingOff,
          picked.coeAligned,
          conversionPct,
          pickedCrossCoe,
          pickedActingRole,
          ctx.reqAllocationPct,
          picked.availableFTE,
        ),
        rationale: "",
        confidence: "-",
        parsed,
        roleFiltered,
        fallbackUsed,
        poolExhausted,
        crossCoe: pickedCrossCoe,
        actingRole: pickedActingRole,
        priorityLabel: ctx.priorityLabel,
        conversionPct,
        reqAllocationPct: ctx.reqAllocationPct,
      });
    }
  }

  // ── Step 6: AI rationale pass ──────────────────────────────────────────────
  // Apply Gemini rationale to up to maxAiCalls REDEPLOY rows (batches of 3, 5s timeout).
  const AI_TIMEOUT = 5_000;

  const redeployCtxs = processOrder
    .filter((ctx) => assignments.get(ctx.req.id)?.match.signal === "REDEPLOY")
    .slice(0, maxAiCalls);

  async function safeExplain(ctx: (typeof redeployCtxs)[number]): Promise<string> {
    const asgn = assignments.get(ctx.req.id);
    if (!asgn) return "";
    const m = asgn.match;
    try {
      return await Promise.race([
        explainMatch({
          projectName: ctx.req.client ?? "Client Project",
          projectCategory: ctx.req.solution ?? "General",
          candidate: m,
          experienceScore: m.experienceScore,
          coeAligned: m.coeAligned,
          coeName: m.empCoeName,
          designationGap: m.designationGap,
          riskFlags: m.riskFlags,
        }),
        new Promise<string>((_, reject) =>
          setTimeout(() => reject(new Error("ai-timeout")), AI_TIMEOUT),
        ),
      ]);
    } catch {
      // Deterministic fallback when AI times out or is unavailable
      const dim  = m.skillScore >= m.competencyScore ? "technical skills" : "consulting competency";
      const risk = m.unmetSkills.length > 0 ? `missing ${m.unmetSkills[0]}` : "availability constrained";
      const coeNote  = m.coeAligned ? ` COE-aligned (${m.requestedDomain ?? m.empCoeName}).` : "";
      const riskNote = m.riskFlags.length > 0 ? ` Risk: ${m.riskFlags.join(", ")}.` : "";
      return `${m.name} leads on ${dim} (${m.matchScore}/100).${coeNote} Primary concern: ${risk}. Signal: ${m.signal}.${riskNote}`;
    }
  }

  for (let i = 0; i < redeployCtxs.length; i += 3) {
    const batch = redeployCtxs.slice(i, i + 3);
    const rationales = await Promise.all(batch.map((ctx) => safeExplain(ctx)));
    batch.forEach((ctx, idx) => {
      const asgn = assignments.get(ctx.req.id);
      if (asgn) {
        asgn.rationale  = rationales[idx] ?? "";
        asgn.confidence = "HIGH (AI-verified)";
      }
    });
  }

  // Fill deterministic rationale for non-AI rows
  for (const [, asgn] of assignments) {
    if (!asgn.rationale) {
      const m    = asgn.match;
      const dim  = m.skillScore >= m.competencyScore ? "technical skills" : "consulting competency";
      const risk = m.unmetSkills.length > 0 ? `missing ${m.unmetSkills[0]}` : "availability limited";
      const coeNote  = m.coeAligned ? ` COE-aligned (${m.requestedDomain ?? m.empCoeName}).` : "";
      const expNote  = m.experienceScore > 0 ? ` Experience depth: ${m.experienceScore}/100.` : "";
      const riskNote = m.riskFlags.length > 0 ? ` Risk: ${m.riskFlags.join(", ")}.` : "";
      asgn.rationale  = `${m.name} scores ${m.matchScore}/100. Strongest: ${dim}.${coeNote}${expNote} Risk: ${risk}.${riskNote}`;
      asgn.confidence =
        m.signal === "HIRE"
          ? "N/A - External Hire"
          : asgn.poolExhausted
          ? "LOW (Pool Exhausted)"
          : "MEDIUM (deterministic)";
    }
  }

  // ── Step 7: Build output rows (original xlsx order preserved) ──────────────
  const outputAoa: unknown[][] = [
    [...(originalHeaders as unknown[]), ...APPENDED_HEADERS],
  ];

  for (let i = 0; i < dataRows.length; i++) {
    const srcRow = [...(dataRows[i] as unknown[])];
    while (srcRow.length < 22) srcRow.push(null);

    const req  = dbRequests[i];
    const asgn = req ? assignments.get(req.id) : null;
    const isResourced = String(srcRow[C.STATUS] ?? "").trim().toLowerCase() === "resourced";

    // Resourced rows: preserve original values as-is, skip matching output and HIRE placeholder
    if (isResourced) {
      outputAoa.push([...srcRow, ...Array<null>(14).fill(null)]);
      continue;
    }

    // Fill existing pipeline xlsx columns — always overwrite to avoid stale values from prior runs
    if (asgn) {
      const m = asgn.match;
      srcRow[C.RESOURCE_RECOMMENDED] = `${m.employeeCode} · ${m.name} (${m.designationName ?? m.jobName ?? "—"})`;
      const availPctStr = `${Math.round(m.availableFTE * 100)}%`;
      const neededPctStr = asgn.reqAllocationPct > 0 ? ` / ${Math.round(asgn.reqAllocationPct * 100)}% needed` : "";
      srcRow[C.PCT_AVAILABLE] = `${availPctStr}${neededPctStr}`;
      srcRow[C.SKILLSET_MATCH] = toSkillsetMatch(m.signal, m.skillScore, m.availableFTE);
    } else {
      // No internal match found — clear any stale values from a previous export run
      const roleLabel = req ? (normalizeResourceRequest(req.resourcesRequested).display || String(srcRow[C.RESOURCES_REQUESTED] ?? "Unknown role")) : "Unknown role";
      srcRow[C.RESOURCE_RECOMMENDED] = `HIRE — no ${roleLabel} available internally`;
      srcRow[C.PCT_AVAILABLE] = "";
      srcRow[C.SKILLSET_MATCH] = "HIRE";
    }

    // Append 14 value-add columns
    const appended: unknown[] = asgn
      ? [
          asgn.match.employeeCode,                                           // 22 Employee ID
          asgn.match.matchScore,                                             // 23 Match Score
          asgn.match.skillScore,                                             // 24 Skill Score
          asgn.match.competencyScore,                                        // 25 Competency Score
          asgn.match.experienceScore,                                        // 26 Experience Score
          Math.round(asgn.match.availableFTE * 100),                         // 27 Availability Score
          asgn.match.coeAligned                                              // 28 COE Alignment
            ? `✓ ${asgn.match.requestedDomain ?? asgn.match.empCoeName ?? "COE"}`
            : `✗ ${asgn.match.requestedDomain ?? "No match"}`,
          asgn.match.signal,                                                 // 29 Signal
          asgn.match.riskFlags.length > 0                                    // 30 Risk Flags
            ? asgn.match.riskFlags.join(", ")
            : "-",
          toAction(                                                           // 31 Recommended Action
            asgn.match,
            asgn.parsed,
            asgn.roleFiltered,
            asgn.fallbackUsed,
            asgn.poolExhausted,
            asgn.conversionPct,
            asgn.crossCoe,
            asgn.actingRole,
            asgn.reqAllocationPct,
          ),
          asgn.match.unmetSkills.join(", ") || "-",                          // 32 Unmet Skills
          asgn.plan,                                                         // 33 Plan
          asgn.rationale,                                                    // 34 AI Rationale
          asgn.confidence,                                                   // 35 Confidence
        ]
      : Array<null>(14).fill(null);

    outputAoa.push([...srcRow, ...appended]);
  }

  // ── Step 8: Build Main sheet with styles ───────────────────────────────────
  const ws = XLSX.utils.aoa_to_sheet(outputAoa);

  // Header row styles
  for (let c = 0; c < TOTAL_COLS; c++) {
    applyStyle(ws, 0, c, c < 22 ? S.headerOrig : S.headerAppended);
  }

  // Data row conditional styles
  for (let r = 1; r < outputAoa.length; r++) {
    const row  = outputAoa[r] as unknown[];
    const sowSigned    = String(row[C.SOW_SIGNED] ?? "").toLowerCase() === "yes";
    const matchScore   = row[C.MATCH_SCORE]       as number | null;
    const signal       = row[C.SIGNAL]            as string | null;
    const skillMatch   = row[C.SKILLSET_MATCH]    as "Complete" | "Partial" | "No" | null;
    const riskFlags    = row[C.RISK_FLAGS]         as string | null;
    const coeAlignment = row[C.COE_ALIGNMENT]      as string | null;

    if (sowSigned) applyStyle(ws, r, C.SOW_SIGNED, S.sowRow);

    const scoreColMap: [number, number | null][] = [
      [C.MATCH_SCORE,       matchScore],
      [C.SKILL_SCORE,       row[C.SKILL_SCORE]       as number | null],
      [C.COMPETENCY_SCORE,  row[C.COMPETENCY_SCORE]  as number | null],
      [C.EXPERIENCE_SCORE,  row[C.EXPERIENCE_SCORE]  as number | null],
      [C.AVAILABILITY_SCORE, row[C.AVAILABILITY_SCORE] as number | null],
    ];
    for (const [col, val] of scoreColMap) {
      const st = scoreStyle(val);
      if (st) applyStyle(ws, r, col, st);
    }

    const sigSt = signalStyle(signal);
    if (sigSt) applyStyle(ws, r, C.SIGNAL, sigSt);

    const matchSt = matchStyle(skillMatch);
    if (matchSt) applyStyle(ws, r, C.SKILLSET_MATCH, matchSt);

    if (coeAlignment?.startsWith("✓")) applyStyle(ws, r, C.COE_ALIGNMENT, S.coeGood);
    if (riskFlags && riskFlags !== "-") applyStyle(ws, r, C.RISK_FLAGS, S.risk);
  }

  // Column widths (36 columns)
  ws["!cols"] = [
    // Original 22 columns
    { wch: 8 },  { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 10 },
    { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 10 },
    { wch: 16 }, { wch: 14 }, { wch: 10 }, { wch: 14 }, { wch: 16 },
    { wch: 8 },  { wch: 26 }, { wch: 12 }, { wch: 40 }, { wch: 18 },
    { wch: 10 }, { wch: 30 },
    // Appended 14 columns
    { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 16 }, { wch: 14 },
    { wch: 14 }, { wch: 20 }, { wch: 16 }, { wch: 30 }, { wch: 52 },
    { wch: 32 }, { wch: 48 }, { wch: 72 }, { wch: 24 },
  ];

  (ws as Record<string, unknown>)["!freeze"] = { xSplit: 0, ySplit: 1 };
  const lastCol = XLSX.utils.encode_col(TOTAL_COLS - 1);
  ws["!autofilter"] = { ref: `A1:${lastCol}1` };

  // ── Step 9: Alternates sheet (enriched) ────────────────────────────────────
  const altHeaders = [
    "Row #", "Client", "Priority", "SOW Signed", "Skillset", "Rank",
    "Employee ID", "Employee Name", "Role", "Designation", "COE",
    "Match Score", "Skill Score", "Competency Score", "Experience Score",
    "Availability %", "COE Aligned", "Signal", "Risk Flags", "Unmet Skills",
  ] as const;

  const altRows: unknown[][] = [[...altHeaders]];
  for (let i = 0; i < dataRows.length; i++) {
    const req  = dbRequests[i];
    if (!req) continue;
    const asgn = assignments.get(req.id);
    if (!asgn) continue;
    const ctx  = requestsWithContext[i];
    const row  = dataRows[i] as unknown[];

    asgn.topMatches.forEach((m, rank) => {
      const emp = allEmployees.find((e) => e.id === m.employeeId);
      altRows.push([
        i + 1,
        row[C.CLIENT] ?? "-",
        ctx?.priorityLabel ?? "-",
        row[C.SOW_SIGNED] ?? "No",
        row[C.SKILLSET] ?? "-",
        rank + 1,
        m.employeeCode,
        m.name,
        m.jobName ?? "-",
        emp?.designation?.name ?? "-",
        (m as MatchResultV2).empCoeName ?? "-",
        m.matchScore,
        m.skillScore,
        m.competencyScore,
        (m as MatchResultV2).experienceScore,
        `${Math.round(m.availableFTE * 100)}%`,
        (m as MatchResultV2).coeAligned ? "Yes" : "No",
        m.signal,
        (m as MatchResultV2).riskFlags.join(", ") || "-",
        m.unmetSkills.join(", ") || "-",
      ]);
    });
  }

  const wsAlt = XLSX.utils.aoa_to_sheet(altRows);
  for (let c = 0; c < altHeaders.length; c++) {
    applyStyle(wsAlt, 0, c, S.headerOrig);
  }
  (wsAlt as Record<string, unknown>)["!freeze"] = { xSplit: 0, ySplit: 1 };
  wsAlt["!autofilter"] = { ref: `A1:${XLSX.utils.encode_col(altHeaders.length - 1)}1` };

  // ── Step 10: Summary sheet ─────────────────────────────────────────────────
  const confirmedCount  = dbRequests.filter((r) => r.sowSigned).length;
  const probableCount   = dbRequests.filter((r) => !r.sowSigned).length;
  const allAssign       = Array.from(assignments.values());
  const redeployCount   = allAssign.filter((a) => a.match.signal === "REDEPLOY").length;
  const partialCount    = allAssign.filter((a) => a.match.signal === "PARTIAL_HIRE").length;
  const hireCount       = allAssign.filter((a) => a.match.signal === "HIRE").length;
  const unmatched       = dbRequests.length - assignments.size;
  const coeAlignedCount = allAssign.filter((a) => a.match.coeAligned).length;
  const riskFlagCount   = allAssign.filter((a) => a.match.riskFlags.length > 0).length;
  const poolExhCount    = allAssign.filter((a) => a.poolExhausted).length;
  const rollingOffCount = allAssign.filter((a) => a.match.isRollingOff).length;
  const coveredPct      = dbRequests.length > 0
    ? Math.round(((redeployCount + partialCount) / dbRequests.length) * 100)
    : 0;

  // Priority breakdown from xlsx
  const prioCounts = new Map<string, number>();
  for (const ctx of requestsWithContext) {
    const p = ctx.priorityLabel ?? "Unspecified";
    prioCounts.set(p, (prioCounts.get(p) ?? 0) + 1);
  }

  // Top 5 roles in demand
  const roleCounts = new Map<string, number>();
  for (const req of dbRequests) {
    const r = req.resourcesRequested ?? "Unknown";
    roleCounts.set(r, (roleCounts.get(r) ?? 0) + 1);
  }
  const topRoles = [...roleCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const now = new Date();
  const summaryRows: unknown[][] = [
    ["RESOURCING EXPORT SUMMARY - v2 Enhanced Matching (7-Dimension Score)", null],
    [`Generated: ${now.toLocaleString("en-GB")}`, null],
    [],
    ["PORTFOLIO OVERVIEW", null],
    ["Total Pipeline Requests",           dbRequests.length],
    ["SOW-Signed (Confirmed)",            confirmedCount],
    ["Probable (Unsigned)",               probableCount],
    [],
    ["PRIORITY BREAKDOWN", null],
    ...[...prioCounts.entries()].map(([p, n]) => [p, n]),
    [],
    ["MATCHING RESULTS", null],
    ["Covered Internally - Redeploy",     redeployCount],
    ["Covered Partially - Partial Hire",  partialCount],
    ["External Hire Required",            hireCount],
    ["No Match Found",                    unmatched],
    ["Internal Coverage %",              `${coveredPct}%`],
    ["COE-Aligned Assignments",           coeAlignedCount],
    ["Rolling-Off Opportunities Used",    rollingOffCount],
    ["Assignments with Risk Flags",       riskFlagCount],
    ["Pool-Exhausted (Shared Resource)",  poolExhCount],
    [],
    ["CANDIDATE POOL HEALTH", null],
    ["Total Employees",                   allEmployees.length],
    [`Excluded - Leavers (≤${LEAVER_HORIZON_DAYS} days)`, leaverCount],
    ["Active Candidates",                 activeCandidates.length],
    [],
    ["TOP ROLES IN DEMAND", null],
    ...topRoles.map(([role, count]) => [role, count]),
    [],
    ["SCORING METHODOLOGY - v2 (7 Dimensions, sum = 100%)", null],
    ["Skill Coverage + Depth",   "32% - required-skill coverage × proficiency level; bidirectional skill matching catches SubSkill composites (e.g. 'Python – Data Analysis' matched by 'Python' in request)"],
    ["Consulting Competency",    "22% - average of 5 behaviour scores: Stakeholder Mgmt, Advisory, Techno-Functional, Communication, Ambiguity Navigation"],
    ["Experience Depth",         "8%  - 3-signal blend: 50% actual skill-years (from File 05 Experience column via ETL) + 25% skill depth (validatedLevel/5) + 25% tenure; +10 pts when level exceeds requirement; SubSkill prefix matching for years lookup"],
    ["Availability Fit",         `18% - window-aware free capacity within likelyStart→end window; project-only timesheets used (leave/admin excluded); rolling-off bonus +${ROLLING_OFF_BONUS_PTS} pts`],
    ["Billability Fit",          "10% - low current billability = high cost-recovery opportunity"],
    ["Evidence Strength",        "6%  - certs × 10 pts + File 05 skill portfolio overlap + role-history match (alloc.role or current jobName) +15 pts + project breadth bonus (distinct project count × 4, max +20 pts)"],
    ["COE Alignment",            "4%  - 3 signals: employee COE in request text (×2), active project techCoe/propositionCoe overlaps request (×1), employee COE matches their active project domain (×1)"],
    [],
    ["DATA SIGNAL IMPROVEMENTS (v2.1)", null],
    ["Experience years (File 05)", "ETL now parses 'Experience' column ('1–3 yrs', '5+', '<1') → stored in ProjectExperienceDoc.extractedSkills JSON; used in Experience Depth dimension"],
    ["Manager chain (File 01)",   "ETL two-pass links Employee.managerId from manager_id column; manager context used in team-level reporting"],
    ["Allocation role (File 03)", "ETL stores employee.jobName as ProjectAllocation.role at allocation time; enables role-history boost in Evidence dimension"],
    ["Timesheet filtering",       "deriveUtilisation() now filters to projectId IS NOT NULL - leave, training, admin entries no longer inflate utilisation"],
    ["COE matching (Files 02-03)","computeCoeAlignment() reads project.techCoe + project.propositionCoe from all allocations (incl. completed) for multi-signal COE scoring"],
    ["SubSkill matching",         "textToRequiredSkills() reverse-matches: keyword 'Python' in request matches skill 'Python – Data Analysis' from ExperienceDoc"],
    [],
    ["CONFLICT RESOLUTION", null],
    ["Request processing order", "Priority (High/Critical) → SOW-Signed → Likely Start ASC"],
    ["Conflict tracking",        "Window-aware: same employee may be recommended for non-overlapping requests"],
    ["Role pool exhaustion",     "Role-matched pool → full active pool → shared resource (clearly flagged in Risk Flags)"],
    ["Leaver exclusion",         `Employees with resignation date ≤${LEAVER_HORIZON_DAYS} days from today excluded from active pool`],
    [],
    ["RISK FLAG LEGEND", null],
    ["GHOST",          `Allocated to project but logging zero timesheet hours - unreliable capacity; −${GHOST_AVAIL_PENALTY} pts availability`],
    ["SHADOW",         "Logging hours without a formal allocation - team health signal, review resourcing records"],
    ["LEAVER",         `Resignation ≤${LEAVER_HORIZON_DAYS} days - excluded from active pool; signal forced to HIRE`],
    ["OVER_ALLOCATED", "Current utilisation > 100% (working beyond capacity)"],
    ["UNDER_LEVELLED", `Designation ≥2 grades below requested role - −${UNDER_LEVEL_SKILL_PENALTY} pts skill score`],
    [],
    ["AI RATIONALE", null],
    ["Applied to",   `Top ${Math.min(maxAiCalls, redeployCount)} REDEPLOY matches (5 s timeout, batches of 3)`],
    ["Context passed", "Skill, Competency, Experience (years), Availability, COE Alignment, Designation Gap, Risk Flags, Project Breadth"],
    ["Fallback",     "Deterministic rationale using dimension scores when AI is unavailable or times out"],
    [],
    ["DATA SOURCES", null],
    ["File 01", "employee_details.csv - employee identity, job, location, manager_id, resignation dates"],
    ["File 02", "project_details.csv - project type, status, tech/proposition COE"],
    ["File 03", "Project_Allocation_Details.csv - allocation %, dates, role, resourcing status"],
    ["File 04", "timesheet_details_2026.csv - hours, billability (→ UtilisationSnapshot, project-only)"],
    ["File 05", "Skill_Data.xlsx - employee skills, validated scores, experience years, SubSkill detail"],
    ["File 06", "Competency_Details.xlsx - 5 consulting-behaviour scores per employee"],
    ["File 07", "Pipeline_Details.xlsx - pipeline demand: skillset, role, priority, SOW"],
    ["File 09", "Project_Weekly_Status_Details.csv - scope/schedule/quality/csat/team RAG"],
    ["Derived", "ShadowFlag (GHOST/SHADOW from allocation vs timesheet join), UtilisationSnapshot, RoleMixTemplate, ProjectExperienceDoc (ETL-SkillProfile per employee)"],
  ];

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  wsSummary["!cols"] = [{ wch: 55 }, { wch: 90 }];
  applyStyle(wsSummary, 0, 0, S.headerOrig);

  // ── Step 11: Assemble and return workbook ──────────────────────────────────
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws,        "Pipeline Resource Plan");
  XLSX.utils.book_append_sheet(wb, wsAlt,     "Alternates");
  XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx", cellStyles: true });
  return buf as Buffer;
}
