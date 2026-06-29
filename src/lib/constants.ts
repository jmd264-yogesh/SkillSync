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

// Match score weights v1 — 5 dimensions (used by matching.service.ts / UI)
// Must sum to 1.0
export const MATCH_WEIGHTS = {
  skill: 0.35,
  competency: 0.25,
  availability: 0.20,
  billability: 0.12,
  evidence: 0.08,
} as const;

// Match score weights v2 — 7 dimensions (used by excel-export.service.ts / CLI)
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
