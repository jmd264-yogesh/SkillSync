"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Trash2, Shield, Key, ShieldAlert, Info, UserPlus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/shared/data-table";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { UserFormDialog } from "@/components/forms/user-form-dialog";
import { deleteUser } from "@/server/actions/user";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import type { UserRole } from "@prisma/client";

interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  employeeId: string | null;
  createdAt: Date;
  employee: { id: string; name: string; employeeCode: string } | null;
}

interface UsersClientProps {
  users: User[];
  employees: { id: string; name: string; employeeCode: string }[];
}

const roleColors: Record<UserRole, string> = {
  ADMIN: "bg-red-50 text-red-700 border-red-200",
  MANAGER: "bg-blue-50 text-blue-700 border-blue-200",
  EMPLOYEE: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

const ROLE_GUIDE = [
  {
    role: "ADMIN",
    icon: ShieldAlert,
    color: "text-red-600",
    bg: "bg-red-50",
    dot: "bg-red-400",
    description: "Full platform control. Configures COEs, Designations, Skills, Employee metadata, mappings, and manages system accounts.",
  },
  {
    role: "MANAGER",
    icon: Key,
    color: "text-blue-600",
    bg: "bg-blue-50",
    dot: "bg-blue-400",
    description: "Approves self-assessments, conducts skill evaluations, views team competency data, and coordinates learning paths.",
  },
  {
    role: "EMPLOYEE",
    icon: Shield,
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    dot: "bg-emerald-400",
    description: "Adds and self-assesses skills, uploads certifications, follows career transition paths and learning recommendations.",
  },
] as const;

export function UsersClient({ users, employees }: UsersClientProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [editItem, setEditItem] = useState<User | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const [search, setSearch] = useState("");

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    const result = await deleteUser(deleteId);
    setDeleting(false);
    if (result.error) { toast.error(result.error); } else { toast.success("User deleted"); }
    setDeleteId(null);
  }

  const filtered = users.filter((u) =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const columns = [
    { header: "Name", accessorKey: "name" as const, className: "font-medium" },
    { header: "Email", accessorKey: "email" as const },
    {
      header: "Role",
      cell: (row: User) => (
        <Badge variant="outline" className={`${roleColors[row.role]} font-semibold text-xs`}>
          {row.role}
        </Badge>
      ),
      className: "w-[120px]",
    },
    {
      header: "Linked Employee",
      cell: (row: User) =>
        row.employee ? (
          <span className="text-sm">
            {row.employee.name}{" "}
            <span className="text-xs text-muted-foreground font-mono">({row.employee.employeeCode})</span>
          </span>
        ) : (
          <span className="text-muted-foreground italic text-xs">Unlinked</span>
        ),
    },
    {
      header: "Created",
      cell: (row: User) => new Date(row.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }),
      className: "w-[140px] text-muted-foreground text-sm",
    },
    {
      header: "Actions",
      className: "w-[90px]",
      cell: (row: User) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md"
            onClick={() => { setEditItem(row); setFormOpen(true); }}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md"
            onClick={() => setDeleteId(row.id)}>
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Users & Permissions"
        description="Manage system user accounts and role assignments"
      >
        <div className="flex items-center gap-2">
          {/* Info icon tooltip */}
          <div className="relative">
            <button
              onMouseEnter={() => setTooltipOpen(true)}
              onMouseLeave={() => setTooltipOpen(false)}
              className="flex items-center gap-1.5 px-2.5 py-2 rounded-md  text-slate-500 hover:text-primary hover:cursor-pointer transition-all"
            >
              <Info className="h-4 w-4" />
              <span className="text-xs font-medium">Role Guide</span>
            </button>

            {tooltipOpen && (
              <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl border border-slate-200 shadow-lg z-50 p-4 space-y-3 animate-scale-in">
                <p className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Role Permissions Guide</p>
                {ROLE_GUIDE.map((r) => (
                  <div key={r.role} className={`flex gap-3 p-2.5 rounded-lg ${r.bg}`}>
                    <r.icon className={`h-4 w-4 mt-0.5 shrink-0 ${r.color}`} />
                    <div>
                      <p className={`text-xs font-bold ${r.color}`}>{r.role}</p>
                      <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{r.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Button
            onClick={() => { setEditItem(null); setFormOpen(true); }}
            className="bg-primary rounded-sm h-9 px-4 text-sm font-semibold hover:bg-secondary cursor-pointer"
          >
            <UserPlus className="h-4 w-4 mr-1.5" /> Add User
          </Button>
        </div>
      </PageHeader>

      {/* Search bar */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 rounded-lg text-sm"
          />
        </div>
        <span className="text-sm text-muted-foreground">{filtered.length} of {users.length} users</span>
      </div>

      {users.length === 0 ? (
        <EmptyState icon={Shield} title="No users found" description="Create a user account to grant access to the platform.">
          <Button onClick={() => setFormOpen(true)}>Add User Account</Button>
        </EmptyState>
      ) : (
        <DataTable columns={columns} data={filtered} />
      )}

      <UserFormDialog
        open={formOpen}
        onOpenChange={(open) => { setFormOpen(open); if (!open) setEditItem(null); }}
        employees={employees}
        user={editItem}
      />

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={() => setDeleteId(null)}
        title="Delete User Account"
        description="This user will lose access immediately. Cannot be undone."
        onConfirm={handleDelete}
        loading={deleting}
      />
    </div>
  );
}
