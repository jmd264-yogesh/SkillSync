"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Plus, RefreshCw, ChevronRight, Calendar, ClipboardList,
  FileText, BarChart3, Lock, Archive, PlayCircle, Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ReviewCycleFormDialog } from "@/components/forms/review-cycle-form-dialog";
import { updateCycleStatus, deleteReviewCycle } from "@/server/actions/review-cycle";
import type { ReviewCycleStatus } from "@prisma/client";

interface Cycle {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  status: ReviewCycleStatus;
  _count: { assignments: number; summaries: number; forms: number };
}

const STATUS_CONFIG: Record<ReviewCycleStatus, { label: string; className: string }> = {
  DRAFT:    { label: "Draft",    className: "bg-slate-100 text-slate-600 border-slate-200" },
  ACTIVE:   { label: "Active",   className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  CLOSED:   { label: "Closed",   className: "bg-amber-50 text-amber-700 border-amber-200" },
  ARCHIVED: { label: "Archived", className: "bg-gray-100 text-gray-500 border-gray-200" },
};

const NEXT_STATUS: Record<ReviewCycleStatus, { status: ReviewCycleStatus; label: string; icon: typeof PlayCircle } | null> = {
  DRAFT:    { status: "ACTIVE",   label: "Open Cycle",  icon: PlayCircle },
  ACTIVE:   { status: "CLOSED",   label: "Close Cycle", icon: Lock },
  CLOSED:   { status: "ARCHIVED", label: "Archive",     icon: Archive },
  ARCHIVED: null,
};

export function CyclesClient({ cycles }: { cycles: Cycle[] }) {
  const [formOpen, setFormOpen] = useState(false);
  const [editCycle, setEditCycle] = useState<Cycle | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [search, setSearch] = useState("");
  const [, startTransition] = useTransition();

  const filtered = cycles.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  function handleStatusChange(id: string, status: ReviewCycleStatus) {
    startTransition(async () => {
      try {
        await updateCycleStatus(id, status);
        toast.success("Cycle status updated");
      } catch {
        toast.error("Failed to update status");
      }
    });
  }

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await deleteReviewCycle(deleteId);
      toast.success("Cycle deleted");
    } catch {
      toast.error("Failed to delete cycle");
    }
    setDeleting(false);
    setDeleteId(null);
  }

  const activeCycles = cycles.filter((c) => c.status === "ACTIVE").length;
  const totalAssignments = cycles.reduce((a, c) => a + c._count.assignments, 0);

  return (
    <div>
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "Total Cycles",   value: cycles.length,    icon: RefreshCw },
          { label: "Active Cycles",  value: activeCycles,     icon: PlayCircle },
          { label: "Assignments",    value: totalAssignments, icon: ClipboardList },
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

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search cycles…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 rounded-lg text-sm"
          />
        </div>
        <Button
          onClick={() => { setEditCycle(null); setFormOpen(true); }}
          className="bg-primary rounded-lg h-9 px-4 text-sm font-semibold hover:bg-secondary cursor-pointer"
        >
          <Plus className="h-4 w-4 mr-1.5" /> New Cycle
        </Button>
      </div>

      {cycles.length === 0 ? (
        <EmptyState
          icon={RefreshCw}
          title="No review cycles yet"
          description="Create your first feedback cycle to start collecting employee feedback."
        >
          <Button onClick={() => setFormOpen(true)} className="bg-primary text-white rounded-lg">
            Create Cycle
          </Button>
        </EmptyState>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60">
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Cycle</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Period</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Forms</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Assignments</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-sm text-muted-foreground">
                    No cycles match your search
                  </td>
                </tr>
              ) : (
                filtered.map((cycle) => {
                  const config = STATUS_CONFIG[cycle.status];
                  const next = NEXT_STATUS[cycle.status];
                  return (
                    <tr key={cycle.id} className="hover:bg-slate-50/60 transition-colors group">
                      <td className="px-5 py-3.5">
                        <span className="font-semibold text-gray-900">{cycle.name}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1.5 text-slate-600 text-xs">
                          <Calendar className="h-3.5 w-3.5 text-slate-400" />
                          <span>
                            {new Date(cycle.startDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                            {" – "}
                            {new Date(cycle.endDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <Badge variant="outline" className={`text-xs font-medium ${config.className}`}>
                          {config.label}
                        </Badge>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <Badge variant="secondary" className="rounded-md bg-indigo-50 text-primary border-0 font-semibold text-xs">
                          <FileText className="h-3 w-3 mr-1" />{cycle._count.forms}
                        </Badge>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <Badge variant="secondary" className="rounded-md bg-slate-100 text-slate-600 border-0 font-semibold text-xs">
                          <ClipboardList className="h-3 w-3 mr-1" />{cycle._count.assignments}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1">
                          {next && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2.5 rounded-lg text-xs font-medium hover:cursor-pointer"
                              onClick={() => handleStatusChange(cycle.id, next.status)}
                            >
                              <next.icon className="h-3.5 w-3.5 mr-1" />
                              {next.label}
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-lg hover:cursor-pointer"
                            onClick={() => { setEditCycle(cycle); setFormOpen(true); }}
                            disabled={cycle.status === "ARCHIVED"}
                          >
                            <BarChart3 className="h-3.5 w-3.5 text-primary" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-lg hover:cursor-pointer text-red-400 hover:text-red-500"
                            onClick={() => setDeleteId(cycle.id)}
                            disabled={cycle.status !== "DRAFT"}
                            title={cycle.status !== "DRAFT" ? "Only draft cycles can be deleted" : undefined}
                          >
                          </Button>
                          <Link href={`/admin/feedback/cycles/${cycle.id}`}>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:cursor-pointer">
                              <ChevronRight className="h-4 w-4 text-slate-400" />
                            </Button>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      <ReviewCycleFormDialog
        open={formOpen}
        onOpenChange={(open) => { setFormOpen(open); if (!open) setEditCycle(null); }}
        cycle={editCycle}
      />
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={() => setDeleteId(null)}
        title="Delete Review Cycle"
        description="This will permanently delete the cycle and all its forms. Only draft cycles can be deleted."
        onConfirm={handleDelete}
        loading={deleting}
      />
    </div>
  );
}
