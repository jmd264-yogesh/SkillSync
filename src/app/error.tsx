"use client";

import { useEffect } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-6">
      <div className="bg-white max-w-md w-full rounded-2xl border border-slate-100 p-8 shadow-card text-center space-y-6">
        <div className="mx-auto h-14 w-14 rounded-2xl bg-rose-50 flex items-center justify-center text-rose-600">
          <AlertCircle className="h-7 w-7" />
        </div>
        
        <div>
          <h2 className="text-lg font-extrabold text-slate-800">Something went wrong</h2>
          <p className="text-xs text-slate-500 mt-2 leading-relaxed">
            An unexpected error occurred while loading this page. Our team has been notified.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button 
            onClick={() => window.location.reload()} 
            variant="outline" 
            className="flex-1 rounded-xl h-10 font-semibold text-slate-600 border-slate-200 text-xs"
          >
            Reload Page
          </Button>
          <Button 
            onClick={() => reset()} 
            className="flex-1 bg-primary text-white hover:bg-secondary rounded-xl h-10 font-semibold transition-all text-xs"
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Try Again
          </Button>
        </div>
      </div>
    </div>
  );
}
