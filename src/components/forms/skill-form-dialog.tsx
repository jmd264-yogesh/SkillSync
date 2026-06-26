"use client";

import { useState } from "react";
import { toast } from "sonner";
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
      <DialogContent className="rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-extrabold">{isEdit ? "Edit Skill" : "Create Skill"}</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label className="font-semibold">Name</Label>
            <Input name="name" defaultValue={skill?.name ?? ""} placeholder="e.g. React" required className="rounded-xl" />
          </div>
          <div className="space-y-2">
            <Label className="font-semibold">Category</Label>
            <select name="category" defaultValue={skill?.category ?? ""} className="select-field" required>
              <option value="" disabled>— Select a category —</option>
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label className="font-semibold">Description</Label>
            <Textarea name="description" defaultValue={skill?.description ?? ""} placeholder="Brief description of this skill" rows={3} className="rounded-xl" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">Cancel</Button>
            <Button type="submit" disabled={loading} className="gradient-brand rounded-xl">
              {loading ? "Saving..." : isEdit ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
