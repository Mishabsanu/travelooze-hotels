"use client";

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { memo } from "react";

const PAGE_SIZES = [10, 20, 50, 100];

interface TablePaginationProps {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  itemName: string;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
}

const navBtn =
  "p-1 text-slate-400 hover:text-slate-800 disabled:opacity-30 disabled:cursor-not-allowed";

function TablePaginationComponent({ page, limit, total, totalPages, itemName, onPageChange, onLimitChange }: TablePaginationProps) {
  const start = total === 0 ? 0 : (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);

  return (
    <div className="w-full flex items-center justify-between gap-3 px-3 py-2 text-[11px] text-slate-500 select-none bg-white border-t border-line">
      <span className="font-medium text-slate-600 shrink-0">
        {total === 0 ? `0 ${itemName}` : `${start} to ${end} of ${total} ${itemName}`}
      </span>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span className="text-slate-400 shrink-0">Rows:</span>
          <select
            value={limit}
            onChange={(e) => onLimitChange(Number(e.target.value))}
            aria-label="Rows per page"
            className="h-6 rounded border border-slate-200 bg-white text-[11px] text-slate-700 font-medium px-1 focus:outline-none focus:ring-1 focus:ring-brand cursor-pointer"
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>

        <div className="w-px h-4 bg-slate-200" />

        <div className="flex items-center gap-0.5">
          <button type="button" className={navBtn} onClick={() => onPageChange(1)} disabled={page <= 1} title="First page">
            <ChevronsLeft className="w-3.5 h-3.5" />
          </button>
          <button type="button" className={navBtn} onClick={() => onPageChange(page - 1)} disabled={page <= 1} title="Previous page">
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <span className="px-2 text-slate-700 font-medium tabular-nums">
            {page} / {totalPages}
          </span>
          <button type="button" className={navBtn} onClick={() => onPageChange(page + 1)} disabled={page >= totalPages} title="Next page">
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
          <button type="button" className={navBtn} onClick={() => onPageChange(totalPages)} disabled={page >= totalPages} title="Last page">
            <ChevronsRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export const TablePagination = memo(TablePaginationComponent);
