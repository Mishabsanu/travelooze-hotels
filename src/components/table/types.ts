import type { ReactNode } from "react";
import type { Option } from "@/lib/types";

export interface Column<T> {
  key: string;
  label: string;
  render?: (row: T) => ReactNode;
  align?: "left" | "center" | "right";
  /** Monospace styling for codes/IDs */
  mono?: boolean;
  /** Hidden until the user enables it in the column picker */
  hiddenByDefault?: boolean;
  width?: string;
  /** Stored field the header sorts by when it differs from `key` (e.g. "employee.name"); false = never sortable */
  sortKey?: string | false;
}

export interface FilterConfig {
  /** URL search param name */
  key: string;
  /** Label of the "all" option, e.g. "All Status" */
  allLabel: string;
  options: Option[];
  minWidth?: string;
}

export const STATUS_FILTER: FilterConfig = {
  key: "status",
  allLabel: "All Status",
  options: [
    { label: "Active", value: "active" },
    { label: "Inactive", value: "inactive" },
  ],
};
