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
import { createEmployee, updateEmployee } from "@/server/actions/employee";
import type { UserRole } from "@prisma/client";

interface EmployeeFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  coes: { id: string; name: string }[];
  designations: { id: string; name: string }[];
  managers: { id: string; name: string; employeeCode: string }[];
  employee?: {
    id: string;
    employeeCode: string;
    name: string;
    email: string;
    coeId: string | null;
    designationId: string | null;
    managerId: string | null;
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
  managers,
  employee,
}: EmployeeFormDialogProps) {
  const [loading, setLoading] = useState(false);
  const isEdit = !!employee;

  async function handleSubmit(formData: FormData) {
    setLoading(true);
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
      <DialogContent className="max-w-lg!">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit Employee" : "Add Employee"}
          </DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="employeeCode">Employee Code</Label>
              <Input
                id="employeeCode"
                name="employeeCode"
                defaultValue={employee?.employeeCode ?? ""}
                placeholder="e.g. EMP001"
                required
                disabled={isEdit}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <select
                id="role"
                name="role"
                defaultValue={employee?.user?.role ?? "EMPLOYEE"}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors "
              >
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input
              id="name"
              name="name"
              defaultValue={employee?.name ?? ""}
              placeholder="e.g. Priya Sharma"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              defaultValue={employee?.email ?? ""}
              placeholder="e.g. priya@company.com"
              required
            />
          </div>

          {!isEdit && (
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                defaultValue="password123"
                placeholder="Initial password"
                required
              />
              <p className="text-xs text-muted-foreground">
                Default: password123. Employee should change on first login.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="coeId">COE</Label>
            <select
              id="coeId"
              name="coeId"
              defaultValue={employee?.coeId ?? ""}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors"
            >
              <option value="">— Select COE —</option>
              {coes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="designationId">Designation</Label>
            <select
              id="designationId"
              name="designationId"
              defaultValue={employee?.designationId ?? ""}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors "
            >
              <option value="">— Select Designation —</option>
              {designations.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="managerId">Reporting Manager</Label>
            <select
              id="managerId"
              name="managerId"
              defaultValue={employee?.managerId ?? ""}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors "
            >
              <option value="">— No Manager —</option>
              {managers
                .filter((m) => m.id !== employee?.id)
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.employeeCode})
                  </option>
                ))}
            </select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : isEdit ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
