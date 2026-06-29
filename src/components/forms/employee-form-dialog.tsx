"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronDown } from "lucide-react";
import { createEmployee, updateEmployee } from "@/server/actions/employee";
import type { UserRole } from "@prisma/client";

interface EmployeeFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  coes: { id: string; name: string }[];
  designations: { id: string; name: string }[];
  clusters: { id: string; name: string }[];
  managers: { id: string; name: string; employeeCode: string }[];
  employee?: {
    id: string;
    employeeCode: string;
    name: string;
    email: string;
    coeId: string | null;
    designationId: string | null;
    managerId: string | null;
    clusterId: string | null;
    user: { role: UserRole } | null;
  } | null;
}

const ROLES: { value: UserRole; label: string }[] = [
  { value: "EMPLOYEE", label: "Employee" },
  { value: "MANAGER", label: "Manager" },
  { value: "ADMIN", label: "Admin" },
];

export function EmployeeFormDialog({
  open,
  onOpenChange,
  coes,
  designations,
  clusters,
  managers,
  employee,
}: EmployeeFormDialogProps) {
  const [loading, setLoading] = useState(false);
  const isEdit = !!employee;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const result = isEdit
      ? await updateEmployee(employee.id, formData)
      : await createEmployee(formData);
    setLoading(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success(isEdit ? "Employee updated" : "Employee created");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-extrabold text-slate-800">
            {isEdit ? "Edit Employee" : "Add Employee"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="max-h-[60vh] overflow-y-auto pr-2 -mr-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="employeeCode" className="text-xs font-bold text-slate-500 uppercase tracking-wider">Employee Code</Label>
                <Input
                  id="employeeCode"
                  name="employeeCode"
                  defaultValue={employee?.employeeCode ?? ""}
                  placeholder="e.g. EMP001"
                  required
                  disabled={isEdit}
                  className="h-10 bg-white border-slate-200 rounded-xl focus-visible:ring-2 focus-visible:ring-primary/20 shadow-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="role" className="text-xs font-bold text-slate-500 uppercase tracking-wider">Role</Label>
                <div className="relative">
                  <select
                    id="role"
                    name="role"
                    defaultValue={employee?.user?.role ?? "EMPLOYEE"}
                    className="flex h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 font-medium transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-primary/20 outline-none appearance-none pr-8"
                  >
                    {ROLES.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-xs font-bold text-slate-500 uppercase tracking-wider">Full Name</Label>
                <Input
                  id="name"
                  name="name"
                  defaultValue={employee?.name ?? ""}
                  placeholder="e.g. Priya Sharma"
                  required
                  className="h-10 bg-white border-slate-200 rounded-xl focus-visible:ring-2 focus-visible:ring-primary/20 shadow-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-bold text-slate-500 uppercase tracking-wider">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  defaultValue={employee?.email ?? ""}
                  placeholder="e.g. priya@company.com"
                  required
                  className="h-10 bg-white border-slate-200 rounded-xl focus-visible:ring-2 focus-visible:ring-primary/20 shadow-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="coeId" className="text-xs font-bold text-slate-500 uppercase tracking-wider">COE</Label>
                <div className="relative">
                  <select
                    id="coeId"
                    name="coeId"
                    defaultValue={employee?.coeId ?? ""}
                    className="flex h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 font-medium transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-primary/20 outline-none appearance-none pr-8"
                  >
                    <option value="">- Select COE -</option>
                    {coes.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="designationId" className="text-xs font-bold text-slate-500 uppercase tracking-wider">Designation</Label>
                <div className="relative">
                  <select
                    id="designationId"
                    name="designationId"
                    defaultValue={employee?.designationId ?? ""}
                    className="flex h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 font-medium transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-primary/20 outline-none appearance-none pr-8"
                  >
                    <option value="">- Select Designation -</option>
                    {designations.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="clusterId" className="text-xs font-bold text-slate-500 uppercase tracking-wider">Cluster</Label>
                <div className="relative">
                  <select
                    id="clusterId"
                    name="clusterId"
                    defaultValue={employee?.clusterId ?? ""}
                    className="flex h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 font-medium transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-primary/20 outline-none appearance-none pr-8"
                  >
                    <option value="">- Select Cluster -</option>
                    {clusters.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="managerId" className="text-xs font-bold text-slate-500 uppercase tracking-wider">Reporting Manager</Label>
                <div className="relative">
                  <select
                    id="managerId"
                    name="managerId"
                    defaultValue={employee?.managerId ?? ""}
                    className="flex h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 font-medium transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-primary/20 outline-none appearance-none pr-8"
                  >
                    <option value="">- No Manager -</option>
                    {managers
                      .filter((m) => m.id !== employee?.id)
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.employeeCode})
                        </option>
                      ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                </div>
              </div>

              {!isEdit && (
                <div className="space-y-1.5 md:col-span-2">
                  <Label htmlFor="password" className="text-xs font-bold text-slate-500 uppercase tracking-wider">Password</Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    defaultValue="password123"
                    placeholder="Initial password"
                    required
                    className="h-10 bg-white border-slate-200 rounded-xl focus-visible:ring-2 focus-visible:ring-primary/20 shadow-xs"
                  />
                  <p className="text-[10px] text-muted-foreground font-semibold leading-relaxed">
                    Default: password123. Employee should change on first login.
                  </p>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="pt-3 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl h-10 px-4 text-sm font-semibold">
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="bg-primary text-white hover:bg-secondary rounded-xl h-10 px-5 text-sm font-semibold transition-all duration-150">
              {loading ? "Saving..." : isEdit ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
