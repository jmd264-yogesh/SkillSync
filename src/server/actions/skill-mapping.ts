"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";

export async function getCoeSkillMappings(coeId: string) {
  return db.coeSkill.findMany({
    where: { coeId },
    include: {
      skill: {
        select: {
          id: true,
          name: true,
          category: true,
        },
      },
    },
    orderBy: { skill: { name: "asc" } },
  });
}

export async function getDesignationSkillMappings(designationId: string) {
  return db.designationSkill.findMany({
    where: { designationId },
    include: {
      skill: {
        select: {
          id: true,
          name: true,
          category: true,
        },
      },
    },
    orderBy: { skill: { name: "asc" } },
  });
}

export async function mapSkillToCoe(formData: FormData) {
  const coeId = formData.get("coeId") as string;
  const skillId = formData.get("skillId") as string;
  const targetCompetency = parseInt(formData.get("targetCompetency") as string, 10);

  if (!coeId || !skillId || isNaN(targetCompetency)) {
    return { error: "COE ID, Skill ID, and Target Competency are required" };
  }

  try {
    await db.coeSkill.upsert({
      where: {
        coeId_skillId: {
          coeId,
          skillId,
        },
      },
      update: {
        targetCompetency,
      },
      create: {
        coeId,
        skillId,
        targetCompetency,
      },
    });

    revalidatePath("/admin/skill-mapping");
    return { success: true };
  } catch (error: unknown) {
    console.error("Failed to map skill to COE:", error);
    return { error: "An error occurred while mapping the skill" };
  }
}

export async function deleteCoeSkill(coeId: string, skillId: string) {
  try {
    await db.coeSkill.delete({
      where: {
        coeId_skillId: {
          coeId,
          skillId,
        },
      },
    });

    revalidatePath("/admin/skill-mapping");
    return { success: true };
  } catch (error: unknown) {
    console.error("Failed to delete COE skill mapping:", error);
    return { error: "An error occurred while deleting the mapping" };
  }
}

export async function mapSkillToDesignation(formData: FormData) {
  const designationId = formData.get("designationId") as string;
  const skillId = formData.get("skillId") as string;
  const targetCompetency = parseInt(formData.get("targetCompetency") as string, 10);

  if (!designationId || !skillId || isNaN(targetCompetency)) {
    return { error: "Designation ID, Skill ID, and Target Competency are required" };
  }

  try {
    await db.designationSkill.upsert({
      where: {
        designationId_skillId: {
          designationId,
          skillId,
        },
      },
      update: {
        targetCompetency,
      },
      create: {
        designationId,
        skillId,
        targetCompetency,
      },
    });

    revalidatePath("/admin/skill-mapping");
    return { success: true };
  } catch (error: unknown) {
    console.error("Failed to map skill to Designation:", error);
    return { error: "An error occurred while mapping the skill" };
  }
}

export async function deleteDesignationSkill(designationId: string, skillId: string) {
  try {
    await db.designationSkill.delete({
      where: {
        designationId_skillId: {
          designationId,
          skillId,
        },
      },
    });

    revalidatePath("/admin/skill-mapping");
    return { success: true };
  } catch (error: unknown) {
    console.error("Failed to delete Designation skill mapping:", error);
    return { error: "An error occurred while deleting the mapping" };
  }
}
