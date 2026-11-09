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
  /**
   * EFFECTIVE hotel scope used by every query and permission check: the hotel chosen in the header
   * switcher, or all assigned hotels when "All my hotels" is chosen.
   */
  allHotels: boolean;
  hotelIds: string[];
  /** What the user is assigned to (the switcher offers these) */
  assignedAll: boolean;
  assignedHotelIds: string[];
  /** Hotel chosen in the header switcher (null = all assigned hotels) */
  activeHotelId: string | null;
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
