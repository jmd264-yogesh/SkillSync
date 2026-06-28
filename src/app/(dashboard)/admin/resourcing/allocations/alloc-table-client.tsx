"use client";

import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const STATUS_STYLES = {
  OVER:  { label: "Over-allocated", class: "bg-red-50 text-red-700 border-red-200" },
  FULL:  { label: "Fully allocated", class: "bg-amber-50 text-amber-700 border-amber-200" },
  UNDER: { label: "Under-utilised",  class: "bg-blue-50 text-blue-700 border-blue-200" },
  BENCH: { label: "Bench",           class: "bg-slate-50 text-slate-600 border-slate-200" },
};

type AllocStatus = keyof typeof STATUS_STYLES;

export interface AllocationRow {
  employeeId: string;
  employeeCode: string;
  jobName: string | null;
  coe: string | null;
  activeProjectCount: number;
  actualUtil: number;
  billableUtil: number;
  status: AllocStatus;
  mismatch: boolean;
  releasableFrom: Date | null;
}

interface AllocationTableClientProps {
  rows: AllocationRow[];
}

export function AllocationTableClient({ rows }: AllocationTableClientProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | AllocStatus>("ALL");

  const counts = useMemo(
    () => ({
      OVER:  rows.filter((r) => r.status === "OVER").length,
      FULL:  rows.filter((r) => r.status === "FULL").length,
      UNDER: rows.filter((r) => r.status === "UNDER").length,
      BENCH: rows.filter((r) => r.status === "BENCH").length,
    }),
    [rows],
  );

  const filteredRows = useMemo(() => {
    const q = search.toLowerCase();
    return rows.filter((r) => {
      const matchesSearch =
        !q ||
        r.employeeCode.toLowerCase().includes(q) ||
        (r.jobName?.toLowerCase().includes(q) ?? false) ||
        (r.coe?.toLowerCase().includes(q) ?? false);
      const matchesStatus = statusFilter === "ALL" || r.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [rows, search, statusFilter]);

  return (
    <Card className="border-0 shadow-sm overflow-hidden">
      <CardHeader className="px-5 py-3 border-b">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-sm font-semibold">Live Allocation Board</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              placeholder="Search employee, role, COE…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-7 text-xs w-52"
            />
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter((v as typeof statusFilter) ?? "ALL")}
            >
              <SelectTrigger className="h-7 text-xs w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All statuses ({rows.length})</SelectItem>
                <SelectItem value="OVER">Over-allocated ({counts.OVER})</SelectItem>
                <SelectItem value="FULL">Fully allocated ({counts.FULL})</SelectItem>
                <SelectItem value="UNDER">Under-utilised ({counts.UNDER})</SelectItem>
                <SelectItem value="BENCH">Bench ({counts.BENCH})</SelectItem>
              </SelectContent>
            </Select>
            {(search || statusFilter !== "ALL") && (
              <button
                onClick={() => { setSearch(""); setStatusFilter("ALL"); }}
                className="text-xs text-muted-foreground hover:text-slate-700"
              >
                Clear
              </button>
            )}
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {filteredRows.length} of {rows.length}
            </span>
          </div>
        </div>
      </CardHeader>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-slate-50/60">
              {["Employee Code", "Role", "COE", "Projects", "Actual %", "Billable %", "Status", "⚠"].map((h) => (
                <th
                  key={h}
                  className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No employees match the current filters.
                </td>
              </tr>
            ) : (
              filteredRows.map((row) => {
                const style = STATUS_STYLES[row.status];
                return (
                  <tr key={row.employeeId} className="border-b last:border-0 hover:bg-slate-50/40">
                    <td className="px-4 py-2.5">
                      <span className="font-medium text-slate-800 text-xs font-mono">{row.employeeCode}</span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-600 text-sm">{row.jobName ?? "—"}</td>
                    <td className="px-4 py-2.5 text-slate-600 text-sm">{row.coe ?? "—"}</td>
                    <td className="px-4 py-2.5">
                      <span className="text-slate-700 text-sm">{row.activeProjectCount}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={cn("text-sm", row.actualUtil > 1 ? "text-red-600 font-semibold" : "text-slate-700")}>
                        {Math.round(row.actualUtil * 100)}%
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-700 text-sm">{Math.round(row.billableUtil * 100)}%</td>
                    <td className="px-4 py-2.5">
                      <Badge variant="outline" className={cn("text-xs", style.class)}>
                        {style.label}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5">
                      {row.mismatch && (
                        <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                          Data drift
                        </Badge>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
