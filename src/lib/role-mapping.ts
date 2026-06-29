/**
 * Canonical role mapping for "Resources Requested" field.
 * Single source of truth used by matching, recommendations, and Excel export.
 */

export interface ParsedRole {
  canonicalRoles: string[];  // OR list - employee matches if jobName contains any
  count: number;
  isEM: boolean;
  display: string;           // clean label for display
}

const SINGLE_ROLE_MAP: Record<string, string> = {
  "p":                            "Principal",
  "principal":                    "Principal",
  "sc":                           "Senior Consultant",
  "senior consultant":            "Senior Consultant",
  "c":                            "Consultant",
  "consultant":                   "Consultant",
  "sac":                          "Senior Associate Consultant",
  "senior associate consultant":  "Senior Associate Consultant",
  "ac":                           "Associate Consultant",
  "ac (uk)":                      "Associate Consultant",
  "associate consultant":         "Associate Consultant",
  "m":                            "Manager",
  "manager":                      "Manager",
  "pa":                           "Principal Architect",
  "principal architect":          "Principal Architect",
  "pta":                          "Principal Technology Architect",
  "principal technology architect": "Principal Technology Architect",
  "partner":                      "Partner",
  "ap":                           "Associate Partner",
  "associate partner":            "Associate Partner",
  "se":                           "Software Engineer",
  "software engineer":            "Software Engineer",
  "sse":                          "Senior Software Engineer",
  "senior software engineer":     "Senior Software Engineer",
  "sol con":                      "Solutions Consultant",
  "solutions consultant":         "Solutions Consultant",
  "sr sol con":                   "Senior Solutions Consultant",
  "snr sol con":                  "Senior Solutions Consultant",
  "senior solutions consultant":  "Senior Solutions Consultant",
  "enabler":                      "Solutions Enabler",
  "solutions enabler":            "Solutions Enabler",
};

const MULTI_ROLE_PATTERNS: Array<{ pattern: RegExp; roles: string[]; display?: string }> = [
  // PA → both Principal Architect (consulting-heavy) and Principal Technology Architect (tech-heavy).
  // COE alignment in the cascade naturally ranks the right type first per project domain.
  { pattern: /^pa$/i,
    roles: ["Principal Architect", "Principal Technology Architect"],
    display: "Principal Architect" },
  { pattern: /^ap\s*\/\s*p$/i,
    roles: ["Associate Partner", "Principal"] },
  { pattern: /^sac\s*[\/,]\s*ac$/i,
    roles: ["Senior Associate Consultant", "Associate Consultant"] },
  { pattern: /senior associate consultant.*(or|\/|,).*associate consultant/i,
    roles: ["Senior Associate Consultant", "Associate Consultant"] },
  { pattern: /^sac\s*-\s*c$/i,
    roles: ["Senior Associate Consultant", "Consultant"] },
  { pattern: /^c\s*\/\s*sac\s*\/\s*ac$/i,
    roles: ["Consultant", "Senior Associate Consultant", "Associate Consultant"] },
  { pattern: /sse\s*(or|\/)\s*se/i,
    roles: ["Senior Software Engineer", "Software Engineer"] },
  { pattern: /se\s*(or|\/)\s*sse/i,
    roles: ["Senior Software Engineer", "Software Engineer"] },
  { pattern: /sol con.*enabler.*sse/i,
    roles: ["Solutions Consultant", "Solutions Enabler", "Senior Software Engineer"] },
  { pattern: /^sc\s*(or|\/)\s*c(\s*[-–]\s*em)?$/i,
    roles: ["Senior Consultant", "Consultant"] },
];

export function normalizeResourceRequest(raw: string | null): ParsedRole {
  if (!raw?.trim()) return { canonicalRoles: [], count: 1, isEM: false, display: "Unknown" };

  const text = raw.trim();

  // Extract leading count: "2 SE" → count=2, rest="SE"
  const countMatch = text.match(/^(\d+)\s+(.+)$/);
  const count = countMatch ? parseInt(countMatch[1]!, 10) : 1;
  const roleText = (countMatch ? countMatch[2]! : text).trim();

  const isEM = /\bEM\b/i.test(roleText);
  // Strip EM annotation: "SC (EM)" → "SC", "SC or C - EM" → "SC or C"
  const cleaned = roleText
    .replace(/\s*\(\s*EM\s*\)/i, "")
    .replace(/\s*[-–]\s*EM\b.*/i, "")
    .trim();

  // Try multi-role patterns first (more specific)
  for (const { pattern, roles, display: patternDisplay } of MULTI_ROLE_PATTERNS) {
    if (pattern.test(cleaned)) {
      return { canonicalRoles: roles, count, isEM, display: patternDisplay ?? roles.join(" / ") };
    }
  }

  // Single-role lookup
  const canonical = SINGLE_ROLE_MAP[cleaned.toLowerCase()];
  if (canonical) {
    return { canonicalRoles: [canonical], count, isEM, display: canonical };
  }

  return { canonicalRoles: [], count, isEM, display: cleaned || "Unknown" };
}

/** Returns true if an employee's jobName matches any canonical role in the list. */
export function employeeMatchesRole(
  jobName: string | null,
  canonicalRoles: string[],
): boolean {
  if (canonicalRoles.length === 0) return true;
  if (!jobName) return false;
  const jn = jobName.toLowerCase();
  return canonicalRoles.some((r) => jn.includes(r.toLowerCase()));
}
