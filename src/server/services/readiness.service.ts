export interface ReadinessResult {
  met: number;
  partial: number;
  missing: number;
  total: number;
  percentage: number;
}

export function computeReadiness(
  coeSkills: { skillId: string; targetCompetency: number }[],
  designationSkills: { skillId: string; targetCompetency: number }[],
  approvedSkills: { skillId: string; validatedLevel: number | null }[],
): ReadinessResult {
  const targetMap = new Map<string, number>();

  for (const cs of coeSkills) {
    targetMap.set(cs.skillId, cs.targetCompetency);
  }
  for (const ds of designationSkills) {
    const existing = targetMap.get(ds.skillId);
    targetMap.set(ds.skillId, existing ? Math.max(existing, ds.targetCompetency) : ds.targetCompetency);
  }

  const currentMap = new Map<string, number>();
  for (const es of approvedSkills) {
    currentMap.set(es.skillId, es.validatedLevel ?? 0);
  }

  let met = 0, partial = 0, missing = 0;
  for (const [skillId, targetLevel] of targetMap) {
    const current = currentMap.get(skillId) ?? 0;
    if (current >= targetLevel) met++;
    else if (current > 0) partial++;
    else missing++;
  }

  const total = targetMap.size;
  const percentage = total > 0 ? Math.round((met / total) * 100) : 0;
  return { met, partial, missing, total, percentage };
}
