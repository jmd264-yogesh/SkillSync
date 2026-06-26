"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Trash2, Users, Award, Search, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmployeeFormDialog } from "@/components/forms/employee-form-dialog";
import { EmployeeSkillsDialog } from "@/components/forms/employee-skills-dialog";
import { deleteEmployee } from "@/server/actions/employee";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import type { UserRole } from "@prisma/client";

interface Employee {
  id: string;
  employeeCode: string;
  name: string;
  email: string;
  coeId: string | null;
  designationId: string | null;
  managerId: string | null;
  coe: { id: string; name: string } | null;
  designation: { id: string; name: string } | null;
  manager: { id: string; name: string } | null;
  user: { id: string; email: string; role: UserRole } | null;
  _count: { employeeSkills: number; reportees: number };
}

interface EmployeesClientProps {
  employees: Employee[];
  coes: { id: string; name: string }[];
  designations: { id: string; name: string }[];
  allSkills: { id: string; name: string; category: string }[];
}

const roleColors: Record<UserRole, string> = {
  ADMIN: "bg-red-50 text-red-700 border-red-200",
  MANAGER: "bg-blue-50 text-blue-700 border-blue-200",
  EMPLOYEE: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

const PAGE_SIZE = 10;

export function EmployeesClient({ employees, coes, designations, allSkills }: EmployeesClientProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [editItem, setEditItem] = useState<Employee | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [skillsDialogOpen, setSkillsDialogOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [coeFilter, setCoeFilter] = useState("ALL");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [page, setPage] = useState(1);

  const managerOptions = employees.map((e) => ({ id: e.id, name: e.name, employeeCode: e.employeeCode }));

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    const result = await deleteEmployee(deleteId);
    setDeleting(false);
    if (result.error) { toast.error(result.error); } else { toast.success("Employee deleted"); }
    setDeleteId(null);
  }

  // Filter logic
  const filtered = employees.filter((emp) => {
    const matchSearch =
      emp.name.toLowerCase().includes(search.toLowerCase()) ||
      emp.employeeCode.toLowerCase().includes(search.toLowerCase()) ||
      emp.email.toLowerCase().includes(search.toLowerCase());
    const matchCoe = coeFilter === "ALL" || emp.coe?.id === coeFilter;
    const matchRole = roleFilter === "ALL" || emp.user?.role === roleFilter;
    return matchSearch && matchCoe && matchRole;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function handleFilterChange() {
    setPage(1);
  }

  return (
    <div>
      <PageHeader
        title="Employee Management"
        description="Add employees, assign COEs, designations, and managers"
      >
        <Button
          onClick={() => { setEditItem(null); setFormOpen(true); }}
          className="bg-primary rounded-lg h-9 px-4 text-sm font-semibold hover:bg-primary/90 cursor-pointer"
        >
          Add Employee
        </Button>
      </PageHeader>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search by name, code, email…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); handleFilterChange(); }}
            className="pl-9 h-9 rounded-lg text-sm"
          />
        </div>

        <div className="relative">
          <select
            value={coeFilter}
            onChange={(e) => { setCoeFilter(e.target.value); handleFilterChange(); }}
            className="h-9 rounded-lg border border-input bg-white pl-3 pr-8 text-sm cursor-pointer appearance-none"
          >
            <option value="ALL">All COEs</option>
            {coes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
        </div>

        <div className="relative">
          <select
            value={roleFilter}
            onChange={(e) => { setRoleFilter(e.target.value); handleFilterChange(); }}
            className="h-9 rounded-lg border border-input bg-white pl-3 pr-8 text-sm cursor-pointer appearance-none"
          >
            <option value="ALL">All Roles</option>
            <option value="ADMIN">Admin</option>
            <option value="MANAGER">Manager</option>
            <option value="EMPLOYEE">Employee</option>
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
        </div>

        <span className="text-sm text-muted-foreground ml-auto">
          {filtered.length} employee{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {employees.length === 0 ? (
        <EmptyState icon={Users} title="No employees yet" description="Add employees and map them to COEs, designations, and managers.">
          <Button onClick={() => setFormOpen(true)}>Add Employee</Button>
        </EmptyState>
      ) : (
        <>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-[90px]">Code</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Name</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-[100px]">Role</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">COE</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Designation</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Manager</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-[70px]">Skills</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-[100px]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {paginated.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-sm text-muted-foreground">
                      No employees match your filters
                    </td>
                  </tr>
                ) : (
                  paginated.map((emp) => (
                    <tr key={emp.id} className="hover:bg-slate-50/60 transition-colors group">
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs text-slate-500">{emp.employeeCode}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-semibold text-gray-900">{emp.name}</p>
                          <p className="text-xs text-muted-foreground">{emp.email}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={`${roleColors[emp.user?.role ?? "EMPLOYEE"]} text-xs font-semibold`}>
                          {emp.user?.role ?? "EMPLOYEE"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">{emp.coe?.name ?? <span className="text-muted-foreground">—</span>}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{emp.designation?.name ?? <span className="text-muted-foreground">—</span>}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{emp.manager?.name ?? <span className="text-muted-foreground">—</span>}</td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant="secondary" className="rounded-md bg-indigo-50 text-primary border-0 font-semibold text-xs">
                          {emp._count.employeeSkills}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1 transition-opacity">
                          {/* <Button
                            variant="ghost" size="icon" className="h-7 w-7 rounded-md"
                            title="Manage Skills"
                            onClick={() => { setSelectedEmployee(emp); setSkillsDialogOpen(true); }}
                          >
                            <Award className="h-3.5 w-3.5 text-primary" />
                          </Button> */}
                          <Button
                            variant="ghost" size="icon" className="h-7 w-7 rounded-md"
                            onClick={() => { setEditItem(emp); setFormOpen(true); }}
                          >
                            <Pencil className="h-3.5 w-3.5 text-primary" />
                          </Button>
                          <Button
                            variant="ghost" size="icon" className="h-7 w-7 rounded-md"
                            onClick={() => setDeleteId(emp.id)}
                          >
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

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <span className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline" size="sm" className="h-8 rounded-lg text-xs"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  const p = i + 1;
                  return (
                    <Button
                      key={p}
                      variant={page === p ? "default" : "outline"}
                      size="sm"
                      className={`h-8 w-8 rounded-lg text-xs ${page === p ? "bg-primary" : ""}`}
                      onClick={() => setPage(p)}
                    >
                      {p}
                    </Button>
                  );
                })}
                <Button
                  variant="outline" size="sm" className="h-8 rounded-lg text-xs"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      <EmployeeFormDialog
        open={formOpen}
        onOpenChange={(open) => { setFormOpen(open); if (!open) setEditItem(null); }}
        coes={coes}
        designations={designations}
        managers={managerOptions}
        employee={editItem}
      />

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={() => setDeleteId(null)}
        title="Delete Employee"
        description="This will delete the employee and their user account. Cannot be undone."
        onConfirm={handleDelete}
        loading={deleting}
      />

      <EmployeeSkillsDialog
        open={skillsDialogOpen}
        onOpenChange={setSkillsDialogOpen}
        employee={selectedEmployee}
        allSkills={allSkills}
      />
    </div>
  );
}
