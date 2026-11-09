"use client";

import { ArrowDown, ArrowUp, ArrowUpDown, Database } from "lucide-react";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { useListParams } from "@/hooks/useListParams";
import type { Paginated } from "@/lib/types";
import { TableFilterBar } from "./TableFilterBar";
import { TablePagination } from "./TablePagination";
import type { Column, FilterConfig } from "./types";

interface DataTableProps<T extends { _id: string }> {
  data: Paginated<T>;
  columns: Column<T>[];
  itemName: string;
  searchPlaceholder: string;
  filters?: FilterConfig[];
  rowActions?: (row: T) => ReactNode;
}

const ALIGN = { left: "text-left", center: "text-center", right: "text-right" };

/**
 * Server-paginated grid. Rows come from the server page; search, filters and paging
 * only change the URL, which makes the server render the next result set.
 */
export function DataTable<T extends { _id: string }>({
  data,
  columns,
  itemName,
  searchPlaceholder,
  filters = [],
  rowActions,
}: DataTableProps<T>) {
  const { get, update, isPending } = useListParams();
  const [visibleKeys, setVisibleKeys] = useState(
    () => new Set(columns.filter((c) => !c.hiddenByDefault).map((c) => c.key))
  );

  const activeColumns = useMemo(() => columns.filter((c) => visibleKeys.has(c.key)), [columns, visibleKeys]);
  const filterValues = useMemo(
    () => Object.fromEntries(filters.map((f) => [f.key, get(f.key)])),
    [filters, get]
  );

  const toggleColumn = useCallback((key: string) => {
    setVisibleKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key) && next.size > 1) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const showAllColumns = useCallback(() => setVisibleKeys(new Set(columns.map((c) => c.key))), [columns]);
  const onSearch = useCallback((value: string) => update({ search: value }), [update]);
  const onFilterChange = useCallback((key: string, value: string) => update({ [key]: value }), [update]);
  const onPageChange = useCallback((page: number) => update({ page: page > 1 ? page : undefined }), [update]);
  const onLimitChange = useCallback((limit: number) => update({ limit: limit === 10 ? undefined : limit }), [update]);

  // Column-header sorting: only fields the server says it can sort by are clickable
  const sort = data.sort ?? get("sort");
  const sortField = (col: Column<T>) => {
    if (col.sortKey === false) return null;
    const field = col.sortKey ?? col.key;
    return data.sortable?.includes(field) ? field : null;
  };
  const onSort = useCallback(
    (field: string) => update({ sort: sort === field ? `-${field}` : field, page: undefined }),
    [sort, update]
  );

  const colSpan = activeColumns.length + (rowActions ? 1 : 0);

  return (
    <div className="w-full bg-white border border-line text-slate-800 relative">
      <TableFilterBar
        search={get("search")}
        onSearch={onSearch}
        searchPlaceholder={searchPlaceholder}
        filters={filters}
        filterValues={filterValues}
        onFilterChange={onFilterChange}
        columns={columns}
        visibleKeys={visibleKeys}
        onToggleColumn={toggleColumn}
        onShowAllColumns={showAllColumns}
        total={data.total}
      />

      <div className={`w-full border-t border-line overflow-x-auto relative transition-opacity ${isPending ? "opacity-50" : ""}`}>
        {isPending && <div className="absolute inset-x-0 top-0 h-0.5 bg-brand animate-pulse" />}
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-line bg-head text-[11px] font-bold text-slate-600 uppercase tracking-wider">
              {activeColumns.map((col) => (
                <th
                  key={col.key}
                  style={{ width: col.width }}
                  className={`px-3 py-2 border-r border-line whitespace-nowrap ${ALIGN[col.align || "left"]}`}
                  aria-sort={(() => {
                    const field = sortField(col);
                    if (!field) return undefined;
                    return sort === field ? "ascending" : sort === `-${field}` ? "descending" : "none";
                  })()}
                >
                  {(() => {
                    const field = sortField(col);
                    if (!field) return col.label;
                    const active = sort === field || sort === `-${field}`;
                    const Icon = sort === field ? ArrowUp : sort === `-${field}` ? ArrowDown : ArrowUpDown;
                    return (
                      <button
                        type="button"
                        onClick={() => onSort(field)}
                        title={`Sort by ${col.label}`}
                        className={`inline-flex items-center gap-1 uppercase tracking-wider hover:text-brand ${active ? "text-brand" : ""}`}
                      >
                        {col.label}
                        <Icon className={`w-3 h-3 ${active ? "" : "opacity-40"}`} />
                      </button>
                    );
                  })()}
                </th>
              ))}
              {rowActions && <th className="w-28 px-3 py-2 text-center">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-line bg-white text-slate-800">
            {data.items.length === 0 ? (
              <tr>
                <td colSpan={colSpan} className="px-6 py-12 text-center text-slate-400">
                  <Database className="w-7 h-7 mx-auto mb-2 text-slate-300" />
                  <p className="text-xs font-semibold text-slate-600">No {itemName} found</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Try clearing your filters or create a new entry</p>
                </td>
              </tr>
            ) : (
              data.items.map((row) => (
                <tr key={row._id} className="hover:bg-head transition-colors">
                  {activeColumns.map((col) => {
                    const content = col.render
                      ? col.render(row)
                      : ((row as Record<string, unknown>)[col.key] as ReactNode) || "—";
                    return (
                      <td
                        key={col.key}
                        className={`px-3 py-2 align-middle border-r border-line whitespace-nowrap ${ALIGN[col.align || "left"]} ${
                          col.mono ? "font-mono font-semibold text-slate-700" : "text-slate-700"
                        }`}
                      >
                        {content}
                      </td>
                    );
                  })}
                  {rowActions && <td className="px-3 py-2 align-middle text-center whitespace-nowrap">{rowActions(row)}</td>}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <TablePagination
        page={data.page}
        limit={data.limit}
        total={data.total}
        totalPages={data.totalPages}
        itemName={itemName}
        onPageChange={onPageChange}
        onLimitChange={onLimitChange}
      />
    </div>
  );
}
