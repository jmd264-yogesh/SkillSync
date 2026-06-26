"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Pencil, Trash2, Briefcase, Plus, Info, Award, Users, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { DesignationFormDialog } from "@/components/forms/designation-form-dialog";
import { deleteDesignation, getDesignationEmployees } from "@/server/actions/designation";
import { EmptyState } from "@/components/shared/empty-state";

interface Designation {
  id: string;
  name: string;
  level: number;
  description: string | null;
  _count: { employees: number; designationSkills: number };
}

interface DesignationEmployee {
  id: string;
  name: string;
  employeeCode: string;
  email: string;
  coe: { name: string } | null;
  _count: { employeeSkills: number };
}

export function DesignationsClient({ designations }: { designations: Designation[] }) {
  const [formOpen, setFormOpen] = useState(false);
  const [editItem, setEditItem] = useState<Designation | null>(null);
  const [insertAfterLevel, setInsertAfterLevel] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [drawerDesig, setDrawerDesig] = useState<Designation | null>(null);
  const [drawerEmployees, setDrawerEmployees] = useState<DesignationEmployee[]>([]);
  const [isPending, startTransition] = useTransition();

  const sorted = [...designations].sort((a, b) => a.level - b.level);

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    const result = await deleteDesignation(deleteId);
    setDeleting(false);
    if (result.error) { toast.error(result.error); } else { toast.success("Designation deleted"); }
    setDeleteId(null);
  }

  function openDrawer(d: Designation) {
    setDrawerDesig(d);
    startTransition(async () => {
      const emps = await getDesignationEmployees(d.id);
      setDrawerEmployees(emps);
    });
  }

  function openCreate(afterLevel?: number) {
    setEditItem(null);
    setInsertAfterLevel(afterLevel ?? null);
    setFormOpen(true);
  }

  const totalEmployees = designations.reduce((a, d) => a + d._count.employees, 0);
  const totalSkills = designations.reduce((a, d) => a + d._count.designationSkills, 0);

  return (
    <div>
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "Designations", value: designations.length, icon: Briefcase },
          { label: "Total Employees", value: totalEmployees, icon: Users },
          { label: "Skill Mappings", value: totalSkills, icon: Award },
        ].map((s) => (
          <div key={s.label} className="stat-card flex items-center gap-4">
            <div className="h-10 w-10 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
              <s.icon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-extrabold text-gray-900">{s.value}</p>
              <p className="text-xs text-muted-foreground font-medium">{s.label}</p>
            </div>
          </div>
        ))}
      </div>
      {/* Floating top-right Add button */}
      <div className="flex justify-end mt-6">
        <Button onClick={() => openCreate()} className="bg-primary rounded-lg h-9 px-4 text-sm font-semibold hover:bg-secondary cursor-pointer"
        >
          <Plus className="h-4 w-4 mr-1.5" /> Add Designation
        </Button>
      </div>
      {designations.length === 0 ? (
        <EmptyState icon={Briefcase} title="No designations yet" description="Define designations to set skill expectations for each role.">
          <Button onClick={() => openCreate()} className="gradient-brand rounded-xl">Create Designation</Button>
        </EmptyState>
      ) : (
        <div className="flex flex-col items-center gap-0 max-w-2xl mx-auto">
          {/* Add at top */}
          <AddBetweenButton onClick={() => openCreate(0)} />

          {sorted.map((d, i) => (
            <div key={d.id} className="w-full flex flex-col items-center gap-0">
              {/* Designation node */}
              <div className="group w-full bg-white rounded-xl border border-slate-200 shadow-card p-5 hover:border-indigo-200 transition-all duration-200">
                <div className="flex items-center gap-4">
                  {/* Level badge */}
                  <div className="h-14 w-14 rounded-xl bg-primary flex flex-col items-center justify-center shrink-0 shadow-sm">
                    <span className="text-white text-[10px] font-semibold uppercase tracking-wider leading-none">Level</span>
                    <span className="text-white text-2xl font-extrabold leading-none">{d.level}</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-secondary text-base">{d.name}</h3>
                    {d.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{d.description}</p>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="secondary" className="rounded-md bg-indigo-50 text-primary border-0 text-xs font-semibold">
                        <Users className="h-3 w-3 mr-1" />{d._count.employees}
                      </Badge>
                      <Badge variant="secondary" className="rounded-md bg-slate-100 text-slate-600 border-0 text-xs font-semibold">
                        <Award className="h-3 w-3 mr-1" />{d._count.designationSkills} skills
                      </Badge>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 ">
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" title="View employees" onClick={() => openDrawer(d)}>
                      <Info className="h-3.5 w-3.5 text-primary" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => { setEditItem(d); setFormOpen(true); }}>
                      <Pencil className="h-3.5 w-3.5 text-slate-500" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => setDeleteId(d.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-red-400" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Connector + Add between */}
              {i < sorted.length - 1 && (
                <div className="flex flex-col items-center gap-0 w-full">
                  <div className="w-0.5 h-4 bg-slate-200" />
                  <AddBetweenButton onClick={() => openCreate(d.level)} />
                  <div className="w-0.5 h-4 bg-slate-200" />
                </div>
              )}
            </div>
          ))}

          {/* Arrow tail at bottom */}
          <div className="w-0.5 h-4 bg-slate-200 mt-0" />
          <AddBetweenButton onClick={() => openCreate(sorted[sorted.length - 1]?.level ?? 0)} />
        </div>
      )}



      {/* Employee drawer */}
      <Sheet open={!!drawerDesig} onOpenChange={(open) => { if (!open) setDrawerDesig(null); }}>
        <SheetContent className="w-[420px] sm:w-[480px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-xl font-extrabold flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-primary" />
              {drawerDesig?.name}
            </SheetTitle>
            <SheetDescription>
              {drawerEmployees.length} employee{drawerEmployees.length !== 1 ? "s" : ""} with this designation
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-3">
            {isPending ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">Loading...</div>
            ) : drawerEmployees.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">No employees with this designation</div>
            ) : (
              drawerEmployees.map((emp) => (
                <div key={emp.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50/80 hover:bg-gray-100/80 transition-colors">
                  <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center shrink-0">
                    <span className="text-white text-xs font-bold">
                      {emp.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-gray-900">{emp.name}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-mono">{emp.employeeCode}</span>
                      {emp.coe && <span>&middot; <Building2 className="h-3 w-3 inline" /> {emp.coe.name}</span>}
                    </div>
                  </div>
                  <Badge variant="secondary" className="rounded-lg text-[10px] font-semibold">
                    <Award className="h-3 w-3 mr-0.5" /> {emp._count.employeeSkills}
                  </Badge>
                </div>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>

      <DesignationFormDialog
        open={formOpen}
        onOpenChange={(open) => { setFormOpen(open); if (!open) { setEditItem(null); setInsertAfterLevel(null); } }}
        designation={editItem}
        suggestedLevel={insertAfterLevel !== null ? insertAfterLevel + 1 : undefined}
      />
      <ConfirmDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)} title="Delete Designation" description="This will remove all skill mappings for this designation." onConfirm={handleDelete} loading={deleting} />
    </div>
  );
}

function AddBetweenButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group flex items-center mb-2 gap-1.5 px-3 py-1 rounded-full border border-dashed border-slate-300 text-slate-500 text-xs font-medium hover:border-primary hover:text-primary hover:bg-indigo-50 transition-all duration-150 cursor-pointer"
    >
      <Plus className="h-3 w-3" /> Add here
    </button>
  );
}
