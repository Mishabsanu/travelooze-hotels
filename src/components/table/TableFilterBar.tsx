"use client";

import { ChevronDown, Search, SlidersHorizontal, X } from "lucide-react";
import { memo, useEffect, useRef, useState } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import type { FilterConfig } from "./types";

interface TableFilterBarProps {
  search: string;
  onSearch: (value: string) => void;
  searchPlaceholder: string;
  filters: FilterConfig[];
  filterValues: Record<string, string>;
  onFilterChange: (key: string, value: string) => void;
  columns: { key: string; label: string }[];
  visibleKeys: Set<string>;
  onToggleColumn: (key: string) => void;
  onShowAllColumns: () => void;
  total: number;
}

function TableFilterBarComponent({
  search,
  onSearch,
  searchPlaceholder,
  filters,
  filterValues,
  onFilterChange,
  columns,
  visibleKeys,
  onToggleColumn,
  onShowAllColumns,
  total,
}: TableFilterBarProps) {
  const [term, setTerm] = useState(search);
  const debounced = useDebounce(term, 400);
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Push the debounced search to the URL (server re-renders the list)
  useEffect(() => {
    if (debounced !== search) onSearch(debounced);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setPickerOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <div className="w-full bg-white select-none">
      <div className="w-full border-b border-line bg-white flex items-stretch h-9 relative z-20">
        {filters.map((f) => (
          <div
            key={f.key}
            style={{ minWidth: f.minWidth || "140px" }}
            className="relative border-r border-line flex items-center px-3 bg-white shrink-0"
          >
            <select
              value={filterValues[f.key] || ""}
              onChange={(e) => onFilterChange(f.key, e.target.value)}
              aria-label={f.allLabel}
              className="w-full text-xs text-slate-600 bg-transparent outline-none appearance-none cursor-pointer pr-5"
            >
              <option value="">{f.allLabel}</option>
              {f.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 pointer-events-none" />
          </div>
        ))}

        <div className="relative flex-1 flex items-center px-3 bg-white min-w-[180px]">
          <Search className="w-3.5 h-3.5 text-slate-400 mr-2 shrink-0 pointer-events-none" />
          <input
            type="text"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder={searchPlaceholder}
            aria-label="Search"
            className="w-full text-xs text-slate-700 placeholder-slate-400 bg-transparent outline-none"
          />
          {term && (
            <button type="button" onClick={() => setTerm("")} aria-label="Clear search" className="text-slate-400 hover:text-slate-600 p-0.5">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div ref={pickerRef} className="relative border-l border-line flex items-center px-3 bg-white shrink-0">
          <button
            type="button"
            onClick={() => setPickerOpen((v) => !v)}
            className="text-xs text-slate-600 hover:text-slate-900 flex items-center gap-1.5 font-medium"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-brand" />
            <span>Columns ({visibleKeys.size})</span>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>
          {pickerOpen && (
            <div className="absolute right-0 top-full mt-1 w-60 bg-white border border-slate-300 rounded shadow-2xl p-2.5 z-50 space-y-2 animate-fade-in text-xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                <span className="font-bold text-slate-700 text-[11px] uppercase">Select Columns</span>
                <button type="button" onClick={onShowAllColumns} className="text-[10.5px] text-brand hover:underline font-semibold">
                  Select All
                </button>
              </div>
              <div className="max-h-60 overflow-y-auto space-y-1 py-1 no-scrollbar">
                {columns.map((col) => (
                  <label key={col.key} className="flex items-center gap-2 text-xs text-slate-700 hover:bg-slate-50 p-1 rounded cursor-pointer">
                    <input
                      type="checkbox"
                      checked={visibleKeys.has(col.key)}
                      onChange={() => onToggleColumn(col.key)}
                      className="w-3.5 h-3.5 cursor-pointer accent-brand"
                    />
                    <span className="truncate">{col.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="flex justify-end px-3 py-1.5 text-[11px] text-slate-500 bg-white">
        <span>Total: {total}</span>
      </div>
    </div>
  );
}

export const TableFilterBar = memo(TableFilterBarComponent);
