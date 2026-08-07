"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, BrainCircuit, CheckCircle2, AlertCircle, FileText, Loader2, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { ExperienceDocFormDialog } from "@/components/forms/experience-doc-form-dialog";
import { extractSkillsFromDoc, applyExtractedSkills } from "@/server/actions/project-experience";
import { PROJECT_TYPE_LABELS, COMPETENCY_LEVEL_LABELS } from "@/validations/project-experience.schema";
import type { ProjectType } from "@/validations/project-experience.schema";
import type { ProjectExperienceDoc } from "@prisma/client";

interface ExtractedSkill {
  name: string;
  level: number;
  reasoning?: string;
}

interface ReviewState {
  docId: string;
  docTitle: string;
  skills: ExtractedSkill[];
}

interface Props {
  docs: ProjectExperienceDoc[];
}

const STATUS_CONFIG = {
  DRAFT:      { label: "Draft",     variant: "outline" as const,    icon: FileText,      color: "text-slate-500" },
  EXTRACTING: { label: "Extracting…", variant: "outline" as const,  icon: Loader2,       color: "text-blue-500" },
  EXTRACTED:  { label: "Extracted", variant: "secondary" as const,  icon: BrainCircuit,  color: "text-violet-600" },
  APPLIED:    { label: "Applied",   variant: "outline" as const,     icon: CheckCircle2,  color: "text-green-600" },
  FAILED:     { label: "Failed",    variant: "destructive" as const, icon: AlertCircle,   color: "text-red-500" },
} as const;

function getStatusConfig(status: string) {
  return STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.DRAFT;
}

export function MyExperienceClient({ docs }: Props) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [extractingId, setExtractingId] = useState<string | null>(null);
  const [reviewState, setReviewState] = useState<ReviewState | null>(null);
  const [selectedSkills, setSelectedSkills] = useState<Set<string>>(new Set());
  const [applying, setApplying] = useState(false);

  async function handleExtract(doc: ProjectExperienceDoc) {
    setExtractingId(doc.id);
    const result = await extractSkillsFromDoc(doc.id);
    setExtractingId(null);

    if ("error" in result) {
      toast.error(result.error);
      return;
    }

    const skills = result.extracted.skills as ExtractedSkill[];
    setReviewState({ docId: doc.id, docTitle: doc.title, skills });
    setSelectedSkills(new Set(skills.map((s) => s.name)));
    toast.success(`Extracted ${skills.length} skill${skills.length !== 1 ? "s" : ""}`);
  }

  function handleOpenReview(doc: ProjectExperienceDoc) {
    try {
      const skills = doc.extractedSkills ? (JSON.parse(doc.extractedSkills) as ExtractedSkill[]) : [];
      setReviewState({ docId: doc.id, docTitle: doc.title, skills });
      setSelectedSkills(new Set(skills.map((s) => s.name)));
    } catch {
      toast.error("Could not load extracted skills. Try re-extracting.");
    }
  }

  function toggleSkill(name: string) {
    setSelectedSkills((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  async function handleApply() {
    if (!reviewState || selectedSkills.size === 0) return;
    setApplying(true);

    const skills = reviewState.skills
      .filter((s) => selectedSkills.has(s.name))
      .map(({ name, level }) => ({ name, level }));

    const result = await applyExtractedSkills(reviewState.docId, skills);
    setApplying(false);

    if ("error" in result) {
      toast.error(result.error);
      return;
    }

    toast.success(`${result.count} skill${result.count !== 1 ? "s" : ""} added to your profile - pending manager approval`);
    setReviewState(null);
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Project Experience</h1>
          <p className="text-sm text-slate-500 mt-1">
            Document your project work - AI extracts the skills you demonstrated and adds them to your profile.
          </p>
        </div>
        <Button onClick={() => setIsFormOpen(true)} size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          Add Experience
        </Button>
      </div>

      {/* How it works */}
      {docs.length === 0 && (
        <Card className="border-dashed border-slate-200 bg-slate-50/50">
          <CardContent className="py-10 flex flex-col items-center text-center gap-4">
            <div className="flex items-center gap-3 text-slate-400">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 text-sm font-semibold">1</div>
              <ChevronRight className="h-4 w-4" />
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 text-sm font-semibold">2</div>
              <ChevronRight className="h-4 w-4" />
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 text-sm font-semibold">3</div>
            </div>
            <div className="grid grid-cols-3 gap-6 text-sm max-w-lg">
              <div>
                <p className="font-medium text-slate-700">Describe a project</p>
                <p className="text-slate-500 text-xs mt-0.5">Fill in what you built, your role, and the tech used</p>
              </div>
              <div>
                <p className="font-medium text-slate-700">AI extracts skills</p>
                <p className="text-slate-500 text-xs mt-0.5">Gemini reads your description and identifies demonstrated skills</p>
              </div>
              <div>
                <p className="font-medium text-slate-700">Apply to profile</p>
                <p className="text-slate-500 text-xs mt-0.5">Selected skills go to your manager for approval</p>
              </div>
            </div>
            <Button onClick={() => setIsFormOpen(true)} variant="outline" size="sm" className="mt-2">
              Add your first project
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Document Cards */}
      {docs.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {docs.map((doc) => {
            const cfg = getStatusConfig(doc.extractionStatus);
            const Icon = cfg.icon;
            const isExtracting = extractingId === doc.id;
            const techItems = doc.techStack ? doc.techStack.split(/[,;]/).map((t) => t.trim()).filter(Boolean) : [];
            const extractedSkills = doc.extractedSkills ? (() => { try { return JSON.parse(doc.extractedSkills) as ExtractedSkill[]; } catch { return []; } })() : [];

            return (
              <Card key={doc.id} className="border-0 shadow-sm flex flex-col">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-slate-900 leading-tight truncate">{doc.title}</p>
                      {doc.myRole && <p className="text-xs text-slate-500 mt-0.5">{doc.myRole}</p>}
                    </div>
                    <Badge variant={cfg.variant} className={`shrink-0 text-[10px] gap-1 ${cfg.color}`}>
                      <Icon className={`h-3 w-3 ${isExtracting ? "animate-spin" : ""}`} />
                      {isExtracting ? "Extracting…" : cfg.label}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap mt-1">
                    <Badge variant="outline" className="text-[10px] bg-slate-50">
                      {PROJECT_TYPE_LABELS[doc.projectType as ProjectType] ?? doc.projectType}
                    </Badge>
                    {doc.clientIndustry && (
                      <span className="text-[11px] text-slate-400">{doc.clientIndustry}</span>
                    )}
                    {doc.startDate && doc.endDate && (
                      <span className="text-[11px] text-slate-400">
                        {new Date(doc.startDate).getFullYear()}-{new Date(doc.endDate).getFullYear()}
                      </span>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="pt-0 flex flex-col gap-3 flex-1">
                  {techItems.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {techItems.slice(0, 6).map((t) => (
                        <span key={t} className="text-[11px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{t}</span>
                      ))}
                      {techItems.length > 6 && (
                        <span className="text-[11px] text-slate-400">+{techItems.length - 6} more</span>
                      )}
                    </div>
                  )}

                  {doc.aiSummary && (
                    <p className="text-xs text-slate-500 leading-relaxed line-clamp-3">{doc.aiSummary}</p>
                  )}

                  {extractedSkills.length > 0 && doc.extractionStatus !== "DRAFT" && (
                    <div className="flex flex-wrap gap-1">
                      {extractedSkills.slice(0, 4).map((s: ExtractedSkill) => (
                        <span key={s.name} className="text-[11px] bg-violet-50 text-violet-700 px-2 py-0.5 rounded-full">
                          {s.name} · L{s.level}
                        </span>
                      ))}
                      {extractedSkills.length > 4 && (
                        <span className="text-[11px] text-slate-400">+{extractedSkills.length - 4} more</span>
                      )}
                    </div>
                  )}

                  <div className="mt-auto pt-2 flex gap-2">
                    {(doc.extractionStatus === "DRAFT" || doc.extractionStatus === "FAILED") && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 text-xs flex-1"
                        disabled={isExtracting}
                        onClick={() => handleExtract(doc)}
                      >
                        {isExtracting ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <BrainCircuit className="h-3.5 w-3.5" />
                        )}
                        Extract Skills with AI
                      </Button>
                    )}

                    {doc.extractionStatus === "EXTRACTED" && (
                      <Button
                        size="sm"
                        className="gap-1.5 text-xs flex-1"
                        onClick={() => handleOpenReview(doc)}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Review &amp; Apply Skills
                      </Button>
                    )}

                    {doc.extractionStatus === "APPLIED" && (
                      <p className="text-xs text-green-600 font-medium flex items-center gap-1.5 flex-1">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Skills applied - pending approval
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create form dialog */}
      <ExperienceDocFormDialog open={isFormOpen} onOpenChange={setIsFormOpen} />

      {/* Skill review dialog */}
      <Dialog open={!!reviewState} onOpenChange={(o) => { if (!o) setReviewState(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Review Extracted Skills</DialogTitle>
            <p className="text-sm text-slate-500">
              From: <span className="font-medium text-slate-700">{reviewState?.docTitle}</span>
            </p>
          </DialogHeader>

          <div className="py-2 max-h-80 overflow-y-auto">
            <p className="text-xs text-slate-500 mb-3">
              Select the skills you want to add to your profile. They will be submitted as PENDING for manager approval.
            </p>
            <div className="flex flex-col gap-2">
              {(reviewState?.skills ?? []).map((skill) => (
                <label
                  key={skill.name}
                  className="flex items-start gap-3 p-3 rounded-lg border border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors"
                >
                  <Checkbox
                    checked={selectedSkills.has(skill.name)}
                    onCheckedChange={() => toggleSkill(skill.name)}
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-slate-800">{skill.name}</span>
                      <Badge variant="outline" className="text-[10px] shrink-0">
                        Level {skill.level} - {COMPETENCY_LEVEL_LABELS[skill.level]}
                      </Badge>
                    </div>
                    {skill.reasoning && (
                      <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{skill.reasoning}</p>
                    )}
                  </div>
                </label>
              ))}
            </div>
          </div>

          <Separator />
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setReviewState(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={selectedSkills.size === 0 || applying}
              onClick={handleApply}
              className="gap-1.5"
            >
              {applying && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Apply {selectedSkills.size > 0 ? `${selectedSkills.size} ` : ""}Selected Skill{selectedSkills.size !== 1 ? "s" : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
