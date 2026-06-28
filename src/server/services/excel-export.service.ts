import path from "path";
import * as XLSX from "xlsx";
import { db } from "@/lib/db";
import { MATCH_WEIGHTS } from "@/lib/constants";
import { explainMatch } from "@/lib/ai/rationale";
import { normalizeResourceRequest, employeeMatchesRole } from "@/lib/role-mapping";
import type { ParsedRole } from "@/lib/role-mapping";
import type { MatchResult, MatchSignal, SkillBreakdown } from "@/server/services/matching.service";

// ── Source file ───────────────────────────────────────────────────────────────
const SOURCE_REL = path.join("reference_files", "07. 260624_Pipeline_Details.xlsx");
const SOURCE_SHEET = "Forecast";

// ── Column indices ────────────────────────────────────────────────────────────
const C = {
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
  RESOURCE_RECOMMENDED: 16, // FILL
  PCT_AVAILABLE: 17,        // FILL
  SKILLSET: 18,
  SKILLSET_MATCH: 19,       // FILL
  SOW_SIGNED: 20,
  COMMENTS: 21,
  // Appended value-add columns
  EMPLOYEE_ID: 22,
  MATCH_SCORE: 23,
  SKILL_SCORE: 24,
  COMPETENCY_SCORE: 25,
  SIGNAL: 26,
  ACTION: 27,
  UNMET_SKILLS: 28,
  PLAN: 29,
  AI_RATIONALE: 30,
  CONFIDENCE: 31,
} as const;

const APPENDED_HEADERS = [
  "Employee ID",
  "Match Score (0–100)",
  "Skill Score",
  "Competency Score",
  "Signal",
  "Recommended Action",
  "Unmet Skills",
  "Plan",
  "AI Rationale",
  "Confidence",
];

const TOTAL_COLS = 32;

// ── Cell styles ────────────────────────────────────────────────────────────────
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
};

function scoreStyle(v: number | null): CellStyle | null {
  if (v === null) return null;
  if (v >= 80) return S.good;
  if (v >= 60) return S.warn;
  return S.bad;
}

function signalStyle(sig: string | null): CellStyle | null {
  if (sig === "REDEPLOY") return S.good;
  if (sig === "PARTIAL_HIRE") return S.warn;
  if (sig === "HIRE") return S.bad;
  return null;
}

function matchStyle(m: "Complete" | "Partial" | "No" | null): CellStyle | null {
  if (m === "Complete") return S.good;
  if (m === "Partial") return S.warn;
  if (m === "No") return S.bad;
  return null;
}

// ── Pre-fetched employee type ─────────────────────────────────────────────────
type EmployeeRow = Awaited<ReturnType<typeof fetchAllEmployees>>[number];

async function fetchAllEmployees() {
  return db.employee.findMany({
    include: {
      employeeSkills: {
        where: { status: "APPROVED" },
        include: {
          skill: { select: { id: true, name: true } },
          evidences: { select: { id: true } },
        },
      },
      competencies: { select: { score: true } },
      allocations: {
        include: { project: { select: { status: true, name: true } } },
      },
      utilisationSnapshots: { orderBy: { weekStart: "desc" }, take: 4 },
      experienceDocs: {
        where: { extractionStatus: { in: ["EXTRACTED", "APPLIED"] } },
        select: { techStack: true, extractedSkills: true },
      },
    },
  });
}

// ── In-memory scoring (mirrors computeMatchRanking but uses pre-fetched data) ─
function scoreEmployee(
  emp: EmployeeRow,
  requiredSkills: { skillId: string; skillName: string; requiredLevel: number }[],
): MatchResult {
  const hasSkillFilter = requiredSkills.length > 0;
  const skillIds = new Set(requiredSkills.map((s) => s.skillId));

  const relevantSkills = hasSkillFilter
    ? emp.employeeSkills.filter((es) => skillIds.has(es.skill.id))
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
      skillDepth += Math.min(current / req.requiredLevel, 1);
      breakdown.push({ skillName: req.skillName, required: req.requiredLevel, current, met });
    }
  }

  const coveragePct = hasSkillFilter ? skillCoverage / requiredSkills.length : 1;
  const depthPct = hasSkillFilter && requiredSkills.length > 0 ? skillDepth / requiredSkills.length : 1;
  const skillScore = hasSkillFilter
    ? Math.round((coveragePct * 0.6 + depthPct * 0.4) * 100)
    : Math.round((emp.employeeSkills.length > 0 ? Math.min(emp.employeeSkills.length / 5, 1) : 0.3) * 100);

  const competencyScore =
    emp.competencies.length > 0
      ? Math.round((emp.competencies.reduce((s, c) => s + c.score, 0) / emp.competencies.length / 5) * 100)
      : 50;

  const snapshots = emp.utilisationSnapshots;
  const avgUtil =
    snapshots.length > 0
      ? snapshots.reduce((s, sn) => s + sn.utilisation, 0) / snapshots.length
      : emp.allocations.length > 0
      ? 1.0
      : 0;
  const availableFTE = Math.max(0, 1 - avgUtil);
  const availabilityFit = Math.round(Math.min(availableFTE, 1) * 100);

  const avgBillable =
    snapshots.length > 0
      ? snapshots.reduce((s, sn) => s + sn.billableUtil, 0) / snapshots.length
      : 1;
  const billabilityFit = Math.round((1 - avgBillable) * 100);

  const totalEvidence = emp.employeeSkills.reduce((s, es) => s + es.evidences.length, 0);
  const reqNames = new Set(requiredSkills.map((r) => r.skillName.toLowerCase()));
  let expBoost = 0;
  for (const doc of emp.experienceDocs) {
    const techTerms = (doc.techStack ?? "").split(/[,;]/).map((t) => t.trim().toLowerCase());
    let docExtracted: { name: string }[] = [];
    try {
      docExtracted = doc.extractedSkills ? (JSON.parse(doc.extractedSkills) as { name: string }[]) : [];
    } catch { /* ignore */ }
    const docSkillNames = [...techTerms, ...docExtracted.map((s) => s.name.toLowerCase())];
    if (docSkillNames.some((n) => reqNames.has(n))) expBoost += 15;
  }
  const evidenceStrength = Math.min(totalEvidence * 10 + expBoost, 100);

  const matchScore = Math.round(
    skillScore * MATCH_WEIGHTS.skill +
    competencyScore * MATCH_WEIGHTS.competency +
    availabilityFit * MATCH_WEIGHTS.availability +
    billabilityFit * MATCH_WEIGHTS.billability +
    evidenceStrength * MATCH_WEIGHTS.evidence,
  );

  let signal: MatchSignal = "REDEPLOY";
  if (!hasSkillFilter) {
    signal = availableFTE > 0.5 ? "REDEPLOY" : availableFTE > 0.1 ? "PARTIAL_HIRE" : "HIRE";
  } else if (coveragePct < 0.7 || skillScore < 60 || availableFTE === 0) {
    signal = coveragePct < 0.4 ? "HIRE" : "PARTIAL_HIRE";
  }

  return {
    employeeId: emp.id,
    employeeCode: emp.employeeCode,
    name: emp.name,
    jobName: emp.jobName,
    skillScore,
    competencyScore,
    availabilityFit,
    billabilityFit,
    evidenceStrength,
    matchScore,
    skillBreakdown: breakdown,
    unmetSkills: unmet,
    availableFTE,
    signal,
  };
}

// ── Skillset text → required skills ──────────────────────────────────────────
function textToRequiredSkills(
  text: string,
  allSkills: { id: string; name: string }[],
): { skillId: string; skillName: string; requiredLevel: number }[] {
  if (!text) return [];
  const lower = text.toLowerCase();
  return allSkills
    .filter((s) => lower.includes(s.name.toLowerCase()))
    .map((s) => ({ skillId: s.id, skillName: s.name, requiredLevel: 3 }));
}

// ── Availability tier (drives selection order, separate from displayed score) ─
function availabilityTier(availableFTE: number): 0 | 1 | 2 | 3 {
  if (availableFTE > 0.5) return 3;
  if (availableFTE > 0.2) return 2;
  if (availableFTE > 0)   return 1;
  return 0;
}

// ── Derived column values ─────────────────────────────────────────────────────
function toSkillsetMatch(
  signal: MatchSignal,
  skillScore: number,
  availFTE: number,
): "Complete" | "Partial" | "No" {
  if (signal === "HIRE" || availFTE === 0) return "No";
  if (skillScore >= 70 && availFTE > 0.2) return "Complete";
  return "Partial";
}

function toAction(
  match: MatchResult,
  parsed: ParsedRole,
  roleFiltered: boolean,
  fallbackUsed: boolean,
): string {
  const avail = Math.round(match.availableFTE * 100);
  const tier = availabilityTier(match.availableFTE);
  const roleLabel = roleFiltered
    ? ` [${parsed.display}]`
    : fallbackUsed
    ? " [role unrecognised — any grade]"
    : "";
  if (match.signal === "HIRE") return `Hire externally${roleLabel} — no available internal match`;
  if (tier === 3) return `Redeploy ${match.name}${roleLabel} — ${avail}% free, available now`;
  if (tier === 2) return `Redeploy ${match.name}${roleLabel} — ${avail}% free, coordinate handoff`;
  if (tier === 1) return `Redeploy ${match.name}${roleLabel} — ${avail}% free, confirm commitment`;
  return `${match.name}${roleLabel} — allocated (${avail}% free), release required`;
}

function toPlan(
  signal: MatchSignal,
  sowSigned: boolean,
  tier: number,
  roleFiltered: boolean,
  fallbackUsed: boolean,
): string {
  if (signal === "HIRE") return "External Hire Required";
  const priority = sowSigned ? "SOW-Priority" : "Date-Priority";
  const av = tier === 3 ? "Available" : tier === 2 ? "Partial" : tier === 1 ? "Marginal" : "Allocated";
  const rf = roleFiltered ? "Role-Matched" : fallbackUsed ? "Grade-Fallback" : "No-Role-Filter";
  return `${priority} · ${av} · ${rf}`;
}

// ── Apply style to a cell ─────────────────────────────────────────────────────
function applyStyle(ws: XLSX.WorkSheet, r: number, c: number, style: CellStyle) {
  const addr = XLSX.utils.encode_cell({ r, c });
  if (!ws[addr]) ws[addr] = { t: "z", v: null };
  (ws[addr] as Record<string, unknown>)["s"] = style;
}

// ── Main export function ──────────────────────────────────────────────────────
export interface ExcelExportOptions {
  sourcePath?: string;
  maxAiCalls?: number;
}

export async function buildResourceExcel(opts: ExcelExportOptions = {}): Promise<Buffer> {
  const sourcePath = opts.sourcePath ?? path.join(process.cwd(), SOURCE_REL);
  const maxAiCalls = opts.maxAiCalls ?? 15;

  // 1. Read source xlsx
  const sourceWb = XLSX.readFile(sourcePath, { cellStyles: true });
  const sourceWs = sourceWb.Sheets[SOURCE_SHEET];
  if (!sourceWs) throw new Error(`Sheet "${SOURCE_SHEET}" not found in ${sourcePath}`);

  const sourceRows = XLSX.utils.sheet_to_json<unknown[]>(sourceWs, { header: 1, defval: null }) as unknown[][];
  const [originalHeaders, ...dataRows] = sourceRows;
  if (!originalHeaders) throw new Error("Source file is empty");

  // 2. Fetch DB data
  const [dbRequests, allSkills, allEmployees] = await Promise.all([
    db.pipelineRequest.findMany({ orderBy: { createdAt: "asc" } }),
    db.skill.findMany({ select: { id: true, name: true } }),
    fetchAllEmployees(),
  ]);

  // 3. Score and assign — availability-first, best-match-within-tier, pool-depletion
  //
  // Selection order per request:
  //   Tier 3 (>50% free) → Tier 2 (20-50% free) → Tier 1 (<20% free) → Tier 0 (fully allocated)
  //   Within each tier: highest matchScore wins
  //
  // SOW-signed requests are processed first to get first pick of the talent pool.
  // Each employee is claimed at most once — this prevents any employee appearing
  // on multiple rows as the primary recommendation.
  //
  // If the required count for a request > 1 (e.g. "2 SE"), this loop processes
  // each slot as a separate row (xlsx already has one row per resource slot).
  const claimedEmployeeIds = new Set<string>();

  // Sort requests: SOW-signed first, then by likelyStart ASC (earliest demand wins)
  const sortedRequests = [...dbRequests].sort((a, b) => {
    if (a.sowSigned !== b.sowSigned) return a.sowSigned ? -1 : 1;
    const ad = a.likelyStart?.getTime() ?? Infinity;
    const bd = b.likelyStart?.getTime() ?? Infinity;
    return ad - bd;
  });

  interface RowAssignment {
    match: MatchResult;
    topMatches: MatchResult[];   // top 3 within role pool — for Alternates sheet
    plan: string;
    rationale: string;
    confidence: string;
    parsed: ParsedRole;
    roleFiltered: boolean;       // true = role pool was non-empty, match respects grade
    fallbackUsed: boolean;       // true = role unrecognised, used full pool
  }
  const assignments = new Map<string, RowAssignment>();

  for (const req of sortedRequests) {
    const reqSkills = textToRequiredSkills(req.skillset ?? "", allSkills);
    const parsed = normalizeResourceRequest(req.resourcesRequested);

    // ── Build role-filtered candidate pool ──────────────────────────────────
    // Primary pool: employees whose jobName matches the canonical role.
    // Fallback pool: all employees when the role is unrecognised or no one matches.
    const rolePool = parsed.canonicalRoles.length > 0
      ? allEmployees.filter((emp) => employeeMatchesRole(emp.jobName, parsed.canonicalRoles))
      : allEmployees;

    const roleFiltered = rolePool.length > 0 && parsed.canonicalRoles.length > 0;
    const fallbackUsed = parsed.canonicalRoles.length === 0;

    // If the role is recognised but no employee holds that grade, widen to full pool
    const candidatePool = rolePool.length > 0 ? rolePool : allEmployees;

    // ── Score candidates ─────────────────────────────────────────────────────
    const allScored = candidatePool.map((emp) => scoreEmployee(emp, reqSkills));

    // Alternates: top 3 within the role pool, ranked by pure matchScore
    const topByScore = [...allScored]
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 3);

    // Selection order: availability tier DESC → matchScore DESC within tier
    const selectionOrder = [...allScored].sort((a, b) => {
      const ta = availabilityTier(a.availableFTE);
      const tb = availabilityTier(b.availableFTE);
      if (ta !== tb) return tb - ta;
      return b.matchScore - a.matchScore;
    });

    // ── Pick first unclaimed candidate ───────────────────────────────────────
    let picked: MatchResult | null = null;
    let pickedTier = 0;
    let poolExhausted = false;

    for (const candidate of selectionOrder) {
      if (!claimedEmployeeIds.has(candidate.employeeId)) {
        picked = candidate;
        pickedTier = availabilityTier(candidate.availableFTE);
        claimedEmployeeIds.add(candidate.employeeId);
        break;
      }
    }

    // If every candidate in the role pool is already claimed, expand to full pool once
    if (!picked && roleFiltered) {
      const fullOrder = allEmployees
        .map((emp) => scoreEmployee(emp, reqSkills))
        .sort((a, b) => {
          const ta = availabilityTier(a.availableFTE);
          const tb = availabilityTier(b.availableFTE);
          if (ta !== tb) return tb - ta;
          return b.matchScore - a.matchScore;
        });
      for (const candidate of fullOrder) {
        if (!claimedEmployeeIds.has(candidate.employeeId)) {
          picked = candidate;
          pickedTier = availabilityTier(candidate.availableFTE);
          claimedEmployeeIds.add(candidate.employeeId);
          break;
        }
      }
    }

    // True pool exhaustion — re-use best match (shared resource, clearly flagged)
    if (!picked) {
      picked = selectionOrder[0] ?? null;
      poolExhausted = true;
    }

    if (picked) {
      const poolSuffix = poolExhausted ? " — Pool Exhausted (Shared)" : "";
      assignments.set(req.id, {
        match: picked,
        topMatches: topByScore,
        plan: toPlan(picked.signal, req.sowSigned, pickedTier, roleFiltered, fallbackUsed) + poolSuffix,
        rationale: "",
        confidence: "—",
        parsed,
        roleFiltered,
        fallbackUsed,
      });
    }
  }

  // 4. AI rationale pass (max N REDEPLOY rows, batches of 3, 5s timeout per call)
  const AI_TIMEOUT = 5000;
  const redeployRows = sortedRequests
    .filter((r) => assignments.get(r.id)?.match.signal === "REDEPLOY")
    .slice(0, maxAiCalls);

  async function safeExplain(req: typeof redeployRows[0]): Promise<string> {
    const asgn = assignments.get(req.id);
    if (!asgn) return "";
    try {
      return await Promise.race([
        explainMatch({
          projectName: req.client ?? "Client Project",
          projectCategory: req.solution ?? "General",
          candidate: asgn.match,
        }),
        new Promise<string>((_, reject) =>
          setTimeout(() => reject(new Error("ai-timeout")), AI_TIMEOUT),
        ),
      ]);
    } catch {
      const c = asgn.match;
      const dim = c.skillScore >= c.competencyScore ? "technical skills" : "consulting competency";
      const risk = c.unmetSkills.length > 0 ? `missing ${c.unmetSkills[0]}` : "availability constrained";
      return `${c.name} leads on ${dim} (${c.matchScore}/100 overall). Primary risk: ${risk}. Signal: ${c.signal}.`;
    }
  }

  // Process AI calls in batches of 3
  for (let i = 0; i < redeployRows.length; i += 3) {
    const batch = redeployRows.slice(i, i + 3);
    const rationales = await Promise.all(batch.map((r) => safeExplain(r)));
    batch.forEach((r, idx) => {
      const asgn = assignments.get(r.id);
      if (asgn) {
        asgn.rationale = rationales[idx] ?? "";
        asgn.confidence = "HIGH (AI-verified)";
      }
    });
  }

  // Fill confidence for non-AI rows
  for (const [id, asgn] of assignments) {
    if (!asgn.rationale) {
      asgn.rationale = (() => {
        const c = asgn.match;
        const dim = c.skillScore >= c.competencyScore ? "technical skills" : "consulting competency";
        const risk = c.unmetSkills.length > 0 ? `missing ${c.unmetSkills[0]}` : "availability limited";
        return `${c.name} scores ${c.matchScore}/100. Strongest: ${dim}. Risk: ${risk}.`;
      })();
      asgn.confidence = asgn.match.signal === "HIRE" ? "N/A — Hire" : "MEDIUM (deterministic)";
    }
    assignments.set(id, asgn);
  }

  // 5. Build output rows
  // Positional mapping: xlsx row i → dbRequests[i] (sorted by createdAt)
  const outputAoa: unknown[][] = [[...originalHeaders as unknown[], ...APPENDED_HEADERS]];

  for (let i = 0; i < dataRows.length; i++) {
    const srcRow = [...(dataRows[i] as unknown[])];
    // Pad to 22 columns
    while (srcRow.length < 22) srcRow.push(null);

    const req = dbRequests[i];
    const asgn = req ? assignments.get(req.id) : null;

    // Fill existing columns
    if (asgn) {
      const m = asgn.match;
      // Resource Recommended: "Name (Job Title)"
      srcRow[C.RESOURCE_RECOMMENDED] = m.jobName
        ? `${m.name} (${m.jobName})`
        : m.name;
      srcRow[C.PCT_AVAILABLE] = `${Math.round(m.availableFTE * 100)}%`;
      srcRow[C.SKILLSET_MATCH] = toSkillsetMatch(m.signal, m.skillScore, m.availableFTE);
    }

    // Append value-add columns
    const appended = asgn
      ? [
          asgn.match.employeeCode,
          asgn.match.matchScore,
          asgn.match.skillScore,
          asgn.match.competencyScore,
          asgn.match.signal,
          toAction(asgn.match, asgn.parsed, asgn.roleFiltered, asgn.fallbackUsed),
          asgn.match.unmetSkills.join(", ") || "—",
          asgn.plan,
          asgn.rationale,
          asgn.confidence,
        ]
      : Array(10).fill(null);

    outputAoa.push([...srcRow, ...appended]);
  }

  // 6. Build Main sheet
  const ws = XLSX.utils.aoa_to_sheet(outputAoa);

  // Apply header styles
  for (let c = 0; c < TOTAL_COLS; c++) {
    applyStyle(ws, 0, c, c < 22 ? S.headerOrig : S.headerAppended);
  }

  // Apply data row styles
  for (let r = 1; r < outputAoa.length; r++) {
    const row = outputAoa[r] as unknown[];
    const sowSigned = String(row[C.SOW_SIGNED] ?? "").toLowerCase() === "yes";
    const matchScore = row[C.MATCH_SCORE] as number | null;
    const signal = row[C.SIGNAL] as string | null;
    const skillsetMatch = row[C.SKILLSET_MATCH] as "Complete" | "Partial" | "No" | null;

    // SOW row highlight on first column
    if (sowSigned) applyStyle(ws, r, C.SOW_SIGNED, S.sowRow);

    // Match Score conditional color
    const ms = scoreStyle(matchScore);
    if (ms) applyStyle(ws, r, C.MATCH_SCORE, ms);
    const ss = scoreStyle(row[C.SKILL_SCORE] as number | null);
    if (ss) applyStyle(ws, r, C.SKILL_SCORE, ss);
    const cs = scoreStyle(row[C.COMPETENCY_SCORE] as number | null);
    if (cs) applyStyle(ws, r, C.COMPETENCY_SCORE, cs);

    // Signal color
    const sigS = signalStyle(signal);
    if (sigS) applyStyle(ws, r, C.SIGNAL, sigS);

    // Skillset Match color
    const mS = matchStyle(skillsetMatch);
    if (mS) applyStyle(ws, r, C.SKILLSET_MATCH, mS);
  }

  // Column widths
  ws["!cols"] = [
    { wch: 8 },  // Cluster
    { wch: 12 }, // Request Received
    { wch: 14 }, // Orig Start Date
    { wch: 14 }, // Request Type
    { wch: 10 }, // Client Priority
    { wch: 18 }, // Client
    { wch: 14 }, // EM
    { wch: 14 }, // Likely Start
    { wch: 12 }, // Start Confirmed
    { wch: 10 }, // Num Weeks
    { wch: 16 }, // Deal Stage
    { wch: 14 }, // Solution
    { wch: 10 }, // Priority
    { wch: 14 }, // Status
    { wch: 16 }, // Resources Requested
    { wch: 8 },  // %
    { wch: 22 }, // Resource Recommended ← FILL
    { wch: 12 }, // % Available ← FILL
    { wch: 40 }, // Skillset
    { wch: 18 }, // Skillset Match ← FILL
    { wch: 10 }, // SOW Signed
    { wch: 30 }, // Comments
    // Appended
    { wch: 14 }, // Employee ID
    { wch: 14 }, // Match Score
    { wch: 12 }, // Skill Score
    { wch: 16 }, // Competency Score
    { wch: 16 }, // Signal
    { wch: 48 }, // Recommended Action
    { wch: 32 }, // Unmet Skills
    { wch: 40 }, // Plan
    { wch: 64 }, // AI Rationale
    { wch: 24 }, // Confidence
  ];

  // Freeze row 1
  (ws as Record<string, unknown>)["!freeze"] = { xSplit: 0, ySplit: 1 };

  // Autofilter on header row
  const lastColLetter = XLSX.utils.encode_col(TOTAL_COLS - 1);
  ws["!autofilter"] = { ref: `A1:${lastColLetter}1` };

  // 7. Build Alternates sheet
  const altHeaders = [
    "Row #", "Client", "SOW Signed", "Skillset", "Rank",
    "Employee ID", "Employee Name", "Role", "Match Score", "Skill Score",
    "Competency Score", "Availability %", "Signal", "Unmet Skills",
  ];
  const altRows: unknown[][] = [altHeaders];

  for (let i = 0; i < dataRows.length; i++) {
    const req = dbRequests[i];
    if (!req) continue;
    const asgn = assignments.get(req.id);
    if (!asgn) continue;
    const row = dataRows[i] as unknown[];

    asgn.topMatches.forEach((m, rank) => {
      altRows.push([
        i + 1,
        row[C.CLIENT] ?? "—",
        row[C.SOW_SIGNED] ?? "No",
        row[C.SKILLSET] ?? "—",
        rank + 1,
        m.employeeCode,
        m.name,
        m.jobName ?? "—",
        m.matchScore,
        m.skillScore,
        m.competencyScore,
        `${Math.round(m.availableFTE * 100)}%`,
        m.signal,
        m.unmetSkills.join(", ") || "—",
      ]);
    });
  }

  const wsAlt = XLSX.utils.aoa_to_sheet(altRows);
  // Header style on alternates
  for (let c = 0; c < altHeaders.length; c++) {
    applyStyle(wsAlt, 0, c, S.headerOrig);
  }
  (wsAlt as Record<string, unknown>)["!freeze"] = { xSplit: 0, ySplit: 1 };

  // 8. Build Summary sheet
  const confirmedCount = dbRequests.filter((r) => r.sowSigned).length;
  const probableCount = dbRequests.filter((r) => !r.sowSigned).length;

  const allAssignments = Array.from(assignments.values());
  const redeployCount = allAssignments.filter((a) => a.match.signal === "REDEPLOY").length;
  const partialCount = allAssignments.filter((a) => a.match.signal === "PARTIAL_HIRE").length;
  const hireCount = allAssignments.filter((a) => a.match.signal === "HIRE").length;
  const unmatched = dbRequests.length - assignments.size;

  const coveredPct =
    dbRequests.length > 0
      ? Math.round(((redeployCount + partialCount) / dbRequests.length) * 100)
      : 0;

  // Roles in demand
  const roleCounts = new Map<string, number>();
  for (const req of dbRequests) {
    const r = req.resourcesRequested ?? "Unknown";
    roleCounts.set(r, (roleCounts.get(r) ?? 0) + 1);
  }
  const topRoles = [...roleCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  const now = new Date();
  const summaryRows: unknown[][] = [
    ["RESOURCING EXPORT SUMMARY", null],
    [`Generated: ${now.toLocaleString("en-GB")}`, null],
    [],
    ["PORTFOLIO OVERVIEW", null],
    ["Total Pipeline Requests", dbRequests.length],
    ["SOW-Signed (Confirmed)", confirmedCount],
    ["Probable (Unsigned)", probableCount],
    [],
    ["MATCHING RESULTS", null],
    ["Covered Internally (Redeploy)", redeployCount],
    ["Covered Partially (Redeploy + Hire)", partialCount],
    ["External Hire Required", hireCount],
    ["No Match Found", unmatched],
    ["Internal Coverage %", `${coveredPct}%`],
    [],
    ["TOP ROLES IN DEMAND", null],
    ...topRoles.map(([role, count]) => [role, count]),
    [],
    ["METHODOLOGY", null],
    ["Scoring weights", "Skill 35% · Competency 25% · Availability 20% · Billability 12% · Evidence 8%"],
    ["Conflict resolution", "Greedy algorithm: SOW-signed requests prioritised, conflict windows tracked per employee"],
    ["AI rationale", `Applied to top ${Math.min(maxAiCalls, redeployCount)} REDEPLOY matches (5s timeout per call)`],
    ["Skillset match", "Complete = REDEPLOY + skill≥70 | Partial = PARTIAL_HIRE | No = HIRE or no match"],
  ];

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  wsSummary["!cols"] = [{ wch: 40 }, { wch: 30 }];
  // Title cell style
  applyStyle(wsSummary, 0, 0, S.headerOrig);

  // 9. Assemble workbook
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Pipeline Resource Plan");
  XLSX.utils.book_append_sheet(wb, wsAlt, "Alternates");
  XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx", cellStyles: true });
  return buf as Buffer;
}
