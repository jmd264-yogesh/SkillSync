"use client";

import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

interface Column<T> {
  header: string;
  accessorKey?: keyof T;
  cell?: (row: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  emptyMessage?: string;
}

export function DataTable<T extends { id: string }>({
  columns, data, emptyMessage = "No data found.",
}: DataTableProps<T>) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-50/80 hover:bg-gray-50/80 border-b border-gray-100">
            {columns.map((col) => (
              <TableHead key={col.header} className={`text-[11px] font-bold uppercase tracking-wider text-gray-500 py-3.5 ${col.className ?? ""}`}>
                {col.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-32 text-center text-muted-foreground">
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            data.map((row, i) => (
              <TableRow key={row.id}
                className="border-b border-gray-50 hover:bg-indigo-50/30 transition-colors"
                style={{ animationDelay: `${i * 30}ms` }}
              >
                {columns.map((col) => (
                  <TableCell key={col.header} className={`py-3.5 text-sm ${col.className ?? ""}`}>
                    {col.cell ? col.cell(row) : col.accessorKey ? String(row[col.accessorKey] ?? "") : null}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
