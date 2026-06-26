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
import { createCoe, updateCoe } from "@/server/actions/coe";

interface CoeFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  coe?: { id: string; name: string; description: string | null } | null;
}

export function CoeFormDialog({ open, onOpenChange, coe }: CoeFormDialogProps) {
  const [loading, setLoading] = useState(false);
  const isEdit = !!coe;

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    const result = isEdit
      ? await updateCoe(coe.id, formData)
      : await createCoe(formData);
    setLoading(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success(isEdit ? "COE updated" : "COE created");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} key={coe?.id ?? "new-coe"}>
      <DialogContent className="rounded-md">
        <DialogHeader>
          <DialogTitle className="text-secondary font-bold">{isEdit ? "Edit COE" : "Create COE"}</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="font-bold text-black text-md">Name</Label>
            <Input
              id="name"
              name="name"
              defaultValue={coe?.name ?? ""}
              placeholder="e.g. Full Stack"
              required
              className="rounded-sm min-h-10"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description" className="font-bold text-black text-md">Description</Label>
            <Textarea
              id="description"
              name="description"
              className="rounded-sm"
              defaultValue={coe?.description ?? ""}
              placeholder="Brief description of this COE"
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button type="button" className="py-4 rounded-sm" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" className="py-4 rounded-sm cursor-pointer" disabled={loading}>
              {loading ? "Saving..." : isEdit ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
