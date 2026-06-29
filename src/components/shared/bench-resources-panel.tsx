"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Users, ChevronDown, ChevronUp, Briefcase, TrendingDown, AlertCircle } from "lucide-react";
import type { EmployeeAvailability } from "@/server/services/availability.service";

interface BenchResourcesPanelProps {
  employees: EmployeeAvailability[];
  isLoading?: boolean;
}

function utilizationBadge(status: EmployeeAvailability["status"], actualUtil: number) {
  const pct = Math.round(actualUtil * 100);
  if (status === "BENCH") {
    return (
      <Badge variant="outline" className="text-red-700 bg-red-50 border-red-200 text-[10px]">
        Bench (0%)
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-amber-700 bg-amber-50 border-amber-200 text-[10px]">
      {pct}% utilized
    </Badge>
  );
}

function freeCapacityChip(actualUtil: number) {
  const free = Math.round((1 - actualUtil) * 100);
  return (
    <span className="text-xs font-semibold text-green-700 bg-green-50 border border-green-200 rounded px-1.5 py-0.5">
      {free}% free
    </span>
  );
}

function EmployeeRow({ emp }: { emp: EmployeeAvailability }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 border-b border-slate-100 last:border-0">
      <div className="flex items-center gap-2 min-w-0">
        <div className="h-7 w-7 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
          <span className="text-[10px] font-bold text-slate-500">
            {emp.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
          </span>
        </div>
        <div className="min-w-0">
          <div className="text-sm font-medium text-slate-800 truncate">
            [{emp.employeeCode}] {emp.name}
          </div>
          {emp.jobName && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Briefcase className="h-3 w-3" />
              {emp.jobName}
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {freeCapacityChip(emp.actualUtil)}
        {utilizationBadge(emp.status, emp.actualUtil)}
      </div>
    </div>
  );
}

export function BenchResourcesPanel({ employees, isLoading }: BenchResourcesPanelProps) {
  const [collapsed, setCollapsed] = useState(false);

  const bench = employees.filter((e) => e.status === "BENCH");
  const under = employees.filter((e) => e.status === "UNDER");

  if (isLoading) {
    return (
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (employees.length === 0) {
    return (
      <Card className="border-0 shadow-sm bg-green-50 border-green-100">
        <CardContent className="p-4 flex items-center gap-3">
          <TrendingDown className="h-5 w-5 text-green-600 shrink-0" />
          <div>
            <p className="text-sm font-medium text-green-800">Full utilization</p>
            <p className="text-xs text-green-600">All resources are at or above 85% utilization.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-sm border-amber-100">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-amber-600" />
            <CardTitle className="text-base font-semibold text-slate-800">
              Bench &amp; Under-Utilized
            </CardTitle>
            <Badge variant="outline" className="text-amber-700 bg-amber-50 border-amber-200 text-xs">
              {employees.length} resource{employees.length !== 1 ? "s" : ""}
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCollapsed((c) => !c)}
            className="h-7 w-7 p-0"
          >
            {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </Button>
        </div>
        {!collapsed && (
          <p className="text-xs text-muted-foreground mt-0.5">
            Employees with spare capacity. Allocate before initiating external hiring.
          </p>
        )}
      </CardHeader>

      {!collapsed && (
        <CardContent className="pt-0">
          {bench.length > 0 && (
            <div className="mb-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <AlertCircle className="h-3.5 w-3.5 text-red-500" />
                <span className="text-xs font-semibold text-red-700 uppercase tracking-wide">
                  On Bench ({bench.length})
                </span>
              </div>
              <div className={cn("rounded-lg border border-red-100 bg-red-50/30 px-3")}>
                {bench.map((emp) => (
                  <EmployeeRow key={emp.employeeId} emp={emp} />
                ))}
              </div>
            </div>
          )}

          {under.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <TrendingDown className="h-3.5 w-3.5 text-amber-500" />
                <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">
                  Under-Utilized ({under.length})
                </span>
              </div>
              <div className={cn("rounded-lg border border-amber-100 bg-amber-50/30 px-3")}>
                {under.map((emp) => (
                  <EmployeeRow key={emp.employeeId} emp={emp} />
                ))}
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
