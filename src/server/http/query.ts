import "server-only";
import type { Schema } from "mongoose";

export const PAGE_SIZES = [10, 20, 50, 100];

export interface ListQuery {
  page: number;
  limit: number;
  search: string;
  status: string;
  sort: string;
  /** Set by listSort(): fields the list may be sorted by */
  sortable?: string[];
  /** Extra module-specific filters, e.g. { role: "...", stockStatus: "LOW_STOCK" } */
  filters: Record<string, string>;
}

type RawParams = URLSearchParams | Record<string, string | string[] | undefined>;

function read(params: RawParams, key: string): string {
  if (params instanceof URLSearchParams) return params.get(key) ?? "";
  const v = params[key];
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

/** Same parsing for API routes (URLSearchParams) and server pages (searchParams object). */
export function parseListQuery(params: RawParams, filterKeys: string[] = []): ListQuery {
  const page = Math.max(1, Number.parseInt(read(params, "page"), 10) || 1);
  const rawLimit = Number.parseInt(read(params, "limit"), 10);
  const limit = PAGE_SIZES.includes(rawLimit) ? rawLimit : 10;
  const filters: Record<string, string> = {};
  for (const key of filterKeys) {
    const value = read(params, key).trim();
    if (value) filters[key] = value;
  }
  return {
    page,
    limit,
    search: read(params, "search").trim().slice(0, 100),
    status: read(params, "status").trim(),
    sort: read(params, "sort").trim(),
    filters,
  };
}

/** Escapes user input before it is used inside a RegExp. */
export const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Loosely typed Mongo filter built from user input (values are validated before use). */
export type Filter = Record<string, unknown>;

export function searchFilter(search: string, fields: string[]): Filter {
  if (!search) return {};
  const regex = new RegExp(escapeRegex(search), "i");
  return { $or: fields.map((f) => ({ [f]: regex })) };
}

export function paginate<T>(items: T[], total: number, query: Pick<ListQuery, "page" | "limit"> & Partial<Pick<ListQuery, "sort" | "sortable">>) {
  return {
    items,
    page: query.page,
    limit: query.limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / query.limit)),
    ...(query.sortable ? { sortable: query.sortable, sort: query.sort ?? "" } : {}),
  };
}

const SORTABLE_TYPES = new Set(["String", "Number", "Date", "Boolean"]);
const HIDDEN_FIELDS = new Set(["password", "passwordHash", "resetToken"]);
const sortableCache = new WeakMap<object, string[]>();

/** Plain stored fields of a model (text, number, date, yes / no, nested ones included) that a list may sort by. */
export function sortableFields(model: { schema: Schema }): string[] {
  const cached = sortableCache.get(model.schema);
  if (cached) return cached;
  const fields: string[] = [];
  model.schema.eachPath((path, type) => {
    const t = type as { instance?: string; options?: { select?: boolean } };
    // Hidden fields (select: false, passwords) are never offered
    if (path.startsWith("_") || HIDDEN_FIELDS.has(path) || t.options?.select === false) return;
    if (SORTABLE_TYPES.has(t.instance ?? "")) fields.push(path);
  });
  sortableCache.set(model.schema, fields);
  return fields;
}

type SortSpec = Record<string, 1 | -1>;

/**
 * Column-header sorting for every list: ?sort=field (ascending) or ?sort=-field (descending), accepted only for
 * the model's plain stored fields; anything else keeps the list's own `fallback` order. Also records the
 * sortable fields on the query so paginate() returns them to the table.
 */
export function listSort(query: ListQuery, model: { schema: Schema }, fallback: SortSpec): SortSpec {
  const fields = sortableFields(model);
  query.sortable = fields;
  const raw = query.sort ?? "";
  const desc = raw.startsWith("-");
  const key = desc ? raw.slice(1) : raw;
  if (!key || !fields.includes(key)) return fallback;
  return { [key]: desc ? -1 : 1, _id: desc ? -1 : 1 };
}

/** Only "active" / "inactive" are accepted; anything else means no status filter. */
export function statusFilter(status: string): Filter {
  return status === "active" || status === "inactive" ? { status } : {};
}
