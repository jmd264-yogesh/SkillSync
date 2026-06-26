"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Trash2, Layers, Plus, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { CompetencyLevelFormDialog } from "@/components/forms/competency-level-form-dialog";
import { deleteCompetencyLevel } from "@/server/actions/competency-level";
import { EmptyState } from "@/components/shared/empty-state";

interface CompetencyLevel {
  id: string;
  level: number;
  name: string;
  description: string | null;
}

const LEVEL_COLORS = [
  { bg: "bg-slate-100", text: "text-slate-700", ring: "border-slate-200", dot: "bg-slate-400" },
  { bg: "bg-blue-50", text: "text-blue-700", ring: "border-blue-200", dot: "bg-blue-400" },
  { bg: "bg-indigo-50", text: "text-indigo-700", ring: "border-indigo-200", dot: "bg-indigo-500" },
  { bg: "bg-violet-50", text: "text-violet-700", ring: "border-violet-200", dot: "bg-violet-500" },
  { bg: "bg-purple-50", text: "text-purple-700", ring: "border-purple-200", dot: "bg-purple-500" },
  { bg: "bg-fuchsia-50", text: "text-fuchsia-700", ring: "border-fuchsia-200", dot: "bg-fuchsia-500" },
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
    <div>
      {/* Horizontal waterfall */}
      {levels.length === 0 ? (
        <EmptyState icon={Layers} title="No competency levels yet" description="Define levels like Beginner, Basic, Intermediate, Advanced, Expert.">
          <Button onClick={() => openCreate()} className="gradient-brand rounded-xl">Create Level</Button>
        </EmptyState>
      ) : (
        <div>
          {/* Horizontal scroll container */}
          <div className="overflow-x-auto pb-4">
            <div className="flex items-center gap-0 min-w-max px-1">
              {/* Add before first */}
              <AddBetweenButton onClick={() => openCreate(0)} />

              {sorted.map((lvl, i) => {
                const color = getColor(i);
                return (
                  <div key={lvl.id} className="flex items-center gap-0">
                    {/* Node */}
                    <div className={`group relative w-48 rounded-xl border-2 ${color.ring} bg-white shadow-card hover:shadow-md transition-all duration-200 p-4`}>
                      {/* Level number pill */}
                      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full ${color.bg} mb-3`}>
                        <div className={`h-2 w-2 rounded-full ${color.dot}`} />
                        <span className={`text-xs font-bold ${color.text}`}>Level {lvl.level}</span>
                      </div>
                      <p className="font-bold text-gray-900 text-sm leading-tight">{lvl.name}</p>
                      {lvl.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{lvl.description}</p>
                      )}
                      {/* Actions */}
                      <div className="absolute top-2 right-2 flex gap-0.5">
                        <Button variant="ghost" size="icon" className="h-6 w-6 rounded-md" onClick={() => { setEditItem(lvl); setFormOpen(true); }}>
                          <Pencil className="h-3 w-3 text-slate-500" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6 rounded-md" onClick={() => setDeleteId(lvl.id)}>
                          <Trash2 className="h-3 w-3 text-red-400" />
                        </Button>
                      </div>
                    </div>

                    {/* Connector arrow + add between */}
                    {i < sorted.length - 1 && (
                      <div className="flex items-center gap-0">
                        <div className="w-4 h-0.5 bg-slate-200" />
                        <AddBetweenButton onClick={() => openCreate(lvl.level)} compact />
                        <div className="w-4 h-0.5 bg-slate-200" />
                        <ChevronRight className="h-4 w-4 text-slate-300 -ml-1" />
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Add after last */}
              <div className="flex items-center gap-0">
                <div className="w-4 h-0.5 bg-slate-200" />
                <AddBetweenButton onClick={() => openCreate(sorted[sorted.length - 1]?.level ?? 0)} compact />
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className="mt-4 flex items-center gap-3 flex-wrap">
            {sorted.map((lvl, i) => {
              const color = getColor(i);
              return (
                <div key={lvl.id} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${color.bg} border ${color.ring}`}>
                  <div className={`h-2 w-2 rounded-full ${color.dot}`} />
                  <span className={`text-xs font-semibold ${color.text}`}>L{lvl.level} · {lvl.name}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex justify-end mt-4">
        <Button onClick={() => openCreate()} className="bg-primary rounded-lg h-9 px-4 text-sm font-semibold hover:bg-primary/90 cursor-pointer">
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
        description="Are you sure you want to delete this competency level?"
        onConfirm={handleDelete}
        loading={deleting}
      />
    </div>
  );
}

function AddBetweenButton({ onClick, compact = false }: { onClick: () => void; compact?: boolean }) {
  if (compact) {
    return (
      <button
        onClick={onClick}
        className="group flex items-center justify-center h-6 w-6 rounded-full border border-dashed border-slate-200 text-slate-400 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all duration-150 cursor-pointer mx-0.5"
        title="Add level here"
      >
        <Plus className="h-3 w-3" />
      </button>
    );
  }
  return (
    <button
      onClick={onClick}
      className="group flex items-center gap-1.5 px-3 py-1 rounded-full border border-dashed border-slate-200 text-slate-400 text-xs font-medium hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all duration-150 cursor-pointer mx-2"
    >
      <Plus className="h-3 w-3" /> Add
    </button>
  );
}
