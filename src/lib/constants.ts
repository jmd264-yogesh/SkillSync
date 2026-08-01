export const COMPETENCY_LEVELS = {
  BEGINNER: 1,
  BASIC: 2,
  INTERMEDIATE: 3,
  ADVANCED: 4,
  EXPERT: 5,
} as const;

export type CompetencyLevel =
  (typeof COMPETENCY_LEVELS)[keyof typeof COMPETENCY_LEVELS];

export const COMPETENCY_LABEL: Record<CompetencyLevel, string> = {
  1: "Beginner",
  2: "Basic",
  3: "Intermediate",
  4: "Advanced",
  5: "Expert",
};

export const SKILL_CATEGORIES = [
  "SKILL",
  "FRAMEWORK",
  "CONCEPT",
  "TOOL",
  "CERTIFICATION",
] as const;

export const EVIDENCE_TYPES = [
  "CERTIFICATION",
  "ASSESSMENT_SCORE",
  "PROJECT_DOCUMENT",
  "SUPPORTING_DOCUMENT",
] as const;

export const APPROVAL_STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;

export const USER_ROLES = ["ADMIN", "MANAGER", "EMPLOYEE"] as const;

export const PROJECT_CATEGORY_LABELS: Record<string, string> = {
  D_AND_D: "Discovery & Design",
  TACTICAL_BUILD: "Tactical Build",
  DATA_PLATFORM_BUILD: "Data Platform Build",
  ENTERPRISE_BUILD: "Enterprise Build",
  DATA_SCIENCE: "Data Science",
  AI_PROJECT: "AI Project",
  MS_PROJECT: "MS Project",
  FULL_STACK: "Full Stack",
  VALUE_CREATION: "Value Creation",
  OTHER: "Other",
};

export const PIPELINE_STAGE_LABELS: Record<string, string> = {
  LEAD: "Lead",
  PROPOSAL: "Proposal",
  SOW_PENDING: "SOW Pending",
  SOW_SIGNED: "SOW Signed",
  ACTIVE: "Active",
  RAMP_DOWN: "Ramp Down",
  CLOSED: "Closed",
};

export const BILLABILITY_LABELS: Record<string, string> = {
  BILLABLE: "Billable",
  PARTIALLY_BILLABLE: "Partially Billable",
  UNBILLABLE: "Unbillable",
  SHADOW: "Shadow",
};

// HubSpot deal stage → win probability
export const DEAL_STAGE_PROBABILITY: Record<string, number> = {
  "Lead": 0.1,
  "Proposal": 0.3,
  "SOW Pending": 0.6,
  "SOW Signed": 1.0,
  "Active": 1.0,
};

export const COMPETENCY_BEHAVIOURS = [
  "Stakeholder Management",
  "Advisory",
  "Techno-Functional",
  "Communication",
  "Ambiguity Navigation",
] as const;

export type CompetencyBehaviour = (typeof COMPETENCY_BEHAVIOURS)[number];

// Match score weights v1 - 5 dimensions (used by matching.service.ts / UI)
// Must sum to 1.0
export const MATCH_WEIGHTS = {
  skill: 0.35,
  competency: 0.25,
  availability: 0.20,
  billability: 0.12,
  evidence: 0.08,
} as const;

// Match score weights v2 - 7 dimensions (used by excel-export.service.ts / CLI)
// Adds Experience Depth (proxy for years-of-experience) and COE Alignment.
// Must sum to 1.0
export const MATCH_WEIGHTS_V2 = {
  skill: 0.32,        // skill coverage × proficiency depth
  competency: 0.22,   // avg of 5 consulting-behaviour scores
  experience: 0.08,   // validated skill-level depth as experience proxy
  availability: 0.18, // window-aware free capacity in the request window
  billability: 0.10,  // low billability = high cost-recovery opportunity
  evidence: 0.06,     // certs + project-doc overlaps + role history
  coeAlignment: 0.04, // employee COE matches project skillset/solution domain
} as const;

// ─── Resourcing CoLab Enhancements (WI-008) ──────────────────

export const SOLUTION_PRIORITY: Record<string, number> = {
  "Customer":             1,
  "Operations":           2,
  "Finance":              3,
  "Sales":                4,
  "People":               5,
  "Full Stack":           6,
  "TechOps":              7,
  "Managed Service":      8,
  "Value Creation":       9,
  "Platform Engineering": 10,
  "Migration":            11,
  "Networking":           12,
  "Lead Scoring":         13,
  "Churn Prediction":     14,
  "Design & Discovery":   15,
  "Pricing Optimization": 16,
  "Web Scraping":         17,
} as const;

export const SOLUTION_TYPES = Object.keys(SOLUTION_PRIORITY) as string[];

// Human-readable labels for project type dropdowns (overrides where a longer description helps)
const SOLUTION_TYPE_LABELS: Record<string, string> = {
  "Full Stack": "Full Stack — Application Build / Support",
  "Design & Discovery": "Design & Discovery",
};

// Shared project type list used by all propositions
export const PROPOSITION_PROJECT_OPTIONS: Array<{ value: string; label: string }> =
  SOLUTION_TYPES.map((s) => ({ value: s, label: SOLUTION_TYPE_LABELS[s] ?? s }));

export const ENGAGEMENT_PHASES = ["Design & Discovery", "Build"] as const;
export type EngagementPhase = (typeof ENGAGEMENT_PHASES)[number];

export const CRITICALITY_LEVELS = ["Stable", "Medium", "High"] as const;
export type CriticalityLevel = (typeof CRITICALITY_LEVELS)[number];

export const SERVICE_LINES = [
  "Due Diligence",
  "Data Advisory",
  "Core Reporting",
  "Value Creation",
  "Exit Support",
  "Managed Service",
] as const;

export type ServiceLine = (typeof SERVICE_LINES)[number];

export const PROPOSITION_ROLES = [
  "Partner",
  "Associate Partner",
  "Principal",
  "Manager",
  "Senior Consultant",
  "Consultant",
  "Senior Associate Consultant",
  "Associate Consultant",
  "Intern",
  "Partner Technology",
  "Associate Partner Technology",
  "Principal Technology Architect",
  "Technical Solutions Architect",
  "Senior Solutions Consultant",
  "Solutions Consultant",
  "Solutions Enabler",
  "Senior Software Engineer",
  "Software Engineer",
  "Intern Technology",
] as const;

export type PropositionRole = (typeof PROPOSITION_ROLES)[number];

export const SOURCE_SYSTEMS = [
  "Salesforce",
  "SAP",
  "Oracle",
  "Snowflake",
  "Microsoft Azure",
  "AWS",
  "Google Cloud",
  "Power BI",
  "Tableau",
  "Databricks",
  "SQL Server",
  "HubSpot",
  "Workday",
  "NetSuite",
  "Looker",
] as const;

export type SourceSystem = (typeof SOURCE_SYSTEMS)[number];

export const PROPOSITION_PROJECT_TYPES: Record<ServiceLine, Array<{ value: string; label: string }>> = {
  "Due Diligence":  PROPOSITION_PROJECT_OPTIONS,
  "Data Advisory":  PROPOSITION_PROJECT_OPTIONS,
  "Core Reporting": PROPOSITION_PROJECT_OPTIONS,
  "Value Creation": PROPOSITION_PROJECT_OPTIONS,
  "Exit Support":   PROPOSITION_PROJECT_OPTIONS,
  "Managed Service":PROPOSITION_PROJECT_OPTIONS,
};

export const CLIENT_TIER_BOOST: Record<string, number> = {
  GOLD: 10,
  SILVER: 5,
  BRONZE: 0,
} as const;

export const CLIENT_TIER_LABELS: Record<string, string> = {
  GOLD: "Gold",
  SILVER: "Silver",
  BRONZE: "Bronze",
} as const;

// Deal stage → confidence percentage
export const CONFIDENCE_BY_DEAL_STAGE: Record<string, number> = {
  LEAD:        20,
  PROPOSAL:    20,
  SOW_PENDING: 40,
  SOW_SIGNED:  80,
  ACTIVE:      100,
  RAMP_DOWN:   100,
  CLOSED:      0,
} as const;

// Matching thresholds
export const HIRING_LEAD_TIME_MONTHS = 6;
export const UNDER_UTILIZATION_THRESHOLD = 0.85;

export const TRAINING_READINESS_LABELS = {
  HIGH:   { min: 80, label: "Project Ready",     color: "text-green-700 bg-green-50 border-green-200" },
  MEDIUM: { min: 60, label: "Mostly Ready",      color: "text-amber-700 bg-amber-50 border-amber-200" },
  LOW:    { min: 0,  label: "Needs Development", color: "text-red-700 bg-red-50 border-red-200" },
} as const;

// ─── Rate Card (Resource Forecast — revenue modelling) ───────
// Day rates in GBP per role/grade. billRate = client-facing, costRate = internal.
// Keyed by canonical role names (see role-mapping.ts). Longest keys are matched first
// so "Senior Software Engineer" wins over "Software Engineer". Tune live for the demo.
export const RATE_CARD: Record<string, { billRate: number; costRate: number }> = {
  "Partner":                          { billRate: 2500, costRate: 1200 },
  "Partner Technology":               { billRate: 2500, costRate: 1200 },
  "Associate Partner":                { billRate: 2000, costRate: 950 },
  "Associate Partner Technology":     { billRate: 2000, costRate: 950 },
  "Principal Technology Architect":   { billRate: 1650, costRate: 820 },
  "Principal Architect":              { billRate: 1650, costRate: 820 },
  "Principal Engineer":               { billRate: 1600, costRate: 800 },
  "Principal":                        { billRate: 1600, costRate: 800 },
  "Technical Solutions Architect":    { billRate: 1400, costRate: 720 },
  "Manager":                          { billRate: 1400, costRate: 700 },
  "Senior Solutions Consultant":      { billRate: 1150, costRate: 620 },
  "Senior Consultant":                { billRate: 1100, costRate: 600 },
  "Senior Software Engineer":         { billRate: 800,  costRate: 440 },
  "Solutions Consultant":             { billRate: 900,  costRate: 500 },
  "Consultant":                       { billRate: 850,  costRate: 480 },
  "Senior Associate Consultant":      { billRate: 750,  costRate: 420 },
  "Solutions Enabler":               { billRate: 650,  costRate: 380 },
  "Software Engineer":                { billRate: 600,  costRate: 350 },
  "Associate Consultant":             { billRate: 600,  costRate: 350 },
  "Intern Technology":                { billRate: 300,  costRate: 180 },
  "Intern":                           { billRate: 300,  costRate: 180 },
};

export const DEFAULT_RATE = { billRate: 800, costRate: 450 } as const;

// Working-time constants for FTE ↔ revenue conversion
export const WORKING_DAYS_PER_MONTH = 21;
export const WORKING_DAYS_PER_WEEK = 5;
export const TARGET_UTILISATION = 0.8; // billable target used by the revenue solver
export const HIRING_LEAD_TIME_WEEKS = 8; // hire-by = shortfall date − lead time

// Map any jobName/role string to a canonical rate-card key via longest-key
// substring match. Demand and supply both funnel through this so they align.
export function rateRoleKey(role: string | null): string {
  if (!role) return "Other";
  if (RATE_CARD[role]) return role;
  const r = role.toLowerCase().trim();
  const keys = Object.keys(RATE_CARD).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    if (r.includes(key.toLowerCase())) return key;
  }
  return "Other";
}

// Resolve a rate for an arbitrary jobName/role via longest-key substring match.
export function rateForRole(role: string | null): { billRate: number; costRate: number } {
  const key = rateRoleKey(role);
  return RATE_CARD[key] ?? { ...DEFAULT_RATE };
}

export const ROLE_PERMISSIONS = {
  ADMIN: [
    "manage:coe",
    "manage:skills",
    "manage:designations",
    "manage:employees",
    "manage:competency-levels",
    "manage:skill-mapping",
    "view:analytics",
    "view:talent-discovery",
    "manage:resources",
  ],
  MANAGER: [
    "approve:skills",
    "view:team",
    "view:team-reports",
    "view:team-learning",
    "endorse:transition",
  ],
  EMPLOYEE: [
    "submit:skills",
    "view:own-skills",
    "view:own-gaps",
    "view:own-report",
    "view:own-learning",
    "view:transition-path",
  ],
} as const;
