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
import { PrismaClient, Prisma } from "@prisma/client";

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
  if (isNaN(d.getTime())) return null;
  // Reject Excel serial-number artifacts that parse to absurd years
  if (d.getFullYear() < 1900 || d.getFullYear() > 2100) return null;
  return d;
}

function parseFloat_(raw: unknown): number {
  const v = parseFloat(String(raw));
  return isNaN(v) ? 0 : v;
}

// ─── Parse experience text from File 05 ─────────────────────────────────────
// Handles: "5 Years", "3-5 Years", "< 1 Year", "10+ Years", "2 to 4 years"
function parseExperienceYears(raw: unknown): number {
  if (!raw) return 0;
  const clean = String(raw).toLowerCase().trim();
  if (!clean) return 0;
  if (clean.includes("<") || clean.includes("less")) return 0.5;
  const plusMatch = clean.match(/(\d+)\s*\+/);
  if (plusMatch?.[1]) return parseInt(plusMatch[1]) + 1;
  const rangeMatch = clean.match(/(\d+)\s*[-–to]+\s*(\d+)/);
  if (rangeMatch?.[1] && rangeMatch?.[2]) {
    return (parseInt(rangeMatch[1]) + parseInt(rangeMatch[2])) / 2;
  }
  const simpleMatch = clean.match(/(\d+(?:\.\d+)?)/);
  if (simpleMatch?.[1]) return parseFloat(simpleMatch[1]);
  return 0;
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

  // Collect manager links for second pass (all employees must exist first)
  const managerLinks: Array<{ empExtId: string; mgrExtId: string }> = [];

  for (const row of rows) {
    // SCD-2: skip non-active versions
    if (String(row["is_active_version"]) !== "1") {
      stats.dropped++;
      continue;
    }

    const externalId = String(row["employee_id"] ?? "").trim();
    if (!externalId) { stats.dropped++; continue; }

    // Collect manager relationship (linked in second pass to avoid forward-reference failures)
    const mgrExtId = String(row["manager_id"] ?? "").trim() || null;
    if (mgrExtId && mgrExtId !== externalId) {
      managerLinks.push({ empExtId: externalId, mgrExtId });
    }

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

  // Second pass: link manager chains now that all employees are in the DB
  let managerLinked = 0;
  for (const { empExtId, mgrExtId } of managerLinks) {
    const emp = await db.employee.findUnique({ where: { externalId: empExtId }, select: { id: true } });
    const mgr = await db.employee.findUnique({ where: { externalId: mgrExtId }, select: { id: true } });
    if (emp && mgr) {
      await db.employee.update({ where: { id: emp.id }, data: { managerId: mgr.id } });
      managerLinked++;
    }
  }
  if (managerLinked > 0) stats.notes.push(`Linked ${managerLinked} manager chains`);

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
  "client project": "TACTICAL_BUILD",
  "internal project": "VALUE_CREATION",
  "managed services": "MS_PROJECT",
  "bau activity": "VALUE_CREATION",
  "sales activity": "VALUE_CREATION",
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

  // Pre-aggregate: an employee may appear on the same project with multiple rows
  // (different roles). Sum allocations; take earliest start / latest end.
  type AggKey = string; // `${projectExtId}__${employeeExtId}`
  const agg = new Map<AggKey, {
    projectExtId: string;
    employeeExtId: string;
    allocation: number;
    resourcingStatus: string | null;
    startDate: Date | null;
    endDate: Date | null;
  }>();

  for (const row of rows) {
    if (String(row["is_active_version"]) !== "1") { stats.dropped++; continue; }
    const isActive = String(row["is_allocation_active"]) === "1";
    if (!isActive) { stats.dropped++; continue; }

    const projectExtId = String(row["project_id"] ?? "").trim();
    const employeeExtId = String(row["employee_id"] ?? "").trim();
    if (!projectExtId || !employeeExtId) { stats.dropped++; continue; }

    const key: AggKey = `${projectExtId}__${employeeExtId}`;
    const alloc = parseFloat_(row["allocation_by_percentage"]);
    const resourcingStatus = String(row["resourcing_status"] ?? "").trim() || null;
    const startDate = parseDate(row["allocated_start_date"]);
    const endDate = parseDate(row["allocated_end_date"]);

    const existing = agg.get(key);
    if (existing) {
      existing.allocation = Math.min(existing.allocation + alloc, 100);
      if (startDate && (!existing.startDate || startDate < existing.startDate)) existing.startDate = startDate;
      if (endDate && (!existing.endDate || endDate > existing.endDate)) existing.endDate = endDate;
    } else {
      agg.set(key, { projectExtId, employeeExtId, allocation: alloc, resourcingStatus, startDate, endDate });
    }
  }

  for (const { projectExtId, employeeExtId, allocation, resourcingStatus, startDate, endDate } of agg.values()) {
    const project = await db.project.findUnique({ where: { externalId: projectExtId } });
    // Fetch jobName so we can populate allocation.role — the best available proxy
    // for the role the employee played on this project (project_rolebased_user_id
    // from File 03 encodes the role but has no accompanying mapping table).
    const employee = await db.employee.findUnique({
      where: { externalId: employeeExtId },
      select: { id: true, jobName: true },
    });
    if (!project || !employee) { stats.dropped++; continue; }

    const role = employee.jobName ?? null;

    await db.projectAllocation.upsert({
      where: { projectId_employeeId: { projectId: project.id, employeeId: employee.id } },
      update: { allocation, resourcingStatus, startDate, endDate, role },
      create: {
        projectId: project.id,
        employeeId: employee.id,
        allocation,
        role,
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

  // Build lookup maps once (avoid N+1 per row on a 600k-row file)
  const employeeMap = new Map<string, string>(); // externalId → internalId
  const projectMap = new Map<string, string>();
  (await db.employee.findMany({ select: { id: true, externalId: true } }))
    .forEach((e) => { if (e.externalId) employeeMap.set(e.externalId, e.id); });
  (await db.project.findMany({ select: { id: true, externalId: true } }))
    .forEach((p) => { if (p.externalId) projectMap.set(p.externalId, p.id); });

  // Truncate for idempotency (upsert-per-row on 600k rows would take hours in SQLite)
  await db.timesheet.deleteMany({});

  const BATCH = 500;
  type TsRow = Prisma.TimesheetCreateManyInput;
  let batch: TsRow[] = [];

  const flush = async () => {
    if (batch.length === 0) return;
    await db.timesheet.createMany({ data: batch });
    stats.loaded += batch.length;
    batch = [];
  };

  for (const row of rows) {
    const externalKey = String(row["timesheet_surrogate_key"] ?? "").trim();
    const employeeExtId = String(row["employee_id"] ?? "").trim();
    const projectExtId = String(row["project_id"] ?? "").trim();
    if (!externalKey || !employeeExtId) { stats.dropped++; continue; }

    const employeeId = employeeMap.get(employeeExtId);
    if (!employeeId) { stats.dropped++; continue; }

    const projectId = projectExtId ? (projectMap.get(projectExtId) ?? null) : null;

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

    batch.push({ externalKey, employeeId, projectId, isBillable, hours, date, status });
    if (batch.length >= BATCH) await flush();
  }
  await flush();
  return stats;
}

// ─── File 05: Skill_Data.xlsx ─────────────────────────────────
async function ingestSkillData(): Promise<IngestStats> {
  const rows = readXlsx("05. 260624 Skill_Data.xlsx");
  const stats = emptyStats();

  // Build all lookup maps upfront — eliminates N+1 for every row
  const employeeMap = new Map<string, { id: string; designationId: string | null; coeId: string | null }>();
  (await db.employee.findMany({ select: { id: true, externalId: true, designationId: true, coeId: true } }))
    .forEach((e) => { if (e.externalId) employeeMap.set(e.externalId, e); });

  const designationMap = new Map<string, string>(); // name → id
  (await db.designation.findMany({ select: { id: true, name: true } }))
    .forEach((d) => designationMap.set(d.name, d.id));

  const coeMap = new Map<string, string>(); // name → id
  (await db.coe.findMany({ select: { id: true, name: true } }))
    .forEach((c) => coeMap.set(c.name, c.id));

  const skillMap = new Map<string, string>(); // name → id (populated as we go)
  (await db.skill.findMany({ select: { id: true, name: true } }))
    .forEach((s) => skillMap.set(s.name, s.id));

  // First pass: collect all unique skill names that don't exist yet, bulk create them
  const newSkillNames = new Set<string>();
  for (const row of rows) {
    const skillName = String(row["Skill"] ?? "").trim();
    if (skillName && !skillMap.has(skillName)) newSkillNames.add(skillName);
  }
  if (newSkillNames.size > 0) {
    await db.skill.createMany({
      data: [...newSkillNames].map((name) => ({ name, category: "SKILL" as const })),
    });
    (await db.skill.findMany({ where: { name: { in: [...newSkillNames] } }, select: { id: true, name: true } }))
      .forEach((s) => skillMap.set(s.name, s.id));
  }

  // Second pass: collect employee→designation/COE updates needed
  const empDesignationUpdates = new Map<string, string>(); // empId → designationId
  const empCoeUpdates = new Map<string, string>();
  for (const row of rows) {
    const employeeExtId = String(row["employee_id"] ?? "").trim();
    const emp = employeeMap.get(employeeExtId);
    if (!emp) continue;
    const designationName = String(row["Designation"] ?? "").trim();
    const coeName = String(row["COE"] ?? "").trim();
    if (designationName && !emp.designationId) {
      const did = designationMap.get(designationName);
      if (did) { empDesignationUpdates.set(emp.id, did); emp.designationId = did; }
    }
    if (coeName && !emp.coeId) {
      const cid = coeMap.get(coeName);
      if (cid) { empCoeUpdates.set(emp.id, cid); emp.coeId = cid; }
    }
  }
  // Apply employee updates individually (no updateMany with per-row values in Prisma)
  for (const [empId, designationId] of empDesignationUpdates)
    await db.employee.update({ where: { id: empId }, data: { designationId } });
  for (const [empId, coeId] of empCoeUpdates)
    await db.employee.update({ where: { id: empId }, data: { coeId } });

  // Third pass: split employeeSkill rows into creates vs updates
  // Use a Map for pending creates so duplicate source rows (same employee+skill) are de-duped
  const dbKeys = new Set(
    (await db.employeeSkill.findMany({ select: { employeeId: true, skillId: true } }))
      .map((es) => `${es.employeeId}__${es.skillId}`),
  );

  type EsCreate = Prisma.EmployeeSkillCreateManyInput;
  const toCreate = new Map<string, EsCreate>(); // key → data (last row wins on dupe)

  for (const row of rows) {
    const employeeExtId = String(row["employee_id"] ?? "").trim();
    const emp = employeeMap.get(employeeExtId);
    if (!emp) { stats.dropped++; continue; }

    const skillName = String(row["Skill"] ?? "").trim();
    if (!skillName) { stats.dropped++; continue; }
    const skillId = skillMap.get(skillName);
    if (!skillId) { stats.dropped++; continue; }

    const score = parseInt(String(row["Score"] ?? "0"), 10) || 0;
    const key = `${emp.id}__${skillId}`;

    if (dbKeys.has(key)) {
      // Already in DB — update
      await db.employeeSkill.update({
        where: { employeeId_skillId: { employeeId: emp.id, skillId } },
        data: { validatedLevel: score, selfAssessedLevel: score, status: score > 0 ? "APPROVED" : "PENDING" },
      });
    } else {
      // New record (or duplicate source row — Map de-dupes, last value wins)
      toCreate.set(key, {
        employeeId: emp.id,
        skillId,
        selfAssessedLevel: score,
        validatedLevel: score > 0 ? score : null,
        status: score > 0 ? "APPROVED" : "PENDING",
      });
    }
    stats.loaded++;
  }

  // Batch-create new employee skills in chunks of 500
  const BATCH = 500;
  const toCreateArr = [...toCreate.values()];
  for (let i = 0; i < toCreateArr.length; i += BATCH)
    await db.employeeSkill.createMany({ data: toCreateArr.slice(i, i + BATCH) });

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

  const employeeMap = new Map<string, string>();
  (await db.employee.findMany({ select: { id: true, externalId: true } }))
    .forEach((e) => { if (e.externalId) employeeMap.set(e.externalId, e.id); });

  const existingKeys = new Set(
    (await db.competency.findMany({ select: { employeeId: true, behaviour: true } }))
      .map((c) => `${c.employeeId}__${c.behaviour}`),
  );

  type CompCreate = Prisma.CompetencyCreateManyInput;
  const toCreate: CompCreate[] = [];

  for (const row of rows) {
    const employeeExtId = String(row["Employee ID"] ?? "").trim();
    const employeeId = employeeMap.get(employeeExtId);
    if (!employeeId) { stats.dropped++; continue; }

    for (const { label, scoreKey } of BEHAVIOUR_COLS) {
      const score = parseInt(String(row[scoreKey] ?? "0"), 10) || 0;
      const key = `${employeeId}__${label}`;
      if (existingKeys.has(key)) {
        await db.competency.update({
          where: { employeeId_behaviour: { employeeId, behaviour: label } },
          data: { score },
        });
      } else {
        toCreate.push({ employeeId, behaviour: label, score });
        existingKeys.add(key);
      }
      stats.loaded++;
    }
  }

  if (toCreate.length > 0)
    await db.competency.createMany({ data: toCreate });

  return stats;
}

// ─── File 07: Pipeline_Details.xlsx ──────────────────────────
async function ingestPipeline(): Promise<IngestStats> {
  const rows = readXlsx("07. 260624_Pipeline_Details.xlsx");
  const stats = emptyStats();

  // No natural unique key — truncate before re-inserting for idempotency
  await db.pipelineRequest.deleteMany({});

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

  const projectMap = new Map<string, string>();
  (await db.project.findMany({ select: { id: true, externalId: true } }))
    .forEach((p) => { if (p.externalId) projectMap.set(p.externalId, p.id); });

  // Truncate for idempotency — externalKey is unique so re-running is safe
  await db.weeklyStatus.deleteMany({});

  type WsRow = Prisma.WeeklyStatusCreateManyInput;
  const BATCH = 500;
  let batch: WsRow[] = [];

  const flush = async () => {
    if (batch.length === 0) return;
    await db.weeklyStatus.createMany({ data: batch });
    stats.loaded += batch.length;
    batch = [];
  };

  for (const row of rows) {
    const externalKey = String(row["wsr_key"] ?? "").trim();
    const projectExtId = String(row["project_id_masked"] ?? "").trim();
    if (!externalKey || !projectExtId) { stats.dropped++; continue; }

    const projectId = projectMap.get(projectExtId);
    if (!projectId) { stats.dropped++; continue; }

    const weekStart = parseDate(row["week_start_date"]);
    const weekEnd = parseDate(row["week_end_date"]);
    if (!weekStart || !weekEnd) { stats.dropped++; continue; }

    batch.push({
      externalKey,
      projectId,
      weekStart,
      weekEnd,
      scopeStatus: String(row["scope_status"] ?? "").trim() || null,
      scheduleStatus: String(row["schedule_status"] ?? "").trim() || null,
      qualityStatus: String(row["quality_status"] ?? "").trim() || null,
      csatStatus: String(row["csat_status"] ?? "").trim() || null,
      teamStatus: String(row["team_status"] ?? "").trim() || null,
    });
    if (batch.length >= BATCH) await flush();
  }
  await flush();
  return stats;
}

// ─── Derived: UtilisationSnapshot from timesheets ────────────
async function deriveUtilisation(): Promise<IngestStats> {
  const stats = emptyStats();

  // Only count timesheets logged against a real project (projectId IS NOT NULL).
  // Rows without a projectId represent leave, training, or admin time — including
  // them inflates utilisation and masks true availability (Gap 5 fix).
  const timesheets = await db.timesheet.findMany({
    select: { employeeId: true, date: true, hours: true, isBillable: true },
    where: { projectId: { not: null } },
  });

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

// ─── Derived: ProjectExperienceDocs from File 05 skill experience data ───────
// Populates one synthetic ProjectExperienceDoc per employee so that
// the export engine can use ACTUAL experience-years data instead of
// a level/5 proxy (Gap 1 + Gap 8 fixes).
async function ingestExperienceDocs(): Promise<IngestStats> {
  const rows = readXlsx("05. 260624 Skill_Data.xlsx");
  const stats = emptyStats();

  const employeeMap = new Map<string, string>(); // externalId → internalId
  (await db.employee.findMany({ select: { id: true, externalId: true } }))
    .forEach((e) => { if (e.externalId) employeeMap.set(e.externalId, e.id); });

  // Collect { name, years, score } per employee from the Experience + Score columns
  type SkillExp = { name: string; years: number; score: number };
  const expByEmployee = new Map<string, SkillExp[]>();

  for (const row of rows) {
    const employeeExtId = String(row["employee_id"] ?? "").trim();
    const employeeId = employeeMap.get(employeeExtId);
    if (!employeeId) continue;

    const skillName = String(row["Skill"] ?? "").trim();
    const subSkill   = String(row["SubSkill"] ?? "").trim(); // preserve for tech-stack
    if (!skillName) continue;

    const years = parseExperienceYears(row["Experience"]);
    const score = parseInt(String(row["Score"] ?? "0"), 10) || 0;

    if (!expByEmployee.has(employeeId)) expByEmployee.set(employeeId, []);
    expByEmployee.get(employeeId)!.push({
      name: subSkill ? `${skillName} – ${subSkill}` : skillName,
      years,
      score: score / 5, // normalise 1-5 scale to 0-1
    });
  }

  // Delete existing synthetic docs before recreating (idempotent re-run)
  const empIds = [...expByEmployee.keys()];
  if (empIds.length > 0) {
    await db.projectExperienceDoc.deleteMany({
      where: { title: "ETL-SkillProfile", employeeId: { in: empIds } },
    });
  }

  for (const [employeeId, skills] of expByEmployee) {
    if (skills.length === 0) continue;

    // Tech-stack: top skills with ≥2 years experience (or top skills by score if no years)
    const ranked = [...skills].sort((a, b) => (b.years || b.score * 5) - (a.years || a.score * 5));
    const techStack = ranked
      .slice(0, 15)
      .map((s) => s.name)
      .join(", ");

    await db.projectExperienceDoc.create({
      data: {
        employeeId,
        title: "ETL-SkillProfile",
        projectType: "SKILL_PORTFOLIO",
        extractionStatus: "EXTRACTED",
        techStack: techStack || null,
        // Store full experience data including years for the scoring engine
        extractedSkills: JSON.stringify(skills),
      },
    });
    stats.loaded++;
  }

  stats.notes.push(`Created ExperienceDocs for ${expByEmployee.size} employees with ${rows.length} skill rows`);
  return stats;
}

// ─── Orchestrator ─────────────────────────────────────────────
async function run() {
  // Optional: pass a step name to run only that step, e.g. `npx tsx ingest.ts 05_skill_data`
  const only = process.argv[2] ?? null;
  console.log(only ? `=== ETL — running only: ${only} ===\n` : "=== Resourcing CoLab ETL ===\n");
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
    { name: "derived_utilisation",    fn: deriveUtilisation },
    { name: "derived_shadow",         fn: deriveShadowFlags },
    { name: "derived_role_mix",       fn: deriveRoleMix },
    { name: "derived_experience_docs",fn: ingestExperienceDocs },
  ];

  for (const step of steps) {
    if (only && step.name !== only) continue;
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
