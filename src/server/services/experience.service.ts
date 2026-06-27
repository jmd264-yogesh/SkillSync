import { db } from "@/lib/db";
import { extractExperienceFromText } from "@/lib/ai/experience-extractor";
import type { ProjectType } from "@/validations/project-experience.schema";

export interface CreateExperienceDocInput {
  employeeId: string;
  title: string;
  clientIndustry?: string;
  projectType: ProjectType;
  techStack?: string;
  businessContext?: string;
  solutionProvided?: string;
  myRole?: string;
  teamSize?: number;
  startDate?: Date;
  endDate?: Date;
  rawText?: string;
}

export async function createExperienceDoc(input: CreateExperienceDocInput) {
  return db.projectExperienceDoc.create({ data: input });
}

export async function getExperienceDocs(employeeId: string) {
  return db.projectExperienceDoc.findMany({
    where: { employeeId },
    orderBy: { createdAt: "desc" },
  });
}

export async function extractAndStoreSkills(docId: string, employeeId: string) {
  const doc = await db.projectExperienceDoc.findUnique({ where: { id: docId } });
  if (!doc || doc.employeeId !== employeeId) return null;

  const context = [
    `Project Title: ${doc.title}`,
    doc.clientIndustry && `Client Industry: ${doc.clientIndustry}`,
    `Project Type: ${doc.projectType}`,
    doc.myRole && `My Role: ${doc.myRole}`,
    doc.teamSize && `Team Size: ${doc.teamSize}`,
    doc.techStack && `Tech Stack / Technologies: ${doc.techStack}`,
    doc.businessContext && `Business Context:\n${doc.businessContext}`,
    doc.solutionProvided && `Solution Provided:\n${doc.solutionProvided}`,
    doc.rawText && `Additional Details:\n${doc.rawText}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const extracted = await extractExperienceFromText(context);

  await db.projectExperienceDoc.update({
    where: { id: docId },
    data: {
      extractionStatus: extracted.skills.length > 0 ? "EXTRACTED" : "FAILED",
      extractedSkills: JSON.stringify(extracted.skills),
      aiSummary: extracted.summary ?? null,
    },
  });

  return extracted;
}

export async function applySkillsToProfile(
  docId: string,
  employeeId: string,
  selectedSkills: { name: string; level: number }[],
): Promise<string[]> {
  const doc = await db.projectExperienceDoc.findUnique({ where: { id: docId } });
  if (!doc || doc.employeeId !== employeeId) throw new Error("Document not found");

  const applied: string[] = [];

  for (const { name, level } of selectedSkills) {
    const skill = await db.skill.upsert({
      where: { name },
      update: {},
      create: { name, category: "SKILL" },
    });

    const existing = await db.employeeSkill.findUnique({
      where: { employeeId_skillId: { employeeId, skillId: skill.id } },
    });

    if (!existing) {
      const es = await db.employeeSkill.create({
        data: { employeeId, skillId: skill.id, selfAssessedLevel: level, status: "PENDING" },
      });
      await db.evidence.create({
        data: {
          employeeSkillId: es.id,
          employeeId,
          type: "PROJECT_DOCUMENT",
          title: `Project: ${doc.title}`,
          description: doc.aiSummary ?? `Experience documented from ${doc.projectType} project`,
        },
      });
      applied.push(name);
    } else if (existing.selfAssessedLevel < level && existing.status !== "APPROVED") {
      await db.employeeSkill.update({
        where: { id: existing.id },
        data: { selfAssessedLevel: level, status: "PENDING" },
      });
      applied.push(name);
    }
  }

  await db.projectExperienceDoc.update({
    where: { id: docId },
    data: { extractionStatus: "APPLIED" },
  });

  return applied;
}
