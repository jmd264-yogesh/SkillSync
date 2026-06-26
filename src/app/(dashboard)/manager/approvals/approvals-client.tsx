"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  CheckCircle2, XCircle, Clock, FileText, User, Award, ChevronDown, ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Progress } from "@/components/ui/progress";
import { approveSkill, rejectSkill } from "@/server/actions/approval";
import { COMPETENCY_LABEL, type CompetencyLevel } from "@/lib/constants";
import type { SkillApprovalStatus, SkillCategory, EvidenceType } from "@prisma/client";

interface Submission {
  id: string;
  selfAssessedLevel: number;
  validatedLevel: number | null;
  status: SkillApprovalStatus;
  reviewComment: string | null;
  reviewedBy: string | null;
  createdAt: Date;
  employee: { id: string; name: string; employeeCode: string; coe: { name: string } | null; designation: { name: string } | null };
  skill: { id: string; name: string; category: SkillCategory };
  evidences: { id: string; type: EvidenceType; title: string }[];
}

const statusConfig = {
  PENDING: { icon: Clock, label: "Pending", bg: "bg-amber-50", text: "text-amber-700" },
  APPROVED: { icon: CheckCircle2, label: "Approved", bg: "bg-emerald-50", text: "text-emerald-700" },
  REJECTED: { icon: XCircle, label: "Rejected", bg: "bg-red-50", text: "text-red-700" },
};

export function ApprovalsClient({ submissions }: { submissions: Submission[] }) {
  const [filter, setFilter] = useState<"ALL" | SkillApprovalStatus>("PENDING");
  const [actionDialog, setActionDialog] = useState<{ type: "approve" | "reject"; submission: Submission } | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = filter === "ALL" ? submissions : submissions.filter((s) => s.status === filter);
  const pendingCount = submissions.filter((s) => s.status === "PENDING").length;
  const approvedCount = submissions.filter((s) => s.status === "APPROVED").length;
  const rejectedCount = submissions.filter((s) => s.status === "REJECTED").length;

  async function handleAction(formData: FormData) {
    if (!actionDialog) return;
    setLoading(true);
    formData.set("employeeSkillId", actionDialog.submission.id);
    const result = actionDialog.type === "approve" ? await approveSkill(formData) : await rejectSkill(formData);
    setLoading(false);
    if (result.error) { toast.error(result.error); return; }
    toast.success(actionDialog.type === "approve" ? "Skill approved" : "Skill rejected");
    setActionDialog(null);
  }

  return (
    <div>
      <PageHeader title="Skill Approvals" description="Review and validate skill submissions from your team" />

      <div className="grid grid-cols-3 gap-4 mb-6 stagger-children">
        {[
          { label: "Pending", value: pendingCount, gradient: "from-amber-500 to-orange-500", icon: Clock },
          { label: "Approved", value: approvedCount, gradient: "from-emerald-500 to-teal-500", icon: CheckCircle2 },
          { label: "Rejected", value: rejectedCount, gradient: "from-red-500 to-rose-500", icon: XCircle },
        ].map((stat) => (
          <div key={stat.label} className="stat-card hover-lift">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{stat.label}</p>
                <p className="text-3xl font-extrabold mt-1 text-gray-900">{stat.value}</p>
              </div>
              <div className={`h-11 w-11 rounded-2xl bg-gradient-to-br ${stat.gradient} flex items-center justify-center`}>
                <stat.icon className="h-5 w-5 text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6">
        {(["PENDING", "APPROVED", "REJECTED", "ALL"] as const).map((s) => {
          const count = s === "ALL" ? submissions.length : s === "PENDING" ? pendingCount : s === "APPROVED" ? approvedCount : rejectedCount;
          return (
            <button key={s} onClick={() => setFilter(s)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                filter === s ? "gradient-brand shadow-glow-sm" : "bg-white text-gray-600 shadow-sm hover:shadow-md"
              }`}>
              {s === "ALL" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()} ({count})
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Award} title="No submissions" description={filter === "PENDING" ? "No skills awaiting your review." : "No submissions match this filter."} />
      ) : (
        <div className="space-y-3 stagger-children">
          {filtered.map((sub) => {
            const config = statusConfig[sub.status];
            const StatusIcon = config.icon;
            const expanded = expandedId === sub.id;
            return (
              <Card key={sub.id} className="border-0 hover-lift rounded-2xl">
                <CardContent className="p-5">
                  <div className="flex items-center gap-4">
                    <div className="h-14 w-14 rounded-2xl gradient-brand flex items-center justify-center shrink-0 shadow-glow-sm">
                      <span className="text-white text-xl font-extrabold">{sub.selfAssessedLevel}</span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-lg text-gray-900">{sub.skill.name}</h3>
                        <Badge variant="outline" className={`${config.bg} ${config.text} border-0 font-semibold rounded-lg`}>
                          <StatusIcon className="h-3 w-3 mr-1" />{config.label}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-1.5 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1 font-medium"><User className="h-3 w-3" />{sub.employee.name}</span>
                        {sub.employee.coe && <span>&middot; {sub.employee.coe.name}</span>}
                        {sub.employee.designation && <span>&middot; {sub.employee.designation.name}</span>}
                      </div>
                      {sub.evidences.length > 0 && (
                        <div className="flex items-center gap-1 mt-1">
                          <FileText className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">{sub.evidences.map((e) => e.title).join(", ")}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {sub.status === "PENDING" && (
                        <>
                          <Button size="sm" className="rounded-xl bg-emerald-600 hover:bg-emerald-700 shadow-sm" onClick={() => setActionDialog({ type: "approve", submission: sub })}>
                            <CheckCircle2 className="h-4 w-4 mr-1" /> Approve
                          </Button>
                          <Button size="sm" variant="outline" className="rounded-xl text-red-600 border-red-200 hover:bg-red-50" onClick={() => setActionDialog({ type: "reject", submission: sub })}>
                            <XCircle className="h-4 w-4 mr-1" /> Reject
                          </Button>
                        </>
                      )}
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => setExpandedId(expanded ? null : sub.id)}>
                        {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  {expanded && (
                    <div className="mt-5 pt-5 border-t border-gray-50 space-y-4 animate-fade-in">
                      <div className="flex gap-8">
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Self Assessment</p>
                          <div className="flex items-center gap-3">
                            <Progress value={(sub.selfAssessedLevel / 5) * 100} className="w-28 h-2.5" />
                            <span className="text-sm font-bold">{sub.selfAssessedLevel}/5 ({COMPETENCY_LABEL[sub.selfAssessedLevel as CompetencyLevel]})</span>
                          </div>
                        </div>
                        {sub.validatedLevel && (
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Validated</p>
                            <div className="flex items-center gap-3">
                              <Progress value={(sub.validatedLevel / 5) * 100} className="w-28 h-2.5" />
                              <span className="text-sm font-bold">{sub.validatedLevel}/5</span>
                            </div>
                          </div>
                        )}
                      </div>
                      {sub.reviewComment && (
                        <div className="rounded-xl bg-gray-50 p-4">
                          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Review: {sub.reviewedBy}</p>
                          <p className="text-sm text-gray-700">{sub.reviewComment}</p>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Approve/Reject Dialog */}
      {actionDialog && (
        <Dialog open={!!actionDialog} onOpenChange={() => setActionDialog(null)}>
          <DialogContent className="rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-xl font-extrabold">
                {actionDialog.type === "approve" ? "Approve" : "Reject"}: {actionDialog.submission.skill.name}
              </DialogTitle>
            </DialogHeader>
            <form action={handleAction} className="space-y-5">
              <div className="rounded-xl bg-gray-50 p-4 text-sm">
                <p><strong>{actionDialog.submission.employee.name}</strong> self-assessed at level <strong>{actionDialog.submission.selfAssessedLevel}</strong> ({COMPETENCY_LABEL[actionDialog.submission.selfAssessedLevel as CompetencyLevel]})</p>
              </div>
              {actionDialog.type === "approve" && (
                <div className="space-y-2">
                  <Label className="font-semibold">Validated Competency Level</Label>
                  <select name="validatedLevel" required className="select-field">
                    {[1, 2, 3, 4, 5].map((l) => (
                      <option key={l} value={l} selected={l === actionDialog.submission.selfAssessedLevel}>
                        {l} — {COMPETENCY_LABEL[l as CompetencyLevel]}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="space-y-2">
                <Label className="font-semibold">{actionDialog.type === "reject" ? "Reason for Rejection *" : "Comments (Optional)"}</Label>
                <Textarea name="reviewComment" placeholder={actionDialog.type === "reject" ? "Please provide a reason..." : "Any comments..."} required={actionDialog.type === "reject"} rows={3} className="rounded-xl" />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setActionDialog(null)} className="rounded-xl">Cancel</Button>
                <Button type="submit" disabled={loading} className={`rounded-xl shadow-sm ${actionDialog.type === "approve" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"}`}>
                  {loading ? "Processing..." : actionDialog.type === "approve" ? "Approve" : "Reject"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
