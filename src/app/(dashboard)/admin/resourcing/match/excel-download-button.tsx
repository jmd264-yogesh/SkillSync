"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { downloadResourceExcel } from "@/server/actions/export-resource-excel";
import { FileSpreadsheet, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function ExcelDownloadButton() {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const { data, filename } = await downloadResourceExcel();
      // Decode base64 → Uint8Array → Blob → download
      const bytes = atob(data);
      const arr = new Uint8Array(bytes.length);
      for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
      const blob = new Blob([arr], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Resource Excel downloaded");
    } catch (err) {
      toast.error(`Export failed: ${String(err)}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={loading}
      className="gap-1.5"
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <FileSpreadsheet className="h-4 w-4" />
      )}
      {loading ? "Building Excel…" : "Download Updated Resource Excel"}
    </Button>
  );
}
