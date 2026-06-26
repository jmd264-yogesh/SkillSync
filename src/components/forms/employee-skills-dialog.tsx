"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Award, Search, Filter, ChevronDown } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  getEmployeeSkills,
  mapSkillToEmployee,
  updateEmployeeSkill,
  removeSkillFromEmployee,
} from "@/server/actions/employee-skill";
import type { SkillApprovalStatus } from "@prisma/client";

interface MappedSkill {
  id: string;
  skillId: string;
  selfAssessedLevel: number;
  validatedLevel: number | null;
  status: SkillApprovalStatus;
  reviewComment: string | null;
  skill: { id: string; name: string; category: string };
}

interface EmployeeSkillsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: { id: string; name: string } | null;
  allSkills: { id: string; name: string; category: string }[];
}

const statusColors: Record<SkillApprovalStatus, string> = {
  PENDING: "bg-amber-50 text-amber-700 border-amber-200",
  APPROVED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  REJECTED: "bg-red-50 text-red-700 border-red-200",
};

const STATUS_LABELS: SkillApprovalStatus[] = ["PENDING", "APPROVED", "REJECTED"];

function SkillFormModal({
  open,
  onOpenChange,
  editingItem,
  availableSkills,
  employeeId,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editingItem: MappedSkill | null;
  availableSkills: { id: string; name: string; category: string }[];
  employeeId: string;
  onSuccess: () => void;
}) {
  const [selectedSkillId, setSelectedSkillId] = useState(editingItem?.skillId ?? "");
  const [selfAssessedLevel, setSelfAssessedLevel] = useState(editingItem?.selfAssessedLevel ?? 3);
  const [validatedLevel, setValidatedLevel] = useState<string>(editingItem?.validatedLevel?.toString() ?? "");
  const [status, setStatus] = useState<SkillApprovalStatus>(editingItem?.status ?? "PENDING");
  const [reviewComment, setReviewComment] = useState(editingItem?.reviewComment ?? "");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setSelectedSkillId(editingItem?.skillId ?? "");
      setSelfAssessedLevel(editingItem?.selfAssessedLevel ?? 3);
      setValidatedLevel(editingItem?.validatedLevel?.toString() ?? "");
      setStatus(editingItem?.status ?? "PENDING");
      setReviewComment(editingItem?.reviewComment ?? "");
    }
  }, [open, editingItem]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData();
    fd.append("employeeId", employeeId);
    fd.append("skillId", selectedSkillId);
    fd.append("selfAssessedLevel", selfAssessedLevel.toString());
    fd.append("validatedLevel", validatedLevel);
    fd.append("status", status);
    fd.append("reviewComment", reviewComment);

    const result = editingItem
      ? await updateEmployeeSkill(editingItem.id, fd)
      : await mapSkillToEmployee(fd);
    setLoading(false);

    if (result.error) { toast.error(result.error); return; }
    toast.success(editingItem ? "Skill updated" : "Skill mapped");
    onOpenChange(false);
    onSuccess();
  }

  const isEdit = !!editingItem;

  return (
    <Dialog open={open} onOpenChange={onOpenChange} key={editingItem?.id ?? "new-skill-map"}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            <Award className="h-4 w-4 text-indigo-500" />
            {isEdit ? "Edit Skill Mapping" : "Map New Skill"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Skill</Label>
            <select
              value={selectedSkillId}
              onChange={(e) => setSelectedSkillId(e.target.value)}
              disabled={isEdit}
              className="select-field"
              required
            >
              <option value="">— Select Skill —</option>
              {availableSkills.map((s) => (
                <option key={s.id} value={s.id}>{s.name} ({s.category})</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Self-Assessed Level</Label>
              <select
                value={selfAssessedLevel}
                onChange={(e) => setSelfAssessedLevel(parseInt(e.target.value, 10))}
                className="select-field"
              >
                {[1, 2, 3, 4, 5].map((l) => (
                  <option key={l} value={l}>Level {l}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Validated Level</Label>
              <select
                value={validatedLevel}
                onChange={(e) => setValidatedLevel(e.target.value)}
                className="select-field"
              >
                <option value="">None</option>
                {[1, 2, 3, 4, 5].map((l) => (
                  <option key={l} value={l}>Level {l}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Status</Label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as SkillApprovalStatus)}
              className="select-field"
            >
              {STATUS_LABELS.map((s) => (
                <option key={s} value={s}>{s === "PENDING" ? "Pending Approval" : s === "APPROVED" ? "Approved" : "Rejected"}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Review Comment</Label>
            <Textarea
              value={reviewComment}
              onChange={(e) => setReviewComment(e.target.value)}
              placeholder="e.g. Verified via AWS certification"
              rows={2}
              className="rounded-lg resize-none"
            />
          </div>

          <DialogFooter className="pt-1">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="rounded-lg">Cancel</Button>
            <Button type="submit" disabled={loading} className="rounded-lg bg-primary hover:bg-primary/90">
              {loading ? "Saving…" : isEdit ? "Save Changes" : "Map Skill"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function EmployeeSkillsDialog({
  open,
  onOpenChange,
  employee,
  allSkills,
}: EmployeeSkillsDialogProps) {
  const [mappedSkills, setMappedSkills] = useState<MappedSkill[]>([]);
  const [loading, setLoading] = useState(false);
  const [mapModalOpen, setMapModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MappedSkill | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<SkillApprovalStatus | "ALL">("ALL");

  async function loadSkills() {
    if (!employee) return;
    setLoading(true);
    try {
      const data = await getEmployeeSkills(employee.id);
      setMappedSkills(data as MappedSkill[]);
    } catch {
      toast.error("Failed to load skills");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open && employee) {
      loadSkills();
      setSearch("");
      setStatusFilter("ALL");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, employee]);

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    const result = await removeSkillFromEmployee(deleteId);
    setDeleting(false);
    if (result.error) { toast.error(result.error); } else {
      toast.success("Skill removed");
      loadSkills();
    }
    setDeleteId(null);
  }

  const availableSkills = allSkills.filter(
    (s) => !mappedSkills.some((ms) => ms.skillId === s.id)
  );

  const filtered = mappedSkills.filter((ms) => {
    const matchSearch = ms.skill.name.toLowerCase().includes(search.toLowerCase()) ||
      ms.skill.category.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "ALL" || ms.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl! max-h-[85vh] flex flex-col rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <Award className="h-4 w-4 text-primary" />
              Manage Skills -<span className="text-secondary">{employee?.name}</span>
            </DialogTitle>
          </DialogHeader>

          {/* Toolbar */}
          <div className="flex items-center gap-2 py-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <Input
                placeholder="Search skills…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 text-sm rounded-lg"
              />
            </div>
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                className="h-8 min-w-36! ring-0 rounded-lg border border-input bg-white pl-8 pr-3 text-sm cursor-pointer appearance-none"
              >
                <option value="ALL">All Status</option>
                <option value="APPROVED">Approved</option>
                <option value="PENDING">Pending</option>
                <option value="REJECTED">Rejected</option>
              </select>
              <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
            </div>
            <Button
              size="sm"
              onClick={() => setMapModalOpen(true)}
              disabled={availableSkills.length === 0}
              className="h-8 rounded-lg bg-primary text-xs font-semibold hover:bg-primary/90"
            >
              <Plus className="h-3.5 w-3.5 mr-1" /> Map Skill
            </Button>
          </div>

          {/* Skills list */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">Loading…</div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-sm text-muted-foreground gap-2">
                <Award className="h-8 w-8 text-slate-200" />
                {mappedSkills.length === 0 ? "No skills mapped yet" : "No skills match your filters"}
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {filtered.map((item) => (
                  <div key={item.id} className="flex items-center gap-4 py-3 px-1 hover:bg-slate-50/60 rounded-lg transition-colors group">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-gray-900">{item.skill.name}</span>
                        <Badge variant="secondary" className="text-[10px] bg-slate-100 text-slate-600 border-0 rounded-md font-medium">
                          {item.skill.category.toLowerCase()}
                        </Badge>
                        <Badge variant="outline" className={`${statusColors[item.status]} border text-[10px] rounded-md font-semibold`}>
                          {item.status === "PENDING" ? "Pending" : item.status === "APPROVED" ? "Approved" : "Rejected"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                        <span>Self: <strong className="text-gray-700">L{item.selfAssessedLevel}</strong></span>
                        {item.validatedLevel !== null && (
                          <span>Validated: <strong className="text-indigo-600">L{item.validatedLevel}</strong></span>
                        )}
                        {item.reviewComment && (
                          <span className="italic line-clamp-1">&quot;{item.reviewComment}&quot;</span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        variant="ghost" size="icon" className="h-7 w-7 rounded-md"
                        onClick={() => { setEditingItem(item); setEditModalOpen(true); }}
                      >
                        <Pencil className="h-3.5 w-3.5 text-slate-500" />
                      </Button>
                      <Button
                        variant="ghost" size="icon" className="h-7 w-7 rounded-md"
                        onClick={() => setDeleteId(item.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-red-400" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{mappedSkills.length} skills mapped</span>
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="rounded-lg text-sm">
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Map new skill modal */}
      <SkillFormModal
        open={mapModalOpen}
        onOpenChange={setMapModalOpen}
        editingItem={null}
        availableSkills={availableSkills}
        employeeId={employee?.id ?? ""}
        onSuccess={loadSkills}
      />

      {/* Edit skill modal */}
      <SkillFormModal
        open={editModalOpen}
        onOpenChange={(v) => { setEditModalOpen(v); if (!v) setEditingItem(null); }}
        editingItem={editingItem}
        availableSkills={allSkills}
        employeeId={employee?.id ?? ""}
        onSuccess={loadSkills}
      />

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={() => setDeleteId(null)}
        title="Remove Skill Mapping"
        description="This will remove this skill from the employee's profile."
        onConfirm={handleDelete}
        loading={deleting}
      />
    </>
  );
}
