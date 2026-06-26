#!/usr/bin/env node
// Reminds to update module-status and daily log after a session that made changes.
const fs = require("fs");
const path = require("path");

try {
  const projectRoot = path.resolve(__dirname, "..", "..");
  const today = new Date().toISOString().slice(0, 10);
  const dailyLog = path.join(
    projectRoot,
    ".claude",
    "memory",
    "daily",
    `${today}.md`
  );
  const moduleStatus = path.join(
    projectRoot,
    ".claude",
    "memory",
    "module-status.md"
  );

  const reminders = [];

  if (!fs.existsSync(dailyLog)) {
    reminders.push(`  • Daily log missing for ${today} — run /daily-summary`);
  }
  if (!fs.existsSync(moduleStatus)) {
    reminders.push(`  • Module status file missing — run /module-status`);
  }

  if (reminders.length > 0) {
    console.log(`\x1b[36m[REMINDER]\x1b[0m End of session checklist:`);
    reminders.forEach((r) => console.log(r));
  }
} catch {
  // Non-fatal
}
