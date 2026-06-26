"use client";

import { Users, Award, Building2, Briefcase } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import type { SkillCategory } from "@prisma/client";

interface Reportee {
  id: string;
  name: string;
  employeeCode: string;
  coe: { name: string } | null;
  designation: { name: string } | null;
  employeeSkills: {
    id: string;
    validatedLevel: number | null;
    skill: { name: string; category: SkillCategory };
  }[];
  _count: { employeeSkills: number };
}

const categoryColors: Record<SkillCategory, string> = {
  SKILL: "bg-blue-500/10 text-blue-700",
  FRAMEWORK: "bg-purple-500/10 text-purple-700",
  CONCEPT: "bg-amber-500/10 text-amber-700",
  TOOL: "bg-emerald-500/10 text-emerald-700",
  CERTIFICATION: "bg-red-500/10 text-red-700",
};

export function TeamSkillsClient({ reportees }: { reportees: Reportee[] }) {
  return (
    <div>
      <PageHeader title="Team Skills" description="Validated skill profiles across your team" />

      <Card className="glass-panel border-0 mb-6">
        <CardContent className="p-4 flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
            <Users className="h-6 w-6 text-white" />
          </div>
          <div>
            <p className="text-2xl font-bold">{reportees.length}</p>
            <p className="text-sm text-muted-foreground">Team Members</p>
          </div>
          <div className="ml-8">
            <p className="text-2xl font-bold">{reportees.reduce((acc, r) => acc + r.employeeSkills.length, 0)}</p>
            <p className="text-sm text-muted-foreground">Validated Skills</p>
          </div>
        </CardContent>
      </Card>

      {reportees.length === 0 ? (
        <EmptyState icon={Users} title="No team members" description="You don't have any direct reportees assigned yet." />
      ) : (
        <div className="grid gap-3">
          {reportees.map((r) => (
            <Card key={r.id} className="glass-panel border-0 hover:shadow-md transition-all">
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shrink-0">
                    <span className="text-white font-bold">{r.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-lg">{r.name}</h3>
                      <span className="text-sm text-muted-foreground font-mono">{r.employeeCode}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                      {r.coe && <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{r.coe.name}</span>}
                      {r.designation && <span className="flex items-center gap-1"><Briefcase className="h-3 w-3" />{r.designation.name}</span>}
                    </div>
                    {r.employeeSkills.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {r.employeeSkills.map((es) => (
                          <div key={es.id} className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs">
                            <Badge variant="outline" className={`${categoryColors[es.skill.category]} text-[10px] px-1 py-0`}>
                              {es.skill.category.charAt(0)}
                            </Badge>
                            <span className="font-medium">{es.skill.name}</span>
                            <Progress value={((es.validatedLevel ?? 0) / 5) * 100} className="w-10 h-1.5" />
                            <span className="font-mono text-[10px]">{es.validatedLevel}/5</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <Badge variant="secondary"><Award className="h-3 w-3 mr-1" />{r.employeeSkills.length}</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
