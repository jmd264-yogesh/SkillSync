"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { createExperienceDocSchema, applySkillsSchema } from "@/validations/project-experience.schema";
import type { ProjectType } from "@/validations/project-experience.schema";
import * as experienceService from "@/server/services/experience.service";

export async function createExperienceDoc(formData: FormData) {
  const session = await auth();
  if (!session?.user?.employeeId) return { error: "Not authenticated as an employee" };

  const raw = {
    title: formData.get("title"),
    clientIndustry: formData.get("clientIndustry") || undefined,
    projectType: formData.get("projectType"),
    techStack: formData.get("techStack") || undefined,
    businessContext: formData.get("businessContext") || undefined,
    solutionProvided: formData.get("solutionProvided") || undefined,
    myRole: formData.get("myRole") || undefined,
    teamSize: formData.get("teamSize") ? Number(formData.get("teamSize")) : undefined,
    startDate: formData.get("startDate") || undefined,
    endDate: formData.get("endDate") || undefined,
    rawText: formData.get("rawText") || undefined,
  };

  const parsed = createExperienceDocSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  await experienceService.createExperienceDoc({
    employeeId: session.user.employeeId,
    ...parsed.data,
    projectType: parsed.data.projectType as ProjectType,
    startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : undefined,
    endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : undefined,
  });

  revalidatePath("/employee/my-experience");
  return { success: true };
}

export async function extractSkillsFromDoc(docId: string) {
  const session = await auth();
  if (!session?.user?.employeeId) return { error: "Not authenticated" };
  if (!docId) return { error: "Document ID required" };

  const extracted = await experienceService.extractAndStoreSkills(docId, session.user.employeeId);
  if (!extracted) return { error: "Document not found" };
  if (extracted.skills.length === 0) return { error: "No skills could be extracted. Try adding more detail to the description." };

  revalidatePath("/employee/my-experience");
  return { success: true, extracted };
}

export async function applyExtractedSkills(docId: string, skills: { name: string; level: number }[]) {
  const session = await auth();
  if (!session?.user?.employeeId) return { error: "Not authenticated" };

  const parsed = applySkillsSchema.safeParse({ docId, skills });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  try {
    const applied = await experienceService.applySkillsToProfile(
      docId,
      session.user.employeeId,
      parsed.data.skills,
    );
    revalidatePath("/employee/my-experience");
    revalidatePath("/employee/my-skills");
    return { success: true, count: applied.length };
  } catch {
    return { error: "Failed to apply skills. Please try again." };
  }
}

export async function getMyExperienceDocs() {
  const session = await auth();
  if (!session?.user?.employeeId) return [];
  return experienceService.getExperienceDocs(session.user.employeeId);
}
