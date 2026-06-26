"use client";

import { LogOut, User, ChevronDown } from "lucide-react";
import { signOut } from "next-auth/react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import type { UserRole } from "@prisma/client";

interface DashboardHeaderProps { userName: string; userRole: UserRole }

const roleConfig: Record<UserRole, { label: string; color: string }> = {
  ADMIN: { label: "Admin", color: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  MANAGER: { label: "Manager", color: "bg-slate-100 text-slate-700 border-slate-200" },
  EMPLOYEE: { label: "Employee", color: "bg-slate-100 text-slate-600 border-slate-200" },
};

function getInitials(name: string): string {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

export function DashboardHeader({ userName, userRole }: DashboardHeaderProps) {
  const role = roleConfig[userRole];

  return (
    <header className="sticky top-0 z-50 flex h-14 items-center gap-4 bg-white border-b border-slate-200 px-6">
      <SidebarTrigger className="text-slate-400 hover:text-slate-700" />

      <div className="flex-1" />

      <Badge variant="outline" className={`${role.color} font-medium text-xs px-2.5 py-0.5 rounded-md`}>
        {role.label}
      </Badge>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-slate-50 transition-colors">
              <Avatar className="h-7 w-7">
                <AvatarFallback className="bg-indigo-600 text-white text-xs font-semibold">
                  {getInitials(userName)}
                </AvatarFallback>
              </Avatar>
              <div className="hidden md:block text-left">
                <p className="text-sm font-semibold text-slate-800 leading-none">{userName}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{role.label}</p>
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-slate-400 hidden md:block" />
            </button>
          }
        />
        <DropdownMenuContent align="end" className="w-56 rounded-xl shadow-lg">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-semibold">{userName}</p>
                <p className="text-xs text-muted-foreground">{userRole}</p>
              </div>
            </DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem className="rounded-lg">
              <User className="mr-2 h-4 w-4" /> Profile
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem className="rounded-lg text-red-600" onClick={() => signOut({ callbackUrl: "/login" })}>
              <LogOut className="mr-2 h-4 w-4" /> Log out
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
