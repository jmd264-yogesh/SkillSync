"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { toast } from "sonner";
import { motion } from "framer-motion";

import {
  FolderOpen,
  Users,
  Clock,
  LayoutGrid,
  Plus,
  Trash2,
  Briefcase,
  CalendarDays,
  AlertCircle,
  CheckCircle2,
  PauseCircle,
  XCircle,
  UserPlus,
  X,
  FileSearch,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Search,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  createProject,
  updateProjectStatus,
  deleteProject,
  addSkillRequirement,
  removeSkillRequirement,
  allocateEmployee,
  removeAllocation,
  getSkillsForSelect,
  getEmployeesForSelect,
  createSkillAndAddRequirement,
} from "@/server/actions/resource-management";
import type { ProjectStatus, SkillCategory, RequirementPriority } from "@prisma/client";

type SkillForSelect = { id: string; name: string; category: SkillCategory };
type EmployeeForSelect = {
  id: string;
  name: string;
  employeeCode: string;
  coe: { name: string } | null;
  designation: { name: string } | null;
};

type EmployeeSkillEntry = {
  id: string;
  skill: { id: string; name: string; category: SkillCategory };
};

type AllocationEmployee = {
  id: string;
  name: string;
  employeeCode: string;
  coe: { id: string; name: string; description: string | null } | null;
  designation: { id: string; name: string; level: number; description: string | null } | null;
  employeeSkills: EmployeeSkillEntry[];
};

type ProjectAllocationEntry = {
  id: string;
  projectId: string;
  employeeId: string;
  allocation: number;
  role: string | null;
  startDate: Date | null;
  endDate: Date | null;
  employee: AllocationEmployee;
};

type SkillRequirementEntry = {
  id: string;
  projectId: string;
  skillId: string;
  requiredLevel: number;
  headcount: number;
  priority: RequirementPriority;
  skill: { id: string; name: string; category: SkillCategory };
};

type ProjectEntry = {
  id: string;
  name: string;
  description: string | null;
  domain: string | null;
  startDate: Date | null;
  endDate: Date | null;
  teamSize: number | null;
  status: ProjectStatus;
  skillRequirements: SkillRequirementEntry[];
  allocations: ProjectAllocationEntry[];
};

type EmployeeAllocationProject = {
  id: string;
  name: string;
  description: string | null;
  domain: string | null;
  startDate: Date | null;
  endDate: Date | null;
  teamSize: number | null;
  status: ProjectStatus;
};

type EnrichedEmployee = {
  id: string;
  name: string;
  employeeCode: string;
  coe: { id: string; name: string; description: string | null } | null;
  designation: { id: string; name: string; level: number; description: string | null } | null;
  allocations: Array<{
    id: string;
    projectId: string;
    employeeId: string;
    allocation: number;
    role: string | null;
    startDate: Date | null;
    endDate: Date | null;
    project: EmployeeAllocationProject;
  }>;
  employeeSkills: EmployeeSkillEntry[];
  totalAllocation: number;
  availablePercent: number;
};

interface ResourceClientProps {
  projects: ProjectEntry[];
  employees: EnrichedEmployee[];
}

const STATUS_CONFIG: Record<ProjectStatus, { label: string; className: string; icon: React.ReactNode }> = {
  ACTIVE: {
    label: "Active",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
    icon: <CheckCircle2 className="h-3 w-3" />,
  },
  PLANNING: {
    label: "Planning",
    className: "bg-blue-50 text-blue-700 border-blue-200",
    icon: <Clock className="h-3 w-3" />,
  },
  COMPLETED: {
    label: "Completed",
    className: "bg-gray-100 text-gray-600 border-gray-200",
    icon: <XCircle className="h-3 w-3" />,
  },
  ON_HOLD: {
    label: "On Hold",
    className: "bg-amber-50 text-amber-700 border-amber-200",
    icon: <PauseCircle className="h-3 w-3" />,
  },
};

const PRIORITY_CONFIG: Record<RequirementPriority, { label: string; className: string }> = {
  CRITICAL: { label: "Critical", className: "bg-rose-50 text-rose-700 border-rose-200" },
  HIGH: { label: "High", className: "bg-orange-50 text-orange-700 border-orange-200" },
  MEDIUM: { label: "Medium", className: "bg-blue-50 text-blue-700 border-blue-200" },
  LOW: { label: "Low", className: "bg-gray-100 text-gray-600 border-gray-200" },
};

function formatDate(d: Date | null): string {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("en-US", { month: "short", year: "numeric", day: "numeric" });
}

function AllocationBar({ pct }: { pct: number }) {
  
  return (
    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
      <div
        className={cn("h-full rounded-full transition-all bg-primary")}
        style={{ width: `${Math.min(pct, 100)}%` }}
      />
    </div>
  );
}

function availabilityLabel(pct: number): { text: string; className: string } {
  if (pct === 100) return { text: "Bench", className: "text-primary font-semibold" };
  if (pct > 0) return { text: `${pct}% Available`, className: "text-primary font-semibold" };
  return { text: "Fully Allocated", className: "text-primary font-semibold" };
}

function AddProjectDialog({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await createProject(fd);
      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success("Project created");
        setOpen(false);
        onDone();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button className="bg-primary py-5 hover:bg-secondary" />}>
        <Plus className="h-4 w-4 mr-1.5" />
        Add Project
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Project</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 mt-1">
          <div>
            <Label htmlFor="name" className="text-xs font-medium">Project Name *</Label>
            <Input id="name" name="name" placeholder="e.g. Project Apollo" className="mt-1" required />
          </div>
          <div>
            <Label htmlFor="description" className="text-xs font-medium">Description</Label>
            <Input id="description" name="description" placeholder="Brief description" className="mt-1" />
          </div>
          <div>
            <Label htmlFor="domain" className="text-xs font-medium">Domain</Label>
            <Input id="domain" name="domain" placeholder="e.g. Full Stack Web Application" className="mt-1" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="startDate" className="text-xs font-medium">Start Date</Label>
              <Input id="startDate" name="startDate" type="date" className="mt-1" />
            </div>
            <div>
              <Label htmlFor="endDate" className="text-xs font-medium">End Date</Label>
              <Input id="endDate" name="endDate" type="date" className="mt-1" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="teamSize" className="text-xs font-medium">Team Size</Label>
              <Input id="teamSize" name="teamSize" type="number" min="1" placeholder="5" className="mt-1" />
            </div>
            <div>
              <Label htmlFor="status" className="text-xs font-medium">Status</Label>
              <select name="status" id="status" className="select-field mt-1">
                <option value="PLANNING">Planning</option>
                <option value="ACTIVE">Active</option>
                <option value="ON_HOLD">On Hold</option>
                <option value="COMPLETED">Completed</option>
              </select>
            </div>
          </div>
          <DialogFooter className="-mx-4 -mb-4 mt-4">
            <Button type="submit" className="bg-primary hover:bg-secondary py-5" disabled={pending}>
              {pending ? "Creating…" : "Create Project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ManageAllocationsSheet({
  project,
  employeesForSelect,
}: {
  project: ProjectEntry;
  employeesForSelect: EmployeeForSelect[];
}) {
  const [pending, startTransition] = useTransition();
  const [showAllocForm, setShowAllocForm] = useState(false);

  function handleAllocate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("projectId", project.id);
    startTransition(async () => {
      const result = await allocateEmployee(fd);
      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success("Employee allocated");
        setShowAllocForm(false);
      }
    });
  }

  function handleRemove(allocationId: string) {
    startTransition(async () => {
      await removeAllocation(allocationId);
      toast.success("Allocation removed");
    });
  }

  return (
    <Sheet>
      <SheetTrigger render={<Button variant="outline" size="sm" className="text-xs cursor-pointer" />}>
        <UserPlus className="h-3.5 w-3.5 mr-1" />
        Manage Allocations
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="pb-4 border-b">
          <SheetTitle>{project.name} - Allocations</SheetTitle>
        </SheetHeader>

        <div className="p-4 space-y-4">
          {project.allocations.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No allocations yet</p>
          ) : (
            <div className="space-y-2">
              {project.allocations.map((alloc) => (
                <div key={alloc.id} className="flex items-center justify-between bg-muted/40 rounded-xl px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold">{alloc.employee.name}</p>
                    <p className="text-xs text-muted-foreground">{alloc.role ?? "-"} &middot; {alloc.allocation}%</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                    onClick={() => handleRemove(alloc.id)}
                    disabled={pending}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <Button
            variant="outline"
            size="sm"
            className="w-full cursor-pointer"
            onClick={() => setShowAllocForm((v) => !v)}
          >


            {showAllocForm ? <X className="h-3.5 w-3.5 mr-1" /> : <Plus className="h-3.5 w-3.5 mr-1" />}

            {showAllocForm ? "Cancel" : " Add Allocation"}
          </Button>

          {showAllocForm && (
            <form onSubmit={handleAllocate} className="space-y-3 border rounded-xl p-4 bg-muted/30">
              <div>
                <Label className="text-xs font-medium">Employee *</Label>
                <select name="employeeId" className="select-field mt-1" required>
                  <option value="">Select employee…</option>
                  {employeesForSelect.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.coe?.name ?? "No COE"})
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-medium">Allocation %</Label>
                  <select name="allocation" className="select-field mt-1" required>
                    <option value="12.5">12.5%</option>
                    <option value="25">25%</option>
                    <option value="50">50%</option>
                    <option value="75">75%</option>
                    <option value="100">100%</option>
                  </select>
                </div>
                <div>
                  <Label className="text-xs font-medium">Role</Label>
                  <Input name="role" placeholder="e.g. Tech Lead" className="mt-1" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-medium">Start Date</Label>
                  <Input name="startDate" type="date" className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs font-medium">End Date</Label>
                  <Input name="endDate" type="date" className="mt-1" />
                </div>
              </div>
              <Button type="submit" size="sm" className="gradient-brand w-full py-4" disabled={pending}>
                {pending ? "Saving…" : "Allocate"}
              </Button>
            </form>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function AddSkillRequirementForm({
  projectId,
  skillsForSelect,
}: {
  projectId: string;
  skillsForSelect: SkillForSelect[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await addSkillRequirement(projectId, fd);
      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success("Skill requirement added");
        setOpen(false);
      }
    });
  }

  return (
    <div>
      <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setOpen((v) => !v)}>
        <Plus className="h-3 w-3 mr-1" />
        Add Skill Requirement
      </Button>
      {open && (
        <form onSubmit={handleSubmit} className="mt-2 space-y-2 border rounded-xl p-3 bg-muted/30">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px] font-medium">Skill *</Label>
              <select name="skillId" className="select-field mt-0.5 text-xs h-8" required>
                <option value="">Select…</option>
                {skillsForSelect.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-[10px] font-medium">Priority</Label>
              <select name="priority" className="select-field mt-0.5 text-xs h-8">
                <option value="CRITICAL">Critical</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px] font-medium">Required Level (1-5)</Label>
              <Input name="requiredLevel" type="number" min="1" max="5" defaultValue="3" className="mt-0.5 h-8 text-xs" />
            </div>
            <div>
              <Label className="text-[10px] font-medium">Headcount</Label>
              <Input name="headcount" type="number" min="1" defaultValue="1" className="mt-0.5 h-8 text-xs" />
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" className="bg-primary h-7 text-xs" disabled={pending}>
              {pending ? "Saving…" : "Add"}
            </Button>
            <Button type="button" variant="ghost" size="sm" className="h-7 text-xs " onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

function SkillRequirementsDialog({
  project,
  skillsForSelect,
}: {
  project: ProjectEntry;
  skillsForSelect: SkillForSelect[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleRemoveReq(reqId: string) {
    startTransition(async () => {
      await removeSkillRequirement(reqId);
      toast.success("Requirement removed");
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={
        <button
          type="button"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
        />
      }>
        <Briefcase className="h-3.5 w-3.5 text-slate-400" />
        Skills ({project.skillRequirements.length})
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{project.name} - Skill Requirements</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 mt-1">
          {project.skillRequirements.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Briefcase className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm font-medium">No skill requirements yet</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {project.skillRequirements.map((req) => (
                <div key={req.id} className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-2.5 border border-slate-100">
                  <div className="flex items-center gap-2 min-w-0 flex-wrap">
                    <span className="text-sm font-semibold truncate">{req.skill.name}</span>
                    <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded font-semibold">L{req.requiredLevel}</span>
                    <span className={cn("text-[10px] px-1.5 py-0.5 rounded border font-medium", PRIORITY_CONFIG[req.priority].className)}>
                      {PRIORITY_CONFIG[req.priority].label}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{req.headcount} needed</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-rose-400 hover:text-rose-600 hover:bg-rose-50 shrink-0"
                    onClick={() => handleRemoveReq(req.id)}
                    disabled={pending}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          <div className="border-t pt-3">
            <AddSkillRequirementForm projectId={project.id} skillsForSelect={skillsForSelect} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ProjectCard({
  project,
  skillsForSelect,
  employeesForSelect,
}: {
  project: ProjectEntry;
  skillsForSelect: SkillForSelect[];
  employeesForSelect: EmployeeForSelect[];
}) {
  const [pending, startTransition] = useTransition();
  const statusCfg = STATUS_CONFIG[project.status];

  function handleDelete() {
    if (!confirm(`Delete "${project.name}"? This cannot be undone.`)) return;
    startTransition(async () => {
      await deleteProject(project.id);
      toast.success("Project deleted");
    });
  }

  function handleStatusChange(newStatus: ProjectStatus) {
    startTransition(async () => {
      await updateProjectStatus(project.id, newStatus);
      toast.success("Status updated");
    });
  }

  const allocationSum = project.allocations.reduce((s, a) => s + a.allocation, 0);

  return (
    <div className="bg-white rounded-2xl shadow-card border-0 overflow-hidden hover-lift">
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-start justify-between gap-2 mb-1">
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-base text-primary truncate">{project.name}</h3>
            {project.domain && (
              <p className="text-xs text-muted-foreground mt-0.5">{project.domain}</p>
            )}
          </div>
          <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border shrink-0", statusCfg.className)}>
            {statusCfg.icon}
            {statusCfg.label}
          </span>
        </div>

        {project.description && (
          <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{project.description}</p>
        )}

        <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <CalendarDays className="h-3.5 w-3.5" />
            {formatDate(project.startDate)} - {formatDate(project.endDate)}
          </span>
          {project.teamSize && (
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              {project.teamSize} headcount
            </span>
          )}
        </div>

        <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
          <Briefcase className="h-3.5 w-3.5" />
          <span>{allocationSum}% team allocated</span>
        </div>
      </div>

      {project.allocations.length > 0 && (
        <div className="px-5 pb-3 border-t border-border/50 pt-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Team</p>
          <div className="flex flex-wrap gap-1.5">
            {project.allocations.map((alloc) => (
              <div key={alloc.id} className="flex items-center gap-1 bg-indigo-50 rounded-lg px-3 py-0.5">
                <span className="text-sm font-medium text-primary">{alloc.employee.name}</span>
                <span className="text-xs text-primary">{alloc.allocation}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="px-5 py-3 border-t border-border/50 flex flex-wrap items-center gap-2">
        <SkillRequirementsDialog project={project} skillsForSelect={skillsForSelect} />
        <ManageAllocationsSheet project={project} employeesForSelect={employeesForSelect} />
        <div className="ml-auto flex items-center gap-2">
          <select
            className="select-field text-xs h-7 w-auto"
            value={project.status}
            onChange={(e) => handleStatusChange(e.target.value as ProjectStatus)}
            disabled={pending}
          >
            <option value="PLANNING">Planning</option>
            <option value="ACTIVE">Active</option>
            <option value="ON_HOLD">On Hold</option>
            <option value="COMPLETED">Completed</option>
          </select>
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-rose-400 hover:text-rose-700 hover:bg-rose-50"
            onClick={handleDelete}
            disabled={pending}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Broad tech keyword dictionary (skills not necessarily in DB) ───────────
// Each entry: canonical name → SkillCategory
const TECH_KEYWORDS: Array<{ name: string; aliases: string[]; category: SkillCategory }> = [
  // Frontend
  { name: "React", aliases: ["reactjs", "react.js", "react js"], category: "FRAMEWORK" },
  { name: "Vue.js", aliases: ["vue", "vuejs", "vue 3", "vue 2", "nuxt"], category: "FRAMEWORK" },
  { name: "Angular", aliases: ["angularjs", "angular 2+"], category: "FRAMEWORK" },
  { name: "Svelte", aliases: ["sveltekit"], category: "FRAMEWORK" },
  { name: "Next.js", aliases: ["nextjs", "next js"], category: "FRAMEWORK" },
  { name: "Remix", aliases: [], category: "FRAMEWORK" },
  { name: "Astro", aliases: [], category: "FRAMEWORK" },
  { name: "Gatsby", aliases: [], category: "FRAMEWORK" },
  { name: "Vite", aliases: [], category: "TOOL" },
  { name: "Webpack", aliases: [], category: "TOOL" },
  { name: "Storybook", aliases: [], category: "TOOL" },
  { name: "Tailwind CSS", aliases: ["tailwind", "tailwindcss"], category: "FRAMEWORK" },
  { name: "Bootstrap", aliases: [], category: "FRAMEWORK" },
  // Languages
  { name: "TypeScript", aliases: ["ts"], category: "SKILL" },
  { name: "JavaScript", aliases: ["js", "es6", "es2015", "ecmascript", "vanilla js"], category: "SKILL" },
  { name: "Python", aliases: ["python3", "python 3"], category: "SKILL" },
  { name: "Java", aliases: [], category: "SKILL" },
  { name: "Kotlin", aliases: [], category: "SKILL" },
  { name: "Swift", aliases: ["swiftui"], category: "SKILL" },
  { name: "Go", aliases: ["golang"], category: "SKILL" },
  { name: "Rust", aliases: [], category: "SKILL" },
  { name: "C#", aliases: ["csharp", "c sharp", ".net core"], category: "SKILL" },
  { name: ".NET", aliases: ["dotnet", "asp.net", "aspnet"], category: "FRAMEWORK" },
  { name: "Ruby", aliases: ["ruby on rails", "ror"], category: "SKILL" },
  { name: "PHP", aliases: [], category: "SKILL" },
  { name: "Scala", aliases: [], category: "SKILL" },
  { name: "Dart", aliases: [], category: "SKILL" },
  // Backend frameworks
  { name: "Spring Boot", aliases: ["spring framework", "spring mvc"], category: "FRAMEWORK" },
  { name: "Express.js", aliases: ["express", "expressjs"], category: "FRAMEWORK" },
  { name: "NestJS", aliases: ["nestjs"], category: "FRAMEWORK" },
  { name: "FastAPI", aliases: [], category: "FRAMEWORK" },
  { name: "Django", aliases: [], category: "FRAMEWORK" },
  { name: "Flask", aliases: [], category: "FRAMEWORK" },
  { name: "Laravel", aliases: [], category: "FRAMEWORK" },
  { name: "Rails", aliases: [], category: "FRAMEWORK" },
  { name: "Gin", aliases: ["gin gonic"], category: "FRAMEWORK" },
  // Mobile
  { name: "React Native", aliases: ["react-native"], category: "FRAMEWORK" },
  { name: "Flutter", aliases: [], category: "FRAMEWORK" },
  { name: "Xamarin", aliases: [], category: "FRAMEWORK" },
  { name: "Ionic", aliases: [], category: "FRAMEWORK" },
  // Databases
  { name: "PostgreSQL", aliases: ["postgresql", "postgres", "psql"], category: "TOOL" },
  { name: "MySQL", aliases: [], category: "TOOL" },
  { name: "MongoDB", aliases: ["mongo"], category: "TOOL" },
  { name: "Redis", aliases: [], category: "TOOL" },
  { name: "Elasticsearch", aliases: ["elastic search", "opensearch"], category: "TOOL" },
  { name: "Cassandra", aliases: ["apache cassandra"], category: "TOOL" },
  { name: "DynamoDB", aliases: ["dynamo db"], category: "TOOL" },
  { name: "Firebase", aliases: ["firestore"], category: "TOOL" },
  { name: "Supabase", aliases: [], category: "TOOL" },
  { name: "SQLite", aliases: [], category: "TOOL" },
  { name: "Oracle DB", aliases: ["oracle database"], category: "TOOL" },
  { name: "MariaDB", aliases: [], category: "TOOL" },
  { name: "Neo4j", aliases: [], category: "TOOL" },
  { name: "ClickHouse", aliases: [], category: "TOOL" },
  // DevOps / Cloud
  { name: "Docker", aliases: ["containerization", "containers"], category: "TOOL" },
  { name: "Kubernetes", aliases: ["k8s", "container orchestration"], category: "TOOL" },
  { name: "Terraform", aliases: ["infrastructure as code", "iac"], category: "TOOL" },
  { name: "Ansible", aliases: [], category: "TOOL" },
  { name: "Helm", aliases: ["helm charts"], category: "TOOL" },
  { name: "AWS", aliases: ["amazon web services", "ec2", "lambda", "ecs", "eks", "s3", "cloudformation"], category: "TOOL" },
  { name: "GCP", aliases: ["google cloud", "google cloud platform"], category: "TOOL" },
  { name: "Azure", aliases: ["microsoft azure", "azure devops"], category: "TOOL" },
  { name: "CI/CD", aliases: ["cicd", "continuous integration", "continuous delivery", "github actions", "jenkins", "gitlab ci", "circleci", "travis ci"], category: "CONCEPT" },
  { name: "Nginx", aliases: [], category: "TOOL" },
  { name: "Git", aliases: ["github", "gitlab", "bitbucket", "version control", "source control"], category: "TOOL" },
  // Data / ML
  { name: "Data Analysis", aliases: ["data analytics", "business intelligence", "bi reporting"], category: "SKILL" },
  { name: "TensorFlow", aliases: [], category: "FRAMEWORK" },
  { name: "PyTorch", aliases: [], category: "FRAMEWORK" },
  { name: "Pandas", aliases: [], category: "TOOL" },
  { name: "NumPy", aliases: [], category: "TOOL" },
  { name: "Apache Spark", aliases: ["pyspark"], category: "TOOL" },
  { name: "Apache Kafka", aliases: ["kafka", "event streaming"], category: "TOOL" },
  { name: "Apache Airflow", aliases: ["airflow", "data pipeline"], category: "TOOL" },
  { name: "dbt", aliases: ["data build tool"], category: "TOOL" },
  { name: "Snowflake", aliases: [], category: "TOOL" },
  { name: "BigQuery", aliases: [], category: "TOOL" },
  { name: "Tableau", aliases: [], category: "TOOL" },
  { name: "Power BI", aliases: ["powerbi"], category: "TOOL" },
  // API / Architecture
  { name: "REST API Design", aliases: ["rest api", "restful api", "api design", "openapi", "swagger"], category: "CONCEPT" },
  { name: "GraphQL", aliases: [], category: "CONCEPT" },
  { name: "gRPC", aliases: ["grpc"], category: "CONCEPT" },
  { name: "WebSockets", aliases: ["websocket"], category: "CONCEPT" },
  { name: "Microservices", aliases: ["microservices architecture", "service mesh", "istio"], category: "CONCEPT" },
  { name: "System Design", aliases: ["distributed systems", "distributed architecture", "high availability", "scalability"], category: "CONCEPT" },
  { name: "Design Patterns", aliases: ["solid principles", "gang of four", "oop patterns", "clean architecture"], category: "CONCEPT" },
  // Testing
  { name: "Jest", aliases: [], category: "TOOL" },
  { name: "Vitest", aliases: [], category: "TOOL" },
  { name: "Cypress", aliases: [], category: "TOOL" },
  { name: "Playwright", aliases: [], category: "TOOL" },
  { name: "Selenium", aliases: [], category: "TOOL" },
  { name: "JUnit", aliases: [], category: "TOOL" },
  { name: "pytest", aliases: [], category: "TOOL" },
  // Observability
  { name: "Monitoring & Observability", aliases: ["monitoring", "observability", "prometheus", "grafana", "datadog", "new relic", "splunk", "elk stack", "jaeger", "opentelemetry"], category: "CONCEPT" },
  // Soft / process
  { name: "Code Review", aliases: ["peer review", "pull request review", "pr review"], category: "SKILL" },
  { name: "Technical Mentoring", aliases: ["mentoring", "coaching", "knowledge transfer", "technical leadership"], category: "SKILL" },
  { name: "Problem Solving", aliases: ["algorithms", "data structures", "analytical thinking"], category: "SKILL" },
  { name: "Agile", aliases: ["scrum", "kanban", "sprint planning"], category: "CONCEPT" },
  { name: "DevOps Culture", aliases: ["devops practices", "devsecops"], category: "CONCEPT" },
  { name: "Security Engineering", aliases: ["appsec", "application security", "penetration testing", "owasp", "sast", "dast"], category: "CONCEPT" },
];

const PRIORITY_SIGNALS: Record<RequirementPriority, RegExp> = {
  CRITICAL: /\b(must.have|critical|mandatory|required|essential|non.negotiable)\b/i,
  HIGH: /\b(strong(ly)?\s+(preferred|desired|experience)|highly\s+(desirable|valued)|important)\b/i,
  LOW: /\b(nice.to.have|plus|bonus|optional|good.to.have)\b/i,
  MEDIUM: /./,
};

const LEVEL_SIGNALS: Array<{ pattern: RegExp; level: number }> = [
  { pattern: /\b(expert|principal|architect|10\+\s*yr|8\+\s*yr)\b/i, level: 5 },
  { pattern: /\b(senior|advanced|deep|5\+\s*yr|6\+\s*yr|7\+\s*yr)\b/i, level: 4 },
  { pattern: /\b(mid.level|intermediate|solid|3\+\s*yr|4\+\s*yr)\b/i, level: 3 },
  { pattern: /\b(junior|entry.level|basic|1\+\s*yr|2\+\s*yr|graduate)\b/i, level: 2 },
];

type ProfiledSkill = {
  clientId: string;
  skillId: string | null;    // null means not in DB yet - will be created on apply
  skillName: string;
  skillCategory: SkillCategory;
  requiredLevel: number;
  priority: RequirementPriority;
  headcount: number;
  selected: boolean;
  isNew: boolean;            // true = will be created in DB when applied
};

function analyzeDocument(text: string, dbSkills: SkillForSelect[]): ProfiledSkill[] {
  const lower = text.toLowerCase();
  const seen = new Set<string>(); // prevent duplicates by canonical name
  const results: ProfiledSkill[] = [];
  const dbMap = new Map(dbSkills.map((s) => [s.name.toLowerCase(), s]));

  // Check each entry in our tech keyword dictionary
  for (const entry of TECH_KEYWORDS) {
    const terms = [entry.name.toLowerCase(), ...entry.aliases];
    let matchIndex = -1;
    for (const term of terms) {
      // word-boundary-aware check: term must not be surrounded by alphanumeric chars
      const idx = lower.indexOf(term);
      if (idx === -1) continue;
      const before = idx > 0 ? (lower[idx - 1] ?? " ") : " ";
      const after = idx + term.length < lower.length ? (lower[idx + term.length] ?? " ") : " ";
      if (/[a-z0-9]/.test(before) || /[a-z0-9]/.test(after)) continue;
      matchIndex = idx;
      break;
    }
    if (matchIndex === -1) continue;
    if (seen.has(entry.name.toLowerCase())) continue;
    seen.add(entry.name.toLowerCase());

    const context = lower.slice(Math.max(0, matchIndex - 200), Math.min(lower.length, matchIndex + 200));

    let requiredLevel = 3;
    for (const sig of LEVEL_SIGNALS) {
      if (sig.pattern.test(context)) { requiredLevel = sig.level; break; }
    }

    let priority: RequirementPriority = "MEDIUM";
    if (PRIORITY_SIGNALS.CRITICAL.test(context)) priority = "CRITICAL";
    else if (PRIORITY_SIGNALS.HIGH.test(context)) priority = "HIGH";
    else if (PRIORITY_SIGNALS.LOW.test(context)) priority = "LOW";

    // Check if this skill already exists in DB (by name, case-insensitive)
    const dbMatch = dbMap.get(entry.name.toLowerCase());
    const isNew = !dbMatch;

    results.push({
      clientId: entry.name,
      skillId: dbMatch?.id ?? null,
      skillName: dbMatch?.name ?? entry.name, // use DB casing if exists
      skillCategory: dbMatch?.category ?? entry.category,
      requiredLevel,
      priority,
      headcount: 1,
      selected: true,
      isNew,
    });
  }

  return results.sort((a, b) => {
    const order: RequirementPriority[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
    return order.indexOf(a.priority) - order.indexOf(b.priority);
  });
}

function SkillDemandProfiler({
  projects,
  skillsForSelect,
}: {
  projects: ProjectEntry[];
  skillsForSelect: SkillForSelect[];
}) {
  const [text, setText] = useState("");
  const [skills, setSkills] = useState<ProfiledSkill[]>([]);
  const [analyzed, setAnalyzed] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [applying, startApply] = useTransition();
  const [showAll, setShowAll] = useState(false);
  const [manualInput, setManualInput] = useState("");

  function handleAnalyze() {
    if (!text.trim()) { toast.error("Paste some text first"); return; }
    const results = analyzeDocument(text, skillsForSelect);
    setSkills(results);
    setAnalyzed(true);
    setShowAll(false);
  }

  function toggleSelected(clientId: string) {
    setSkills((prev) => prev.map((s) => s.clientId === clientId ? { ...s, selected: !s.selected } : s));
  }

  function updateSkill(clientId: string, field: keyof ProfiledSkill, value: unknown) {
    setSkills((prev) => prev.map((s) => s.clientId === clientId ? { ...s, [field]: value } : s));
  }

  function addManualSkill() {
    const name = manualInput.trim();
    if (!name) return;
    if (skills.some((s) => s.skillName.toLowerCase() === name.toLowerCase())) {
      toast.info(`"${name}" is already in the list`);
      return;
    }
    const dbMatch = skillsForSelect.find((s) => s.name.toLowerCase() === name.toLowerCase());
    setSkills((prev) => [
      ...prev,
      {
        clientId: `manual-${name}`,
        skillId: dbMatch?.id ?? null,
        skillName: dbMatch?.name ?? name,
        skillCategory: dbMatch?.category ?? "SKILL",
        requiredLevel: 3,
        priority: "MEDIUM",
        headcount: 1,
        selected: true,
        isNew: !dbMatch,
      },
    ]);
    setManualInput("");
  }

  function removeSkill(clientId: string) {
    setSkills((prev) => prev.filter((s) => s.clientId !== clientId));
  }

  function handleApply() {
    if (!selectedProjectId) { toast.error("Select a project first"); return; }
    const selected = skills.filter((s) => s.selected);
    if (selected.length === 0) { toast.error("Select at least one skill"); return; }

    startApply(async () => {
      let added = 0;
      let errors = 0;
      for (const s of selected) {
        let result: { error: string } | { success: true };
        if (!s.isNew && s.skillId) {
          const fd = new FormData();
          fd.set("skillId", s.skillId);
          fd.set("requiredLevel", String(s.requiredLevel));
          fd.set("headcount", String(s.headcount));
          fd.set("priority", s.priority);
          result = await addSkillRequirement(selectedProjectId, fd);
        } else {
          result = await createSkillAndAddRequirement(
            selectedProjectId, s.skillName, s.skillCategory, s.requiredLevel, s.headcount, s.priority
          );
        }
        if ("error" in result) errors++;
        else added++;
      }
      if (added > 0) toast.success(`${added} skill${added !== 1 ? "s" : ""} applied to project${errors > 0 ? ` (${errors} failed)` : ""}`);
      else toast.error("All requirements failed to apply");
    });
  }

  const selected = skills.filter((s) => s.selected);
  const visibleSkills = showAll ? skills : skills.slice(0, 8);

  return (
    <div className="space-y-6">
      {/* Input card */}
      <div className="bg-white rounded-2xl shadow-card border-0 overflow-hidden">
        <div className="px-6 pt-6 pb-4 border-b border-border/40 flex items-center gap-3">
          <div className="p-2 rounded-xl bg-violet-50">
            <FileSearch className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-bold text-base text-primary">Skill Demand Profiler</h3>
            <p className="text-xs text-muted-foreground">Paste a project description, JD, or SOW - any skill mentioned will be extracted</p>
          </div>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <Label className="text-xs font-semibold mb-1.5 block">Project Description / JD / SOW</Label>
            <Textarea
              value={text}
              onChange={(e) => { setText(e.target.value); setAnalyzed(false); }}
              placeholder={"Paste any text here - job descriptions, project briefs, SOWs, RFPs.\n\nExample:\n\"We need a Senior React developer with 5+ years of experience in TypeScript and Node.js. Must have Docker and Kubernetes expertise. GraphQL experience is a strong plus. The team uses Terraform for infrastructure and GitHub Actions for CI/CD. AWS knowledge required...\""}
              className="min-h-[200px] text-sm font-mono resize-y"
            />
            <p className="text-[10px] text-muted-foreground mt-1">{text.split(/\s+/).filter(Boolean).length} words</p>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={handleAnalyze} className="gradient-brand" disabled={!text.trim()}>
              <Sparkles className="h-4 w-4 mr-1.5" />
              Extract Skills
            </Button>
            {analyzed && (
              <span className="text-sm text-muted-foreground">
                Found <span className="font-semibold text-foreground">{skills.length}</span> skill{skills.length !== 1 ? "s" : ""}
                {skills.some((s) => s.isNew) && (
                  <span className="ml-1.5 text-primary font-medium">
                    ({skills.filter((s) => s.isNew).length} new - will be added to your skills library)
                  </span>
                )}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Results card */}
      {(analyzed || skills.length > 0) && (
        <div className="bg-white rounded-2xl shadow-card border-0 overflow-hidden">
          <div className="px-6 pt-5 pb-3 border-b border-border/40 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-base text-primary">Extracted Skills</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                <span className="inline-flex items-center gap-1 mr-2">
                  <span className="h-2 w-2 rounded-full bg-primary inline-block" />Existing in library
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-violet-400 inline-block" />New - will be created
                </span>
              </p>
            </div>
            <span className="text-xs text-muted-foreground">{selected.length} selected</span>
          </div>

          {skills.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <FileSearch className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-30" />
              <p className="font-semibold text-muted-foreground">No skills detected</p>
              <p className="text-sm text-muted-foreground mt-1">Try a more detailed description, or add skills manually below.</p>
            </div>
          ) : (
            <div className="px-6 pt-4 pb-2 space-y-2">
              {visibleSkills.map((s) => (
                <div
                  key={s.clientId}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-4 py-3 border transition-colors",
                    s.selected
                      ? s.isNew ? "bg-violet-50/60 border-violet-200" : "bg-indigo-50/60 border-primary"
                      : "bg-muted/30 border-border/40 opacity-50"
                  )}
                >
                  <input
                    type="checkbox"
                    checked={s.selected}
                    onChange={() => toggleSelected(s.clientId)}
                    className="h-4 w-4 accent-primary shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold truncate">{s.skillName}</span>
                      {s.isNew ? (
                        <span className="text-[10px] bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded font-semibold shrink-0">NEW</span>
                      ) : (
                        <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded font-medium shrink-0">In library</span>
                      )}
                      {s.isNew && (
                        <select
                          value={s.skillCategory}
                          onChange={(e) => updateSkill(s.clientId, "skillCategory", e.target.value as SkillCategory)}
                          className="select-field h-6 text-[10px] w-28"
                          disabled={!s.selected}
                        >
                          <option value="SKILL">Skill</option>
                          <option value="FRAMEWORK">Framework</option>
                          <option value="TOOL">Tool</option>
                          <option value="CONCEPT">Concept</option>
                          <option value="CERTIFICATION">Certification</option>
                        </select>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex flex-col items-center">
                      <span className="text-[9px] text-muted-foreground mb-0.5">Level</span>
                      <select
                        value={s.requiredLevel}
                        onChange={(e) => updateSkill(s.clientId, "requiredLevel", parseInt(e.target.value, 10))}
                        className="select-field h-7 text-xs w-16 text-center"
                        disabled={!s.selected}
                      >
                        {[1, 2, 3, 4, 5].map((l) => (
                          <option key={l} value={l}>L{l}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="text-[9px] text-muted-foreground mb-0.5">Priority</span>
                      <select
                        value={s.priority}
                        onChange={(e) => updateSkill(s.clientId, "priority", e.target.value as RequirementPriority)}
                        className={cn("select-field h-7 text-xs w-24",
                          s.priority === "CRITICAL" ? "text-rose-700" :
                            s.priority === "HIGH" ? "text-orange-700" :
                              s.priority === "LOW" ? "text-gray-500" : "text-blue-700"
                        )}
                        disabled={!s.selected}
                      >
                        <option value="CRITICAL">Critical</option>
                        <option value="HIGH">High</option>
                        <option value="MEDIUM">Medium</option>
                        <option value="LOW">Low</option>
                      </select>
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="text-[9px] text-muted-foreground mb-0.5">Headcount</span>
                      <Input
                        type="number" min="1" max="20"
                        value={s.headcount}
                        onChange={(e) => updateSkill(s.clientId, "headcount", parseInt(e.target.value, 10) || 1)}
                        className="h-7 text-xs w-16 text-center"
                        disabled={!s.selected}
                      />
                    </div>
                    <button
                      onClick={() => removeSkill(s.clientId)}
                      className="text-muted-foreground hover:text-rose-500 transition-colors ml-1"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}

              {skills.length > 8 && (
                <button
                  onClick={() => setShowAll((v) => !v)}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
                >
                  {showAll ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  {showAll ? "Show less" : `Show ${skills.length - 8} more skills`}
                </button>
              )}
            </div>
          )}

          {/* Manual add */}
          <div className="px-6 py-3 border-t border-border/40">
            <p className="text-xs font-semibold text-muted-foreground mb-2">Add a skill manually</p>
            <div className="flex gap-2">
              <Input
                placeholder="e.g. Temporal.io, Backstage, Argo CD…"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addManualSkill(); } }}
                className="text-sm"
              />
              <Button variant="outline" onClick={addManualSkill} disabled={!manualInput.trim()}>
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </div>
          </div>

          {/* Apply footer */}
          <div className="px-6 py-4 border-t border-border/40 bg-muted/20 flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[220px]">
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="select-field w-full"
              >
                <option value="">Select a project to apply to…</option>
                {projects
                  .filter((p) => p.status !== "COMPLETED")
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({STATUS_CONFIG[p.status].label})
                    </option>
                  ))}
              </select>
            </div>
            <Button
              onClick={handleApply}
              className="gradient-brand shrink-0"
              disabled={applying || !selectedProjectId || selected.length === 0}
            >
              {applying
                ? "Applying…"
                : `Apply ${selected.length} Skill${selected.length !== 1 ? "s" : ""} to Project`}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function ResourceClient({ projects, employees }: ResourceClientProps) {
  const [skillsForSelect, setSkillsForSelect] = useState<SkillForSelect[]>([]);
  const [employeesForSelect, setEmployeesForSelect] = useState<EmployeeForSelect[]>([]);
  const [selectsLoaded, setSelectsLoaded] = useState(false);

  const [projectSearch, setProjectSearch] = useState("");
  const [projectStatusFilter, setProjectStatusFilter] = useState<ProjectStatus | "ALL">("ALL");
  const [visibleProjects, setVisibleProjects] = useState(6);
  const [activeTab, setActiveTab] = useState("overview");

  const [benchSearch, setBenchSearch] = useState("");
  const [benchCoeFilter, setBenchCoeFilter] = useState("");
  const [visibleBench, setVisibleBench] = useState(10);

  const PROJECT_PAGE_SIZE = 6;
  const BENCH_PAGE_SIZE = 10;

  const projectSentinelRef = useRef<HTMLDivElement | null>(null);
  const benchSentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setVisibleProjects(PROJECT_PAGE_SIZE);
  }, [projectSearch, projectStatusFilter]);

  useEffect(() => {
    setVisibleBench(BENCH_PAGE_SIZE);
  }, [benchSearch, benchCoeFilter]);
  const tabs = [
    {
      value: "overview",
      label: "Overview",
      icon: LayoutGrid,
    },
    {
      value: "projects",
      label: "Projects",
      icon: FolderOpen,
    },
    {
      value: "bench",
      label: "Bench & Availability",
      icon: Users,
    },
    {
      value: "profiler",
      label: "Skill Demand Profiler",
      icon: FileSearch,
    },
  ];

  async function loadSelects() {
    if (selectsLoaded) return;
    const [skills, emps] = await Promise.all([getSkillsForSelect(), getEmployeesForSelect()]);
    setSkillsForSelect(skills);
    setEmployeesForSelect(emps);
    setSelectsLoaded(true);
  }

  const activeProjects = projects.filter((p) => p.status === "ACTIVE");
  const onBench = employees.filter((e) => e.totalAllocation === 0);
  const partiallyAvailable = employees.filter((e) => e.totalAllocation > 0 && e.totalAllocation < 100);
  const fullyAllocated = employees.filter((e) => e.totalAllocation === 100);
  const overallocated = employees.filter((e) => e.totalAllocation > 100);

  const statusCounts = {
    ACTIVE: projects.filter((p) => p.status === "ACTIVE").length,
    PLANNING: projects.filter((p) => p.status === "PLANNING").length,
    ON_HOLD: projects.filter((p) => p.status === "ON_HOLD").length,
    COMPLETED: projects.filter((p) => p.status === "COMPLETED").length,
  };

  const now = new Date();
  const in60Days = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
  const upcomingFreeups = employees.flatMap((emp) =>
    emp.allocations
      .filter((a) => {
        if (!a.endDate) return false;
        const end = new Date(a.endDate);
        return end >= now && end <= in60Days;
      })
      .map((a) => ({
        employeeName: emp.name,
        coe: emp.coe?.name ?? "-",
        projectName: a.project.name,
        endDate: a.endDate,
        allocation: a.allocation,
      }))
  );

  const filteredProjects = projects.filter((p) => {
    const matchSearch =
      !projectSearch ||
      p.name.toLowerCase().includes(projectSearch.toLowerCase()) ||
      (p.domain ?? "").toLowerCase().includes(projectSearch.toLowerCase());
    const matchStatus = projectStatusFilter === "ALL" || p.status === projectStatusFilter;
    return matchSearch && matchStatus;
  });
  const paginatedProjects = filteredProjects.slice(0, visibleProjects);

  const benchCoes = Array.from(
    new Set(employees.map((e) => e.coe?.name).filter((n): n is string => !!n))
  );
  const filteredBench = employees.filter((e) => {
    const matchSearch =
      !benchSearch ||
      e.name.toLowerCase().includes(benchSearch.toLowerCase()) ||
      e.employeeCode.toLowerCase().includes(benchSearch.toLowerCase());
    const matchCoe = !benchCoeFilter || e.coe?.name === benchCoeFilter;
    return matchSearch && matchCoe;
  });
  const paginatedBench = filteredBench.slice(0, visibleBench);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      const entry = entries[0];
      if (entry && entry.isIntersecting) {
        setVisibleProjects((prev) => Math.min(prev + PROJECT_PAGE_SIZE, filteredProjects.length));
      }
    }, { rootMargin: "100px" });

    const currentSentinel = projectSentinelRef.current;
    if (currentSentinel) {
      observer.observe(currentSentinel);
    }
    return () => {
      if (currentSentinel) {
        observer.unobserve(currentSentinel);
      }
    };
  }, [filteredProjects.length]);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      const entry = entries[0];
      if (entry && entry.isIntersecting) {
        setVisibleBench((prev) => Math.min(prev + BENCH_PAGE_SIZE, filteredBench.length));
      }
    }, { rootMargin: "100px" });

    const currentSentinel = benchSentinelRef.current;
    if (currentSentinel) {
      observer.observe(currentSentinel);
    }
    return () => {
      if (currentSentinel) {
        observer.unobserve(currentSentinel);
      }
    };
  }, [filteredBench.length]);

  return (
    <div onClick={loadSelects}>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="h-auto w-full justify-start gap-1 rounded-2xl bg-gray-100/80 p-1.5 mb-8">
          {tabs.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="cursor-pointer relative flex items-center gap-2 rounded-xl px-5 py-5 text-sm font-semibold text-gray-600 transition-colors data-[state=active]:text-primary"
            >
              {activeTab === tab.value && (
                <motion.div
                  layoutId="active-tab-pill"
                  className="absolute inset-0 rounded-xl bg-white shadow-sm"
                  transition={{
                    type: "spring",
                    stiffness: 450,
                    damping: 35,
                  }}
                />
              )}

              <span className="relative z-10 flex items-center gap-2">
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ── OVERVIEW ── */}
        <TabsContent value="overview">
          <div className="space-y-6">
            {/* KPI cards */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {[
                { label: "Total Projects", value: projects.length, icon: <FolderOpen className="h-5 w-5 text-primary" />, accent: "bg-indigo-50" },
                { label: "Active Projects", value: activeProjects.length, icon: <CheckCircle2 className="h-5 w-5 text-primary" />, accent: "bg-indigo-50" },
                { label: "On Bench", value: onBench.length, icon: <Users className="h-5 w-5 text-primary" />, accent: "bg-indigo-50" },
                { label: "Partially Available", value: partiallyAvailable.length, icon: <AlertCircle className="h-5 w-5 text-primary" />, accent: "bg-indigo-50" },
                { label: "Overallocated", value: overallocated.length, icon: <XCircle className="h-5 w-5 text-primary" />, accent: "bg-indigo-50" },
              ].map((stat) => (
                <div key={stat.label} className="stat-card hover-lift rounded-2xl">
                  <div className={cn("p-2.5 rounded-xl w-fit mb-3", stat.accent)}>{stat.icon}</div>
                  <div className="text-3xl font-extrabold tracking-tight text-primary mb-0.5">{stat.value}</div>
                  <p className="text-sm font-semibold text-foreground/80">{stat.label}</p>
                </div>
              ))}
            </div>

            {/* Chart row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Project Status Distribution */}
              <div className="bg-white rounded-2xl shadow-card border-0 p-6">
                <h3 className="font-bold text-lg text-primary mb-1">Project Status Distribution</h3>
                <p className="text-sm text-secondary mb-5">Breakdown of {projects.length} project{projects.length !== 1 ? "s" : ""} by status</p>
                <div className="space-y-3.5">
                  {[
                    { label: "Active", count: statusCounts.ACTIVE, bar: "bg-primary", text: "text-primary" },
                    { label: "Planning", count: statusCounts.PLANNING, bar: "bg-primary", text: "text-primary" },
                    { label: "On Hold", count: statusCounts.ON_HOLD, bar: "bg-primary", text: "text-primary" },
                    { label: "Completed", count: statusCounts.COMPLETED, bar: "bg-primary", text: "text-primary" },].map((row) => (
                      <div key={row.label} className="flex items-center gap-3">
                        <span className="text-xs font-semibold text-slate-600 w-20 shrink-0">{row.label}</span>
                        <div className="flex-1 h-6 bg-slate-100 rounded-lg overflow-hidden">
                          <div
                            className={`h-full ${row.bar} rounded-lg transition-all duration-700`}
                            style={{ width: `${projects.length > 0 ? (row.count / projects.length) * 100 : 0}%`, minWidth: row.count > 0 ? "4px" : "0" }}
                          />
                        </div>
                        <span className={`text-xs font-bold w-5 text-right tabular-nums ${row.text}`}>{row.count}</span>
                      </div>
                    ))}
                </div>
              </div>

              {/* Workforce Availability */}
              <div className="bg-white rounded-2xl shadow-card border-0 p-6">
                <h3 className="font-bold text-lg text-primary mb-1">Workforce Availability</h3>
                <p className="text-sm text-secondary mb-5">Allocation status across {employees.length} employee{employees.length !== 1 ? "s" : ""}</p>
                <div className="space-y-3.5">
                  {[
                    { label: "On Bench", count: onBench.length, bar: "bg-primary", text: "text-primary" },
                    { label: "Partial", count: partiallyAvailable.length, bar: "bg-primary", text: "text-primary" },
                    { label: "Fully Allocated", count: fullyAllocated.length, bar: "bg-primary", text: "text-primary" },
                    { label: "Overallocated", count: overallocated.length, bar: "bg-primary", text: "text-primary" },
                  ].map((row) => (
                    <div key={row.label} className="flex items-center gap-3">
                      <span className="text-xs font-semibold text-slate-600 w-24 shrink-0">{row.label}</span>
                      <div className="flex-1 h-6 bg-slate-100 rounded-lg overflow-hidden">
                        <div
                          className={`h-full ${row.bar} rounded-lg transition-all duration-700`}
                          style={{ width: `${employees.length > 0 ? (row.count / employees.length) * 100 : 0}%`, minWidth: row.count > 0 ? "4px" : "0" }}
                        />
                      </div>
                      <span className={`text-xs font-bold w-5 text-right tabular-nums ${row.text}`}>{row.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Upcoming Freeups */}
            {upcomingFreeups.length > 0 && (
              <div className="bg-white rounded-2xl shadow-card border border-slate-100 overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-lg text-primary">
                        Upcoming Freeups
                      </h3>
                      <p className="text-sm text-secondary mt-1">
                        Employees becoming available in the next 60 days
                      </p>
                    </div>

                    <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-primary/10 text-primary font-bold">
                      {upcomingFreeups.length}
                    </div>
                  </div>
                </div>

                <div className="p-5 space-y-3">
                  {upcomingFreeups.map((f, i) => (
                    <div
                      key={i}
                      className="group relative flex items-center justify-between rounded cursor-pointer border border-slate-200 bg-slate-50/60 p-4 transition-all hover:border-primary/30 hover:bg-primary/5 hover:shadow-md"
                    >
                      {/* Timeline Dot */}
                      <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl bg-primary" />

                      <div className="pl-3">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-sm text-slate-900">
                            {f.employeeName}
                          </h4>

                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                            {f.allocation}% Allocated
                          </span>
                        </div>

                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span>{f.coe}</span>
                          <span>•</span>
                          <span>{f.projectName}</span>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="">
                          <p className="text-[10px] font-medium uppercase tracking-wide text-secondary">
                            Available From
                          </p>
                          <p className="text-sm font-bold text-secondary">
                            {formatDate(f.endDate)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ── PROJECTS ── */}
        <TabsContent value="projects">
          <div className="space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative w-56">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <Input
                  placeholder="Search projects…"
                  value={projectSearch}
                  onChange={(e) => setProjectSearch(e.target.value)}
                  className="pl-8 h-9 rounded-lg text-sm"
                />
              </div>
              <div className="flex rounded-lg border border-input overflow-hidden">
                {(["ALL", "ACTIVE", "PLANNING", "ON_HOLD", "COMPLETED"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setProjectStatusFilter(s)}
                    className={`px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${projectStatusFilter === s ? "bg-primary text-white" : "bg-white text-slate-500 hover:bg-slate-50"
                      }`}
                  >
                    {s === "ALL" ? "All" : STATUS_CONFIG[s].label}
                  </button>
                ))}
              </div>
              <div className="ml-auto">
                <AddProjectDialog onDone={() => { }} />
              </div>
            </div>

            {filteredProjects.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <FolderOpen className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No projects found</p>
                <p className="text-sm">Try a different search or filter.</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {paginatedProjects.map((project) => (
                    <ProjectCard
                      key={project.id}
                      project={project}
                      skillsForSelect={skillsForSelect}
                      employeesForSelect={employeesForSelect}
                    />
                  ))}
                </div>
                {visibleProjects < filteredProjects.length && (
                  <div ref={projectSentinelRef} className="py-6 text-center text-sm font-semibold text-slate-400 tracking-wide animate-pulse">
                    Loading more projects...
                  </div>
                )}
              </>
            )}
          </div>
        </TabsContent>

        {/* ── BENCH & AVAILABILITY ── */}
        <TabsContent value="bench">
          <div className="space-y-4">
            <div className="w-full flex items-center gap-3 flex-wrap">
              <div className="relative w-56">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <Input
                  placeholder="Search employees…"
                  value={benchSearch}
                  onChange={(e) => setBenchSearch(e.target.value)}
                  className="pl-8 h-9 rounded-lg text-sm"
                />
              </div>
              {benchCoes.length > 0 && (
                <select
                  value={benchCoeFilter}
                  onChange={(e) => setBenchCoeFilter(e.target.value)}
                  className="select-field h-9 text-sm w-44!"
                >
                  <option value="">All COEs</option>
                  {benchCoes.map((coe) => (
                    <option key={coe} value={coe}>{coe}</option>
                  ))}
                </select>
              )}
              <span className="text-xs text-muted-foreground ml-auto">{filteredBench.length} employees</span>
            </div>

            <div className="bg-white rounded-2xl shadow-card border-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/60">
                      <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Employee</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">COE / Role</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider min-w-[160px]">Allocation</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Projects</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {paginatedBench.map((emp) => {
                      const avail = availabilityLabel(emp.availablePercent);
                      return (
                        <tr key={emp.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="px-6 py-3">
                            <p className="font-semibold text-gray-900">{emp.name}</p>
                            <p className="text-xs text-muted-foreground">{emp.employeeCode}</p>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-xs font-medium">{emp.coe?.name ?? "-"}</p>
                            <p className="text-xs text-muted-foreground">{emp.designation?.name ?? "-"}</p>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 min-w-[80px]">
                                <AllocationBar pct={emp.totalAllocation} />
                              </div>
                              <span className="text-xs font-semibold tabular-nums w-10 shrink-0">
                                {emp.totalAllocation}%
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1">
                              {emp.allocations.length === 0 ? (
                                <span className="text-xs text-muted-foreground">-</span>
                              ) : (
                                emp.allocations.map((a) => (
                                  <span key={a.id} className="inline-flex items-center px-1.5 py-0.5 bg-indigo-50 text-primary rounded text-[10px] font-medium">
                                    {a.project.name}
                                  </span>
                                ))
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={cn("text-xs", avail.className)}>{avail.text}</span>
                          </td>
                        </tr>
                      );
                    })}
                    {paginatedBench.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground text-sm">
                          No employees match your filters
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {visibleBench < filteredBench.length && (
              <div ref={benchSentinelRef} className="py-6 text-center text-sm font-semibold text-slate-400 tracking-wide animate-pulse">
                Loading more employees...
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="profiler">
          <SkillDemandProfiler projects={projects} skillsForSelect={skillsForSelect} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
