"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Users, Pencil, Trash2, Plus, Info, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ClusterFormDialog } from "@/components/forms/cluster-form-dialog";
import { deleteCluster, getClusterEmployees } from "@/server/actions/cluster";
import { EmptyState } from "@/components/shared/empty-state";

interface Cluster {
  id: string;
  name: string;
  description: string | null;
  _count: { employees: number };
}

interface ClusterEmployee {
  id: string;
  name: string;
  employeeCode: string;
  designation: { name: string } | null;
  _count: { employeeSkills: number };
}

export function ClustersClient({ clusters }: { clusters: Cluster[] }) {
  const [formOpen, setFormOpen] = useState(false);
  const [editCluster, setEditCluster] = useState<Cluster | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [drawerCluster, setDrawerCluster] = useState<Cluster | null>(null);
  const [drawerEmployees, setDrawerEmployees] = useState<ClusterEmployee[]>([]);
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");

  const totalEmployees = clusters.reduce((a, c) => a + c._count.employees, 0);
  const filtered = clusters.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.description?.toLowerCase() ?? "").includes(search.toLowerCase())
  );

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    const result = await deleteCluster(deleteId);
    setDeleting(false);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Cluster deleted");
    }
    setDeleteId(null);
  }

  function openDrawer(cluster: Cluster) {
    setDrawerCluster(cluster);
    startTransition(async () => {
      const emps = await getClusterEmployees(cluster.id);
      setDrawerEmployees(emps);
    });
  }

  return (
    <div>
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {[
          { label: "Total Clusters", value: clusters.length, icon: Users, color: "bg-violet-50 text-violet-600" },
          { label: "Total Members", value: totalEmployees, icon: Users, color: "bg-indigo-50 text-indigo-600" },
        ].map((s) => (
          <div key={s.label} className="stat-card flex items-center gap-4">
            <div className={`h-12 w-12 rounded-lg flex items-center justify-center shrink-0 ${s.color.split(" ")[0]}`}>
              <s.icon className={`h-6 w-6 ${s.color.split(" ")[1]}`} />
            </div>
            <div>
              <p className="text-2xl font-extrabold text-gray-900">{s.value}</p>
              <p className="text-xs text-muted-foreground font-medium">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input placeholder="Search clusters..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9 rounded-lg text-sm" />
        </div>
        <Button onClick={() => { setEditCluster(null); setFormOpen(true); }} className="bg-primary rounded-lg h-9 px-4 text-sm font-semibold hover:bg-secondary cursor-pointer">
          <Plus className="h-4 w-4 mr-1.5" /> Add Cluster
        </Button>
      </div>

      {clusters.length === 0 ? (
        <EmptyState icon={Users} title="No clusters yet" description="Create clusters to group employees.">
          <Button onClick={() => setFormOpen(true)}>Create Cluster</Button>
        </EmptyState>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60">
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Cluster</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Description</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Members</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-12 text-sm text-muted-foreground">No clusters match your search</td></tr>
              ) : (
                filtered.map((cluster) => (
                  <tr key={cluster.id} className="hover:bg-slate-50/60 transition-colors group">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-lg bg-violet-100 flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-violet-700">{cluster.name.replace("Cluster-", "")}</span>
                        </div>
                        <span className="font-semibold text-gray-900">{cluster.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-slate-600 text-sm line-clamp-1 max-w-xs">{cluster.description || "-"}</span>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <Badge variant="secondary" className="rounded-md bg-indigo-50 text-indigo-700 border-0 font-semibold text-xs">
                        {cluster._count.employees}
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" title="View members" onClick={() => openDrawer(cluster)}>
                          <Info className="h-3.5 w-3.5 text-primary" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => { setEditCluster(cluster); setFormOpen(true); }}>
                          <Pencil className="h-3.5 w-3.5 text-primary" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => setDeleteId(cluster.id)}>
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

      {/* Member drawer */}
      <Sheet open={!!drawerCluster} onOpenChange={(open) => { if (!open) setDrawerCluster(null); }}>
        <SheetContent className="w-[420px] sm:w-[480px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-xl font-extrabold flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-violet-100 flex items-center justify-center">
                <span className="text-xs font-bold text-violet-700">{drawerCluster?.name.replace("Cluster-", "")}</span>
              </div>
              {drawerCluster?.name}
            </SheetTitle>
            <SheetDescription>{drawerEmployees.length} member{drawerEmployees.length !== 1 ? "s" : ""}</SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-2">
            {isPending ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">Loading...</div>
            ) : drawerEmployees.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">No employees assigned to this cluster</div>
            ) : (
              drawerEmployees.map((emp, i) => (
                <div key={emp.id} className="flex items-center gap-3 p-3 bg-gray-50/80 hover:bg-gray-100/80 rounded-xl transition-colors border border-gray-100">
                  <div className="h-9 w-9 rounded-xl bg-violet-600 flex items-center justify-center shrink-0">
                    <span className="text-white text-xs font-bold">{emp.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-gray-900 truncate">{emp.name}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-mono">{emp.employeeCode}</span>
                      {emp.designation && <span> · {emp.designation.name}</span>}
                    </div>
                  </div>
                  <Badge variant="secondary" className="rounded text-[10px] text-white font-semibold bg-violet-600 border-0">
                    {emp._count.employeeSkills} skills
                  </Badge>
                </div>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>

      <ClusterFormDialog open={formOpen} onOpenChange={(open) => { setFormOpen(open); if (!open) setEditCluster(null); }} cluster={editCluster} />
      <ConfirmDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)} title="Delete Cluster" description="This will remove the cluster. Employees assigned to it will become unassigned." onConfirm={handleDelete} loading={deleting} />
    </div>
  );
}
