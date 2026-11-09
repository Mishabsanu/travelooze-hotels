import { BarChart3, BedDouble, Building2, Handshake, Home, ShieldCheck, type LucideIcon } from "lucide-react";
import { can, type PermissionModule } from "@/lib/permissions";
import type { SessionUser } from "@/lib/types";

export interface NavItem {
  label: string;
  href: string;
  permission?: PermissionModule;
  /** A second module that also opens this item (e.g. Availability: booking OR agent_booking) */
  orPermission?: PermissionModule;
}

export interface NavModule {
  id: string;
  label: string;
  icon: LucideIcon;
  /** URL prefix that marks this module active */
  basePath: string;
  items: NavItem[];
}

/** Single source of truth for the left rail, module tabs and sub-tabs. */
export const NAV_MODULES: NavModule[] = [
  {
    id: "home",
    label: "Home",
    icon: Home,
    basePath: "/dashboard/overview",
    items: [
      { label: "Overview", href: "/dashboard/overview" },
      { label: "Booking Grid", href: "/dashboard/overview/booking-grid", permission: "booking", orPermission: "agent_booking" },
      { label: "Room Status", href: "/dashboard/overview/room-status", permission: "booking", orPermission: "agent_booking" },
    ],
  },
  {
    id: "front-office",
    label: "Front Office",
    icon: BedDouble,
    basePath: "/dashboard/front-office",
    items: [
      { label: "Bookings", href: "/dashboard/front-office/bookings", permission: "booking" },
      { label: "New Booking", href: "/dashboard/front-office/bookings/new", permission: "booking" },
      { label: "Booking Grid", href: "/dashboard/front-office/availability", permission: "booking", orPermission: "agent_booking" },
      { label: "Room Status", href: "/dashboard/front-office/room-status", permission: "booking" },
    ],
  },
  {
    id: "sales",
    label: "B2B Sales",
    icon: Handshake,
    basePath: "/dashboard/sales",
    items: [
      { label: "Agent Bookings", href: "/dashboard/sales/agent-bookings", permission: "agent_booking" },
      { label: "New Agent Booking", href: "/dashboard/sales/agent-bookings/new", permission: "agent_booking" },
      { label: "Agents Master", href: "/dashboard/sales/agents", permission: "agent" },
    ],
  },
  {
    id: "property",
    label: "Property",
    icon: Building2,
    basePath: "/dashboard/property",
    items: [
      { label: "Hotels", href: "/dashboard/property/hotels", permission: "hotel" },
      { label: "Room Types & Rates", href: "/dashboard/property/room-types", permission: "room_type" },
      { label: "Rooms", href: "/dashboard/property/rooms", permission: "room" },
    ],
  },
  {
    id: "reports",
    label: "Reports",
    icon: BarChart3,
    basePath: "/dashboard/reports",
    items: [{ label: "Revenue & Agent Outstanding", href: "/dashboard/reports", permission: "report" }],
  },
  {
    id: "admin",
    label: "Admin",
    icon: ShieldCheck,
    basePath: "/dashboard/admin",
    items: [
      { label: "User Directory", href: "/dashboard/admin/users", permission: "user" },
      { label: "Roles & Permissions", href: "/dashboard/admin/roles", permission: "role" },
    ],
  },
];

/** Modules and items the user may see; modules with no visible items are dropped. */
export function visibleModules(user: SessionUser): NavModule[] {
  return NAV_MODULES.map((m) => ({
    ...m,
    items: m.items.filter(
      (i) => !i.permission || can(user, i.permission, "view") || (i.orPermission ? can(user, i.orPermission, "view") : false)
    ),
  })).filter((m) => m.items.length > 0);
}

/** The module owning this path — the longest matching basePath wins . */
export function findActiveModule(modules: NavModule[], pathname: string): NavModule | undefined {
  return modules
    .filter((m) => pathname === m.basePath || pathname.startsWith(`${m.basePath}/`))
    .sort((a, b) => b.basePath.length - a.basePath.length)[0];
}

export function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
