#!/usr/bin/env node
// Prints a visible warning before destructive database or git operations.
try {
  const input = JSON.parse(process.env.CLAUDE_TOOL_INPUT || "{}");
  const cmd = (input.command || "").toLowerCase();

  const destructive = [
    { pattern: "--force-reset", label: "prisma migrate reset --force-reset" },
    { pattern: "migrate reset", label: "prisma migrate reset" },
    { pattern: "db push --force", label: "prisma db push --force" },
    { pattern: "drop table", label: "SQL DROP TABLE" },
    { pattern: "drop database", label: "SQL DROP DATABASE" },
    { pattern: "truncate ", label: "SQL TRUNCATE" },
    { pattern: "delete from ", label: "SQL DELETE FROM (no WHERE?)" },
    { pattern: "git reset --hard", label: "git reset --hard" },
    { pattern: "git push --force", label: "git push --force" },
    { pattern: "git push -f ", label: "git push -f" },
    { pattern: "rm -rf", label: "rm -rf" },
  ];

  const hit = destructive.find((d) => cmd.includes(d.pattern));
  if (hit) {
    console.error(
      `\x1b[33m[SAFETY GATE]\x1b[0m Potentially destructive operation detected: \x1b[31m${hit.label}\x1b[0m\n` +
        `  Command: ${input.command}\n` +
        `  Proceeding — confirm this is intentional before approving.\n`
    );
  }
} catch {
  // Non-fatal
}
