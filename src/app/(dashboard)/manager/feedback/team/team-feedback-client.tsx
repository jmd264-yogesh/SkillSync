"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronRight, Users, CheckCircle2, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import type { AssignmentStatus, FeedbackFormType } from "@prisma/client";

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

const FORM_TYPE_LABEL: Record<FeedbackFormType, string> = {
  PM_FEEDBACK: "PM Feedback",
  CDM_ASSESSMENT: "CDM Assessment",
  HR_FEEDBACK: "HR Feedback",
};

export function TeamFeedbackClient({ assignments }: { assignments: Assignment[] }) {
  const [search] = useState("");

  // Group by employee
  const byEmployee = assignments.reduce<
    Record<string, { employee: Assignment["employee"]; items: Assignment[] }>
  >((acc, a) => {
    if (!acc[a.employee.id]) acc[a.employee.id] = { employee: a.employee, items: [] };
    acc[a.employee.id]!.items.push(a);
    return acc;
  }, {});

  const groups = Object.values(byEmployee).filter(({ employee }) =>
    !search || employee.name.toLowerCase().includes(search.toLowerCase())
  );

  const totalSubmitted = assignments.filter((a) => a.status === "SUBMITTED").length;

  return (
    <div className="flex flex-col gap-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Team Members", value: Object.keys(byEmployee).length, icon: Users },
          { label: "Total Assignments", value: assignments.length, icon: Clock },
          { label: "Submitted", value: totalSubmitted, icon: CheckCircle2 },
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

      {groups.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No feedback data"
          description="No feedback assignments found for your team."
        />
      ) : (
        <div className="space-y-3">
          {groups.map(({ employee, items }) => {
            const submitted = items.filter((i) => i.status === "SUBMITTED").length;
            return (
              <div key={employee.id} className="bg-white rounded-xl border border-slate-200 shadow-card overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center">
                      <span className="text-white text-xs font-bold">
                        {employee.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                      </span>
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-slate-900">{employee.name}</p>
                      <p className="text-xs text-muted-foreground">{employee.designation?.name ?? "—"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">
                      {submitted}/{items.length} submitted
                    </span>
                    <Link href={`/manager/feedback/team/${employee.id}`}>
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg">
                        <ChevronRight className="h-4 w-4 text-slate-400" />
                      </Button>
                    </Link>
                  </div>
                </div>
                <div className="divide-y divide-slate-50">
                  {items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between px-5 py-2.5">
                      <div className="flex items-center gap-2 text-xs text-slate-600">
                        <span className="font-medium">{item.reviewer.name}</span>
                        <span className="text-slate-300">·</span>
                        <Badge variant="outline" className="text-[10px] border-indigo-200 text-indigo-600 bg-indigo-50 py-0">
                          {FORM_TYPE_LABEL[item.form.formType]}
                        </Badge>
                        {item.project && (
                          <>
                            <span className="text-slate-300">·</span>
                            <span className="text-muted-foreground">{item.project.name}</span>
                          </>
                        )}
                        <span className="text-slate-300">·</span>
                        <span className="text-muted-foreground">{item.reviewCycle.name}</span>
                      </div>
                      {item.submission ? (
                        <Badge className="text-[10px] bg-emerald-50 text-emerald-700 border-0 font-medium">
                          <CheckCircle2 className="h-3 w-3 mr-0.5" /> Submitted
                        </Badge>
                      ) : (
                        <Badge className="text-[10px] bg-slate-100 text-slate-500 border-0 font-medium">
                          <Clock className="h-3 w-3 mr-0.5" /> Pending
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
