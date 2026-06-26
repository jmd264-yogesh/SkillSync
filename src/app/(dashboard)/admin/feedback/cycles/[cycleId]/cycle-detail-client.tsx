"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import {
  FileText, ClipboardList, CheckCircle2, Clock, Users,
  ChevronRight, BarChart3, Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { generateFeedbackSummary } from "@/server/actions/feedback-submission";
import type { ReviewCycleStatus, FeedbackFormType, AssignmentStatus } from "@prisma/client";

interface Assignment {
  id: string;
  status: AssignmentStatus;
  employee: { id: string; name: string; employeeCode: string; designation: { name: string } | null };
  form: { formType: FeedbackFormType; title: string };
  reviewer: { id: string; name: string };
  project: { id: string; name: string } | null;
  reviewCycle: { id: string; name: string };
  submission: { id: string; submittedAt: Date } | null;
}

interface CycleProps {
  cycle: {
    id: string;
    name: string;
    startDate: Date;
    endDate: Date;
    status: ReviewCycleStatus;
    forms: { id: string; title: string; formType: FeedbackFormType; _count: { assignments: number } }[];
    _count: { assignments: number; summaries: number };
  };
  assignments: Assignment[];
}

const FORM_TYPE_LABEL: Record<FeedbackFormType, string> = {
  PM_FEEDBACK: "PM Feedback",
  CDM_ASSESSMENT: "CDM Assessment",
  HR_FEEDBACK: "HR Feedback",
};

const STATUS_CONFIG: Record<AssignmentStatus, { label: string; className: string }> = {
  PENDING:     { label: "Pending",     className: "bg-slate-100 text-slate-600" },
  IN_PROGRESS: { label: "In Progress", className: "bg-blue-50 text-blue-700" },
  SUBMITTED:   { label: "Submitted",   className: "bg-emerald-50 text-emerald-700" },
  OVERDUE:     { label: "Overdue",     className: "bg-red-50 text-red-600" },
};

export function CycleDetailClient({ cycle, assignments }: CycleProps) {
  const [generatingFor, setGeneratingFor] = useState<string | null>(null);

  // Group assignments by employee
  const byEmployee = assignments.reduce<Record<string, { employee: Assignment["employee"]; items: Assignment[] }>>(
    (acc, a) => {
      if (!acc[a.employee.id]) acc[a.employee.id] = { employee: a.employee, items: [] };
      acc[a.employee.id]!.items.push(a);
      return acc;
    },
    {}
  );

  const employeeGroups = Object.values(byEmployee);
  const totalSubmitted = assignments.filter((a) => a.status === "SUBMITTED").length;
  const completionPct = assignments.length > 0
    ? Math.round((totalSubmitted / assignments.length) * 100)
    : 0;

  async function handleGenerateSummary(employeeId: string) {
    setGeneratingFor(employeeId);
    try {
      await generateFeedbackSummary({ reviewCycleId: cycle.id, employeeId });
      toast.success("Summary generated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to generate summary");
    }
    setGeneratingFor(null);
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{cycle.name}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {new Date(cycle.startDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
            {" – "}
            {new Date(cycle.endDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`/admin/feedback/cycles/${cycle.id}/forms`}>
            <Button variant="outline" size="sm" className="rounded-lg">
              <FileText className="h-4 w-4 mr-1.5" /> Manage Forms
            </Button>
          </Link>
          <Link href={`/admin/feedback/cycles/${cycle.id}/forms?newAssignment=1`}>
            <Button size="sm" className="bg-primary rounded-lg hover:bg-secondary">
              <Plus className="h-4 w-4 mr-1.5" /> Add Assignment
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Forms",       value: cycle.forms.length,         icon: FileText },
          { label: "Assignments", value: assignments.length,          icon: ClipboardList },
          { label: "Submitted",   value: totalSubmitted,             icon: CheckCircle2 },
          { label: "Completion",  value: `${completionPct}%`,        icon: BarChart3 },
        ].map((s) => (
          <div key={s.label} className="stat-card flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
              <s.icon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xl font-extrabold text-gray-900">{s.value}</p>
              <p className="text-xs text-muted-foreground font-medium">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      <Tabs defaultValue="assignments">
        <TabsList className="rounded-lg bg-slate-100">
          <TabsTrigger value="assignments" className="rounded-md text-sm">
            <ClipboardList className="h-4 w-4 mr-1.5" /> By Employee
          </TabsTrigger>
          <TabsTrigger value="forms" className="rounded-md text-sm">
            <FileText className="h-4 w-4 mr-1.5" /> Forms
          </TabsTrigger>
        </TabsList>

        <TabsContent value="assignments" className="mt-4">
          {employeeGroups.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-muted-foreground text-sm">
              No assignments yet. Add assignments to start collecting feedback.
            </div>
          ) : (
            <div className="space-y-3">
              {employeeGroups.map(({ employee, items }) => {
                const submitted = items.filter((i) => i.status === "SUBMITTED").length;
                const allDone = submitted === items.length;
                return (
                  <div key={employee.id} className="bg-white rounded-xl border border-slate-200 shadow-card">
                    <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center">
                          <span className="text-white text-xs font-bold">
                            {employee.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                          </span>
                        </div>
                        <div>
                          <p className="font-semibold text-sm text-slate-900">{employee.name}</p>
                          <p className="text-xs text-muted-foreground">{employee.employeeCode} · {employee.designation?.name ?? "—"}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{submitted}/{items.length} submitted</span>
                        {allDone && cycle.status === "CLOSED" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs rounded-lg"
                            onClick={() => handleGenerateSummary(employee.id)}
                            disabled={generatingFor === employee.id}
                          >
                            <BarChart3 className="h-3 w-3 mr-1" />
                            {generatingFor === employee.id ? "Generating…" : "Generate Summary"}
                          </Button>
                        )}
                        <Link href={`/admin/feedback/cycles/${cycle.id}/employee/${employee.id}`}>
                          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg">
                            <ChevronRight className="h-4 w-4 text-slate-400" />
                          </Button>
                        </Link>
                      </div>
                    </div>
                    <div className="divide-y divide-slate-50">
                      {items.map((item) => {
                        const sc = STATUS_CONFIG[item.status];
                        return (
                          <div key={item.id} className="flex items-center justify-between px-5 py-2.5">
                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-1.5 text-xs text-slate-600">
                                <Users className="h-3.5 w-3.5 text-slate-400" />
                                <span className="font-medium">{item.reviewer.name}</span>
                                <span className="text-slate-300">·</span>
                                <span className="text-muted-foreground">{FORM_TYPE_LABEL[item.form.formType]}</span>
                                {item.project && (
                                  <>
                                    <span className="text-slate-300">·</span>
                                    <span className="text-muted-foreground">{item.project.name}</span>
                                  </>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {item.submission ? (
                                <span className="text-xs text-muted-foreground">
                                  {new Date(item.submission.submittedAt).toLocaleDateString("en-IN")}
                                </span>
                              ) : null}
                              <Badge className={`text-[10px] font-medium border-0 ${sc.className}`}>
                                {item.status === "SUBMITTED" ? <CheckCircle2 className="h-3 w-3 mr-0.5" /> : <Clock className="h-3 w-3 mr-0.5" />}
                                {sc.label}
                              </Badge>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="forms" className="mt-4">
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-card">
            {cycle.forms.length === 0 ? (
              <div className="p-12 text-center text-sm text-muted-foreground">
                No forms created for this cycle.{" "}
                <Link href={`/admin/feedback/cycles/${cycle.id}/forms`} className="text-primary underline underline-offset-2">
                  Manage forms
                </Link>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/60">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Form</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Type</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Assignments</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {cycle.forms.map((form) => (
                    <tr key={form.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-5 py-3.5 font-medium text-slate-900">{form.title}</td>
                      <td className="px-5 py-3.5">
                        <Badge variant="outline" className="text-xs border-indigo-200 text-indigo-700 bg-indigo-50">
                          {FORM_TYPE_LABEL[form.formType]}
                        </Badge>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <Badge variant="secondary" className="bg-slate-100 text-slate-600 border-0 text-xs font-semibold">
                          {form._count.assignments}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
