"use client";

import Link from "next/link";
import { ClipboardList, CheckCircle2, Clock, ChevronRight, MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import type { AssignmentStatus, FeedbackFormType } from "@prisma/client";

interface Assignment {
  id: string;
  status: AssignmentStatus;
  employee: { id: string; name: string; employeeCode: string; designation: { name: string } | null };
  form: { formType: FeedbackFormType; title: string };
  project: { id: string; name: string } | null;
  reviewCycle: { id: string; name: string; status: string };
  submission: { id: string; submittedAt: Date } | null;
  dueDate: Date | null;
}

const FORM_TYPE_LABEL: Record<FeedbackFormType, string> = {
  PM_FEEDBACK: "PM Feedback",
  CDM_ASSESSMENT: "CDM Assessment",
  HR_FEEDBACK: "HR Feedback",
};

const STATUS_CONFIG: Record<AssignmentStatus, { label: string; className: string }> = {
  PENDING:     { label: "Pending",     className: "bg-slate-100 text-slate-600 border-0" },
  IN_PROGRESS: { label: "In Progress", className: "bg-blue-50 text-blue-700 border-0" },
  SUBMITTED:   { label: "Submitted",   className: "bg-emerald-50 text-emerald-700 border-0" },
  OVERDUE:     { label: "Overdue",     className: "bg-red-50 text-red-600 border-0" },
};

export function ManagerFeedbackClient({ assignments }: { assignments: Assignment[] }) {
  const pending = assignments.filter((a) => a.status !== "SUBMITTED");
  const submitted = assignments.filter((a) => a.status === "SUBMITTED");

  return (
    <div className="flex flex-col gap-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Assigned",   value: assignments.length, icon: ClipboardList },
          { label: "Pending",          value: pending.length,     icon: Clock },
          { label: "Submitted",        value: submitted.length,   icon: CheckCircle2 },
        ].map((s) => (
          <div key={s.label} className="stat-card flex items-center gap-4">
            <div className="h-12 w-12 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
              <s.icon className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-extrabold text-gray-900">{s.value}</p>
              <p className="text-sm text-muted-foreground font-medium">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Quick links */}
      <div className="flex gap-3">
        <Link href="/manager/feedback/forms">
          <Button variant="outline" size="sm" className="rounded-lg">
            <MessageSquare className="h-4 w-4 mr-1.5" /> My Forms
          </Button>
        </Link>
        <Link href="/manager/feedback/team">
          <Button variant="outline" size="sm" className="rounded-lg">
            <ClipboardList className="h-4 w-4 mr-1.5" /> Team Feedback
          </Button>
        </Link>
      </div>

      {/* Pending assignments */}
      <div>
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-3">
          Pending Submissions ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title="All caught up!"
            description="You have no pending feedback submissions."
          />
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Employee</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Form / Project</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Cycle</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {pending.map((a) => {
                  const sc = STATUS_CONFIG[a.status];
                  return (
                    <tr key={a.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-5 py-3.5">
                        <p className="font-semibold text-slate-900">{a.employee.name}</p>
                        <p className="text-xs text-muted-foreground">{a.employee.designation?.name ?? "—"}</p>
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="text-slate-700">{a.form.title}</p>
                        {a.project && <p className="text-xs text-muted-foreground mt-0.5">{a.project.name}</p>}
                        <Badge variant="outline" className="text-[10px] mt-1 border-indigo-200 text-indigo-600 bg-indigo-50">
                          {FORM_TYPE_LABEL[a.form.formType]}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5 text-slate-600 text-xs">{a.reviewCycle.name}</td>
                      <td className="px-4 py-3.5 text-center">
                        <Badge className={`text-xs font-medium ${sc.className}`}>{sc.label}</Badge>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <Link href={`/manager/feedback/submit/${a.id}`}>
                          <Button size="sm" className="bg-primary rounded-lg h-8 text-xs hover:bg-secondary">
                            Fill Out <ChevronRight className="h-3.5 w-3.5 ml-1" />
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
