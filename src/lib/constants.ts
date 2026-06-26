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
