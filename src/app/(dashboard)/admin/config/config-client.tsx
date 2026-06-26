"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Settings2, Building2, Briefcase, Award, Layers } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/page-header";
import { CoeClient } from "@/app/(dashboard)/admin/coe/coe-client";
import { DesignationsClient } from "@/app/(dashboard)/admin/designations/designations-client";
import { SkillsClient } from "@/app/(dashboard)/admin/skills/skills-client";
import { CompetencyLevelsClient } from "@/app/(dashboard)/admin/competency-levels/competency-levels-client";
import type { getCoes } from "@/server/actions/coe";
import type { getDesignations } from "@/server/actions/designation";
import type { getSkills } from "@/server/actions/skill";
import type { getCompetencyLevels } from "@/server/actions/competency-level";

type Coes = Awaited<ReturnType<typeof getCoes>>;
type Designations = Awaited<ReturnType<typeof getDesignations>>;
type Skills = Awaited<ReturnType<typeof getSkills>>;
type Levels = Awaited<ReturnType<typeof getCompetencyLevels>>;

interface ConfigClientProps {
  coes: Coes;
  designations: Designations;
  skills: Skills;
  levels: Levels;
}

const TABS = [
  { value: "coe", label: "COEs", icon: Building2 },
  { value: "designations", label: "Designations", icon: Briefcase },
  { value: "skills", label: "Skills", icon: Award },
  { value: "competency", label: "Competency Levels", icon: Layers },
] as const;

export function ConfigClient({
  coes,
  designations,
  skills,
  levels,
}: ConfigClientProps) {
  const [activeTab, setActiveTab] = useState("coe");

  return (
    <div>
      <PageHeader
        title="Platform Configuration"
        description="Manage COEs, designations, skills, and competency levels"
      >
        <div className="flex items-center gap-2 rounded-xl bg-indigo-50 px-3 py-1.5 text-indigo-600">
          <Settings2 className="h-4 w-4" />
          <span className="text-sm font-semibold">Admin Config</span>
        </div>
      </PageHeader>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="h-auto w-full justify-start gap-1 rounded-2xl bg-gray-100/80 p-1.5 mb-8">
          {TABS.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="cursor-pointer relative flex items-center gap-2 rounded-xl px-5 py-5 text-lg font-semibold text-gray-600 transition-colors data-[state=active]:text-indigo-700"
            >
              {activeTab === tab.value && (
                <motion.div
                  layoutId="active-tab-pill"
                  className="absolute inset-0 rounded-xl bg-white shadow-sm"
                  transition={{
                    type: "spring",
                    stiffness: 450,
                    damping: 35,
                  }}
                />
              )}

              <span className="relative z-10 flex items-center gap-2">
                <tab.icon className="h-6 w-6" />
                {tab.label}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="coe">
          <CoeClient coes={coes} />
        </TabsContent>

        <TabsContent value="designations">
          <DesignationsClient designations={designations} />
        </TabsContent>

        <TabsContent value="skills">
          <SkillsClient skills={skills} />
        </TabsContent>

        <TabsContent value="competency">
          <CompetencyLevelsClient levels={levels} />
        </TabsContent>
      </Tabs>
    </div>
  );
}