"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, FileText, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { FeedbackFormBuilderDialog } from "@/components/forms/feedback-form-builder-dialog";
import { deleteFeedbackForm } from "@/server/actions/feedback-form";
import type { ReviewCycleStatus, FeedbackFormType, QuestionType } from "@prisma/client";

interface Question { id: string; text: string; type: QuestionType; required: boolean; order: number }
interface Section { id: string; title: string; description: string | null; order: number; questions: Question[] }
interface Form {
  id: string;
  title: string;
  description: string | null;
  formType: FeedbackFormType;
  sections: Section[];
  _count: { assignments: number };
}

interface Props {
  cycle: { id: string; name: string; status: ReviewCycleStatus };
  forms: Form[];
}

const FORM_TYPE_LABEL: Record<FeedbackFormType, { label: string; className: string }> = {
  PM_FEEDBACK:    { label: "PM Feedback",    className: "bg-blue-50 text-blue-700 border-blue-200" },
  CDM_ASSESSMENT: { label: "CDM Assessment", className: "bg-violet-50 text-violet-700 border-violet-200" },
  HR_FEEDBACK:    { label: "HR Feedback",    className: "bg-amber-50 text-amber-700 border-amber-200" },
};

export function FormsManagementClient({ cycle, forms }: Props) {
  const [builderOpen, setBuilderOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const canEdit = cycle.status !== "CLOSED" && cycle.status !== "ARCHIVED";

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await deleteFeedbackForm(deleteId);
      toast.success("Form deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete form");
    }
    setDeleting(false);
    setDeleteId(null);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Forms — {cycle.name}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Create and manage feedback form templates for this cycle.</p>
        </div>
        {canEdit && (
          <Button
            onClick={() => setBuilderOpen(true)}
            className="bg-primary rounded-lg h-9 px-4 text-sm font-semibold hover:bg-secondary cursor-pointer"
          >
            <Plus className="h-4 w-4 mr-1.5" /> New Form
          </Button>
        )}
      </div>

      {forms.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No forms yet"
          description="Create feedback forms for project managers and CDMs to fill out for this cycle."
        >
          {canEdit && (
            <Button onClick={() => setBuilderOpen(true)} className="bg-primary text-white rounded-lg">
              Create Form
            </Button>
          )}
        </EmptyState>
      ) : (
        <div className="space-y-3">
          {forms.map((form) => {
            const typeConfig = FORM_TYPE_LABEL[form.formType];
            const isExpanded = expandedId === form.id;
            const totalQuestions = form.sections.reduce((acc, s) => acc + s.questions.length, 0);
            return (
              <div key={form.id} className="bg-white rounded-xl border border-slate-200 shadow-card overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-indigo-50 flex items-center justify-center">
                      <FileText className="h-4.5 w-4.5 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-slate-900">{form.title}</p>
                      {form.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">{form.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={`text-xs font-medium ${typeConfig.className}`}>
                      {typeConfig.label}
                    </Badge>
                    <Badge variant="secondary" className="bg-slate-100 text-slate-600 border-0 text-xs">
                      {form.sections.length} sections · {totalQuestions} questions
                    </Badge>
                    <Badge variant="secondary" className="bg-indigo-50 text-primary border-0 text-xs">
                      {form._count.assignments} assigned
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 rounded-lg"
                      onClick={() => setExpandedId(isExpanded ? null : form.id)}
                    >
                      {isExpanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                    </Button>
                    {canEdit && form._count.assignments === 0 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 rounded-lg text-red-400 hover:text-red-500"
                        onClick={() => setDeleteId(form.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-slate-100 px-5 py-4 space-y-4 bg-slate-50/40">
                    {form.sections.map((section) => (
                      <div key={section.id}>
                        <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                          {section.title}
                        </p>
                        <div className="space-y-1.5">
                          {section.questions.map((q) => (
                            <div key={q.id} className="flex items-center gap-2 text-sm text-slate-700">
                              <Badge variant="outline" className={`text-[10px] font-medium shrink-0 ${q.type === "RATING" ? "border-indigo-200 text-indigo-600 bg-indigo-50" : "border-slate-200 text-slate-500"}`}>
                                {q.type}
                              </Badge>
                              <span>{q.text}</span>
                              {q.required && <span className="text-red-400 text-xs">*</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <FeedbackFormBuilderDialog
        open={builderOpen}
        onOpenChange={setBuilderOpen}
        reviewCycleId={cycle.id}
        allowedFormTypes={["PM_FEEDBACK", "CDM_ASSESSMENT", "HR_FEEDBACK"]}
      />
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={() => setDeleteId(null)}
        title="Delete Form"
        description="This will permanently delete the form and all its sections and questions."
        onConfirm={handleDelete}
        loading={deleting}
      />
    </div>
  );
}
