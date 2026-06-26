"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Trash2, Award, Plus, ChevronDown, ChevronRight, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { SkillFormDialog } from "@/components/forms/skill-form-dialog";
import { deleteSkill, updateSkill } from "@/server/actions/skill";
import { EmptyState } from "@/components/shared/empty-state";
import type { SkillCategory } from "@prisma/client";

interface Skill {
  id: string;
  name: string;
  category: SkillCategory;
  description: string | null;
  _count: { employeeSkills: number; coeSkills: number; designationSkills: number };
}

const categoryConfig: Record<SkillCategory, { label: string; bg: string; text: string; dot: string; border: string }> = {
  SKILL: { label: "Skills", bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-400", border: "border-blue-100" },
  FRAMEWORK: { label: "Frameworks", bg: "bg-violet-50", text: "text-violet-700", dot: "bg-violet-400", border: "border-violet-100" },
  CONCEPT: { label: "Concepts", bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-400", border: "border-amber-100" },
  TOOL: { label: "Tools", bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-400", border: "border-emerald-100" },
  CERTIFICATION: { label: "Certifications", bg: "bg-rose-50", text: "text-rose-700", dot: "bg-rose-400", border: "border-rose-100" },
};

const CATEGORY_ORDER: SkillCategory[] = ["SKILL", "FRAMEWORK", "CONCEPT", "TOOL", "CERTIFICATION"];

const CATEGORIES: { value: SkillCategory; label: string }[] = [
  { value: "SKILL", label: "Skill" },
  { value: "FRAMEWORK", label: "Framework" },
  { value: "CONCEPT", label: "Concept" },
  { value: "TOOL", label: "Tool" },
  { value: "CERTIFICATION", label: "Certification" },
];

export function SkillsClient({ skills }: { skills: Skill[] }) {
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  // Drawer state
  const [drawerSkill, setDrawerSkill] = useState<Skill | null>(null);
  const [drawerName, setDrawerName] = useState("");
  const [drawerCategory, setDrawerCategory] = useState<SkillCategory>("SKILL");
  const [drawerDesc, setDrawerDesc] = useState("");
  const [drawerSaving, setDrawerSaving] = useState(false);

  const grouped = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    config: categoryConfig[cat],
    items: skills.filter((s) => s.category === cat),
  })).filter((g) => g.items.length > 0);

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    const result = await deleteSkill(deleteId);
    setDeleting(false);
    if (result.error) { toast.error(result.error); } else {
      toast.success("Skill deleted");
      if (drawerSkill?.id === deleteId) setDrawerSkill(null);
    }
    setDeleteId(null);
  }

  function openDrawer(skill: Skill) {
    setDrawerSkill(skill);
    setDrawerName(skill.name);
    setDrawerCategory(skill.category);
    setDrawerDesc(skill.description ?? "");
  }

  async function handleDrawerSave() {
    if (!drawerSkill) return;
    setDrawerSaving(true);
    const fd = new FormData();
    fd.append("name", drawerName);
    fd.append("category", drawerCategory);
    fd.append("description", drawerDesc);
    const result = await updateSkill(drawerSkill.id, fd);
    setDrawerSaving(false);
    if (result.error) { toast.error(result.error); return; }
    toast.success("Skill updated");
    setDrawerSkill(null);
  }

  function toggleSection(cat: string) {
    setCollapsed((prev) => ({ ...prev, [cat]: !prev[cat] }));
  }

  return (
    <div>
      {/* Summary stat pills */}
      <div className="flex gap-3 mb-5 flex-wrap items-center justify-between">
        <div className="flex gap-3 flex-wrap">
          <div className="stat-card px-4 py-2.5 flex items-center gap-2">
            <Award className="h-4 w-4 text-indigo-500" />
            <span className="text-sm font-bold">{skills.length}</span>
            <span className="text-xs text-muted-foreground">Total Skills</span>
          </div>
          {CATEGORY_ORDER.map((cat) => {
            const count = skills.filter((s) => s.category === cat).length;
            if (count === 0) return null;
            const cfg = categoryConfig[cat];
            return (
              <div key={cat} className="stat-card px-4 py-2.5 flex items-center gap-2">
                <div className={`h-2.5 w-2.5 rounded-full ${cfg.dot}`} />
                <span className="text-sm font-bold">{count}</span>
                <span className="text-xs text-muted-foreground">{cfg.label}</span>
              </div>
            );
          })}
        </div>
        <Button onClick={() => setCreateOpen(true)}
          className="bg-primary rounded-lg h-9 px-4 text-sm font-semibold hover:bg-primary/90 cursor-pointer">
          <Plus className="h-4 w-4 mr-1.5" /> Add Skill
        </Button>
      </div>

      {skills.length === 0 ? (
        <EmptyState icon={Award} title="No skills found" description="Create skills that employees can add to their profiles.">
          <Button onClick={() => setCreateOpen(true)} className="gradient-brand rounded-xl">Create Skill</Button>
        </EmptyState>
      ) : (
        <div className="space-y-5">
          {grouped.map(({ category, config: cfg, items }) => {
            const isCollapsed = collapsed[category];
            return (
              <div key={category}>
                <button onClick={() => toggleSection(category)}
                  className="flex items-center gap-3 w-full mb-3 group">
                  <div className={`h-7 w-7 rounded-lg ${cfg.bg} border ${cfg.border} flex items-center justify-center`}>
                    {isCollapsed
                      ? <ChevronRight className={`h-3.5 w-3.5 ${cfg.text}`} />
                      : <ChevronDown className={`h-3.5 w-3.5 ${cfg.text}`} />}
                  </div>
                  <h2 className="text-sm font-bold text-gray-800">{cfg.label}</h2>
                  <Badge variant="secondary" className={`${cfg.bg} ${cfg.text} border-0 font-bold text-xs rounded-md`}>
                    {items.length}
                  </Badge>
                  <div className="flex-1 h-px bg-slate-100 ml-1" />
                </button>

                {!isCollapsed && (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 stagger-children">
                    {items.map((skill) => (
                      <button
                        key={skill.id}
                        onClick={() => openDrawer(skill)}
                        className={`group text-left rounded-xl border ${cfg.border} bg-white hover:bg-${cfg.bg} hover:border-${cfg.text.replace("text-", "")} p-3.5 transition-all duration-150 hover:shadow-sm cursor-pointer`}
                      >
                        <div className="flex items-start gap-2.5">
                          <div className={`h-7 w-7 rounded-lg ${cfg.bg} flex items-center justify-center shrink-0 mt-0.5`}>
                            <div className={`h-2 w-2 rounded-full ${cfg.dot}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm text-gray-900 leading-tight">{skill.name}</p>
                            <p className="text-[11px] text-muted-foreground mt-1.5">
                              {skill._count.employeeSkills} emp · {skill._count.coeSkills} COEs · {skill._count.designationSkills} desig
                            </p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Edit drawer */}
      <Sheet open={!!drawerSkill} onOpenChange={(open) => { if (!open) setDrawerSkill(null); }}>
        <SheetContent className="w-[380px] overflow-y-auto">
          <SheetHeader className="flex-row items-center justify-between pr-0 mb-6">
            <SheetTitle className="text-base font-bold">Edit Skill</SheetTitle>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDrawerSkill(null)}>
              <X className="h-4 w-4" />
            </Button>
          </SheetHeader>

          {drawerSkill && (
            <div className="space-y-5">
              {/* Category badge */}
              <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full ${categoryConfig[drawerSkill.category].bg} border ${categoryConfig[drawerSkill.category].border}`}>
                <div className={`h-2 w-2 rounded-full ${categoryConfig[drawerSkill.category].dot}`} />
                <span className={`text-xs font-semibold ${categoryConfig[drawerSkill.category].text}`}>
                  {categoryConfig[drawerSkill.category].label}
                </span>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Name</Label>
                <Input
                  value={drawerName}
                  onChange={(e) => setDrawerName(e.target.value)}
                  className="rounded-lg"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Category</Label>
                <select
                  value={drawerCategory}
                  onChange={(e) => setDrawerCategory(e.target.value as SkillCategory)}
                  className="select-field"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Description</Label>
                <Textarea
                  value={drawerDesc}
                  onChange={(e) => setDrawerDesc(e.target.value)}
                  rows={3}
                  className="rounded-lg resize-none"
                  placeholder="Brief description…"
                />
              </div>

              {/* Stats */}
              <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-3.5 space-y-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Usage</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "Employees", value: drawerSkill._count.employeeSkills },
                    { label: "COEs", value: drawerSkill._count.coeSkills },
                    { label: "Designations", value: drawerSkill._count.designationSkills },
                  ].map((s) => (
                    <div key={s.label} className="text-center">
                      <p className="text-lg font-bold text-gray-900">{s.value}</p>
                      <p className="text-[11px] text-muted-foreground">{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  onClick={handleDrawerSave}
                  disabled={drawerSaving}
                  className="flex-1 bg-primary rounded-lg text-sm font-semibold hover:bg-primary/90"
                >
                  <Pencil className="h-3.5 w-3.5 mr-1.5" />
                  {drawerSaving ? "Saving…" : "Save Changes"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => { setDeleteId(drawerSkill.id); setDrawerSkill(null); }}
                  className="rounded-lg text-red-600 border-red-200 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <SkillFormDialog open={createOpen} onOpenChange={(open) => setCreateOpen(open)} skill={null} />
      <ConfirmDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)} title="Delete Skill" description="This removes all COE and designation mappings for this skill." onConfirm={handleDelete} loading={deleting} />
    </div>
  );
}
