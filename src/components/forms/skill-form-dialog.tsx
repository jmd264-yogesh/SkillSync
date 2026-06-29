"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ChevronDown } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createSkill, updateSkill } from "@/server/actions/skill";
import type { SkillCategory } from "@prisma/client";

interface SkillFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  skill?: { id: string; name: string; category: SkillCategory; description: string | null } | null;
}

const CATEGORIES: { value: SkillCategory; label: string }[] = [
  { value: "SKILL", label: "Skill" },
  { value: "FRAMEWORK", label: "Framework" },
  { value: "CONCEPT", label: "Concept" },
  { value: "TOOL", label: "Tool" },
  { value: "CERTIFICATION", label: "Certification" },
];

export function SkillFormDialog({ open, onOpenChange, skill }: SkillFormDialogProps) {
  const [loading, setLoading] = useState(false);
  const isEdit = !!skill;

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    const result = isEdit ? await updateSkill(skill.id, formData) : await createSkill(formData);
    setLoading(false);
    if (result.error) { toast.error(result.error); return; }
    toast.success(isEdit ? "Skill updated" : "Skill created");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} key={skill?.id ?? "new-skill"}>
      <DialogContent className="rounded-2xl max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-extrabold text-slate-800">{isEdit ? "Edit Skill" : "Create Skill"}</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Skill Name</Label>
            <Input name="name" defaultValue={skill?.name ?? ""} placeholder="e.g. React" required className="h-10 bg-white border-slate-200 rounded-xl focus-visible:ring-2 focus-visible:ring-primary/20 shadow-xs" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Category</Label>
            <div className="relative">
              <select name="category" defaultValue={skill?.category ?? ""} className="flex h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 font-medium transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-primary/20 outline-none appearance-none" required>
                <option value="" disabled>- Select a category -</option>
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Description</Label>
            <Textarea name="description" defaultValue={skill?.description ?? ""} placeholder="Brief description of this skill..." rows={3} className="bg-white border-slate-200 rounded-xl focus-visible:ring-2 focus-visible:ring-primary/20 shadow-xs resize-none" />
          </div>
          <DialogFooter className="pt-3">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl h-10 px-4 text-sm font-semibold">Cancel</Button>
            <Button type="submit" disabled={loading} className="bg-primary text-white hover:bg-secondary hover:shadow-md rounded-xl h-10 px-5 text-sm font-semibold transition-all duration-200">
              {loading ? "Saving..." : isEdit ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

