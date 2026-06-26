"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Building2, Briefcase, Plus, Trash2, Pencil, Link2, Award, Layers } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  getCoeSkillMappings,
  deleteCoeSkill,
  mapSkillToCoe,
  getDesignationSkillMappings,
  deleteDesignationSkill,
  mapSkillToDesignation,
} from "@/server/actions/skill-mapping";
import { motion } from "framer-motion";


interface Skill {
  id: string;
  name: string;
  category: string;
}

interface Coe {
  id: string;
  name: string;
  description: string | null;
}

interface Designation {
  id: string;
  name: string;
  level: number;
}

interface CoeSkillMapping {
  id: string;
  coeId: string;
  skillId: string;
  targetCompetency: number;
  skill: Skill;
}

interface DesignationSkillMapping {
  id: string;
  designationId: string;
  skillId: string;
  targetCompetency: number;
  skill: Skill;
}

interface SkillMappingClientProps {
  coes: Coe[];
  designations: Designation[];
  skills: Skill[];
}

export function SkillMappingClient({ coes, designations, skills }: SkillMappingClientProps) {
  // Tabs state
  const [activeTab, setActiveTab] = useState("coe");

  // Selection states
  const [selectedCoeId, setSelectedCoeId] = useState("");
  const [selectedDesignationId, setSelectedDesignationId] = useState("");

  // Mapping data states
  const [coeMappings, setCoeMappings] = useState<CoeSkillMapping[]>([]);
  const [designationMappings, setDesignationMappings] = useState<DesignationSkillMapping[]>([]);
  const [loading, setLoading] = useState(false);

  // Dialog form states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMapping, setEditingMapping] = useState<{ skillId: string; name: string; level: number } | null>(null);
  const [formSkillId, setFormSkillId] = useState("");
  const [formLevel, setFormLevel] = useState(3);

  // Load COE mappings
  async function loadCoeMappings() {
    if (!selectedCoeId) {
      setCoeMappings([]);
      return;
    }
    setLoading(true);
    try {
      const data = await getCoeSkillMappings(selectedCoeId);
      setCoeMappings(data as CoeSkillMapping[]);
    } catch {
      toast.error("Failed to load COE skill mappings");
    } finally {
      setLoading(false);
    }
  }

  // Load Designation mappings
  async function loadDesignationMappings() {
    if (!selectedDesignationId) {
      setDesignationMappings([]);
      return;
    }
    setLoading(true);
    try {
      const data = await getDesignationSkillMappings(selectedDesignationId);
      setDesignationMappings(data as DesignationSkillMapping[]);
    } catch {
      toast.error("Failed to load designation skill mappings");
    } finally {
      setLoading(false);
    }
  }

  // Trigger loads on selections
  useEffect(() => {
    loadCoeMappings();
  }, [selectedCoeId]);

  useEffect(() => {
    loadDesignationMappings();
  }, [selectedDesignationId]);

  // Set default selections
  useEffect(() => {
    if (coes.length > 0 && !selectedCoeId) {
      setSelectedCoeId(coes[0]?.id ?? "");
    }
    if (designations.length > 0 && !selectedDesignationId) {
      setSelectedDesignationId(designations[0]?.id ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coes, designations]);

  async function handleAddOrEditMapping(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData();
    formData.append("skillId", formSkillId);
    formData.append("targetCompetency", formLevel.toString());

    let result;
    if (activeTab === "coe") {
      formData.append("coeId", selectedCoeId);
      result = await mapSkillToCoe(formData);
    } else {
      formData.append("designationId", selectedDesignationId);
      result = await mapSkillToDesignation(formData);
    }

    setLoading(false);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(editingMapping ? "Mapping updated successfully" : "Skill mapped successfully");
      setDialogOpen(false);
      setEditingMapping(null);
      setFormSkillId("");
      setFormLevel(3);
      if (activeTab === "coe") {
        loadCoeMappings();
      } else {
        loadDesignationMappings();
      }
    }
  }

  async function handleDeleteMapping(skillId: string) {
    if (!confirm("Are you sure you want to remove this skill mapping?")) return;
    setLoading(true);

    let result;
    if (activeTab === "coe") {
      result = await deleteCoeSkill(selectedCoeId, skillId);
    } else {
      result = await deleteDesignationSkill(selectedDesignationId, skillId);
    }

    setLoading(false);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Skill mapping removed");
      if (activeTab === "coe") {
        loadCoeMappings();
      } else {
        loadDesignationMappings();
      }
    }
  }

  function handleOpenAdd() {
    setEditingMapping(null);
    setFormSkillId("");
    setFormLevel(3);
    setDialogOpen(true);
  }

  function handleOpenEdit(skillId: string, name: string, level: number) {
    setEditingMapping({ skillId, name, level });
    setFormSkillId(skillId);
    setFormLevel(level);
    setDialogOpen(true);
  }

  // Filter skills not yet mapped for selection
  const mappedSkillIds = activeTab === "coe"
    ? coeMappings.map((m) => m.skillId)
    : designationMappings.map((m) => m.skillId);

  const availableSkills = skills.filter(
    (s) => !mappedSkillIds.includes(s.id) || (editingMapping && editingMapping.skillId === s.id)
  );
const TABS = [
  { value: "coe", label: "COE Skill Mapping", icon: Building2 },
  { value: "designation", label: "Designation Mapping", icon: Briefcase },
  
] as const;

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setEditingMapping(null); }} className="w-full">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 ">
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

        </div>
        <div className="flex justify-end">
           <Button className="py-5 mb-3" onClick={handleOpenAdd} disabled={activeTab === "coe" ? !selectedCoeId : !selectedDesignationId}>
            <Plus className="h-4 w-4 mr-1" />
            Add Skill Mapping
          </Button>
        </div>
         

        {/* COE MAPPING TAB */}
        <TabsContent value="coe" className="space-y-4">
          <Card>
            <CardHeader className="pb-3 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <CardTitle>COE Skill Profiles</CardTitle>
                <CardDescription>
                  Map required technical competencies and skills to Centres of Excellence (COEs).
                </CardDescription>
              </div>
              <div className="w-full md:w-[250px] space-y-1.5">
                <Label htmlFor="coe-select" className="text-xs">Select Centre of Excellence</Label>
                <select
                  id="coe-select"
                  value={selectedCoeId}
                  onChange={(e) => setSelectedCoeId(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {coes.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </CardHeader>
            <CardContent>
              {loading && coeMappings.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground text-sm">Loading skill mapping profile...</div>
              ) : coeMappings.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center border border-dashed rounded-lg text-center p-8">
                  <Link2 className="h-8 w-8 text-muted-foreground/40 mb-2" />
                  <p className="text-sm font-semibold">No skills mapped to this COE yet</p>
                  <p className="text-xs text-muted-foreground mt-1 mb-4">Define skills and target levels expected for this COE.</p>
                  <Button size="sm" onClick={handleOpenAdd}>Map Your First Skill</Button>
                </div>
              ) : (
                <div className="border rounded-md overflow-hidden divide-y">
                  {coeMappings.map((m) => (
                    <div key={m.id} className="p-4 flex items-center justify-between gap-4 hover:bg-muted/10 transition-colors">
                      <div className=" min-w-0">
                          <p className="font-semibold text-sm mb-1"> Skill: <span className="text-secondary">{m.skill.name}</span>  </p>
                          <p className="font-semibold text-sm mb-1"> Category: <span className="text-secondary capitalize">{m.skill.category.toLowerCase()}</span>  </p> 
                        <div className="flex items-center gap-1.5">
                          <p className="font-semibold text-sm mb-1">Target Competency Level:</p>
                          <span className="text-xs font-bold text-foreground">Level {m.targetCompetency}</span>
                          <div className="flex gap-0.5 ml-2">
                            {[1, 2, 3, 4, 5].map((lvl) => (
                              <div
                                key={lvl}
                                className={`h-1.5 w-4 rounded-xs ${
                                  lvl <= m.targetCompetency
                                    ? "bg-primary"
                                    : "bg-gray-300"
                                }`}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenEdit(m.skillId, m.skill.name, m.targetCompetency)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteMapping(m.skillId)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* DESIGNATION MAPPING TAB */}
        <TabsContent value="designation" className="space-y-4">
          <Card>
            <CardHeader className="pb-3 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <CardTitle>Designation Skill Profiles</CardTitle>
                <CardDescription>
                  Map expected core competencies and levels to professional designations.
                </CardDescription>
              </div>
              <div className="w-full md:w-[250px] space-y-1.5">
                <Label htmlFor="designation-select" className="text-xs">Select Designation</Label>
                <select
                  id="designation-select"
                  value={selectedDesignationId}
                  onChange={(e) => setSelectedDesignationId(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {designations.map((d) => (
                    <option key={d.id} value={d.id}>{d.name} (Level {d.level})</option>
                  ))}
                </select>
              </div>
            </CardHeader>
            <CardContent>
              {loading && designationMappings.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground text-sm">Loading skill mapping profile...</div>
              ) : designationMappings.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center border border-dashed rounded-lg text-center p-8">
                  <Link2 className="h-8 w-8 text-muted-foreground/40 mb-2" />
                  <p className="text-sm font-semibold">No skills mapped to this designation yet</p>
                  <p className="text-xs text-muted-foreground mt-1 mb-4">Define skills and target levels expected for this designation.</p>
                  <Button size="sm" onClick={handleOpenAdd}>Map Your First Skill</Button>
                </div>
              ) : (
                <div className="border rounded-md overflow-hidden divide-y">
                  {designationMappings.map((m) => (
                    <div key={m.id} className="p-4 flex items-center justify-between gap-4 hover:bg-muted/10 transition-colors">
                      <div className="min-w-0">
                          <p className="font-semibold text-sm mb-1"> Skill: <span className="text-secondary">{m.skill.name}</span>  </p> 
                          <p className="font-semibold text-sm mb-1"> Category: <span className="text-secondary capitalize">{m.skill.category.toLowerCase()}</span>  </p> 
                        <div className="flex items-center gap-1.5">
                          <p className="font-semibold text-sm mb-1">Target Competency Level:</p>
                          <span className="text-xs font-bold text-foreground">Level {m.targetCompetency}</span>
                          <div className="flex gap-0.5 ml-2">
                            {[1, 2, 3, 4, 5].map((lvl) => (
                              <div
                                key={lvl}
                                className={`h-1.5 w-4 rounded-xs ${
                                  lvl <= m.targetCompetency
                                    ? "bg-primary"
                                    : "bg-gray-300"
                                }`}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenEdit(m.skillId, m.skill.name, m.targetCompetency)}>
                          <Pencil className="h-4 w-4 text-primary" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteMapping(m.skillId)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add/Edit Skill Mapping Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingMapping
                ? `Edit Target Level — ${editingMapping.name}`
                : `Add Skill Mapping to ${
                    activeTab === "coe"
                      ? coes.find((c) => c.id === selectedCoeId)?.name || "COE"
                      : designations.find((d) => d.id === selectedDesignationId)?.name || "Designation"
                  }`}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddOrEditMapping} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="dialogSkillId">Skill</Label>
              <select
                id="dialogSkillId"
                value={formSkillId}
                onChange={(e) => setFormSkillId(e.target.value)}
                disabled={!!editingMapping}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                required
              >
                <option value="">— Select Skill —</option>
                {availableSkills.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.category})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dialogLevel">Target Competency Level (1-5)</Label>
              <select
                id="dialogLevel"
                value={formLevel}
                onChange={(e) => setFormLevel(parseInt(e.target.value, 10))}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {[1, 2, 3, 4, 5].map((lvl) => (
                  <option key={lvl} value={lvl}>
                    Level {lvl}
                  </option>
                ))}
              </select>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => { setDialogOpen(false); setEditingMapping(null); }}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Saving..." : editingMapping ? "Save Changes" : "Create Mapping"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
