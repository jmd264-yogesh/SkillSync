"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Pencil, Trash2, Building2, Users, Link2, Plus, Info, Award, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { CoeFormDialog } from "@/components/forms/coe-form-dialog";
import { deleteCoe, getCoeEmployees } from "@/server/actions/coe";
import { EmptyState } from "@/components/shared/empty-state";

interface Coe {
  id: string;
  name: string;
  description: string | null;
  _count: { employees: number; coeSkills: number };
}

interface CoeEmployee {
  id: string;
  name: string;
  employeeCode: string;
  email: string;
  designation: { name: string } | null;
  _count: { employeeSkills: number };
}

export function CoeClient({ coes }: { coes: Coe[] }) {
  const [formOpen, setFormOpen] = useState(false);
  const [editCoe, setEditCoe] = useState<Coe | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [drawerCoe, setDrawerCoe] = useState<Coe | null>(null);
  const [drawerEmployees, setDrawerEmployees] = useState<CoeEmployee[]>([]);
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    const result = await deleteCoe(deleteId);
    setDeleting(false);
    if (result.error) { toast.error(result.error); } else { toast.success("COE deleted"); }
    setDeleteId(null);
  }

  function openDrawer(coe: Coe) {
    setDrawerCoe(coe);
    startTransition(async () => {
      const emps = await getCoeEmployees(coe.id);
      setDrawerEmployees(emps);
    });
  }

  const totalEmployees = coes.reduce((a, c) => a + c._count.employees, 0);
  const totalSkills = coes.reduce((a, c) => a + c._count.coeSkills, 0);
  const filtered = coes.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.description?.toLowerCase() ?? "").includes(search.toLowerCase())
  );

  return (
    <div>
      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "Total COEs", value: coes.length, icon: Building2 },
          { label: "Total Employees", value: totalEmployees, icon: Users },
          { label: "Skill Mappings", value: totalSkills, icon: Link2 },
        ].map((s) => (
          <div key={s.label} className="stat-card flex items-center gap-4">
            <div className="h-12 w-12 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
              <s.icon className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-extrabold text-gray-900">{s.value}</p>
              <p className="text-md text-muted-foreground font-medium">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search COEs…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 rounded-lg text-sm"
          />
        </div>
        <Button
          onClick={() => { setEditCoe(null); setFormOpen(true); }}
          className="bg-primary rounded-lg h-9 px-4 text-sm font-semibold hover:bg-secondary cursor-pointer"
        >
          <Plus className="h-4 w-4 mr-1.5" /> Add COE
        </Button>
      </div>

      {coes.length === 0 ? (
        <EmptyState icon={Building2} title="No COEs yet" description="Create your first Center of Excellence to start organizing.">
          <Button onClick={() => setFormOpen(true)} className="gradient-brand rounded-xl">Create COE</Button>
        </EmptyState>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60">
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">COE Name</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Description</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Employees</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Skills</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-sm text-muted-foreground">
                    No COEs match your search
                  </td>
                </tr>
              ) : (
                filtered.map((coe) => (
                  <tr key={coe.id} className="hover:bg-slate-50/60 transition-colors group">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">

                        <span className="font-semibold text-gray-900">{coe.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-slate-800 text-md line-clamp-1 max-w-xs">{coe.description || "-"}</span>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <Badge variant="secondary" className="rounded-md bg-indigo-50 text-primary border-0 font-semibold text-xs">
                        {coe._count.employees}
                      </Badge>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <Badge variant="secondary" className="rounded-md bg-slate-100 text-slate-600 border-0 font-semibold text-xs">
                        {coe._count.coeSkills}
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:cursor-pointer" title="View employees" onClick={() => openDrawer(coe)}>
                          <Info className="h-3.5 w-3.5 text-primary" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:cursor-pointer" onClick={() => { setEditCoe(coe); setFormOpen(true); }}>
                          <Pencil className="h-3.5 w-3.5 text-primary" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:cursor-pointer" onClick={() => setDeleteId(coe.id)}>
                          <Trash2 className="h-3.5 w-3.5 text-red-400" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Employee drawer */}
      <Sheet open={!!drawerCoe} onOpenChange={(open) => { if (!open) setDrawerCoe(null); }}>
        <SheetContent className="w-[420px] sm:w-[480px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-xl font-extrabold flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              {drawerCoe?.name}
            </SheetTitle>
            <SheetDescription>
              {drawerEmployees.length} employee{drawerEmployees.length !== 1 ? "s" : ""}
            </SheetDescription>
          </SheetHeader>
          <div className="">
            {isPending ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">Loading...</div>
            ) : drawerEmployees.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">No employees assigned to this COE</div>
            ) : (
              drawerEmployees.map((emp, index) => (
                <div
                  key={emp.id}
                  className={`flex items-center gap-3 p-3 mx-3 bg-gray-50/80 hover:bg-gray-100/80 transition-colors ${index !== drawerEmployees.length - 1 ? "border-b border-gray-200" : ""
                    }`}
                >                  <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center shrink-0">
                    <span className="text-white text-xs font-bold">
                      {emp.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-gray-900">{emp.name}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-mono">{emp.employeeCode}</span>
                      {emp.designation && <span>&middot; {emp.designation.name}</span>}
                    </div>
                  </div>
                  <Badge variant="secondary" className="rounded text-[10px] text-white font-semibold">
                    <Award className="h-3 w-3 mr-0.5" /> {emp._count.employeeSkills}
                  </Badge>
                </div>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>

      <CoeFormDialog open={formOpen} onOpenChange={(open) => { setFormOpen(open); if (!open) setEditCoe(null); }} coe={editCoe} />
      <ConfirmDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)} title="Delete COE" description="This will remove all skill mappings for this COE." onConfirm={handleDelete} loading={deleting} />
    </div>
  );
}
