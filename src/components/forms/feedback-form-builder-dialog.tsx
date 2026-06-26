"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Trash2, GripVertical } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { createFeedbackForm } from "@/server/actions/feedback-form";
import type { FeedbackFormType } from "@prisma/client";

const FORM_TYPE_OPTIONS: { value: FeedbackFormType; label: string }[] = [
  { value: "PM_FEEDBACK",    label: "PM Feedback (filled by Project Managers)" },
  { value: "CDM_ASSESSMENT", label: "CDM Assessment (filled by CDMs/Managers)" },
  { value: "HR_FEEDBACK",    label: "HR Feedback (filled by HR/Admin)" },
];

const DEFAULT_SECTIONS = [
  {
    title: "Technical Skills",
    description: "Assess technical competencies relevant to the role.",
    questions: [
      { text: "How would you rate the employee's technical skills for this project?", type: "RATING" as const, required: true },
      { text: "Please provide specific examples of their technical contributions.", type: "TEXT" as const, required: false },
    ],
  },
  {
    title: "Ownership & Communication",
    description: "",
    questions: [
      { text: "Rate the employee's ownership and accountability.", type: "RATING" as const, required: true },
      { text: "Rate the employee's communication and collaboration.", type: "RATING" as const, required: true },
      { text: "Any additional observations?", type: "TEXT" as const, required: false },
    ],
  },
];

interface Question { text: string; type: "RATING" | "TEXT"; required: boolean }
interface Section { title: string; description: string; questions: Question[] }
interface Cycle { id: string; name: string }
interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reviewCycleId: string;
  allowedFormTypes: FeedbackFormType[];
  cycles?: Cycle[];
}

export function FeedbackFormBuilderDialog({ open, onOpenChange, reviewCycleId, allowedFormTypes, cycles }: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [formType, setFormType] = useState<FeedbackFormType>(allowedFormTypes[0] ?? "PM_FEEDBACK");
  const [selectedCycleId, setSelectedCycleId] = useState(reviewCycleId);
  const [sections, setSections] = useState<Section[]>(
    DEFAULT_SECTIONS.map((s) => ({ ...s, questions: s.questions.map((q) => ({ ...q })) }))
  );
  const [isPending, startTransition] = useTransition();

  function addSection() {
    setSections((prev) => [...prev, { title: "", description: "", questions: [{ text: "", type: "RATING", required: true }] }]);
  }

  function removeSection(si: number) {
    setSections((prev) => prev.filter((_, i) => i !== si));
  }

  function updateSection(si: number, field: keyof Section, value: string) {
    setSections((prev) => prev.map((s, i) => i === si ? { ...s, [field]: value } : s));
  }

  function addQuestion(si: number) {
    setSections((prev) => prev.map((s, i) =>
      i === si ? { ...s, questions: [...s.questions, { text: "", type: "RATING", required: true }] } : s
    ));
  }

  function removeQuestion(si: number, qi: number) {
    setSections((prev) => prev.map((s, i) =>
      i === si ? { ...s, questions: s.questions.filter((_, j) => j !== qi) } : s
    ));
  }

  function updateQuestion(si: number, qi: number, field: keyof Question, value: string | boolean) {
    setSections((prev) => prev.map((s, i) =>
      i === si ? {
        ...s,
        questions: s.questions.map((q, j) => j === qi ? { ...q, [field]: value } : q),
      } : s
    ));
  }

  function handleClose() {
    setTitle("");
    setDescription("");
    setSections(DEFAULT_SECTIONS.map((s) => ({ ...s, questions: s.questions.map((q) => ({ ...q })) })));
    onOpenChange(false);
  }

  function handleSubmit() {
    if (!title.trim()) { toast.error("Form title is required"); return; }
    if (sections.some((s) => !s.title.trim())) { toast.error("All section titles are required"); return; }
    if (sections.some((s) => s.questions.some((q) => !q.text.trim()))) { toast.error("All question texts are required"); return; }
    if (sections.some((s) => s.questions.length === 0)) { toast.error("Each section must have at least one question"); return; }

    startTransition(async () => {
      try {
        await createFeedbackForm({
          title,
          description: description || undefined,
          formType,
          reviewCycleId: cycles ? selectedCycleId : reviewCycleId,
          sections: sections.map((s, si) => ({
            title: s.title,
            description: s.description || undefined,
            order: si,
            questions: s.questions.map((q, qi) => ({
              text: q.text,
              type: q.type,
              required: q.required,
              order: qi,
            })),
          })),
        });
        toast.success("Form created");
        handleClose();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to create form");
      }
    });
  }

  const filteredTypes = FORM_TYPE_OPTIONS.filter((o) => allowedFormTypes.includes(o.value));

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Feedback Form</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* Meta */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label className="text-sm font-medium">Form Title</Label>
              <Input
                placeholder="e.g. Q2 PM Feedback Form"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="h-9 rounded-lg text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Form Type</Label>
              <Select value={formType} onValueChange={(v) => v && setFormType(v as FeedbackFormType)}>
                <SelectTrigger className="h-9 rounded-lg text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {filteredTypes.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {cycles && cycles.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Review Cycle</Label>
                <Select value={selectedCycleId} onValueChange={(v) => v && setSelectedCycleId(v)}>
                  <SelectTrigger className="h-9 rounded-lg text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {cycles.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="col-span-2 space-y-1.5">
              <Label className="text-sm font-medium">Description (optional)</Label>
              <Textarea
                placeholder="Brief description of this form's purpose…"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="resize-none text-sm rounded-lg"
              />
            </div>
          </div>

          {/* Sections */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-800">Form Sections</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs rounded-lg"
                onClick={addSection}
              >
                <Plus className="h-3.5 w-3.5 mr-1" /> Add Section
              </Button>
            </div>

            {sections.map((section, si) => (
              <div key={si} className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-50/60 px-4 py-3 flex items-center gap-2">
                  <GripVertical className="h-4 w-4 text-slate-300 shrink-0" />
                  <Input
                    placeholder="Section title (e.g. Technical Skills)"
                    value={section.title}
                    onChange={(e) => updateSection(si, "title", e.target.value)}
                    className="h-8 rounded-lg text-sm flex-1 bg-white"
                  />
                  {sections.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 rounded-lg text-red-400 hover:text-red-500 shrink-0"
                      onClick={() => removeSection(si)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>

                <div className="px-4 py-3 space-y-2.5">
                  {section.questions.map((q, qi) => (
                    <div key={qi} className="flex items-start gap-2">
                      <div className="flex-1 space-y-1">
                        <Input
                          placeholder="Question text…"
                          value={q.text}
                          onChange={(e) => updateQuestion(si, qi, "text", e.target.value)}
                          className="h-8 rounded-lg text-sm"
                        />
                      </div>
                      <Select
                        value={q.type}
                        onValueChange={(v) => v && updateQuestion(si, qi, "type", v)}
                      >
                        <SelectTrigger className="h-8 w-28 rounded-lg text-xs shrink-0">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="RATING">Rating (1–5)</SelectItem>
                          <SelectItem value="TEXT">Text</SelectItem>
                        </SelectContent>
                      </Select>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Badge
                          variant={q.required ? "default" : "outline"}
                          className={`text-[10px] cursor-pointer select-none ${q.required ? "bg-primary text-white" : "text-slate-500"}`}
                          onClick={() => updateQuestion(si, qi, "required", !q.required)}
                        >
                          {q.required ? "Required" : "Optional"}
                        </Badge>
                        {section.questions.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 rounded-lg text-red-400 hover:text-red-500"
                            onClick={() => removeQuestion(si, qi)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-primary hover:text-primary"
                    onClick={() => addQuestion(si)}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" /> Add Question
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={handleClose} className="rounded-lg">Cancel</Button>
            <Button
              onClick={handleSubmit}
              disabled={isPending}
              className="bg-primary rounded-lg hover:bg-secondary"
            >
              {isPending ? "Creating…" : "Create Form"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
