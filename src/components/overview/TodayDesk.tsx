import { LogIn, LogOut, Users, Wallet } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { BOOKING_BASE } from "@/components/bookings/bookingConfig";
import { formatDay, formatINR } from "@/lib/format";
import { DeskAction } from "./DeskAction";
import type { Booking } from "@/lib/hotelTypes";

interface Props {
  arriving: Booking[];
  leaving: Booking[];
  inHouse: Booking[];
  canCheck: boolean;
  canPay: boolean;
  /** YYYY-MM-DD (India) */
  today: string;
}

const actionBtn = "shrink-0 inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-xs font-bold transition";

/**
 * The front desk's day on one screen: arrivals (Check In), departures (Check Out) and in-house guests (Take Payment).
 * Only what is still to do: once checked in, a guest moves from "To check in" to "Checked in"; once checked out, off Home.
 * Each button opens the pop-up right here on Home (same checks as on the booking page); Home refreshes after.
 */
export function TodayDesk({ arriving, leaving, inHouse, canCheck, canPay, today }: Props) {
  // Departing guests are also in-house: list them only once, under "Leaving today"
  const leavingIds = new Set(leaving.map((b) => b._id));
  const staying = inHouse.filter((b) => !leavingIds.has(b._id));

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
      <Column title="To check in today" icon={<LogIn className="w-4 h-4" />} tone="text-sky-700 bg-sky-50 border-sky-200" count={arriving.length} all={`${BOOKING_BASE}?stay=arrivals`} empty="Everyone has arrived">
        {arriving.map((b) => (
          <Row key={b._id} b={b}>
            {b.status !== "confirmed" ? (
              <Done label="Checked in" at={b.checkedInAt} />
            ) : canCheck && (
              <DeskAction b={b} action="checkin" today={today} className={`${actionBtn} bg-brand text-white hover:bg-brand-dark`}>
                <LogIn className="w-4 h-4" /> Check In
              </DeskAction>
            )}
          </Row>
        ))}
      </Column>

      <Column title="To check out today" icon={<LogOut className="w-4 h-4" />} tone="text-amber-700 bg-amber-50 border-amber-200" count={leaving.length} all={`${BOOKING_BASE}?stay=departures`} empty="Nobody left to check out">
        {leaving.map((b) => (
          <Row key={b._id} b={b} showDue>
            {b.status === "checked_out" ? (
              <Done label="Checked out" at={b.checkedOutAt} />
            ) : canCheck && (
              <DeskAction b={b} action="checkout" today={today} className={`${actionBtn} bg-rail text-white hover:bg-rail-active`}>
                <LogOut className="w-4 h-4" /> Check Out
              </DeskAction>
            )}
          </Row>
        ))}
      </Column>

      <Column title="Checked in (staying)" icon={<Users className="w-4 h-4" />} tone="text-emerald-700 bg-emerald-50 border-emerald-200" count={staying.length} all={`${BOOKING_BASE}?stay=inhouse`} empty="No guests staying">
        {staying.map((b) => (
          <Row key={b._id} b={b} showDue>
            <span className="shrink-0 flex gap-1.5">
              {canPay && b.guestDue > 0 && (
                <DeskAction b={b} action="pay" today={today} className={`${actionBtn} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50`}>
                  <Wallet className="w-4 h-4" /> Pay
                </DeskAction>
              )}
              {canCheck && (
                <DeskAction b={b} action="checkout" today={today} className={`${actionBtn} border border-rail text-rail hover:bg-rail hover:text-white`}>
                  <LogOut className="w-4 h-4" /> Check Out
                </DeskAction>
              )}
            </span>
          </Row>
        ))}
      </Column>
    </div>
  );
}

/** Already done today: a green tick and the time instead of the button */
function Done({ label, at }: { label: string; at?: string }) {
  const time = at ? new Date(at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }) : "";
  return (
    <span className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-emerald-50 border border-emerald-200 px-2.5 h-9 text-xs font-bold text-emerald-700">
      ✓ {label}
      {time && <span className="font-medium">{time}</span>}
    </span>
  );
}

function Column({ title, icon, tone, count, all, empty, children }: { title: string; icon: ReactNode; tone: string; count: number; all: string; empty: string; children: ReactNode }) {
  return (
    <section className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col shadow-xs">
      <header className="px-4 py-3 border-b border-line flex items-center gap-2">
        <span className={`w-8 h-8 rounded-lg border flex items-center justify-center ${tone}`}>{icon}</span>
        <h2 className="text-sm font-bold text-slate-800">{title}</h2>
        <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600 tabular-nums">{count}</span>
        <Link href={all} className="ml-auto text-xs font-bold text-brand hover:underline">
          See all
        </Link>
      </header>
      {count === 0 ? (
        <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
          <span className={`w-11 h-11 rounded-full border flex items-center justify-center opacity-70 ${tone}`}>{icon}</span>
          <p className="text-sm text-slate-400">{empty}</p>
        </div>
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
