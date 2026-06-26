import { z } from "zod";

export const createReviewCycleSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
});

export type CreateReviewCycleInput = z.infer<typeof createReviewCycleSchema>;

export const updateReviewCycleSchema = createReviewCycleSchema.partial();
export type UpdateReviewCycleInput = z.infer<typeof updateReviewCycleSchema>;

export const createFeedbackFormSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(500).optional(),
  formType: z.enum(["PM_FEEDBACK", "CDM_ASSESSMENT", "HR_FEEDBACK"]),
  reviewCycleId: z.string().uuid("Invalid cycle ID"),
  sections: z.array(
    z.object({
      title: z.string().min(1, "Section title is required").max(100),
      description: z.string().max(300).optional(),
      order: z.number().int().min(0),
      questions: z.array(
        z.object({
          text: z.string().min(1, "Question text is required").max(300),
          type: z.enum(["RATING", "TEXT"]),
          required: z.boolean().default(true),
          order: z.number().int().min(0),
        })
      ).min(1, "Each section needs at least one question"),
    })
  ).min(1, "Form needs at least one section"),
});

export type CreateFeedbackFormInput = z.infer<typeof createFeedbackFormSchema>;

export const createAssignmentSchema = z.object({
  reviewCycleId: z.string().uuid(),
  formId: z.string().uuid(),
  reviewerId: z.string().uuid("Invalid reviewer ID"),
  employeeId: z.string().uuid("Invalid employee ID"),
  projectId: z.string().uuid().optional(),
  dueDate: z.string().optional(),
});

export type CreateAssignmentInput = z.infer<typeof createAssignmentSchema>;

export const submitFeedbackSchema = z.object({
  assignmentId: z.string().uuid(),
  responses: z.array(
    z.object({
      questionId: z.string().uuid(),
      ratingValue: z.number().int().min(1).max(5).optional(),
      textValue: z.string().max(2000).optional(),
    })
  ),
});

export type SubmitFeedbackInput = z.infer<typeof submitFeedbackSchema>;

export const generateSummarySchema = z.object({
  reviewCycleId: z.string().uuid(),
  employeeId: z.string().uuid(),
  promotionNotes: z.string().max(1000).optional(),
});

export type GenerateSummaryInput = z.infer<typeof generateSummarySchema>;
