import { z } from "zod";

export const createEmployeeSchema = z.object({
  employeeCode: z.string().min(1, "Employee code is required").max(20),
  name: z.string().min(1, "Name is required").max(100),
  email: z.string().email("Invalid email address"),
  coeId: z.string().uuid().optional(),
  designationId: z.string().uuid().optional(),
  managerId: z.string().uuid().optional(),
  clusterId: z.string().uuid().optional(),
});

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;

export const updateEmployeeSchema = createEmployeeSchema.partial().omit({
  employeeCode: true,
});

export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;

export const talentDiscoveryFilterSchema = z.object({
  skillIds: z.array(z.string().uuid()).optional(),
  minCompetencyLevel: z.number().int().min(1).max(5).optional(),
  coeId: z.string().uuid().optional(),
  designationId: z.string().uuid().optional(),
  managerId: z.string().uuid().optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
});

export type TalentDiscoveryFilter = z.infer<typeof talentDiscoveryFilterSchema>;
