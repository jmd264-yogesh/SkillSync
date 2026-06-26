"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

const LEVEL_NAMES: Record<number, string> = {
  0: "Unrated",
  1: "Beginner",
  2: "Basic",
  3: "Intermediate",
  4: "Advanced",
  5: "Expert",
};

export interface LearningStep {
  order: number;
  title: string;
  type: "course" | "practice" | "assessment" | "project" | "certification";
  description: string;
  duration: string;
}

export interface RecommendedPath {
  skillId: string;
  skillName: string;
  category: string;
  currentLevel: number;
  targetLevel: number;
  gap: number;
  steps: LearningStep[];
}

function generateSteps(skillName: string, fromLevel: number, toLevel: number): LearningStep[] {
  const steps: LearningStep[] = [];
  let order = 1;

  for (let lvl = fromLevel; lvl < toLevel; lvl++) {
    const nextName = LEVEL_NAMES[lvl + 1] ?? "Expert";

    if (lvl === 0) {
      steps.push({
        order: order++,
        type: "course",
        title: `${skillName} — Foundations`,
        description: `Learn the fundamentals of ${skillName} to reach ${nextName} level`,
        duration: "6–10 hours",
      });
    } else if (lvl === 1) {
      steps.push({
        order: order++,
        type: "course",
        title: `${skillName} — Core Concepts`,
        description: `Build hands-on experience and deepen understanding`,
        duration: "8–16 hours",
      });
      steps.push({
        order: order++,
        type: "practice",
        title: "Practice Exercises",
        description: `Reinforce ${skillName} through guided problems and exercises`,
        duration: "4–6 hours",
      });
    } else if (lvl === 2) {
      steps.push({
        order: order++,
        type: "course",
        title: `Advanced ${skillName}`,
        description: "Master advanced patterns, performance, and real-world applications",
        duration: "12–20 hours",
      });
      steps.push({
        order: order++,
        type: "project",
        title: "Project Implementation",
        description: `Build a meaningful project demonstrating ${skillName} at ${nextName} level`,
        duration: "1–2 weeks",
      });
    } else {
      steps.push({
        order: order++,
        type: "project",
        title: "Expert-Level Contribution",
        description: `Lead or make a significant contribution to a production system using ${skillName}`,
        duration: "2–4 weeks",
      });
      steps.push({
        order: order++,
        type: "certification",
        title: `${skillName} Certification`,
        description: "Obtain a recognized industry certification for formal validation",
        duration: "1–3 months",
      });
    }
  }

  steps.push({
    order: order++,
    type: "assessment",
    title: "Submit for Manager Validation",
    description: "Complete a self-assessment and submit your skill for manager approval",
    duration: "30–60 min",
  });

  return steps;
}

export async function getMyLearningPaths(): Promise<RecommendedPath[]> {
  const session = await auth();
  if (!session?.user?.employeeId) return [];

  const employee = await db.employee.findUnique({
    where: { id: session.user.employeeId },
    include: {
      coe: { include: { coeSkills: { include: { skill: true } } } },
      designation: { include: { designationSkills: { include: { skill: true } } } },
      employeeSkills: {
        where: { status: "APPROVED" },
        include: { skill: true },
      },
    },
  });

  if (!employee) return [];

  const targetMap = new Map<string, { targetLevel: number; skillName: string; category: string }>();

  for (const cs of employee.coe?.coeSkills ?? []) {
    targetMap.set(cs.skillId, {
      targetLevel: cs.targetCompetency,
      skillName: cs.skill.name,
      category: cs.skill.category,
    });
  }

  for (const ds of employee.designation?.designationSkills ?? []) {
    const existing = targetMap.get(ds.skillId);
    if (existing) {
      targetMap.set(ds.skillId, {
        ...existing,
        targetLevel: Math.max(existing.targetLevel, ds.targetCompetency),
      });
    } else {
      targetMap.set(ds.skillId, {
        targetLevel: ds.targetCompetency,
        skillName: ds.skill.name,
        category: ds.skill.category,
      });
    }
  }

  const currentMap = new Map<string, number>();
  for (const es of employee.employeeSkills) {
    currentMap.set(es.skillId, es.validatedLevel ?? 0);
  }

  const paths: RecommendedPath[] = [];

  for (const [skillId, target] of targetMap) {
    const currentLevel = currentMap.get(skillId) ?? 0;
    const gap = target.targetLevel - currentLevel;
    if (gap <= 0) continue;

    paths.push({
      skillId,
      skillName: target.skillName,
      category: target.category,
      currentLevel,
      targetLevel: target.targetLevel,
      gap,
      steps: generateSteps(target.skillName, currentLevel, target.targetLevel),
    });
  }

  paths.sort((a, b) => b.gap - a.gap);
  return paths;
}
