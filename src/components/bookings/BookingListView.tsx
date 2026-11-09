"use client";

import { Eye, LogIn, LogOut, Pencil, Wallet } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { useSession } from "@/components/providers/SessionProvider";
import { DataTable } from "@/components/table/DataTable";
import type { Column, FilterConfig } from "@/components/table/types";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { BOOKING_STATUS, MEAL_PLAN_CODES, toOptions, type BookingStatus } from "@/lib/constants";
import { formatDateTime, formatDay, formatINR } from "@/lib/format";
import { isEarlyCheckIn, isLateCheckOut, timeLabel } from "@/lib/stayTimes";
import type { Booking } from "@/lib/hotelTypes";
import { canBooking } from "@/lib/bookingAccess";
import { can } from "@/lib/permissions";
import type { Option, Paginated, SessionUser } from "@/lib/types";

import { BOOKING_BASE } from "./bookingConfig";

const STATUS_VARIANT: Record<BookingStatus, BadgeVariant> = {
  confirmed: "info",
  checked_in: "success",
  checked_out: "neutral",
  cancelled: "danger",
  no_show: "warning",
};

export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  return (
    <Badge variant={STATUS_VARIANT[status]} dot>
      {BOOKING_STATUS[status]}
    </Badge>
  );
}

export function SourceBadge({ b }: { b: Pick<Booking, "source" | "agent"> }) {
  return b.source === "agent" ? <Badge variant="warning">{b.agent?.name ?? "Agent"}</Badge> : <Badge variant="brand">Walk-in</Badge>;
}

const STAY_FILTER: FilterConfig = {
  key: "stay",
  allLabel: "All Dates",
  options: [
    { value: "arrivals", label: "Arriving Today" },
    { value: "departures", label: "Departing Today" },
    { value: "inhouse", label: "In-house Now" },
    { value: "upcoming", label: "Upcoming" },
  ],
};

const pill = "inline-flex items-center gap-1 h-7 px-2.5 rounded-md text-[11px] font-bold transition-colors";

/** The next step for a booking, right in the list: Check In (on/after arrival day), Check Out, Pay. Opens the booking with that pop-up. */
function BookingRowActions({ b, user, today }: { b: Booking; user: SessionUser; today: string }) {
  const href = `${BOOKING_BASE}/${b._id}`;
  const desk = can(user, "check_in_out", "update");
  const arrived = b.checkIn.slice(0, 10) <= today;
  return (
    <div className="flex items-center justify-end gap-1.5">
      {b.status === "confirmed" && desk && arrived && (
        <Link href={`${href}?do=checkin`} className={`${pill} bg-emerald-600 text-white hover:bg-emerald-700`}>
          <LogIn className="w-3.5 h-3.5" /> Check In
        </Link>
      )}
      {b.status === "confirmed" && desk && !arrived && (
        <span className={`${pill} bg-slate-100 text-slate-400 cursor-default`} title="Check-in opens on the arrival date">
          <LogIn className="w-3.5 h-3.5" /> {formatDay(b.checkIn).replace(/\s\d{4}$/, "")}
        </span>
      )}
      {b.status === "checked_in" && desk && (
        <Link href={`${href}?do=checkout`} className={`${pill} bg-slate-800 text-white hover:bg-slate-900`}>
          <LogOut className="w-3.5 h-3.5" /> Check Out
        </Link>
      )}
      {b.status !== "cancelled" && b.balance > 0 && can(user, "payment", "create") && (
        <Link
          href={`${href}?do=pay`}
          title="Record payment"
          aria-label="Pay"
          className="p-1 rounded text-slate-400 hover:text-emerald-700 hover:bg-emerald-50"
        >
          <Wallet className="w-3.5 h-3.5" />
        </Link>
      )}
      {(b.status === "confirmed" || b.status === "checked_in") && canBooking(user, b.source, "update") && (
        <Link href={`${href}?do=edit`} title="Edit booking" aria-label="Edit" className="p-1 rounded text-slate-400 hover:text-brand hover:bg-brand-light">
          <Pencil className="w-3.5 h-3.5" />
        </Link>
      )}
      <Link href={href} title="Open booking" className="p-1 rounded text-slate-400 hover:text-brand hover:bg-brand-light">
        <Eye className="w-3.5 h-3.5" />
      </Link>
    </div>
  );
}

interface Props {
  data: Paginated<Booking>;
  /** Today in IST (YYYY-MM-DD), from the server */
  today: string;
  hotelOptions: Option[];
  /** Hide the walk-in / agent filter (agent bookings page, agent detail) */
  agentOnly?: boolean;
  itemName?: string;
}

export function BookingListView({ data, hotelOptions, agentOnly, itemName = "bookings", today }: Props) {
  const user = useSession();
  const columns = useMemo<Column<Booking>[]>(
    () => [
      {
        key: "bookingNo",
        label: "Booking",
        mono: true,
        render: (r) => (
          <Link href={`${BOOKING_BASE}/${r._id}`} className="text-brand hover:underline">
            {r.bookingNo}
          </Link>
        ),
      },
      {
        key: "guest.name",
        label: "Guest",
        render: (r) => (
          <span className="flex flex-col">
            <span className="font-semibold text-slate-900">{r.guest.name}</span>
            <span className="text-[10.5px] text-slate-400">{r.guest.phone}</span>
          </span>
        ),
      },
      {
        key: "hotel",
        label: "Hotel / Rooms",
        sortKey: false,
        render: (r) => (
          <span className="flex flex-col">
            <span>{r.hotel?.name}</span>
            <span className="text-[10.5px] text-slate-400">Room {r.rooms.map((x) => x.roomNumber).join(", ")}</span>
          </span>
        ),
      },
      {
        key: "checkIn",
        label: "Stay",
        render: (r) => (
          <span className="flex flex-col">
            <span>
              {formatDay(r.checkIn)} → {formatDay(r.checkOut)}
            </span>
            <span className="text-[10.5px] text-slate-400">
              {r.nights} night{r.nights > 1 ? "s" : ""} · {r.adults}A{r.children ? ` ${r.children}C` : ""} · ETA{" "}
              {timeLabel(r.arrivalTime || r.hotel?.checkInTime || "12:00")}
            </span>
          </span>
        ),
      },
      {
        key: "checkedInAt",
        label: "Checked In",
        render: (r) =>
          r.checkedInAt ? (
            <span className="flex flex-col">
              <span>{formatDateTime(r.checkedInAt)}</span>
              {isEarlyCheckIn(r) && <span className="text-[10px] font-bold text-amber-700">EARLY</span>}
            </span>
          ) : (
            <span className="text-slate-300">—</span>
          ),
      },
      {
        key: "checkedOutAt",
        label: "Checked Out",
        render: (r) =>
          r.checkedOutAt ? (
            <span className="flex flex-col">
              <span>{formatDateTime(r.checkedOutAt)}</span>
              {isLateCheckOut(r) && <span className="text-[10px] font-bold text-amber-700">LATE</span>}
            </span>
          ) : (
            <span className="text-slate-300">—</span>
          ),
        hiddenByDefault: true,
      },
      { key: "mealPlan", label: "Plan", align: "center", render: (r) => <Badge variant="neutral">{r.mealPlan}</Badge> },
      { key: "source", label: "Source", render: (r) => <SourceBadge b={r} /> },
      { key: "agentRef", label: "Agent Ref", hiddenByDefault: true },
      { key: "status", label: "Status", align: "center", render: (r) => <BookingStatusBadge status={r.status} /> },
      { key: "total", label: "Total", align: "right", render: (r) => <span className="tabular-nums">{formatINR(r.total)}</span> },
      {
        key: "balance",
        label: "Balance",
        align: "right",
        sortKey: false,
        render: (r) => (
          <span className={`tabular-nums font-semibold ${r.balance > 0 && r.status !== "cancelled" ? "text-rose-600" : "text-slate-400"}`}>
            {formatINR(r.balance)}
          </span>
        ),
      },
      { key: "createdBy", label: "Booked By", sortKey: false, hiddenByDefault: true, render: (r) => r.createdBy?.name ?? "—" },
    ],
    []
  );

  const filters = useMemo<FilterConfig[]>(() => {
    const list: FilterConfig[] = [
      { key: "hotel", allLabel: "All Hotels", options: hotelOptions, minWidth: "170px" },
      STAY_FILTER,
      { key: "status", allLabel: "All Status", options: toOptions(BOOKING_STATUS) },
    ];
    if (!agentOnly) list.push({ key: "source", allLabel: "Walk-in + Agent", options: [{ value: "walkin", label: "Walk-in" }, { value: "agent", label: "Agent" }] });
    list.push({ key: "mealPlan", allLabel: "All Plans", options: MEAL_PLAN_CODES.map((c) => ({ value: c, label: c })), minWidth: "110px" });
    return list;
  }, [hotelOptions, agentOnly]);

  return (
    <DataTable
      data={data}
      columns={columns}
      itemName={itemName}
      searchPlaceholder="Search by booking no., guest, phone, room or agent ref..."
      filters={filters}
      rowActions={(row) => <BookingRowActions b={row} user={user} today={today} />}
    />
  );
}
