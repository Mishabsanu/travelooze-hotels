"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useSession } from "@/components/providers/SessionProvider";
import { DataTable } from "@/components/table/DataTable";
import { RowActions } from "@/components/table/RowActions";
import type { Column, FilterConfig } from "@/components/table/types";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { BOOKING_STATUS, MEAL_PLAN_CODES, toOptions, type BookingStatus } from "@/lib/constants";
import { formatDateTime, formatDay, formatINR, paxLabel } from "@/lib/format";
import { isEarlyCheckIn, isLateCheckOut, timeLabel } from "@/lib/stayTimes";
import type { Booking } from "@/lib/hotelTypes";
import { canBooking, deleteBlocker } from "@/lib/bookingAccess";
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

/** View / Edit / Delete (to the Recycle Bin). Check in / out, pay, voucher, invoice are on the booking page. */
function BookingRowActions({ b, user }: { b: Booking; user: SessionUser }) {
  const href = `${BOOKING_BASE}/${b._id}`;
  const open = b.status === "confirmed" || b.status === "checked_in";
  return (
    <RowActions
      entityLabel="Booking"
      itemName={`${b.bookingNo} – ${b.guest.name}`}
      viewHref={href}
      editHref={open && canBooking(user, b.source, "update") ? `${href}?do=edit` : undefined}
      deleteUrl={!deleteBlocker(user, b) ? `/api/bookings/${b._id}` : undefined}
      deleteNote="It goes to the Recycle Bin and can be restored from there."
    />
  );
}

interface Props {
  data: Paginated<Booking>;
  /** Today in IST (YYYY-MM-DD); kept for callers, not needed by the list any more */
  today?: string;
  hotelOptions: Option[];
  /** Hide the walk-in / agent filter (agent bookings page, agent detail) */
  agentOnly?: boolean;
  itemName?: string;
}

export function BookingListView({ data, hotelOptions, agentOnly, itemName = "bookings" }: Props) {
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
              {r.nights} night{r.nights > 1 ? "s" : ""} · {paxLabel(r.adults, r.children)} · ETA{" "}
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
        hiddenByDefault: true,
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
      {
        key: "total",
        label: "Total",
        align: "right",
        // Grand total (room + extra charges), the same amount the Balance is worked out from
        render: (r) => (
          <span className="tabular-nums">
            {formatINR(r.grandTotal)}
            {r.extrasTotal > 0 && <span className="block text-[10.5px] text-slate-400">incl. extras {formatINR(r.extrasTotal)}</span>}
          </span>
        ),
      },
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
      {
        key: "createdAt",
        label: "Booked",
        render: (r) => (
          <span className="flex flex-col">
            <span className="font-semibold text-slate-800">{r.createdBy?.name ?? "—"}</span>
            <span className="text-[10.5px] text-slate-400">{formatDateTime(r.createdAt)}</span>
          </span>
        ),
      },
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
      rowActions={(row) => <BookingRowActions b={row} user={user} />}
    />
  );
}
