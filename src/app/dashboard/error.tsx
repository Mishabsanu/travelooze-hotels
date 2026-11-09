"use client";

import { AlertTriangle } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/Button";

export default function DashboardError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-12 text-center shadow-xs">
      <div className="w-12 h-12 mx-auto rounded-xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mb-3">
        <AlertTriangle className="w-6 h-6" />
      </div>
      <h2 className="text-sm font-bold text-slate-900">This page could not be loaded</h2>
      <p className="text-xs text-slate-500 mt-1">Check that the database is running, then try again.</p>
      <Button className="mt-4" onClick={() => retry()}>
        Try again
      </Button>
    </div>
  );
}
