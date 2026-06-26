"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Star, MessageSquare, BarChart3, TrendingUp, Award } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { generateFeedbackSummary } from "@/server/actions/feedback-submission";
import type { ReviewCycleStatus, FeedbackFormType, QuestionType, PromotionStatus } from "@prisma/client";

interface Response { id: string; ratingValue: number | null; textValue: string | null; question: { text: string; type: QuestionType } }
interface Submission { id: string; submittedAt: Date; responses: Response[] }
interface FeedbackItem {
  id: string;
  form: { title: string; formType: FeedbackFormType; sections: { id: string; title: string; questions: { id: string; text: string; type: QuestionType }[] }[] };
  reviewer: { id: string; name: string };
  project: { id: string; name: string } | null;
  submission: Submission | null;
}

interface Summary {
  summaryText: string;
  keyStrengths: string;
  developmentAreas: string;
  skillReadiness: number;
  feedbackReadiness: number;
  compositeScore: number;
  promotionStatus: PromotionStatus;
  promotionNotes: string | null;
  generatedAt: Date;
  reviewCycle: { name: string; status: ReviewCycleStatus };
}

interface Props {
  cycle: { id: string; name: string; status: ReviewCycleStatus };
  employee: { id: string; name: string; employeeCode: string; designation: { name: string } | null };
  feedback: FeedbackItem[];
  summary: Summary | null;
}

const FORM_TYPE_LABEL: Record<FeedbackFormType, string> = {
  PM_FEEDBACK: "PM Feedback",
  CDM_ASSESSMENT: "CDM Assessment",
  HR_FEEDBACK: "HR Feedback",
};

const PROMOTION_CONFIG: Record<PromotionStatus, { label: string; className: string }> = {
  READY_FOR_PROMOTION: { label: "Ready for Promotion",  className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  NEAR_READY:          { label: "Near Ready",           className: "bg-blue-50 text-blue-700 border-blue-200" },
  NEEDS_DEVELOPMENT:   { label: "Needs Development",    className: "bg-amber-50 text-amber-700 border-amber-200" },
  NOT_ELIGIBLE_YET:    { label: "Not Eligible Yet",     className: "bg-red-50 text-red-600 border-red-200" },
};

function RatingBar({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`h-3.5 w-3.5 ${n <= value ? "text-amber-400 fill-amber-400" : "text-slate-200 fill-slate-200"}`}
        />
      ))}
      <span className="text-xs font-semibold text-slate-700 ml-1">{value}/5</span>
    </div>
  );
}

export function EmployeeFeedbackClient({ cycle, employee, feedback, summary }: Props) {
  const [generating, setGenerating] = useState(false);
  const canGenerate = cycle.status === "CLOSED" && feedback.filter((f) => f.submission).length > 0;

  async function handleGenerate() {
    setGenerating(true);
    try {
      await generateFeedbackSummary({ reviewCycleId: cycle.id, employeeId: employee.id });
      toast.success("Summary generated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to generate summary");
    }
    setGenerating(false);
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center">
            <span className="text-white text-sm font-bold">
              {employee.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
            </span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">{employee.name}</h1>
            <p className="text-sm text-muted-foreground">{employee.employeeCode} · {employee.designation?.name ?? "—"} · {cycle.name}</p>
          </div>
        </div>
        {canGenerate && (
          <Button
            onClick={handleGenerate}
            disabled={generating}
            className="bg-primary rounded-lg hover:bg-secondary"
            size="sm"
          >
            <BarChart3 className="h-4 w-4 mr-1.5" />
            {generating ? "Generating…" : summary ? "Regenerate Summary" : "Generate Summary"}
          </Button>
        )}
      </div>

      {/* Summary card */}
      {summary && (
        <Card className="border-0 shadow-sm bg-white">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <TrendingUp className="h-4.5 w-4.5 text-primary" />
                Promotion Readiness Summary
              </CardTitle>
              <Badge variant="outline" className={`text-xs font-medium ${PROMOTION_CONFIG[summary.promotionStatus].className}`}>
                {PROMOTION_CONFIG[summary.promotionStatus].label}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 mb-4">
              {[
                { label: "Skill Readiness",    value: summary.skillReadiness,    color: "bg-indigo-100 text-indigo-700" },
                { label: "Feedback Readiness", value: summary.feedbackReadiness, color: "bg-violet-100 text-violet-700" },
                { label: "Composite Score",    value: summary.compositeScore,    color: "bg-primary text-white" },
              ].map((s) => (
                <div key={s.label} className={`rounded-xl p-3 text-center ${s.color}`}>
                  <p className="text-2xl font-extrabold">{s.value}%</p>
                  <p className="text-xs font-medium mt-0.5 opacity-80">{s.label}</p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Key Strengths</p>
                <p className="text-slate-700">{summary.keyStrengths}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Development Areas</p>
                <p className="text-slate-700">{summary.developmentAreas}</p>
              </div>
            </div>
            {summary.promotionNotes && (
              <div className="mt-3 pt-3 border-t border-slate-100">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">CDM Notes</p>
                <p className="text-sm text-slate-700">{summary.promotionNotes}</p>
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-3">
              Generated {new Date(summary.generatedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Individual feedback */}
      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">
          Feedback Submissions ({feedback.filter((f) => f.submission).length} of {feedback.length})
        </h2>
        {feedback.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-sm text-muted-foreground">
            No feedback assigned for this employee in this cycle.
          </div>
        ) : (
          feedback.map((item) => (
            <Card key={item.id} className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-sm text-slate-900">
                      {item.reviewer.name}
                      {item.project && <span className="font-normal text-muted-foreground"> · {item.project.name}</span>}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">{item.form.title}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs border-indigo-200 text-indigo-700 bg-indigo-50">
                      {FORM_TYPE_LABEL[item.form.formType]}
                    </Badge>
                    {item.submission ? (
                      <Badge className="text-xs bg-emerald-50 text-emerald-700 border-0">
                        <CheckCircle2 className="h-3 w-3 mr-0.5" /> Submitted
                      </Badge>
                    ) : (
                      <Badge className="text-xs bg-slate-100 text-slate-500 border-0">Pending</Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              {item.submission && (
                <CardContent className="pt-0">
                  <div className="space-y-3">
                    {item.submission.responses.map((r) => (
                      <div key={r.id}>
                        <p className="text-xs text-muted-foreground mb-1">{r.question.text}</p>
                        {r.ratingValue !== null ? (
                          <RatingBar value={r.ratingValue} />
                        ) : r.textValue ? (
                          <div className="flex items-start gap-1.5">
                            <MessageSquare className="h-3.5 w-3.5 text-slate-400 mt-0.5 shrink-0" />
                            <p className="text-sm text-slate-700">{r.textValue}</p>
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground italic">No response</p>
                        )}
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">
                    <Award className="h-3 w-3 inline mr-1" />
                    Submitted {new Date(item.submission.submittedAt).toLocaleDateString("en-IN")}
                  </p>
                </CardContent>
              )}
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
