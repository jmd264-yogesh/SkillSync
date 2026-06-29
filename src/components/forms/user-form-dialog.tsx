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
import { createUser, updateUser } from "@/server/actions/user";
import type { UserRole } from "@prisma/client";

interface UserFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employees: { id: string; name: string; employeeCode: string }[];
  user?: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    employeeId: string | null;
  } | null;
}

const ROLES: { value: UserRole; label: string }[] = [
  { value: "EMPLOYEE", label: "Employee" },
  { value: "MANAGER", label: "Manager" },
  { value: "ADMIN", label: "Admin" },
];

export function UserFormDialog({
  open,
  onOpenChange,
  employees,
  user,
}: UserFormDialogProps) {
  const [loading, setLoading] = useState(false);
  const isEdit = !!user;

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    const result = isEdit
      ? await updateUser(user.id, formData)
      : await createUser(formData);
    setLoading(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success(isEdit ? "User updated successfully" : "User created successfully");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit User Account" : "Add User Account"}</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input
              id="name"
              name="name"
              defaultValue={user?.name ?? ""}
              placeholder="e.g. Rahul Sharma"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              name="email"
              type="email"
              defaultValue={user?.email ?? ""}
              placeholder="e.g. rahul.sharma@company.com"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="role">User Role</Label>
              <select
                id="role"
                name="role"
                defaultValue={user?.role ?? "EMPLOYEE"}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="employeeId">Link to Employee</Label>
              <select
                id="employeeId"
                name="employeeId"
                defaultValue={user?.employeeId ?? ""}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">- No Employee Link -</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.employeeCode})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder={isEdit ? "Leave blank to keep current password" : "Enter password"}
              required={!isEdit}
              minLength={8}
            />
            {isEdit && (
              <p className="text-[10px] text-muted-foreground mt-1">Leave blank if you don&apos;t want to change</p>
            )}
          </div>

          <DialogFooter className="pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : isEdit ? "Update User" : "Create User"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
