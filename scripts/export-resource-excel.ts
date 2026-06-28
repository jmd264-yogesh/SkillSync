/**
 * CLI export: generates the "Updated Resource Excel" with AI-powered recommendations.
 *
 * Usage:
 *   pnpm export:excel
 *   # or
 *   npx tsx scripts/export-resource-excel.ts
 *
 * Requires env vars (copy from .env or set in shell):
 *   DATABASE_URL   — Prisma connection string
 *   GOOGLE_AI_API_KEY — Gemini API key (optional; falls back to deterministic rationale)
 *
 * Output: ./out/07_Pipeline_Details_UPDATED.xlsx
 */

import path from "path";
import fs from "fs";
import { buildResourceExcel } from "../src/server/services/excel-export.service";

async function main() {
  const dbUrl = process.env["DATABASE_URL"];
  if (!dbUrl) {
    console.error("ERROR: DATABASE_URL is not set. Set it in .env or export it in your shell.");
    process.exit(1);
  }

  const outDir = path.join(process.cwd(), "out");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const outPath = path.join(outDir, "07_Pipeline_Details_UPDATED.xlsx");

  console.log("Building updated resource Excel...");
  console.log("  Source: reference_files/07. 260624_Pipeline_Details.xlsx");
  console.log("  Output:", outPath);
  console.log("  AI rationale: up to 15 calls (5s timeout each)");
  console.log("");

  const start = Date.now();
  const buf = await buildResourceExcel({ maxAiCalls: 15 });
  fs.writeFileSync(outPath, buf);

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  const sizeKb = Math.round(fs.statSync(outPath).size / 1024);

  console.log(`✓ Done in ${elapsed}s — ${sizeKb} KB`);
  console.log(`  Sheets: "Pipeline Resource Plan" | "Alternates" | "Summary"`);
  console.log(`  Columns 1–22: original schema preserved (Resource Recommended, % Available, Skillset Match filled)`);
  console.log(`  Columns 23–31: Match Score, Skill Score, Competency Score, Signal, Action, Unmet Skills, Plan, AI Rationale, Confidence`);
  console.log(`  File: ${outPath}`);

  process.exit(0);
}

main().catch((err) => {
  console.error("Export failed:", err);
  process.exit(1);
});
