"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Star, ChevronLeft, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { submitFeedback } from "@/server/actions/feedback-submission";
import type { FeedbackFormType, QuestionType } from "@prisma/client";

interface Question { id: string; text: string; type: QuestionType; required: boolean; order: number }
interface Section { id: string; title: string; description: string | null; questions: Question[] }
interface AssignmentData {
  id: string;
  employee: { id: string; name: string; designation: { name: string } | null };
  project: { id: string; name: string } | null;
  reviewCycle: { id: string; name: string };
  form: { title: string; formType: FeedbackFormType; sections: Section[] };
}

const FORM_TYPE_LABEL: Record<FeedbackFormType, string> = {
  PM_FEEDBACK: "PM Feedback",
  CDM_ASSESSMENT: "CDM Assessment",
  HR_FEEDBACK: "HR Feedback",
};

function RatingInput({ value, onChange }: { value: number | undefined; onChange: (v: number) => void }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const display = hovered ?? value ?? 0;

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          onMouseEnter={() => setHovered(n)}
          onMouseLeave={() => setHovered(null)}
          className="focus:outline-none"
        >
          <Star
            className={`h-6 w-6 transition-colors ${
              n <= display ? "text-amber-400 fill-amber-400" : "text-slate-200 fill-slate-200 hover:text-amber-300 hover:fill-amber-300"
            }`}
          />
        </button>
      ))}
      {value && <span className="text-sm font-semibold text-slate-700 ml-2">{value}/5</span>}
    </div>
  );
}

export function FeedbackSubmitClient({ assignment }: { assignment: AssignmentData }) {
  const router = useRouter();
  const [responses, setResponses] = useState<Record<string, { ratingValue?: number; textValue?: string }>>({});
  const [submitting, setSubmitting] = useState(false);

  const allQuestions = assignment.form.sections.flatMap((s) => s.questions);
  const requiredIds = new Set(allQuestions.filter((q) => q.required).map((q) => q.id));

  function setRating(questionId: string, value: number) {
    setResponses((prev) => ({ ...prev, [questionId]: { ...prev[questionId], ratingValue: value } }));
  }

  function setText(questionId: string, value: string) {
    setResponses((prev) => ({ ...prev, [questionId]: { ...prev[questionId], textValue: value } }));
  }

  function isComplete() {
    for (const id of requiredIds) {
      const r = responses[id];
      const q = allQuestions.find((q) => q.id === id);
      if (!r) return false;
      if (q?.type === "RATING" && !r.ratingValue) return false;
      if (q?.type === "TEXT" && !r.textValue?.trim()) return false;
    }
    return true;
  }

  async function handleSubmit() {
    if (!isComplete()) {
      toast.error("Please answer all required questions");
      return;
    }

    setSubmitting(true);
    try {
      await submitFeedback({
        assignmentId: assignment.id,
        responses: allQuestions
          .map((q) => ({
            questionId: q.id,
            ratingValue: responses[q.id]?.ratingValue,
            textValue: responses[q.id]?.textValue,
          }))
          .filter((r) => r.ratingValue !== undefined || r.textValue !== undefined),
      });
      toast.success("Feedback submitted successfully");
      router.push("/manager/feedback");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to submit feedback");
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      {/* Context card */}
      <Card className="border-0 shadow-sm">
        <CardContent className="pt-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">Feedback for</p>
              <p className="text-xl font-bold text-slate-900">{assignment.employee.name}</p>
              <p className="text-sm text-muted-foreground">{assignment.employee.designation?.name ?? "—"}</p>
              {assignment.project && (
                <p className="text-sm text-slate-600 mt-1">Project: <span className="font-medium">{assignment.project.name}</span></p>
              )}
            </div>
            <div className="text-right">
              <Badge variant="outline" className="text-xs border-indigo-200 text-indigo-700 bg-indigo-50 mb-1">
                {FORM_TYPE_LABEL[assignment.form.formType]}
              </Badge>
              <p className="text-xs text-muted-foreground">{assignment.reviewCycle.name}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Form sections */}
      {assignment.form.sections.map((section) => (
        <Card key={section.id} className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-slate-900">{section.title}</CardTitle>
            {section.description && (
              <p className="text-sm text-muted-foreground">{section.description}</p>
            )}
          </CardHeader>
          <CardContent className="space-y-5">
            {section.questions.map((question) => (
              <div key={question.id}>
                <p className="text-sm font-medium text-slate-800 mb-2">
                  {question.text}
                  {question.required && <span className="text-red-400 ml-1">*</span>}
                </p>
                {question.type === "RATING" ? (
                  <RatingInput
                    value={responses[question.id]?.ratingValue}
                    onChange={(v) => setRating(question.id, v)}
                  />
                ) : (
                  <Textarea
                    placeholder="Your response…"
                    value={responses[question.id]?.textValue ?? ""}
                    onChange={(e) => setText(question.id, e.target.value)}
                    rows={3}
                    className="resize-none text-sm"
                  />
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      {/* Footer actions */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => router.push("/manager/feedback")}
          className="rounded-lg"
        >
          <ChevronLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={submitting || !isComplete()}
          className="bg-primary rounded-lg hover:bg-secondary px-6"
        >
          <Send className="h-4 w-4 mr-1.5" />
          {submitting ? "Submitting…" : "Submit Feedback"}
        </Button>
      </div>
    </div>
  );
}
