"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Award, Plus, Clock, CheckCircle2, XCircle, Trash2, FileText, Target,
  ChevronLeft, ChevronRight, Search, Building2, Briefcase,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { submitSkill, withdrawSkill } from "@/server/actions/my-skills";
import { COMPETENCY_LABEL, type CompetencyLevel } from "@/lib/constants";
import type { SkillApprovalStatus, SkillCategory, EvidenceType } from "@prisma/client";

interface EmployeeSkill {
  id: string;
  selfAssessedLevel: number;
  validatedLevel: number | null;
  status: SkillApprovalStatus;
  reviewComment: string | null;
  reviewedBy: string | null;
  skill: { id: string; name: string; category: SkillCategory; description: string | null };
  evidences: { id: string; type: EvidenceType; title: string }[];
}

interface AvailableSkill {
  id: string;
  name: string;
  category: SkillCategory;
  description: string | null;
}

interface TargetSkill {
  skillId: string;
  skillName: string;
  category: string;
  targetLevel: number;
  source: string;
}

const statusConfig = {
  PENDING: { icon: Clock, label: "Pending", bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  APPROVED: { icon: CheckCircle2, label: "Approved", bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  REJECTED: { icon: XCircle, label: "Rejected", bg: "bg-red-50", text: "text-red-700", border: "border-red-200" },
};

const categoryStyle: Record<SkillCategory, { bg: string; dot: string; text: string }> = {
  SKILL: { bg: "bg-pink-50", dot: "bg-secondary", text: "text-secondary" },
  FRAMEWORK: { bg: "bg-pink-50", dot: "bg-secondary", text: "text-secondary" },
  CONCEPT: { bg: "bg-pink-50", dot: "bg-secondary", text: "text-secondary" },
  TOOL: { bg: "bg-pink-50", dot: "bg-secondary", text: "text-secondary" },
  CERTIFICATION: { bg: "bg-pink-50", dot: "bg-secondary", text: "text-secondary" },
};

const PAGE_SIZE = 9;

export function MySkillsClient({
  skills,
  availableSkills,
  targetSkills = [],
}: {
  skills: EmployeeSkill[];
  availableSkills: AvailableSkill[];
  targetSkills?: TargetSkill[];
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<SkillApprovalStatus | "ALL">("ALL");
  const [page, setPage] = useState(1);
  const [expectedTab, setExpectedTab] = useState<"coe" | "designation">("coe");

  const approved = skills.filter((s) => s.status === "APPROVED").length;
  const pending = skills.filter((s) => s.status === "PENDING").length;
  const rejected = skills.filter((s) => s.status === "REJECTED").length;

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    const result = await submitSkill(formData);
    setLoading(false);
    if (result.error) { toast.error(result.error); return; }
    toast.success("Skill submitted for approval");
    setAddOpen(false);
  }

  async function handleWithdraw() {
    if (!deleteId) return;
    setDeleting(true);
    const result = await withdrawSkill(deleteId);
    setDeleting(false);
    if (result.error) { toast.error(result.error); } else { toast.success("Skill withdrawn"); }
    setDeleteId(null);
  }

  // Filter
  const filteredSkills = skills.filter((es) => {
    const matchSearch = es.skill.name.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "ALL" || es.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filteredSkills.length / PAGE_SIZE));
  const paginated = filteredSkills.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Expected skill tabs
  const coeSkills = targetSkills.filter((ts) => ts.source === "COE" || ts.source === "Both");
  const designationSkills = targetSkills.filter((ts) => ts.source === "Designation" || ts.source === "Both");

  function renderTargetCard(ts: TargetSkill) {
    const mySkill = skills.find((s) => s.skill.id === ts.skillId);
    const currentLevel = mySkill?.validatedLevel ?? mySkill?.selfAssessedLevel ?? 0;
    const met = mySkill?.status === "APPROVED" && (mySkill.validatedLevel ?? 0) >= ts.targetLevel;
    return (
      <div key={ts.skillId} className={`rounded-xl border p-4 transition-colors ${met ? "bg-emerald-50/60 border-emerald-200" : "bg-white border-slate-200"}`}>
        <div className="flex items-center justify-between mb-3">
          <span className="font-semibold text-sm text-gray-900">{ts.skillName}</span>
          {met && 
            <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
  }
        </div>
        <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
          <span>Current: <strong className="text-gray-700">{currentLevel}</strong></span>
          <span>Target: <strong className="text-indigo-600">{ts.targetLevel}</strong></span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${met ? "bg-emerald-500" : currentLevel > 0 ? "bg-primary" : "bg-gray-300"}`}
            style={{ width: `${Math.min(100, (currentLevel / ts.targetLevel) * 100)}%` }}
          />
        </div>
        {!mySkill && (
          <p className="text-[11px] text-muted-foreground mt-2">Not yet added to your profile</p>
        )}
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="My Skills" description="Add skills and submit them for manager validation">
        <Button onClick={() => setAddOpen(true)} className="gradient-brand rounded-xl shadow-glow-sm hover:opacity-90 transition-all">
          <Plus className="h-4 w-4 mr-2" /> Add Skill
        </Button>
      </PageHeader>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total Skills", value: skills.length, icon: Award, bg: "bg-indigo-50", text: "text-primary" },
          { label: "Approved", value: approved, icon: CheckCircle2, bg: "bg-indigo-50", text: "text-primary" },
          { label: "Pending", value: pending, icon: Clock, bg: "bg-indigo-50", text: "text-primary" },
          { label: "Rejected", value: rejected, icon: XCircle, bg: "bg-indigo-50", text: "text-primary" },
        ].map((stat) => (
          <div key={stat.label} className="stat-card flex items-center gap-3.5">
            <div className={`h-10 w-10 rounded-xl ${stat.bg} flex items-center justify-center shrink-0`}>
              <stat.icon className={`h-5 w-5 ${stat.text}`} />
            </div>
            <div>
              <p className="text-2xl font-extrabold text-gray-900">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      {skills.length > 0 && (
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <div className="relative w-56">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <Input
              placeholder="Search skills…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pl-8 h-9 rounded-lg text-sm"
            />
          </div>
          <div className="flex rounded-lg border border-input overflow-hidden">
            {(["ALL", "APPROVED", "PENDING", "REJECTED"] as const).map((s) => (
              <button
                key={s}
                onClick={() => { setStatusFilter(s); setPage(1); }}
                className={`px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                  statusFilter === s
                  ? "bg-primary text-white"
                    : "bg-white text-slate-500 hover:bg-slate-50"
                }`}
              >
                {s === "ALL" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
          <span className="text-xs text-muted-foreground ml-auto">{filteredSkills.length} skills</span>
        </div>
      )}

      {skills.length === 0 ? (
        <EmptyState icon={Award} title="No skills added yet" description="Start building your skill profile by adding skills and submitting them for validation.">
          <Button onClick={() => setAddOpen(true)} className="gradient-brand rounded-xl">Add Your First Skill</Button>
        </EmptyState>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children">
            {paginated.map((es) => {
              const config = statusConfig[es.status];
              const StatusIcon = config.icon;
              const catStyle = categoryStyle[es.skill.category];
              return (
                <div key={es.id} className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition-all duration-200 shadow-card group">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3 min-w-0">

                      <div className="min-w-0">
                        <p className="font-bold text-primary text-sm leading-tight truncate">{es.skill.name}</p>
                        <div className={`inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded ${catStyle.bg}`}>
                          <div className={`h-1.5 w-1.5 rounded-full ${catStyle.dot}`} />
                          <span className={`text-[10px] font-semibold ${catStyle.text}`}>{es.skill.category}</span>
                        </div>
                      </div>
                    </div>
                    <Badge variant="outline" className={`${config.bg} ${config.text} ${config.border} text-[10px] font-semibold rounded-md shrink-0 flex items-center gap-1`}>
                      <StatusIcon className="h-2.5 w-2.5" />{config.label}
                    </Badge>
                  </div>

                  <div className="space-y-2">
                    <div>
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
                        <span>Self-assessed</span>
                        <span>{es.selfAssessedLevel}/5 · {COMPETENCY_LABEL[es.selfAssessedLevel as CompetencyLevel]}</span>
                      </div>
                      <Progress value={(es.selfAssessedLevel / 5) * 100} className="h-1.5 rounded-full" />
                    </div>
                    {es.validatedLevel !== null && (
                      <div>
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
                          <span>Validated</span>
                          <span className="text-indigo-600 font-semibold">{es.validatedLevel}/5</span>
                        </div>
                        <Progress value={(es.validatedLevel / 5) * 100} className="h-1.5 rounded-full" />
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-50">
                    {es.evidences.length > 0 ? (
                      <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <FileText className="h-3 w-3" /> {es.evidences.length} evidence
                      </span>
                    ) : <span />}
                    <Button
                      variant="ghost" size="icon" className="h-7 w-7 rounded-md "
                      onClick={() => setDeleteId(es.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-red-400" />
                    </Button>
                  </div>

                  {es.reviewComment && (
                    <div className="mt-2 pt-2 border-t border-slate-50">
                      <p className="text-[11px] text-muted-foreground italic line-clamp-2">&quot;{es.reviewComment}&quot;</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-5">
              <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
              <div className="flex items-center gap-1.5">
                <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <Button
                    key={p}
                    variant={page === p ? "default" : "outline"}
                    size="icon"
                    className={`h-8 w-8 rounded-lg text-xs ${page === p ? "bg-indigo-600 border-indigo-600" : ""}`}
                    onClick={() => setPage(p)}
                  >
                    {p}
                  </Button>
                ))}
                <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Expected Skills — two tabs */}
      {targetSkills.length > 0 && (
        <div className="mt-10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-extrabold text-primary">Expected Skills</h2>
            </div>
            {/* Tabs */}
            <div className="flex rounded-xl bg-slate-100 p-1 gap-0.5">
              <button
                onClick={() => setExpectedTab("coe")}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  expectedTab === "coe"
                  ? "bg-white text-primary shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <Building2 className="h-3.5 w-3.5" />
                From COE
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${expectedTab === "coe" ? "bg-indigo-100 text-primary" : "bg-slate-200 text-slate-500"}`}>
                  {coeSkills.length}
                </span>
              </button>
              <button
                onClick={() => setExpectedTab("designation")}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  expectedTab === "designation"
                  ? "bg-white text-primary shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <Briefcase className="h-3.5 w-3.5" />
                From Designation
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${expectedTab === "designation" ? "bg-indigo-100 text-indigo-700" : "bg-slate-200 text-slate-500"}`}>
                  {designationSkills.length}
                </span>
              </button>
            </div>
          </div>

          {expectedTab === "coe" ? (
            coeSkills.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-muted-foreground">
                No COE skill targets defined. Contact your admin.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 stagger-children">
                {coeSkills.map(renderTargetCard)}
              </div>
            )
          ) : (
            designationSkills.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-muted-foreground">
                No designation skill targets defined. Contact your admin.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 stagger-children">
                {designationSkills.map(renderTargetCard)}
              </div>
            )
          )}
        </div>
      )}

      {/* Add Skill Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-extrabold">Submit Skill for Approval</DialogTitle>
          </DialogHeader>
          <form action={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label className="font-semibold">Skill</Label>
              <select name="skillId" required className="select-field">
                <option value="">— Select a skill —</option>
                {availableSkills.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} ({s.category})</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label className="font-semibold">Self-Assessed Level</Label>
              <select name="selfAssessedLevel" required className="select-field">
                {[1, 2, 3, 4, 5].map((l) => (
                  <option key={l} value={l}>{l} — {COMPETENCY_LABEL[l as CompetencyLevel]}</option>
                ))}
              </select>
            </div>
            <div className="rounded-xl bg-gray-50 p-4 space-y-4">
              <p className="text-sm font-bold text-gray-700">Supporting Evidence <span className="font-normal text-muted-foreground">(Optional)</span></p>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Type</Label>
                  <select name="evidenceType" className="select-field">
                    <option value="">— None —</option>
                    <option value="CERTIFICATION">Certification</option>
                    <option value="ASSESSMENT_SCORE">Assessment Score</option>
                    <option value="PROJECT_DOCUMENT">Project Document</option>
                    <option value="SUPPORTING_DOCUMENT">Supporting Document</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Title</Label>
                  <Input name="evidenceTitle" placeholder="e.g. AWS Cloud Practitioner" className="rounded-xl" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Score</Label>
                  <Input name="evidenceScore" placeholder="e.g. 85%" className="rounded-xl" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Notes</Label>
                  <Textarea name="evidenceDescription" placeholder="Additional details..." rows={2} className="rounded-xl" />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)} className="rounded-xl">Cancel</Button>
              <Button type="submit" disabled={loading} className="gradient-brand rounded-xl shadow-glow-sm">
                {loading ? "Submitting..." : "Submit for Approval"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)} title="Withdraw Skill" description="This will remove this skill from your profile." onConfirm={handleWithdraw} loading={deleting} />
    </div>
  );
}
