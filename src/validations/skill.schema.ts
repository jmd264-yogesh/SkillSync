import { z } from "zod";

export const createSkillSchema = z.object({
  name: z.string().min(1, "Skill name is required").max(100),
  description: z.string().max(500).optional(),
  category: z.enum([
    "SKILL",
    "FRAMEWORK",
    "CONCEPT",
    "TOOL",
    "CERTIFICATION",
  ]),
});

export type CreateSkillInput = z.infer<typeof createSkillSchema>;

export const updateSkillSchema = createSkillSchema.partial();

export type UpdateSkillInput = z.infer<typeof updateSkillSchema>;

export const skillSubmissionSchema = z.object({
  skillId: z.string().uuid("Invalid skill ID"),
  selfAssessedLevel: z
    .number()
    .int()
    .min(1, "Minimum level is 1")
    .max(5, "Maximum level is 5"),
  evidenceType: z
    .enum([
      "CERTIFICATION",
      "ASSESSMENT_SCORE",
      "PROJECT_DOCUMENT",
      "SUPPORTING_DOCUMENT",
    ])
    .optional(),
  evidenceTitle: z.string().max(200).optional(),
  evidenceDescription: z.string().max(1000).optional(),
  evidenceFileUrl: z.string().url().optional(),
  evidenceScore: z.string().max(50).optional(),
});

export type SkillSubmissionInput = z.infer<typeof skillSubmissionSchema>;

export const skillApprovalSchema = z.object({
  employeeSkillId: z.string().uuid("Invalid employee skill ID"),
  action: z.enum(["APPROVED", "REJECTED"]),
  validatedLevel: z.number().int().min(1).max(5).optional(),
  reviewComment: z.string().max(1000).optional(),
});

export type SkillApprovalInput = z.infer<typeof skillApprovalSchema>;
