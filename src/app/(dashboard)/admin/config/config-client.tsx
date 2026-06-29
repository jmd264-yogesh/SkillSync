"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Settings2, Building2, Briefcase, Award, Layers, Users } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { CoeClient } from "@/app/(dashboard)/admin/coe/coe-client";
import { DesignationsClient } from "@/app/(dashboard)/admin/designations/designations-client";
import { SkillsClient } from "@/app/(dashboard)/admin/skills/skills-client";
import { CompetencyLevelsClient } from "@/app/(dashboard)/admin/competency-levels/competency-levels-client";
import { ClustersClient } from "@/app/(dashboard)/admin/clusters/clusters-client";
import type { getCoes } from "@/server/actions/coe";
import type { getDesignations } from "@/server/actions/designation";
import type { getSkills } from "@/server/actions/skill";
import type { getCompetencyLevels } from "@/server/actions/competency-level";
import type { getClusters } from "@/server/actions/cluster";

type Coes = Awaited<ReturnType<typeof getCoes>>;
type Designations = Awaited<ReturnType<typeof getDesignations>>;
type Skills = Awaited<ReturnType<typeof getSkills>>;
type Levels = Awaited<ReturnType<typeof getCompetencyLevels>>;
type Clusters = Awaited<ReturnType<typeof getClusters>>;

interface ConfigClientProps {
  coes: Coes;
  designations: Designations;
  skills: Skills;
  levels: Levels;
  clusters: Clusters;
}

const TABS = [
  { value: "coe",         label: "COEs",              icon: Building2, color: "text-indigo-600" },
  { value: "clusters",    label: "Clusters",           icon: Users,     color: "text-violet-600" },
  { value: "designations",label: "Designations",       icon: Briefcase, color: "text-sky-600" },
  { value: "skills",      label: "Skills",             icon: Award,     color: "text-amber-600" },
  { value: "competency",  label: "Competency Levels",  icon: Layers,    color: "text-emerald-600" },
] as const;

type TabValue = (typeof TABS)[number]["value"];

export function ConfigClient({ coes, designations, skills, levels, clusters }: ConfigClientProps) {
  const [activeTab, setActiveTab] = useState<TabValue>("coe");

  return (
    <div>
      <PageHeader
        title="Platform Configuration"
        description="Manage COEs, clusters, designations, skills, and competency levels"
      >
        <div className="flex items-center gap-2 rounded-xl bg-indigo-50 px-3 py-1.5 text-indigo-600">
          <Settings2 className="h-4 w-4" />
          <span className="text-sm font-semibold">Admin Config</span>
        </div>
      </PageHeader>

      {/* ── Tab Bar ── */}
      <div className="mb-6 flex justify-start">
        <div className="flex items-center gap-1.5 p-1.5 bg-slate-100/80 backdrop-blur-md rounded-2xl border border-slate-200/60 shadow-inner max-w-full overflow-x-auto no-scrollbar">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.value;
            return (
              <button
                key={tab.value}
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.value)}
                className={`
                  relative flex items-center gap-2 px-4.5 py-2 text-sm font-semibold rounded-xl
                  transition-all duration-300 select-none cursor-pointer outline-none focus:outline-none
                  ${isActive
                    ? "text-white shadow-md shadow-indigo-600/10"
                    : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
                  }
                `}
              >
                {isActive && (
                  <motion.div
                    layoutId="config-tab-active-bg"
                    className="absolute inset-0 bg-indigo-600 rounded-xl"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-2">
                  <tab.icon className={`h-4.5 w-4.5 transition-transform duration-300 ${isActive ? "text-white scale-110" : "text-slate-400 group-hover:text-slate-600"}`} />
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Tab Panels ── */}
      <div>
        {activeTab === "coe" && <CoeClient coes={coes} />}
        {activeTab === "clusters" && <ClustersClient clusters={clusters} />}
        {activeTab === "designations" && <DesignationsClient designations={designations} />}
        {activeTab === "skills" && <SkillsClient skills={skills} />}
        {activeTab === "competency" && <CompetencyLevelsClient levels={levels} />}
      </div>
    </div>
  );
}