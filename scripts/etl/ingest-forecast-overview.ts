/**
 * ingest-forecast-overview.ts
 *
 * Reads "Forecast Overview" sheet from:
 *   prisma/Cluster Patapsco - Forecast & Overview.xlsx
 *
 * Parses every PortCo row (rows 12+), computes an extensionScore (0–100)
 * and extensionBand, then upserts into the `forecast_overview_entries` table.
 *
 * Run: npx tsx scripts/etl/ingest-forecast-overview.ts
 */

import path from "path";
import * as XLSX from "xlsx";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

// ── File location ─────────────────────────────────────────────
const FILE_PATH = path.resolve(
  process.cwd(),
  "prisma",
  "Cluster Patapsco - Forecast & Overview.xlsx"
);
const SHEET_NAME = "Forecast Overview";

// ── Column indices (0-based) ──────────────────────────────────
const C = {
  FUND: 1,
  PORT_CO: 2,
  CLUSTER: 3,
  LEVEL: 4,
  CLIENT_LEAD: 5,
  ACCOUNT_OWNER: 6,
  ACCOUNT_MANAGER: 7,
  TEAM_OWNER: 8,
  STATUS: 9,
  BOOKED_PRIOR: 10,       // Jun-26 Booked (prior month actual)
  BOOKED_CURRENT: 11,     // Jul-26 Booked
  UNWEIGHTED_CURRENT: 12, // Jul-26 Unweighted
  WEIGHTED_CURRENT: 13,   // Jul-26 Weighted
  // skip cols 14-16 (Book v Snap, Unweig v Snap, Weigh v Snap)
  BOOKED_M1: 17,          // Aug-26 Booked
  UNWEIGHTED_M1: 18,      // Aug-26 Unweighted
  WEIGHTED_M1: 19,        // Aug-26 Weighted
  // skip cols 20-22 (snapshot deltas)
  BOOKED_M2: 23,          // Sep-26 Booked
  UNWEIGHTED_M2: 24,      // Sep-26 Unweighted
  WEIGHTED_M2: 25,        // Sep-26 Weighted
  BOOKED_M3: 26,          // Oct-26 Booked
  UNWEIGHTED_M3: 27,      // Oct-26 Unweighted
  WEIGHTED_M3: 28,        // Oct-26 Weighted
  // skip col 29 (spacer)
  FY_BOOKED: 30,
  FY_UNWEIGHTED: 31,
  FY_WEIGHTED: 32,
};

// ── Helpers ───────────────────────────────────────────────────
function num(v: unknown): number {
  if (v === null || v === undefined) return 0;
  const n = parseFloat(String(v));
  return isNaN(n) ? 0 : n;
}

function str(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

/**
 * Compute extension score (0–100) from row data.
 *
 * Dimensions:
 *   Level Score        25% — Gold=100, Silver=70, Bronze=40, Servicing=55
 *   Status Score       25% — ▲▲=100, ▲=80, ▶=50, ▼=20, ▼▼=0
 *   Forward Pipeline   30% — forward weighted / max-forward-weighted in dataset
 *   FY Revenue         20% — normalised FY Booked (relative to dataset max)
 */
function computeScore(
  level: string,
  status: string,
  forwardWeighted: number,
  fyBooked: number,
  maxForwardWeighted: number,
  maxFyBooked: number
): number {
  // Level score
  const levelMap: Record<string, number> = {
    Gold: 100,
    Silver: 70,
    Bronze: 40,
    Servicing: 55,
  };
  const levelScore = levelMap[level] ?? 30;

  // Status score
  const statusMap: Record<string, number> = {
    "▲▲": 100,
    "▲": 80,
    "▶": 50,
    "▼": 20,
    "▼▼": 0,
    "-": 50,
  };
  const statusScore = statusMap[status] ?? 40;

  // Forward pipeline score (months +1, +2, +3 weighted sum normalised)
  const forwardScore =
    maxForwardWeighted > 0
      ? Math.min(100, (forwardWeighted / maxForwardWeighted) * 100)
      : 0;

  // FY revenue score
  const fyScore =
    maxFyBooked > 0 ? Math.min(100, (fyBooked / maxFyBooked) * 100) : 0;

  const raw =
    levelScore * 0.25 +
    statusScore * 0.25 +
    forwardScore * 0.3 +
    fyScore * 0.2;

  return Math.round(raw);
}

function scoreToBand(score: number): string {
  if (score >= 75) return "VERY_LIKELY";
  if (score >= 55) return "LIKELY";
  if (score >= 35) return "UNCERTAIN";
  return "UNLIKELY";
}

// ── Summary rows / non-data rows to skip ─────────────────────
const SKIP_PORTCOS = new Set([
  "ONLY EDIT THE PINK",
  "-",
  "",
  "Working Numbers",
  "Summary",
  "Budget Revenue",
  "Booked Revenue",
  "Forecast by Type",
  "Total",
]);

const SKIP_LEVELS = new Set(["Level", "-", ""]);

// ── Main ──────────────────────────────────────────────────────
async function main() {
  console.log("📂 Reading:", FILE_PATH);

  const wb = XLSX.readFile(FILE_PATH);
  const ws = wb.Sheets[SHEET_NAME];
  if (!ws) {
    console.error(`❌ Sheet "${SHEET_NAME}" not found`);
    process.exit(1);
  }

  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    defval: null,
  });

  // Data starts at row index 12 (0-based)
  const dataRows = rows.slice(12);

  // ── Pass 1: collect raw rows + compute max values for normalisation ──
  interface RawRow {
    fund: string;
    portCo: string;
    cluster: string;
    level: string;
    clientLead: string;
    accountOwner: string;
    accountManager: string;
    teamOwner: string;
    status: string;
    bookedPrior: number;
    bookedCurrent: number;
    unweightedCurrent: number;
    weightedCurrent: number;
    bookedMonth1: number;
    unweightedMonth1: number;
    weightedMonth1: number;
    bookedMonth2: number;
    unweightedMonth2: number;
    weightedMonth2: number;
    bookedMonth3: number;
    unweightedMonth3: number;
    weightedMonth3: number;
    fyBooked: number;
    fyUnweighted: number;
    fyWeighted: number;
    forwardWeighted: number;
  }

  const parsed: RawRow[] = [];
  let maxForwardWeighted = 0;
  let maxFyBooked = 0;

  for (const row of dataRows) {
    const r = row as unknown[];
    const portCo = str(r[C.PORT_CO]);
    const level = str(r[C.LEVEL]);
    const fund = str(r[C.FUND]);

    // Skip summary / header / blank rows
    if (!portCo || !fund) continue;
    if (SKIP_PORTCOS.has(portCo)) continue;
    if (SKIP_LEVELS.has(level)) continue;
    if (!str(r[C.STATUS])) continue;

    const weightedMonth1 = num(r[C.WEIGHTED_M1]);
    const weightedMonth2 = num(r[C.WEIGHTED_M2]);
    const weightedMonth3 = num(r[C.WEIGHTED_M3]);
    const forwardWeighted = weightedMonth1 + weightedMonth2 + weightedMonth3;
    const fyBooked = num(r[C.FY_BOOKED]);

    if (forwardWeighted > maxForwardWeighted) maxForwardWeighted = forwardWeighted;
    if (fyBooked > maxFyBooked) maxFyBooked = fyBooked;

    parsed.push({
      fund,
      portCo,
      cluster: str(r[C.CLUSTER]),
      level,
      clientLead: str(r[C.CLIENT_LEAD]),
      accountOwner: str(r[C.ACCOUNT_OWNER]),
      accountManager: str(r[C.ACCOUNT_MANAGER]),
      teamOwner: str(r[C.TEAM_OWNER]),
      status: str(r[C.STATUS]),
      bookedPrior: num(r[C.BOOKED_PRIOR]),
      bookedCurrent: num(r[C.BOOKED_CURRENT]),
      unweightedCurrent: num(r[C.UNWEIGHTED_CURRENT]),
      weightedCurrent: num(r[C.WEIGHTED_CURRENT]),
      bookedMonth1: num(r[C.BOOKED_M1]),
      unweightedMonth1: num(r[C.UNWEIGHTED_M1]),
      weightedMonth1,
      bookedMonth2: num(r[C.BOOKED_M2]),
      unweightedMonth2: num(r[C.UNWEIGHTED_M2]),
      weightedMonth2,
      bookedMonth3: num(r[C.BOOKED_M3]),
      unweightedMonth3: num(r[C.UNWEIGHTED_M3]),
      weightedMonth3,
      fyBooked,
      fyUnweighted: num(r[C.FY_UNWEIGHTED]),
      fyWeighted: num(r[C.FY_WEIGHTED]),
      forwardWeighted,
    });
  }

  console.log(`✅ Parsed ${parsed.length} PortCo rows`);
  console.log(`   Max forward weighted: £${maxForwardWeighted.toFixed(0)}`);
  console.log(`   Max FY booked: £${maxFyBooked.toFixed(0)}`);

  // Determine dataMonth from "Current Month" in row 4 (col 2 = Excel serial)
  // Row 4 (0-based index) → rows[4]
  const metaRow = rows[4] as unknown[];
  let dataMonth = "2026-07"; // fallback
  if (metaRow && typeof metaRow[2] === "number") {
    const serial = metaRow[2] as number;
    const d = new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
    dataMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }
  console.log(`   Data month: ${dataMonth}`);

  // ── Pass 2: compute scores and upsert ────────────────────────
  let upserted = 0;
  let skipped = 0;

  for (const row of parsed) {
    const extensionScore = computeScore(
      row.level,
      row.status,
      row.forwardWeighted,
      row.fyBooked,
      maxForwardWeighted,
      maxFyBooked
    );
    const extensionBand = scoreToBand(extensionScore);

    try {
      await db.forecastOverviewEntry.upsert({
        where: {
          fund_portCo_dataMonth: {
            fund: row.fund,
            portCo: row.portCo,
            dataMonth,
          },
        },
        create: {
          fund: row.fund,
          portCo: row.portCo,
          cluster: row.cluster || null,
          level: row.level || null,
          clientLead: row.clientLead || null,
          accountOwner: row.accountOwner || null,
          accountManager: row.accountManager || null,
          teamOwner: row.teamOwner || null,
          status: row.status || null,
          bookedPrior: row.bookedPrior,
          bookedCurrent: row.bookedCurrent,
          unweightedCurrent: row.unweightedCurrent,
          weightedCurrent: row.weightedCurrent,
          bookedMonth1: row.bookedMonth1,
          unweightedMonth1: row.unweightedMonth1,
          weightedMonth1: row.weightedMonth1,
          bookedMonth2: row.bookedMonth2,
          unweightedMonth2: row.unweightedMonth2,
          weightedMonth2: row.weightedMonth2,
          bookedMonth3: row.bookedMonth3,
          unweightedMonth3: row.unweightedMonth3,
          weightedMonth3: row.weightedMonth3,
          fyBooked: row.fyBooked,
          fyUnweighted: row.fyUnweighted,
          fyWeighted: row.fyWeighted,
          extensionScore,
          extensionBand,
          dataMonth,
        },
        update: {
          cluster: row.cluster || null,
          level: row.level || null,
          clientLead: row.clientLead || null,
          accountOwner: row.accountOwner || null,
          accountManager: row.accountManager || null,
          teamOwner: row.teamOwner || null,
          status: row.status || null,
          bookedPrior: row.bookedPrior,
          bookedCurrent: row.bookedCurrent,
          unweightedCurrent: row.unweightedCurrent,
          weightedCurrent: row.weightedCurrent,
          bookedMonth1: row.bookedMonth1,
          unweightedMonth1: row.unweightedMonth1,
          weightedMonth1: row.weightedMonth1,
          bookedMonth2: row.bookedMonth2,
          unweightedMonth2: row.unweightedMonth2,
          weightedMonth2: row.weightedMonth2,
          bookedMonth3: row.bookedMonth3,
          unweightedMonth3: row.unweightedMonth3,
          weightedMonth3: row.weightedMonth3,
          fyBooked: row.fyBooked,
          fyUnweighted: row.fyUnweighted,
          fyWeighted: row.fyWeighted,
          extensionScore,
          extensionBand,
        },
      });
      upserted++;
    } catch (err) {
      console.warn(`  ⚠ Skipped "${row.portCo}" (${row.fund}):`, err);
      skipped++;
    }
  }

  console.log(`\n🎉 Done! Upserted: ${upserted} | Skipped: ${skipped}`);
  await db.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
