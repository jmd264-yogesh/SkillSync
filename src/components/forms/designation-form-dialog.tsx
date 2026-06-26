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
import { createDesignation, updateDesignation } from "@/server/actions/designation";

interface DesignationFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  designation?: {
    id: string;
    name: string;
    level: number;
    description: string | null;
  } | null;
  suggestedLevel?: number;
}

export function DesignationFormDialog({
  open,
  onOpenChange,
  designation,
  suggestedLevel,
}: DesignationFormDialogProps) {
  const [loading, setLoading] = useState(false);
  const isEdit = !!designation;

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    const result = isEdit
      ? await updateDesignation(designation.id, formData)
      : await createDesignation(formData);
    setLoading(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success(isEdit ? "Designation updated" : "Designation created");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} key={`${designation?.id ?? "new-desig"}-${suggestedLevel ?? 0}`}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit Designation" : "Create Designation"}
          </DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              name="name"
              defaultValue={designation?.name ?? ""}
              placeholder="e.g. Senior Software Engineer"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="level">Level</Label>
            <Input
              id="level"
              name="level"
              type="number"
              min={1}
              defaultValue={designation?.level ?? suggestedLevel ?? ""}
              placeholder="e.g. 2"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              defaultValue={designation?.description ?? ""}
              placeholder="Brief description of this designation"
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
