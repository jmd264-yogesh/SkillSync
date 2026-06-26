"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  createCompetencyLevel,
  updateCompetencyLevel,
} from "@/server/actions/competency-level";

interface CompetencyLevelFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  level?: {
    id: string;
    level: number;
    name: string;
    description: string | null;
  } | null;
  suggestedLevel?: number;
}

export function CompetencyLevelFormDialog({
  open,
  onOpenChange,
  level,
  suggestedLevel,
}: CompetencyLevelFormDialogProps) {
  const [loading, setLoading] = useState(false);
  const isEdit = !!level;

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    const result = isEdit
      ? await updateCompetencyLevel(level.id, formData)
      : await createCompetencyLevel(formData);
    setLoading(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success(isEdit ? "Level updated" : "Level created");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} key={`${level?.id ?? "new-level"}-${suggestedLevel ?? 0}`}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit Competency Level" : "Create Competency Level"}
          </DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="level">Level Number</Label>
            <Input
              id="level"
              name="level"
              type="number"
              min={1}
              max={10}
              defaultValue={level?.level ?? suggestedLevel ?? ""}
              placeholder="e.g. 1"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              name="name"
              defaultValue={level?.name ?? ""}
              placeholder="e.g. Beginner"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              defaultValue={level?.description ?? ""}
              placeholder="What this level represents"
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : isEdit ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
