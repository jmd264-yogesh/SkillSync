import { z } from "zod";

export const PROJECT_TYPES = [
  "REPORTING",
  "DATA_MIGRATION",
  "PLATFORM_BUILD",
  "DATA_SCIENCE",
  "INTEGRATION",
  "CLOUD_MIGRATION",
  "API_DEVELOPMENT",
  "ANALYTICS",
  "MANAGED_SERVICES",
  "EXIT_TRANSITION",
  "OTHER",
] as const;

export type ProjectType = (typeof PROJECT_TYPES)[number];

export const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  REPORTING: "Reporting / Dashboard",
  DATA_MIGRATION: "Data Migration",
  PLATFORM_BUILD: "Platform Build",
  DATA_SCIENCE: "Data Science / ML",
  INTEGRATION: "System Integration",
  CLOUD_MIGRATION: "Cloud Migration",
  API_DEVELOPMENT: "API Development",
  ANALYTICS: "Analytics",
  MANAGED_SERVICES: "Managed Services",
  EXIT_TRANSITION: "Exit / Transition",
  OTHER: "Other",
};

export const COMPETENCY_LEVEL_LABELS: Record<number, string> = {
  1: "Basic Awareness",
  2: "Beginner",
  3: "Working Proficiency",
  4: "Advanced",
  5: "Expert",
};

export const createExperienceDocSchema = z.object({
  title: z.string().min(1, "Project title is required").max(200),
  clientIndustry: z.string().max(100).optional(),
  projectType: z.enum(PROJECT_TYPES),
  techStack: z.string().max(500).optional(),
  businessContext: z.string().max(3000).optional(),
  solutionProvided: z.string().max(3000).optional(),
  myRole: z.string().max(200).optional(),
  teamSize: z.coerce.number().int().positive().max(500).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  rawText: z.string().max(10000).optional(),
});

export const applySkillsSchema = z.object({
  docId: z.string().uuid(),
  skills: z.array(
    z.object({
      name: z.string().min(1),
      level: z.number().int().min(1).max(5),
    }),
  ).min(1, "Select at least one skill to apply"),
});
