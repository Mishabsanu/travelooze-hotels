import { LogIn, LogOut, Users, Wallet } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { BOOKING_BASE } from "@/components/bookings/bookingConfig";
import { formatDay, formatINR } from "@/lib/format";
import type { Booking } from "@/lib/hotelTypes";

interface Props {
  arriving: Booking[];
  leaving: Booking[];
  inHouse: Booking[];
  canCheck: boolean;
  canPay: boolean;
}

const actionBtn = "shrink-0 inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-xs font-bold transition";

/**
 * The front desk's day on one screen: arrivals (Check In), departures (Check Out) and in-house guests (Take Payment).
 * Each button opens the booking with that pop-up already open (?do=…), so the usual rules and checks still apply.
 */
export function TodayDesk({ arriving, leaving, inHouse, canCheck, canPay }: Props) {
  // Departing guests are also in-house: list them only once, under "Leaving today"
  const leavingIds = new Set(leaving.map((b) => b._id));
  const staying = inHouse.filter((b) => !leavingIds.has(b._id));

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
      <Column title="Arriving today" icon={<LogIn className="w-4 h-4" />} tone="text-sky-700 bg-sky-50 border-sky-200" count={arriving.length} all={`${BOOKING_BASE}?stay=arrivals`} empty="No more arrivals today">
        {arriving.map((b) => (
          <Row key={b._id} b={b}>
            {canCheck && (
              <Link href={`${BOOKING_BASE}/${b._id}?do=checkin`} className={`${actionBtn} bg-brand text-white hover:bg-brand-dark`}>
                <LogIn className="w-4 h-4" /> Check In
              </Link>
            )}
          </Row>
        ))}
      </Column>

      <Column title="Leaving today" icon={<LogOut className="w-4 h-4" />} tone="text-amber-700 bg-amber-50 border-amber-200" count={leaving.length} all={`${BOOKING_BASE}?stay=departures`} empty="No more departures today">
        {leaving.map((b) => (
          <Row key={b._id} b={b} showDue>
            {canCheck && (
              <Link href={`${BOOKING_BASE}/${b._id}?do=checkout`} className={`${actionBtn} bg-rail text-white hover:bg-rail-active`}>
                <LogOut className="w-4 h-4" /> Check Out
              </Link>
            )}
          </Row>
        ))}
      </Column>

      <Column title="In-house" icon={<Users className="w-4 h-4" />} tone="text-emerald-700 bg-emerald-50 border-emerald-200" count={staying.length} all={`${BOOKING_BASE}?stay=inhouse`} empty="No other guests in the house">
        {staying.map((b) => (
          <Row key={b._id} b={b} showDue>
            {canPay && b.balance > 0 && (
              <Link href={`${BOOKING_BASE}/${b._id}?do=pay`} className={`${actionBtn} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50`}>
                <Wallet className="w-4 h-4" /> Payment
              </Link>
            )}
          </Row>
        ))}
      </Column>
    </div>
  );
}

function Column({ title, icon, tone, count, all, empty, children }: { title: string; icon: ReactNode; tone: string; count: number; all: string; empty: string; children: ReactNode }) {
  return (
    <section className="bg-white border border-line rounded-xl overflow-hidden flex flex-col">
      <header className="px-4 py-3 border-b border-line flex items-center gap-2">
        <span className={`w-8 h-8 rounded-lg border flex items-center justify-center ${tone}`}>{icon}</span>
        <h2 className="text-sm font-bold text-slate-800">{title}</h2>
        <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600 tabular-nums">{count}</span>
        <Link href={all} className="ml-auto text-xs font-bold text-brand hover:underline">
          See all
        </Link>
      </header>
      {count === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-slate-400">{empty}</p>
      ) : (
        <ul className="divide-y divide-line max-h-[420px] overflow-y-auto">{children}</ul>
      )}
    </section>
  );
}

function Row({ b, showDue, children }: { b: Booking; showDue?: boolean; children?: ReactNode }) {
  const rooms = b.rooms.map((r) => r.roomNumber).join(", ");
  return (
    <li className="px-4 py-2.5 flex items-center gap-3 hover:bg-head">
      <Link href={`${BOOKING_BASE}/${b._id}`} className="min-w-0 flex-1 group">
        <p className="text-sm font-semibold text-slate-900 truncate group-hover:text-brand">
          {b.guest.name || "—"}
          {b.source === "agent" && b.agent && <span className="ml-1.5 text-xs font-normal text-slate-500">via {b.agent.name}</span>}
        </p>
        <p className="text-xs text-slate-500 truncate">
          Room {rooms || "—"} · {b.adults + b.children} pax · till {formatDay(b.checkOut)}
          {showDue && b.guestDue > 0 && <span className="ml-1.5 font-bold text-rose-600">Due {formatINR(b.guestDue)}</span>}
        </p>
      </Link>
      {children}
    </li>
  );
}
