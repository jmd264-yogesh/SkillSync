/**
 * ETL Ingestion — Resourcing CoLab
 * Reads 8 reference files from ./reference_files/ and loads into Postgres via Prisma.
 * Idempotent: uses upsert everywhere. Logs an IngestReport row per file.
 *
 * Run: npx tsx scripts/etl/ingest.ts
 */

import path from "path";
import fs from "fs";
import { parse } from "csv-parse/sync";
import * as XLSX from "xlsx";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const DATA_DIR = path.resolve(process.cwd(), "reference_files");

interface IngestStats {
  loaded: number;
  dropped: number;
  coerced: number;
  unmapped: number;
  notes: string[];
}

function emptyStats(): IngestStats {
  return { loaded: 0, dropped: 0, coerced: 0, unmapped: 0, notes: [] };
}

function parseDate(raw: unknown): Date | null {
  if (!raw) return null;
  const d = new Date(String(raw));
  return isNaN(d.getTime()) ? null : d;
}

function parseFloat_(raw: unknown): number {
  const v = parseFloat(String(raw));
  return isNaN(v) ? 0 : v;
}

function parseBool(raw: unknown): boolean {
  if (raw === null || raw === undefined) return false;
  const s = String(raw).trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes" || s === "y";
}

function readCsv(filename: string): Record<string, unknown>[] {
  const fullPath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(fullPath)) {
    console.warn(`  [SKIP] File not found: ${filename}`);
    return [];
  }
  const content = fs.readFileSync(fullPath, "utf-8");
  return parse(content, { columns: true, skip_empty_lines: true, trim: true }) as Record<string, unknown>[];
}

function readXlsx(filename: string): Record<string, unknown>[] {
  const fullPath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(fullPath)) {
    console.warn(`  [SKIP] File not found: ${filename}`);
    return [];
  }
  const wb = XLSX.readFile(fullPath);
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return [];
  const ws = wb.Sheets[sheetName];
  if (!ws) return [];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null });
}

// ─── File 01: employee_details ───────────────────────────────
async function ingestEmployees(): Promise<IngestStats> {
  const rows = readCsv("01. 260624 employee_details.csv");
  const stats = emptyStats();

  for (const row of rows) {
    // SCD-2: skip non-active versions
    if (String(row["is_active_version"]) !== "1") {
      stats.dropped++;
      continue;
    }

    const externalId = String(row["employee_id"] ?? "").trim();
    if (!externalId) { stats.dropped++; continue; }

    const dateOfJoin = parseDate(row["date_of_join"]);
    const dateOfResignation = parseDate(row["date_of_resignation"]);
    const jobName = String(row["job_name"] ?? "").trim() || null;
    const department = String(row["department_name"] ?? "").trim() || null;
    const location = String(row["location"] ?? "").trim() || null;

    // Upsert by externalId; create stub if no matching Employee found yet
    await db.employee.upsert({
      where: { externalId },
      update: { jobName, department, location, dateOfJoin, dateOfResignation },
      create: {
        externalId,
        employeeCode: externalId,
        name: jobName ?? externalId,
        email: `${externalId.toLowerCase()}@placeholder.local`,
        jobName,
        department,
        location,
        dateOfJoin,
        dateOfResignation,
      },
    });
    stats.loaded++;
  }
  return stats;
}

// ─── File 02: project_details ────────────────────────────────
const PROJECT_CATEGORY_MAP: Record<string, string> = {
  "discovery & design": "D_AND_D",
  "d&d": "D_AND_D",
  "tactical build": "TACTICAL_BUILD",
  "data platform build": "DATA_PLATFORM_BUILD",
  "enterprise build": "ENTERPRISE_BUILD",
  "data science": "DATA_SCIENCE",
  "ai project": "AI_PROJECT",
  "ms project": "MS_PROJECT",
  "full stack": "FULL_STACK",
  "value creation": "VALUE_CREATION",
};

function mapCategory(raw: string): { category: string; unmapped: boolean } {
  const key = raw.toLowerCase().trim();
  const mapped = PROJECT_CATEGORY_MAP[key];
  if (mapped) return { category: mapped, unmapped: false };
  // partial match
  for (const [k, v] of Object.entries(PROJECT_CATEGORY_MAP)) {
    if (key.includes(k) || k.includes(key)) return { category: v, unmapped: false };
  }
  return { category: "OTHER", unmapped: true };
}

async function ingestProjects(): Promise<IngestStats> {
  const rows = readCsv("02. 260624 project_details.csv");
  const stats = emptyStats();

  for (const row of rows) {
    if (String(row["is_active_version"]) !== "1") { stats.dropped++; continue; }

    const externalId = String(row["project_id"] ?? "").trim();
    if (!externalId) { stats.dropped++; continue; }

    const typeRaw = String(row["type_of_project"] ?? "").trim();
    const { category, unmapped } = mapCategory(typeRaw);
    if (unmapped) {
      stats.unmapped++;
      stats.notes.push(`Unmapped project type: "${typeRaw}" → OTHER`);
    }

    const startDate = parseDate(row["project_start_date"]);
    const endDate = parseDate(row["project_end_date"]);
    const techCoe = String(row["tech_coe"] ?? "").trim() || null;
    const propositionCoe = String(row["proposition_coe"] ?? "").trim() || null;
    const clientId = String(row["CLIENT_ID"] ?? "").trim() || null;
    const statusRaw = String(row["project_status"] ?? "").toUpperCase().trim();
    const status = ["PLANNING", "ACTIVE", "COMPLETED", "ON_HOLD"].includes(statusRaw)
      ? statusRaw as "PLANNING" | "ACTIVE" | "COMPLETED" | "ON_HOLD"
      : "ACTIVE";

    await db.project.upsert({
      where: { externalId },
      update: { category: category as never, status, techCoe, propositionCoe, clientId, startDate, endDate, plannedEndDate: endDate },
      create: {
        externalId,
        name: externalId,
        category: category as never,
        status,
        techCoe,
        propositionCoe,
        clientId,
        startDate,
        endDate,
        plannedEndDate: endDate,
      },
    });
    stats.loaded++;
  }
  return stats;
}

// ─── File 03: Project_Allocation_Details ─────────────────────
async function ingestAllocations(): Promise<IngestStats> {
  const rows = readCsv("03. 260623_Project_Allocation_Details.csv");
  const stats = emptyStats();

  for (const row of rows) {
    if (String(row["is_active_version"]) !== "1") { stats.dropped++; continue; }

    const externalId = String(row["project_rolebased_user_id"] ?? "").trim();
    const projectExtId = String(row["project_id"] ?? "").trim();
    const employeeExtId = String(row["employee_id"] ?? "").trim();
    if (!externalId || !projectExtId || !employeeExtId) { stats.dropped++; continue; }

    const project = await db.project.findUnique({ where: { externalId: projectExtId } });
    const employee = await db.employee.findUnique({ where: { externalId: employeeExtId } });
    if (!project || !employee) { stats.dropped++; continue; }

    const allocation = parseFloat_(row["allocation_by_percentage"]);
    const resourcingStatus = String(row["resourcing_status"] ?? "").trim() || null;
    const startDate = parseDate(row["allocated_start_date"]);
    const endDate = parseDate(row["allocated_end_date"]);
    const isActive = String(row["is_allocation_active"]) === "1";
    if (!isActive) { stats.dropped++; continue; }

    await db.projectAllocation.upsert({
      where: { externalId },
      update: { allocation, resourcingStatus, startDate, endDate },
      create: {
        externalId,
        projectId: project.id,
        employeeId: employee.id,
        allocation,
        resourcingStatus,
        startDate,
        endDate,
      },
    });
    stats.loaded++;
  }
  return stats;
}

// ─── File 04: timesheet_details_2026 ─────────────────────────
async function ingestTimesheets(): Promise<IngestStats> {
  const rows = readCsv("04. 260624 timesheet_details_2026.csv");
  const stats = emptyStats();

  for (const row of rows) {
    const externalKey = String(row["timesheet_surrogate_key"] ?? "").trim();
    const employeeExtId = String(row["employee_id"] ?? "").trim();
    const projectExtId = String(row["project_id"] ?? "").trim();
    if (!externalKey || !employeeExtId) { stats.dropped++; continue; }

    const employee = await db.employee.findUnique({ where: { externalId: employeeExtId } });
    if (!employee) { stats.dropped++; continue; }

    const project = projectExtId
      ? await db.project.findUnique({ where: { externalId: projectExtId } })
      : null;

    // Coerce is_billable float (null/NaN → false, logged)
    let isBillable = false;
    if (row["is_billable"] === null || row["is_billable"] === undefined || row["is_billable"] === "") {
      stats.coerced++;
    } else {
      isBillable = parseBool(row["is_billable"]);
    }

    const hours = parseFloat_(row["time"]);
    const date = parseDate(row["date"]);
    if (!date) { stats.dropped++; continue; }

    const status = String(row["status"] ?? "").trim() || null;

    await db.timesheet.upsert({
      where: { externalKey },
      update: { isBillable, hours, date, status, projectId: project?.id ?? null },
      create: {
        externalKey,
        employeeId: employee.id,
        projectId: project?.id ?? null,
        isBillable,
        hours,
        date,
        status,
      },
    });
    stats.loaded++;
  }
  return stats;
}

// ─── File 05: Skill_Data.xlsx ─────────────────────────────────
async function ingestSkillData(): Promise<IngestStats> {
  const rows = readXlsx("05. 260624 Skill_Data.xlsx");
  const stats = emptyStats();

  for (const row of rows) {
    const employeeExtId = String(row["employee_id"] ?? "").trim();
    if (!employeeExtId) { stats.dropped++; continue; }

    const employee = await db.employee.findUnique({ where: { externalId: employeeExtId } });
    if (!employee) { stats.dropped++; continue; }

    // Update designation/COE from skill data if not set
    const designationName = String(row["Designation"] ?? "").trim() || null;
    const coeName = String(row["COE"] ?? "").trim() || null;

    if (designationName && !employee.designationId) {
      const designation = await db.designation.findFirst({ where: { name: designationName } });
      if (designation) {
        await db.employee.update({ where: { id: employee.id }, data: { designationId: designation.id } });
      }
    }
    if (coeName && !employee.coeId) {
      const coe = await db.coe.findFirst({ where: { name: coeName } });
      if (coe) {
        await db.employee.update({ where: { id: employee.id }, data: { coeId: coe.id } });
      }
    }

    const skillName = String(row["Skill"] ?? "").trim();
    if (!skillName) { stats.dropped++; continue; }
    const experience = String(row["Experience"] ?? "").trim() || null;
    const score = parseInt(String(row["Score"] ?? "0"), 10) || 0;

    // Upsert skill into the catalog
    const skill = await db.skill.upsert({
      where: { name: skillName },
      update: {},
      create: { name: skillName, category: "SKILL" },
    });

    // Upsert employee skill (approved if score > 0, pending otherwise)
    await db.employeeSkill.upsert({
      where: { employeeId_skillId: { employeeId: employee.id, skillId: skill.id } },
      update: { validatedLevel: score, selfAssessedLevel: score, status: score > 0 ? "APPROVED" : "PENDING" },
      create: {
        employeeId: employee.id,
        skillId: skill.id,
        selfAssessedLevel: score,
        validatedLevel: score > 0 ? score : null,
        status: score > 0 ? "APPROVED" : "PENDING",
      },
    });
    stats.loaded++;
  }
  return stats;
}

// ─── File 06: Competency_Details.xlsx ────────────────────────
// Wide → long: 5 behaviour columns, each with a Score.N column
const BEHAVIOUR_COLS = [
  { label: "Stakeholder Management", scoreKey: "Score" },
  { label: "Advisory",              scoreKey: "Score.1" },
  { label: "Techno-Functional",     scoreKey: "Score.2" },
  { label: "Communication",         scoreKey: "Score.3" },
  { label: "Ambiguity Navigation",  scoreKey: "Score.4" },
] as const;

async function ingestCompetencies(): Promise<IngestStats> {
  const rows = readXlsx("06. 260623_Competency_Details.xlsx");
  const stats = emptyStats();

  for (const row of rows) {
    const employeeExtId = String(row["Employee ID"] ?? "").trim();
    if (!employeeExtId) { stats.dropped++; continue; }

    const employee = await db.employee.findUnique({ where: { externalId: employeeExtId } });
    if (!employee) { stats.dropped++; continue; }

    for (const { label, scoreKey } of BEHAVIOUR_COLS) {
      const score = parseInt(String(row[scoreKey] ?? "0"), 10) || 0;
      await db.competency.upsert({
        where: { employeeId_behaviour: { employeeId: employee.id, behaviour: label } },
        update: { score },
        create: { employeeId: employee.id, behaviour: label, score },
      });
      stats.loaded++;
    }
  }
  return stats;
}

// ─── File 07: Pipeline_Details.xlsx ──────────────────────────
async function ingestPipeline(): Promise<IngestStats> {
  const rows = readXlsx("07. 260624_Pipeline_Details.xlsx");
  const stats = emptyStats();

  for (const row of rows) {
    const cluster = row["Cluster"] != null ? parseInt(String(row["Cluster"]), 10) : null;
    const likelyStart = parseDate(row["Likely Start Date"]);
    const numberOfWeeks = row["Number of Weeks"] != null ? parseFloat_(row["Number of Weeks"]) : null;

    // SOW Signed: parse "Yes"/"No"/null
    const sowRaw = String(row["SOW Signed"] ?? "").toLowerCase().trim();
    const sowSigned = sowRaw === "yes" || sowRaw === "true" || sowRaw === "1";

    const dealStageRaw = row["Deal Stage\n(HubSpot)"] ?? row["Deal Stage (HubSpot)"] ?? row["Deal Stage"] ?? null;

    await db.pipelineRequest.create({
      data: {
        cluster: cluster ?? undefined,
        client: String(row["Client"] ?? "").trim() || null,
        requestType: String(row["Request Type"] ?? "").trim() || null,
        clientPriority: String(row["Client Priority"] ?? "").trim() || null,
        likelyStart,
        numberOfWeeks,
        dealStage: dealStageRaw != null ? String(dealStageRaw).trim() : null,
        solution: String(row["Solution"] ?? "").trim() || null,
        resourcesRequested: String(row["Resources Requested"] ?? "").trim() || null,
        resourceRecommended: row["Resource Recommended"] != null ? parseFloat_(row["Resource Recommended"]) : null,
        percentAvailable: row["% Available"] != null ? parseFloat_(row["% Available"]) : null,
        skillset: String(row["Skillset"] ?? "").trim() || null,
        skillsetMatch: String(row["Skillset Match (Complete / Partial / No)"] ?? "").trim() || null,
        sowSigned,
        status: String(row["Status"] ?? "").trim() || null,
        comments: String(row["Comments"] ?? "").trim() || null,
      },
    });
    stats.loaded++;
  }
  return stats;
}

// ─── File 09: Project_Weekly_Status_Details ───────────────────
async function ingestWeeklyStatus(): Promise<IngestStats> {
  const rows = readCsv("09. 260624_Project_Weekly_Status_Details.csv");
  const stats = emptyStats();

  for (const row of rows) {
    const externalKey = String(row["wsr_key"] ?? "").trim();
    const projectExtId = String(row["project_id_masked"] ?? "").trim();
    if (!externalKey || !projectExtId) { stats.dropped++; continue; }

    const project = await db.project.findUnique({ where: { externalId: projectExtId } });
    if (!project) { stats.dropped++; continue; }

    const weekStart = parseDate(row["week_start_date"]);
    const weekEnd = parseDate(row["week_end_date"]);
    if (!weekStart || !weekEnd) { stats.dropped++; continue; }

    await db.weeklyStatus.upsert({
      where: { externalKey },
      update: {
        scopeStatus: String(row["scope_status"] ?? "").trim() || null,
        scheduleStatus: String(row["schedule_status"] ?? "").trim() || null,
        qualityStatus: String(row["quality_status"] ?? "").trim() || null,
        csatStatus: String(row["csat_status"] ?? "").trim() || null,
        teamStatus: String(row["team_status"] ?? "").trim() || null,
      },
      create: {
        externalKey,
        projectId: project.id,
        weekStart,
        weekEnd,
        scopeStatus: String(row["scope_status"] ?? "").trim() || null,
        scheduleStatus: String(row["schedule_status"] ?? "").trim() || null,
        qualityStatus: String(row["quality_status"] ?? "").trim() || null,
        csatStatus: String(row["csat_status"] ?? "").trim() || null,
        teamStatus: String(row["team_status"] ?? "").trim() || null,
      },
    });
    stats.loaded++;
  }
  return stats;
}

// ─── Derived: UtilisationSnapshot from timesheets ────────────
async function deriveUtilisation(): Promise<IngestStats> {
  const stats = emptyStats();

  // Fetch all timesheets and group by (employeeId, week)
  const timesheets = await db.timesheet.findMany({ select: { employeeId: true, date: true, hours: true, isBillable: true } });

  const grouped = new Map<string, { total: number; billable: number }>();
  for (const ts of timesheets) {
    // ISO week Monday
    const d = new Date(ts.date);
    const day = d.getDay(); // 0=Sun
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    const key = `${ts.employeeId}__${monday.toISOString()}`;
    const existing = grouped.get(key) ?? { total: 0, billable: 0 };
    existing.total += ts.hours;
    if (ts.isBillable) existing.billable += ts.hours;
    grouped.set(key, existing);
  }

  for (const [key, { total, billable }] of grouped) {
    const parts = key.split("__");
    const employeeId = parts[0];
    const weekStartIso = parts[1];
    if (!employeeId || !weekStartIso) continue;
    const weekStart = new Date(weekStartIso);
    const capacity = 40;
    const utilisation = Math.min(total / capacity, 1.5);
    const billableUtil = total > 0 ? billable / total : 0;

    await db.utilisationSnapshot.upsert({
      where: { employeeId_weekStart: { employeeId, weekStart } },
      update: { totalHours: total, billableHours: billable, utilisation, billableUtil },
      create: { employeeId, weekStart, totalHours: total, billableHours: billable, utilisation, billableUtil },
    });
    stats.loaded++;
  }
  return stats;
}

// ─── Derived: ShadowFlags — SHADOW & GHOST ───────────────────
async function deriveShadowFlags(): Promise<IngestStats> {
  const stats = emptyStats();

  // Clear existing flags before re-deriving
  await db.shadowFlag.deleteMany({});

  const allocations = await db.projectAllocation.findMany({ select: { employeeId: true, projectId: true } });
  const allocatedSet = new Set(allocations.map((a) => `${a.employeeId}__${a.projectId}`));

  // Timesheets grouped by (employeeId, projectId)
  const tsGroups = await db.timesheet.groupBy({
    by: ["employeeId", "projectId"],
    _sum: { hours: true },
    where: { projectId: { not: null } },
  });

  const now = new Date();

  for (const grp of tsGroups) {
    if (!grp.projectId) continue;
    const key = `${grp.employeeId}__${grp.projectId}`;
    if (!allocatedSet.has(key)) {
      // SHADOW: logging time but no allocation record
      await db.shadowFlag.create({
        data: {
          employeeId: grp.employeeId,
          projectId: grp.projectId,
          flagType: "SHADOW",
          detectedAt: now,
          hours: grp._sum.hours ?? 0,
        },
      });
      stats.loaded++;
    }
  }

  const workingSet = new Set(tsGroups.filter((g) => g.projectId).map((g) => `${g.employeeId}__${g.projectId}`));
  for (const alloc of allocations) {
    const key = `${alloc.employeeId}__${alloc.projectId}`;
    if (!workingSet.has(key)) {
      // GHOST: allocated but logging no time
      await db.shadowFlag.create({
        data: {
          employeeId: alloc.employeeId,
          projectId: alloc.projectId,
          flagType: "GHOST",
          detectedAt: now,
          hours: 0,
        },
      });
      stats.loaded++;
    }
  }
  return stats;
}

// ─── Derived: RoleMixTemplate from allocations + employees ───
async function deriveRoleMix(): Promise<IngestStats> {
  const stats = emptyStats();

  const allocs = await db.projectAllocation.findMany({
    include: { employee: { select: { jobName: true } }, project: { select: { category: true, status: true } } },
  });

  // Average allocation by (category, jobName) over completed projects
  const map = new Map<string, { sum: number; count: number }>();
  for (const a of allocs) {
    if (a.project.status !== "COMPLETED") continue;
    const role = a.employee.jobName ?? "Unknown";
    const key = `${a.project.category}__${role}`;
    const existing = map.get(key) ?? { sum: 0, count: 0 };
    existing.sum += a.allocation / 100;
    existing.count++;
    map.set(key, existing);
  }

  for (const [key, { sum, count }] of map) {
    const parts = key.split("__");
    const category = parts[0];
    const role = parts[1];
    if (!category || !role) continue;
    const fte = sum / count;
    await db.roleMixTemplate.upsert({
      where: { category_role: { category: category as never, role } },
      update: { fte, source: "DERIVED" },
      create: { category: category as never, role, fte, source: "DERIVED" },
    });
    stats.loaded++;
  }

  // Seed D&D from blueprint spec if no derived data
  const dandCount = await db.roleMixTemplate.count({ where: { category: "D_AND_D" } });
  if (dandCount === 0) {
    const assumed = [
      { role: "Business Analyst", fte: 0.5 },
      { role: "Solution Architect", fte: 0.25 },
      { role: "Delivery Manager", fte: 0.25 },
    ];
    for (const { role, fte } of assumed) {
      await db.roleMixTemplate.upsert({
        where: { category_role: { category: "D_AND_D", role } },
        update: {},
        create: { category: "D_AND_D", role, fte, source: "ASSUMED" },
      });
      stats.loaded++;
      stats.notes.push(`Assumed D&D role mix: ${role} = ${fte} FTE`);
    }
  }
  return stats;
}

// ─── Orchestrator ─────────────────────────────────────────────
async function run() {
  console.log("=== Resourcing CoLab ETL ===\n");
  const runAt = new Date();

  const steps: Array<{ name: string; fn: () => Promise<IngestStats> }> = [
    { name: "01_employees",       fn: ingestEmployees },
    { name: "02_projects",        fn: ingestProjects },
    { name: "03_allocations",     fn: ingestAllocations },
    { name: "04_timesheets",      fn: ingestTimesheets },
    { name: "05_skill_data",      fn: ingestSkillData },
    { name: "06_competencies",    fn: ingestCompetencies },
    { name: "07_pipeline",        fn: ingestPipeline },
    { name: "09_weekly_status",   fn: ingestWeeklyStatus },
    { name: "derived_utilisation",fn: deriveUtilisation },
    { name: "derived_shadow",     fn: deriveShadowFlags },
    { name: "derived_role_mix",   fn: deriveRoleMix },
  ];

  for (const step of steps) {
    console.log(`▶ ${step.name}`);
    try {
      const stats = await step.fn();
      console.log(`  ✓ loaded=${stats.loaded} dropped=${stats.dropped} coerced=${stats.coerced} unmapped=${stats.unmapped}`);
      if (stats.notes.length) stats.notes.forEach((n) => console.log(`    note: ${n}`));

      await db.ingestReport.create({
        data: {
          runAt,
          fileName: step.name,
          rowsLoaded: stats.loaded,
          rowsDropped: stats.dropped,
          nullsCoerced: stats.coerced,
          unmappedValues: stats.unmapped,
          notes: stats.notes.join("; ") || null,
        },
      });
    } catch (err) {
      console.error(`  ✗ ${step.name} failed:`, err);
    }
  }

  console.log("\n=== ETL complete ===");
  await db.$disconnect();
}

run().catch((e) => { console.error(e); process.exit(1); });
