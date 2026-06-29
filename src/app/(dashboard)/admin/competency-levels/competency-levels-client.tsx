"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Trash2, Layers, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { CompetencyLevelFormDialog } from "@/components/forms/competency-level-form-dialog";
import { deleteCompetencyLevel } from "@/server/actions/competency-level";
import { EmptyState } from "@/components/shared/empty-state";
import { cn } from "@/lib/utils";

interface CompetencyLevel {
  id: string;
  level: number;
  name: string;
  description: string | null;
}

const LEVEL_COLORS = [
  { bg: "bg-slate-100 text-slate-700", ring: "border-slate-200/80", dot: "bg-slate-400" },
  { bg: "bg-blue-50 text-blue-700", ring: "border-blue-100", dot: "bg-blue-500" },
  { bg: "bg-indigo-50 text-indigo-700", ring: "border-indigo-100", dot: "bg-indigo-500" },
  { bg: "bg-violet-50 text-violet-700", ring: "border-violet-100", dot: "bg-violet-500" },
  { bg: "bg-purple-50 text-purple-700", ring: "border-purple-100", dot: "bg-purple-500" },
  { bg: "bg-fuchsia-50 text-fuchsia-700", ring: "border-fuchsia-100", dot: "bg-fuchsia-500" },
] as const;

function getColor(index: number) {
  return LEVEL_COLORS[index % LEVEL_COLORS.length] ?? LEVEL_COLORS[0];
}

export function CompetencyLevelsClient({ levels }: { levels: CompetencyLevel[] }) {
  const [formOpen, setFormOpen] = useState(false);
  const [editItem, setEditItem] = useState<CompetencyLevel | null>(null);
  const [insertAfterLevel, setInsertAfterLevel] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const sorted = [...levels].sort((a, b) => a.level - b.level);

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    const result = await deleteCompetencyLevel(deleteId);
    setDeleting(false);
    if ("error" in result && typeof result.error === "string") {
      toast.error(result.error);
    } else {
      toast.success("Level deleted");
    }
    setDeleteId(null);
  }

  function openCreate(afterLevel?: number) {
    setEditItem(null);
    setInsertAfterLevel(afterLevel ?? null);
    setFormOpen(true);
  }

  return (
    <div className="max-w-xl mx-auto py-4">
      {levels.length === 0 ? (
        <EmptyState icon={Layers} title="No competency levels yet" description="Define levels like Beginner, Basic, Intermediate, Advanced, Expert.">
          <Button onClick={() => openCreate()} className="gradient-brand rounded-xl">Create Level</Button>
        </EmptyState>
      ) : (
        <div className="space-y-6">
          <div className="relative border-l-2 border-slate-200/70 ml-6 pl-0">
            {/* Add before first level */}
            <div className="absolute -left-[13px] -top-8 z-10">
              <AddBetweenButton onClick={() => openCreate(0)} />
            </div>

            {sorted.map((lvl, i) => {
              const color = getColor(i);
              return (
                <div key={lvl.id} className="relative pl-8 pb-10 last:pb-4">
                  {/* Timeline bullet indicator */}
                  <div className={cn("absolute -left-[9px] top-3 h-4 w-4 rounded-full border-4 border-white shadow-sm", color.dot)} />

                  {/* Level card widget */}
                  <div className={cn("group relative rounded-2xl border bg-white p-5 transition-all duration-200 hover:shadow-card hover:-translate-y-0.5", color.ring)}>
                    <div className="flex items-center justify-between mb-3">
                      <div className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold", color.bg)}>
                        <div className={cn("h-1.5 w-1.5 rounded-full", color.dot)} />
                        Level {lvl.level}
                      </div>

                      {/* Card actions */}
                      <div className="flex gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity duration-150">
                        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-slate-100" onClick={() => { setEditItem(lvl); setFormOpen(true); }}>
                          <Pencil className="h-3.5 w-3.5 text-slate-500" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-red-50" onClick={() => setDeleteId(lvl.id)}>
                          <Trash2 className="h-3.5 w-3.5 text-red-500" />
                        </Button>
                      </div>
                    </div>

                    <h4 className="font-extrabold text-slate-800 text-sm leading-snug">{lvl.name}</h4>
                    {lvl.description && (
                      <p className="text-xs text-slate-500 mt-2 leading-relaxed">{lvl.description}</p>
                    )}
                  </div>

                  {/* Add level after this node (centered on connector track) */}
                  <div className="absolute -left-[13px] bottom-[-13px] z-10">
                    <AddBetweenButton onClick={() => openCreate(lvl.level)} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick reference legend badge list */}
          <div className="border-t border-slate-200/50 pt-5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-3">Legend & Level Sequence</span>
            <div className="flex items-center gap-2 flex-wrap">
              {sorted.map((lvl, i) => {
                const color = getColor(i);
                return (
                  <div key={lvl.id} className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold", color.bg, color.ring)}>
                    <div className={cn("h-1.5 w-1.5 rounded-full", color.dot)} />
                    L{lvl.level}: {lvl.name}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Global add level trigger */}
      <div className="flex justify-end mt-6">
        <Button onClick={() => openCreate()} className="bg-primary rounded-xl h-10 px-4 text-sm font-semibold hover:bg-secondary transition-all duration-150 cursor-pointer">
          <Plus className="h-4 w-4 mr-1.5" /> Add Level
        </Button>
      </div>

      <CompetencyLevelFormDialog
        open={formOpen}
        onOpenChange={(open) => { setFormOpen(open); if (!open) { setEditItem(null); setInsertAfterLevel(null); } }}
        level={editItem}
        suggestedLevel={insertAfterLevel !== null ? insertAfterLevel + 1 : undefined}
      />

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={() => setDeleteId(null)}
        title="Delete Competency Level"
        description="Are you sure you want to delete this competency level? This may impact mapped requirements."
        onConfirm={handleDelete}
        loading={deleting}
      />
    </div>
  );
}

function AddBetweenButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center justify-center h-6 w-6 rounded-full border border-dashed border-slate-300 bg-white text-slate-400 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 shadow-xs transition-all duration-150 cursor-pointer"
      title="Add level here"
    >
      <Plus className="h-3.5 w-3.5" />
    </button>
  );
}

