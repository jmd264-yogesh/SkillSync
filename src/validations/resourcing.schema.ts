import { z } from "zod";

export const recommendForPipelineSchema = z.object({
  pipelineRequestId: z.string().uuid(),
});

export const recommendAdHocSchema = z.object({
  requiredSkills: z.array(
    z.object({
      skillId: z.string().uuid(),
      skillName: z.string().min(1),
      requiredLevel: z.number().int().min(1).max(5),
    }),
  ).min(1),
  windowStart: z.string().datetime().optional(),
  windowEnd: z.string().datetime().optional(),
  topN: z.number().int().min(1).max(50).optional(),
});

export const forecastNewProjectsSchema = z.object({
  pipelineRequestIds: z.array(z.string().uuid()).optional(),
  adHoc: z.array(
    z.object({
      category: z.enum([
        "D_AND_D","TACTICAL_BUILD","DATA_PLATFORM_BUILD","ENTERPRISE_BUILD",
        "DATA_SCIENCE","AI_PROJECT","MS_PROJECT","FULL_STACK","VALUE_CREATION","OTHER",
      ]),
      count: z.number().int().min(1).max(100),
      start: z.string().datetime(),
      weeks: z.number().min(1).max(104),
    }),
  ).optional(),
});

export const pipelineOutlookSchema = z.object({
  months: z.number().int().min(1).max(24).optional().default(6),
  cluster: z.number().int().optional(),
});

export const allocationReportFilterSchema = z.object({
  status: z.enum(["ALL", "OVER", "FULL", "UNDER", "BENCH"]).optional().default("ALL"),
  coeId: z.string().uuid().optional(),
  designationId: z.string().uuid().optional(),
});

export const copilotTurnSchema = z.object({
  history: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string(),
    }),
  ).min(1).max(20),
});

export type RecommendForPipelineInput = z.infer<typeof recommendForPipelineSchema>;
export type RecommendAdHocInput = z.infer<typeof recommendAdHocSchema>;
export type ForecastNewProjectsInput = z.infer<typeof forecastNewProjectsSchema>;
export type PipelineOutlookInput = z.infer<typeof pipelineOutlookSchema>;
export type AllocationReportFilterInput = z.infer<typeof allocationReportFilterSchema>;
export type CopilotTurnInput = z.infer<typeof copilotTurnSchema>;
