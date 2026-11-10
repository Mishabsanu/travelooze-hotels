"use client";

import { FileSpreadsheet } from "lucide-react";

/** Downloads the given rows as a CSV file (opens in Excel). */
export function CsvButton({ fileName, header, rows, label = "Download CSV" }: { fileName: string; header: string[]; rows: (string | number)[][]; label?: string }) {
  const download = () => {
    const esc = (v: string | number) => {
      const s = String(v ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [header, ...rows].map((r) => r.map(esc).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <button
      type="button"
      onClick={download}
      disabled={!rows.length}
      className="inline-flex items-center gap-1.5 rounded-lg border border-brand-border bg-white px-3.5 py-2 text-xs font-bold text-brand shadow-xs hover:bg-brand-light disabled:opacity-50"
    >
      <FileSpreadsheet className="h-4 w-4" /> {label}
    </button>
  );
}
