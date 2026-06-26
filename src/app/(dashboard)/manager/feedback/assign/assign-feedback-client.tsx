"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Link2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/shared/empty-state";
import { createAssignment } from "@/server/actions/feedback-assignment";

interface Cycle { id: string; name: string; status: string }
interface Form { id: string; title: string; reviewCycleId: string }
interface Employee { id: string; name: string; employeeCode: string; designation: { name: string } | null }
interface Project {
  id: string;
  name: string;
  projectManagerId: string | null;
  projectManager: { id: string; name: string } | null;
  allocations: { employeeId: string }[];
}

interface Props {
  cycles: Cycle[];
  forms: Form[];
  reportees: Employee[];
  projects: Project[];
}

export function AssignFeedbackClient({ cycles, forms, reportees, projects }: Props) {
  const [cycleId, setCycleId] = useState("");
  const [formId, setFormId] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const formsForCycle = forms.filter((f) => f.reviewCycleId === cycleId);

  // Only projects where the selected employee is allocated
  const availableProjects = employeeId
    ? projects.filter((p) => p.allocations.some((a) => a.employeeId === employeeId) && p.projectManager)
    : [];

  const selectedProject = projects.find((p) => p.id === projectId);

  async function handleAssign() {
    if (!cycleId || !formId || !employeeId || !projectId) {
      toast.error("Please fill in all fields");
      return;
    }

    setSubmitting(true);
    try {
      await createAssignment({
        reviewCycleId: cycleId,
        formId,
        reviewerId: selectedProject?.projectManagerId ?? "",
        employeeId,
        projectId,
      });
      toast.success("Assignment created successfully");
      setFormId("");
      setEmployeeId("");
      setProjectId("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create assignment");
    }
    setSubmitting(false);
  }

  if (cycles.length === 0) {
    return (
      <EmptyState
        icon={Link2}
        title="No active cycles"
        description="Ask your HR/Admin to create and open a review cycle before assigning feedback forms."
      />
    );
  }

  if (reportees.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="No reportees"
        description="You don't have any direct reportees assigned to you."
      />
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-xl">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Assign Feedback Form</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Assign a PM feedback form to a project manager for one of your reportees.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-card p-6 space-y-5">
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Review Cycle</Label>
          <Select value={cycleId} onValueChange={(v) => { if (v) { setCycleId(v); setFormId(""); } }}>
            <SelectTrigger className="h-9 rounded-lg text-sm">
              <SelectValue placeholder="Select cycle…" />
            </SelectTrigger>
            <SelectContent>
              {cycles.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Feedback Form</Label>
          <Select value={formId} onValueChange={(v) => v && setFormId(v)} disabled={!cycleId || formsForCycle.length === 0}>
            <SelectTrigger className="h-9 rounded-lg text-sm">
              <SelectValue placeholder={formsForCycle.length === 0 ? "No forms for this cycle" : "Select form…"} />
            </SelectTrigger>
            <SelectContent>
              {formsForCycle.map((f) => (
                <SelectItem key={f.id} value={f.id}>{f.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {cycleId && formsForCycle.length === 0 && (
            <p className="text-xs text-amber-600 mt-1">
              Create a PM feedback form first from the <span className="font-medium">My Forms</span> page.
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Employee (being reviewed)</Label>
          <Select value={employeeId} onValueChange={(v) => { if (v) { setEmployeeId(v); setProjectId(""); } }}>
            <SelectTrigger className="h-9 rounded-lg text-sm">
              <SelectValue placeholder="Select employee…" />
            </SelectTrigger>
            <SelectContent>
              {reportees.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.name} · {e.designation?.name ?? "—"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Project</Label>
          <Select value={projectId} onValueChange={(v) => v && setProjectId(v)} disabled={!employeeId || availableProjects.length === 0}>
            <SelectTrigger className="h-9 rounded-lg text-sm">
              <SelectValue placeholder={
                !employeeId ? "Select employee first" :
                availableProjects.length === 0 ? "No projects with PM for this employee" :
                "Select project…"
              } />
            </SelectTrigger>
            <SelectContent>
              {availableProjects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name} — PM: {p.projectManager?.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedProject?.projectManager && (
          <div className="bg-indigo-50 rounded-lg px-4 py-3 text-sm text-indigo-700">
            <span className="font-medium">{selectedProject.projectManager.name}</span> will be asked to fill out the feedback form for the selected employee.
          </div>
        )}

        <Button
          onClick={handleAssign}
          disabled={submitting || !cycleId || !formId || !employeeId || !projectId}
          className="w-full bg-primary rounded-lg hover:bg-secondary h-10 font-semibold"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          {submitting ? "Creating…" : "Create Assignment"}
        </Button>
      </div>
    </div>
  );
}
