"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Settings2, Award, Users, Link2,
  Search, BarChart3, ClipboardCheck, FileText, GraduationCap,
  ArrowUpRight, FileBarChart, Target, UserCheck, LayoutGrid,
  Zap, HeartPulse, TrendingUp, CalendarRange, Bot, Briefcase, Presentation, ClipboardList, Lightbulb, Radar,
  LineChart, ChevronDown, GitCompare,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { UserRole } from "@prisma/client";
import type { LucideIcon } from "lucide-react";

interface NavItem { title: string; href: string; icon: LucideIcon }
interface AppSidebarProps { role: UserRole }

// Pinned at the top: the primary tools, in the requested order.
const adminPinnedItems: NavItem[] = [
  { title: "Dashboard",       href: "/admin/analytics",                icon: LayoutDashboard },
  { title: "Pipeline Kanban", href: "/admin/resourcing/kanban",        icon: LayoutGrid },
  { title: "Simulator",       href: "/admin/resourcing/simulator",     icon: TrendingUp },
  { title: "Extension Radar", href: "/admin/resourcing/extension",     icon: Radar },
  { title: "Forecast",        href: "/admin/resourcing/forecast",      icon: LineChart },
  { title: "RM Copilot",      href: "/admin/copilot",                  icon: Bot },
];

// Collapsed by default: admin setup pages.
const adminSetupItems: NavItem[] = [
  { title: "Configuration",       href: "/admin/config",              icon: Settings2 },
  { title: "Employee Mapping",    href: "/admin/employee-mapping",    icon: Users },
  { title: "Skill Mapping",       href: "/admin/skill-mapping",       icon: Link2 },
  { title: "Users & Permissions", href: "/admin/users",               icon: UserCheck },
  { title: "Talent Discovery",    href: "/admin/talent-discovery",    icon: Search },
  { title: "Resource Management", href: "/admin/resource-management", icon: LayoutGrid },
];

// Collapsed by default: remaining resourcing tools.
const resourcingMoreItems: NavItem[] = [
  { title: "Match Engine",       href: "/admin/resourcing/match",            icon: Zap },
  { title: "PM Questionnaire",   href: "/admin/resourcing/questionnaire",    icon: ClipboardList },
  { title: "Pipeline Inception", href: "/admin/resourcing/pipeline",         icon: Lightbulb },
  { title: "Health Radar",       href: "/admin/resourcing/health",           icon: HeartPulse },
  { title: "Scenario Planner",   href: "/admin/resourcing/scenario-planner", icon: GitCompare },
  { title: "Allocations",        href: "/admin/resourcing/allocations",      icon: LayoutGrid },
  { title: "Pipeline Outlook",   href: "/admin/resourcing/outlook",          icon: CalendarRange },
  { title: "Pitch / Judge View", href: "/pitch",                             icon: Presentation },
];

const managerNavItems: NavItem[] = [
  { title: "Team Skills",   href: "/manager/team-skills",   icon: Target },
  { title: "Approvals",     href: "/manager/approvals",     icon: ClipboardCheck },
  { title: "Team Reports",  href: "/manager/team-reports",  icon: FileText },
  { title: "Team Learning", href: "/manager/team-learning", icon: GraduationCap },
];

const employeeNavItems: NavItem[] = [
  { title: "My Skills",          href: "/employee/my-skills",       icon: Award },
  { title: "Skill Gaps",         href: "/employee/skill-gaps",      icon: BarChart3 },
  { title: "Learning Paths",     href: "/employee/learning-paths",  icon: GraduationCap },
  { title: "Transition Path",    href: "/employee/transition-path", icon: ArrowUpRight },
  { title: "My Report",          href: "/employee/my-report",       icon: FileBarChart },
  { title: "Project Experience", href: "/employee/my-experience",   icon: Briefcase },
];

function NavSection({ label, items, pathname }: { label: string; items: NavItem[]; pathname: string }) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel className="text-[10px] font-semibold uppercase tracking-widest text-secondary px-3 mb-1">
        {label}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu className="space-y-0.5 px-2">
          {items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  isActive={active}
                  tooltip={item.title}
                  className={[
                    "relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-150 w-full",
                    "group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0!",
                    active
                      ? "bg-primary! text-white! shadow-sm!"
                      : "text-slate-500 hover:bg-slate-100 hover:text-slate-800",
                  ].join(" ")}
                  render={<Link href={item.href} />}
                >
                  <item.icon className="h-[17px] w-[17px] shrink-0" />
                  <span className="group-data-[collapsible=icon]:hidden truncate">{item.title}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

function CollapsibleNavSection({
  label, items, pathname, defaultOpen = false,
}: { label: string; items: NavItem[]; pathname: string; defaultOpen?: boolean }) {
  // Open automatically if a child route is active, otherwise honour defaultOpen (collapsed).
  const hasActiveChild = items.some(
    (i) => pathname === i.href || pathname.startsWith(i.href + "/"),
  );
  const [open, setOpen] = useState(defaultOpen || hasActiveChild);

  return (
    <SidebarGroup>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-between w-full px-3 mb-1 group/collapse group-data-[collapsible=icon]:hidden"
      >
        <span className="text-[10px] font-semibold uppercase tracking-widest text-secondary">{label}</span>
        <ChevronDown className={cn("h-3.5 w-3.5 text-slate-400 transition-transform", open ? "rotate-0" : "-rotate-90")} />
      </button>
      {open && (
        <SidebarGroupContent>
          <SidebarMenu className="space-y-0.5 px-2">
            {items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    isActive={active}
                    tooltip={item.title}
                    className={[
                      "relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-150 w-full",
                      "group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0!",
                      active
                        ? "bg-primary! text-white! shadow-sm!"
                        : "text-slate-500 hover:bg-slate-100 hover:text-slate-800",
                    ].join(" ")}
                    render={<Link href={item.href} />}
                  >
                    <item.icon className="h-[17px] w-[17px] shrink-0" />
                    <span className="group-data-[collapsible=icon]:hidden truncate">{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroupContent>
      )}
    </SidebarGroup>
  );
}

export function AppSidebar({ role }: AppSidebarProps) {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon" className="border-r border-slate-100">
      <SidebarHeader className="px-4 py-4 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:py-3">
        <Link
          href="/"
          className="flex items-center gap-3 overflow-hidden group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0"
        >
          <div className="bg-primary p-2 rounded-lg shrink-0">
            <LayoutDashboard className="h-5 w-5 text-white" />
          </div>
          <div className="group-data-[collapsible=icon]:hidden overflow-hidden">
            <span className="block text-[15px] font-bold tracking-tight text-primary whitespace-nowrap">
              SkillSphere
            </span>
            <p className="text-[10px] text-slate-400 font-medium -mt-0.5">L&D Platform</p>
          </div>
        </Link>
      </SidebarHeader>

      <Separator className="mx-4 w-auto group-data-[collapsible=icon]:mx-2" />

      <SidebarContent className="pt-3">
        {role === "ADMIN" && (
          <>
            <NavSection label="Resourcing CoLab" items={adminPinnedItems} pathname={pathname} />
            <CollapsibleNavSection label="Administration" items={adminSetupItems} pathname={pathname} />
            <CollapsibleNavSection label="More Resourcing" items={resourcingMoreItems} pathname={pathname} />
          </>
        )}
        {role === "MANAGER" && (
          <NavSection label="Team Management" items={managerNavItems} pathname={pathname} />
        )}
        {role === "ADMIN" ? (
          <CollapsibleNavSection label="My Workspace" items={employeeNavItems} pathname={pathname} />
        ) : (
          <NavSection label="My Workspace" items={employeeNavItems} pathname={pathname} />
        )}
      </SidebarContent>
    </Sidebar>
  );
}
