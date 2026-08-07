/**
 * backfill-pipeline-dates.ts
 *
 * Demo data fix: the seeded pipeline_requests have NULL likely_start (and mostly
 * NULL number_of_weeks), so the Resource Forecast has no demand to place on its
 * timeline. This spreads likelyStart evenly across the next ~5 months and fills
 * a sensible duration where missing, so the forecast populates.
 *
 * Deterministic and idempotent: re-running produces the same dates.
 * Run with:  npx tsx scripts/backfill-pipeline-dates.ts
 */

import { db } from "../src/lib/db";

const HORIZON_DAYS = 150; // spread starts across ~5 months
const DURATION_CHOICES = [8, 10, 12, 16, 20]; // weeks, used only where number_of_weeks is null

async function main() {
  const requests = await db.pipelineRequest.findMany({
    orderBy: [{ sowSigned: "desc" }, { createdAt: "asc" }],
    select: { id: true, numberOfWeeks: true },
  });

  const total = requests.length;
  if (total === 0) {
    console.log("No pipeline requests found. Nothing to backfill.");
    return;
  }

  // Anchor to the first day of the current month for stable, readable dates.
  const now = new Date();
  const base = new Date(now.getFullYear(), now.getMonth(), 1);

  let updated = 0;
  for (let i = 0; i < total; i++) {
    const req = requests[i]!;
    const offsetDays = Math.round((i / total) * HORIZON_DAYS);
    const likelyStart = new Date(base.getTime() + offsetDays * 24 * 60 * 60 * 1000);
    const numberOfWeeks = req.numberOfWeeks ?? DURATION_CHOICES[i % DURATION_CHOICES.length]!;

    await db.pipelineRequest.update({
      where: { id: req.id },
      data: { likelyStart, numberOfWeeks },
    });
    updated++;
  }

  const first = new Date(base);
  const last = new Date(base.getTime() + HORIZON_DAYS * 24 * 60 * 60 * 1000);
  console.log(`Backfilled ${updated} pipeline requests.`);
  console.log(`likelyStart spread: ${first.toISOString().slice(0, 10)} to ${last.toISOString().slice(0, 10)}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
