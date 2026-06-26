#!/usr/bin/env node
// Runs ESLint --fix on any .ts/.tsx file after Write or Edit tool use.
const { execSync } = require("child_process");
const path = require("path");

try {
  const input = JSON.parse(process.env.CLAUDE_TOOL_INPUT || "{}");
  const filePath = input.file_path || "";

  if (!filePath) process.exit(0);
  if (!filePath.endsWith(".ts") && !filePath.endsWith(".tsx")) process.exit(0);
  if (filePath.includes("node_modules")) process.exit(0);
  if (filePath.includes(".d.ts")) process.exit(0);

  const projectRoot = path.resolve(__dirname, "..", "..");
  execSync(`npx eslint --fix "${filePath}" --quiet`, {
    stdio: "pipe",
    cwd: projectRoot,
  });
} catch {
  // Non-fatal: lint errors are shown in the next explicit lint run
}
