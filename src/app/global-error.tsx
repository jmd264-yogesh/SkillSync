"use client";

import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 font-sans">
        <div className="bg-white max-w-md w-full rounded-2xl border border-slate-100 p-8 shadow-card text-center space-y-6">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-rose-50 flex items-center justify-center text-rose-600">
            <AlertCircle className="h-7 w-7" />
          </div>
          
          <div>
            <h2 className="text-lg font-extrabold text-slate-800">A global error occurred</h2>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              We encountered a critical crash in the application shell.
            </p>
          </div>

          <Button 
            onClick={() => reset()} 
            className="w-full bg-primary text-white hover:bg-secondary rounded-xl h-11 font-semibold transition-all text-xs"
          >
            Reset Shell
          </Button>
        </div>
      </body>
    </html>
  );
}
