import { z } from "zod";

export const createClusterSchema = z.object({
  name: z.string().min(1, "Cluster name is required").max(100),
  description: z.string().max(500).optional(),
});

export type CreateClusterInput = z.infer<typeof createClusterSchema>;

export const createCoeSchema = z.object({
  name: z.string().min(1, "COE name is required").max(100),
  description: z.string().max(500).optional(),
});

export type CreateCoeInput = z.infer<typeof createCoeSchema>;

export const createDesignationSchema = z.object({
  name: z.string().min(1, "Designation name is required").max(100),
  level: z.number().int().min(1, "Level must be at least 1"),
  description: z.string().max(500).optional(),
});

export type CreateDesignationInput = z.infer<typeof createDesignationSchema>;

export const createCompetencyLevelSchema = z.object({
  level: z.number().int().min(1).max(10),
  name: z.string().min(1, "Level name is required").max(50),
  description: z.string().max(500).optional(),
});

export type CreateCompetencyLevelInput = z.infer<
  typeof createCompetencyLevelSchema
>;

export const mapEmployeeToCoeSchema = z.object({
  employeeId: z.string().uuid(),
  coeId: z.string().uuid(),
});

export type MapEmployeeToCoeInput = z.infer<typeof mapEmployeeToCoeSchema>;

export const mapEmployeeToManagerSchema = z.object({
  employeeId: z.string().uuid(),
  managerId: z.string().uuid(),
});

export type MapEmployeeToManagerInput = z.infer<
  typeof mapEmployeeToManagerSchema
>;

export const mapSkillToCoeSchema = z.object({
  coeId: z.string().uuid(),
  skillId: z.string().uuid(),
  targetCompetency: z.number().int().min(1).max(5),
});

export type MapSkillToCoeInput = z.infer<typeof mapSkillToCoeSchema>;

export const mapSkillToDesignationSchema = z.object({
  designationId: z.string().uuid(),
  skillId: z.string().uuid(),
  targetCompetency: z.number().int().min(1).max(5),
});

export type MapSkillToDesignationInput = z.infer<
  typeof mapSkillToDesignationSchema
>;
