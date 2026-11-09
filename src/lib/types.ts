import type { PermissionMap } from "./permissions";

export type RecordStatus = "active" | "inactive";

export interface Paginated<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  /** Fields the list can be sorted by (column headers become clickable) */
  sortable?: string[];
  /** Applied sort: "field" ascending, "-field" descending */
  sort?: string;
}

export interface Option {
  label: string;
  value: string;
}

export interface SessionUser {
  _id: string;
  name: string;
  email: string;
  roleName: string;
  isSuperAdmin: boolean;
  permissions: PermissionMap;
  /** Works at every hotel (Super Admin, or "All hotels" ticked on the user) */
  allHotels: boolean;
  /** Hotels this user is assigned to (ignored when allHotels) */
  hotelIds: string[];
}

export interface Role {
  _id: string;
  name: string;
  description?: string;
  status: RecordStatus;
  isSuperAdmin: boolean;
  permissions: PermissionMap;
  userCount?: number;
  /** Modules with at least one granted action (every module for Super Admin) */
  accessCount?: number;
  createdBy?: CreatorName | null;
  createdAt?: string;
  updatedAt?: string;
}

/** Who created an admin record: only the name is ever sent to the browser. */
export interface CreatorName {
  name: string;
}

export interface User {
  _id: string;
  name: string;
  email: string;
  mobile: string;
  role: { _id: string; name: string } | null;
  status: RecordStatus;
  allHotels: boolean;
  hotels: { _id: string; name: string }[];
  createdBy?: CreatorName | null;
  createdAt?: string;
  updatedAt?: string;
}
