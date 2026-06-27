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
import { createExperienceDoc } from "@/server/actions/project-experience";
import { PROJECT_TYPES, PROJECT_TYPE_LABELS } from "@/validations/project-experience.schema";

interface ExperienceDocFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ExperienceDocFormDialog({ open, onOpenChange }: ExperienceDocFormDialogProps) {
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    const result = await createExperienceDoc(formData);
    setLoading(false);
    if ("error" in result && result.error) { toast.error(result.error); return; }
    toast.success("Project experience saved — click Extract Skills to analyse it");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-extrabold">Add Project Experience</DialogTitle>
          <p className="text-sm text-slate-500 mt-1">
            Describe a project you worked on. The more detail you add, the better the AI skill extraction.
          </p>
        </DialogHeader>

        <form action={handleSubmit} className="space-y-4">
          {/* Title */}
          <div className="space-y-2">
            <Label className="font-semibold">Project Title <span className="text-red-500">*</span></Label>
            <Input
              name="title"
              placeholder="e.g. BI Dashboard for Sales Ops"
              required
              className="rounded-xl"
            />
          </div>

          {/* Project Type + Client Industry */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="font-semibold">Project Type <span className="text-red-500">*</span></Label>
              <select name="projectType" className="select-field" required defaultValue="">
                <option value="" disabled>— Select type —</option>
                {PROJECT_TYPES.map((t) => (
                  <option key={t} value={t}>{PROJECT_TYPE_LABELS[t]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label className="font-semibold">Client Industry</Label>
              <Input
                name="clientIndustry"
                placeholder="e.g. Financial Services"
                className="rounded-xl"
              />
            </div>
          </div>

          {/* My Role + Team Size */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="font-semibold">My Role</Label>
              <Input
                name="myRole"
                placeholder="e.g. Lead Data Engineer"
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label className="font-semibold">Team Size</Label>
              <Input
                name="teamSize"
                type="number"
                min={1}
                max={500}
                placeholder="e.g. 8"
                className="rounded-xl"
              />
            </div>
          </div>

          {/* Tech Stack */}
          <div className="space-y-2">
            <Label className="font-semibold">Tech Stack / Technologies</Label>
            <Input
              name="techStack"
              placeholder="e.g. Python, Spark, Databricks, Power BI, Azure DevOps"
              className="rounded-xl"
            />
            <p className="text-xs text-slate-400">Comma-separated list of tools, languages, frameworks, and platforms used</p>
          </div>

          {/* Date range */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="font-semibold">Start Date</Label>
              <Input name="startDate" type="date" className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label className="font-semibold">End Date</Label>
              <Input name="endDate" type="date" className="rounded-xl" />
            </div>
          </div>

          {/* Business Context */}
          <div className="space-y-2">
            <Label className="font-semibold">Business Context</Label>
            <Textarea
              name="businessContext"
              placeholder="What business problem were you solving? What was the client's situation?"
              rows={3}
              className="rounded-xl"
            />
          </div>

          {/* Solution Provided */}
          <div className="space-y-2">
            <Label className="font-semibold">Solution You Provided</Label>
            <Textarea
              name="solutionProvided"
              placeholder="What did you build or deliver? What was your specific contribution?"
              rows={3}
              className="rounded-xl"
            />
          </div>

          {/* Additional Notes */}
          <div className="space-y-2">
            <Label className="font-semibold">Additional Notes</Label>
            <Textarea
              name="rawText"
              placeholder="Any other context: challenges faced, outcomes achieved, interesting technical decisions…"
              rows={3}
              className="rounded-xl"
            />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="gradient-brand rounded-xl">
              {loading ? "Saving…" : "Save Project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
