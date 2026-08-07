"use client";

import { useState, useTransition, useEffect } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createReviewCycle, updateReviewCycle } from "@/server/actions/review-cycle";
import type { ReviewCycleStatus } from "@prisma/client";

interface Cycle {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  status: ReviewCycleStatus;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cycle?: Cycle | null;
}

function toDateInputValue(date: Date) {
  return new Date(date).toISOString().split("T")[0] ?? "";
}

export function ReviewCycleFormDialog({ open, onOpenChange, cycle }: Props) {
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (cycle) {
      setName(cycle.name);
      setStartDate(toDateInputValue(cycle.startDate));
      setEndDate(toDateInputValue(cycle.endDate));
    } else {
      setName("");
      setStartDate("");
      setEndDate("");
    }
  }, [cycle, open]);

  function handleSubmit() {
    if (!name.trim() || !startDate || !endDate) {
      toast.error("All fields are required");
      return;
    }
    if (new Date(endDate) <= new Date(startDate)) {
      toast.error("End date must be after start date");
      return;
    }

    startTransition(async () => {
      try {
        if (cycle) {
          await updateReviewCycle(cycle.id, { name, startDate, endDate });
          toast.success("Cycle updated");
        } else {
          await createReviewCycle({ name, startDate, endDate });
          toast.success("Cycle created");
        }
        onOpenChange(false);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{cycle ? "Edit Review Cycle" : "Create Review Cycle"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-sm font-medium">Cycle Name</Label>
            <Input
              id="name"
              placeholder="e.g. H1 2026, Jan-Jun 2026"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-9 rounded-lg text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="startDate" className="text-sm font-medium">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-9 rounded-lg text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="endDate" className="text-sm font-medium">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-9 rounded-lg text-sm"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-lg">
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isPending}
              className="bg-primary rounded-lg hover:bg-secondary"
            >
              {isPending ? "Saving…" : cycle ? "Save Changes" : "Create Cycle"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
