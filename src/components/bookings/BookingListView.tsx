"use client";

import Link from "next/link";
import { useMemo } from "react";
import { DataTable } from "@/components/table/DataTable";
import type { Column, FilterConfig } from "@/components/table/types";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { BOOKING_STATUS, MEAL_PLAN_CODES, toOptions, type BookingStatus } from "@/lib/constants";
import { formatDay, formatINR } from "@/lib/format";
import type { Booking } from "@/lib/hotelTypes";
import type { Option, Paginated } from "@/lib/types";

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

interface Props {
  data: Paginated<Booking>;
  hotelOptions: Option[];
  /** Hide the walk-in / agent filter (agent bookings page, agent detail) */
  agentOnly?: boolean;
  itemName?: string;
}

export function BookingListView({ data, hotelOptions, agentOnly, itemName = "bookings" }: Props) {
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
              {r.nights} night{r.nights > 1 ? "s" : ""} · {r.adults}A{r.children ? ` ${r.children}C` : ""}
            </span>
          </span>
        ),
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
    />
  );
}
