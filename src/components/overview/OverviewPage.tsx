import { BarChart3, BedDouble, IndianRupee, LogIn, LogOut, Plus, UtensilsCrossed } from "lucide-react";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import type { SessionUser } from "@/lib/types";
import { todayIST } from "@/server/services/stay";
import { canBooking, canListBookings } from "@/lib/bookingAccess";
import { formatDay, formatINR, toDayString } from "@/lib/format";
import { can } from "@/lib/permissions";
import { requireUser } from "@/server/auth/session";
import { parseListQuery } from "@/server/http/query";
import { listBookings } from "@/server/services/booking/booking.service";
import { getOverview } from "@/server/services/overview.service";
import { TodayDesk } from "./TodayDesk";

const BOOKINGS = "/dashboard/front-office/bookings";

/**
 * Home: what the front desk needs today, in plain words.
 * Streams in three parts so nothing waits for the slowest query:
 * greeting + buttons (instant) → 4 numbers + meals → who is coming / leaving / staying.
 */
export async function OverviewPage() {
  const user = await requireUser();
  const bookings = canListBookings(user);
  const reports = can(user, "report", "view");
  const canWalkin = canBooking(user, "walkin", "create");
  const canAgent = canBooking(user, "agent", "create");
  const hour = Number(new Date().toLocaleString("en-IN", { hour: "numeric", hour12: false, timeZone: "Asia/Kolkata" }));
  const hello = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <>
      {/* Greeting + the two main buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            {hello}, {user.name.split(" ")[0]}
          </h1>
          <p className="text-sm text-slate-500">{formatDay(todayIST())}</p>
        </div>
        {(canWalkin || canAgent) && (
          <div className="flex flex-wrap gap-2">
            {canWalkin && (
              <Link href={`${BOOKINGS}/new`} className="inline-flex items-center gap-2 h-11 px-5 rounded-xl bg-brand hover:bg-brand-dark text-white text-sm font-bold shadow-sm">
                <Plus className="w-5 h-5" /> New Walk-in
              </Link>
            )}
            {canAgent && (
              <Link href={`${BOOKINGS}/new-agent`} className="inline-flex items-center gap-2 h-11 px-5 rounded-xl border border-brand-border bg-white text-brand hover:bg-brand-light text-sm font-bold">
                <Plus className="w-5 h-5" /> Agent Booking
              </Link>
            )}
          </div>
        )}
      </div>

      <Suspense fallback={<NumbersSkeleton />}>
        <HomeNumbers user={user} bookings={bookings} reports={reports} />
      </Suspense>

      {bookings && (
        <Suspense fallback={<DeskSkeleton />}>
          <HomeDesk user={user} />
        </Suspense>
      )}

      {!can(user, "booking", "view") && !can(user, "agent_booking", "view") && !can(user, "agent", "view") && (
        <p className="text-sm text-slate-500">Your role has no booking permissions yet. Ask an admin to update your role.</p>
      )}
    </>
  );
}

/** 4 numbers, the missed-arrivals warning and the meals line (one overview query). */
async function HomeNumbers({ user, bookings, reports }: { user: SessionUser; bookings: boolean; reports: boolean }) {
  const o = await getOverview(user);
  const free = o.totals.rooms - o.totals.occupied;
  const meals = o.hotels.reduce((m, h) => ({ b: m.b + h.meals.breakfast, l: m.l + h.meals.lunch, d: m.d + h.meals.dinner }), { b: 0, l: 0, d: 0 });
  return (
    <>
      {/* Four numbers, plain words */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <Big
          icon={<BedDouble className="w-5 h-5" />}
          tone="bg-brand-light text-brand"
          label="Rooms free tonight"
          value={`${free}`}
          sub={`${o.totals.occupied} of ${o.totals.rooms} rooms are taken`}
          href={bookings ? "/dashboard/front-office/availability" : undefined}
        />
        <Big
          icon={<LogIn className="w-5 h-5" />}
          tone="bg-sky-50 text-sky-700"
          label="Coming today"
          value={`${o.totals.arrivals}`}
          sub={o.totals.arrivals ? `${o.totals.arrivalsDone} checked in · ${o.totals.arrivals - o.totals.arrivalsDone} still to come` : "no arrivals today"}
          href={bookings ? `${BOOKINGS}?stay=arrivals` : undefined}
        />
        <Big
          icon={<LogOut className="w-5 h-5" />}
          tone="bg-amber-50 text-amber-700"
          label="Leaving today"
          value={`${o.totals.departures}`}
          sub={o.totals.departures ? `${o.totals.departuresDone} checked out · ${o.totals.departures - o.totals.departuresDone} still here` : "no departures today"}
          href={bookings ? `${BOOKINGS}?stay=departures` : undefined}
        />
        <Big
          icon={<IndianRupee className="w-5 h-5" />}
          tone="bg-rose-50 text-rose-700"
          label="Money to collect"
          value={formatINR(o.pending.amount)}
          sub={o.pending.bookings ? `Due now ${formatINR(o.pending.now)} · Upcoming ${formatINR(o.pending.upcoming)}` : "Everyone has paid"}
          danger={o.pending.amount > 0}
          href={reports ? "/dashboard/reports/daily" : bookings ? BOOKINGS : undefined}
        />
      </div>

      {o.totals.overdueArrivals > 0 && bookings && (
        <Link href={`${BOOKINGS}?status=confirmed&sort=checkIn`} className="block text-sm font-medium text-amber-900 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 hover:bg-amber-100">
          ⚠ {o.totals.overdueArrivals} guest{o.totals.overdueArrivals > 1 ? "s" : ""} did not come on their check-in date. <b className="underline">Check in or mark no-show →</b>
        </Link>
      )}

      {/* Small extras */}
      <div className="flex flex-wrap gap-3 text-sm">
        <span className="inline-flex items-center gap-2 rounded-xl border border-line bg-white px-4 py-2.5 text-slate-700">
          <UtensilsCrossed className="w-4 h-4 text-brand" />
          <b>Meals today:</b> Breakfast {meals.b} · Lunch {meals.l} · Dinner {meals.d}
        </span>
        {reports && (
          <Link href="/dashboard/overview/analytics" className="inline-flex items-center gap-2 rounded-xl border border-line bg-white px-4 py-2.5 font-semibold text-brand hover:bg-brand-light">
            <BarChart3 className="w-4 h-4" /> Sales charts →
          </Link>
        )}
        {reports && (
          <Link href="/dashboard/reports/daily" className="inline-flex items-center gap-2 rounded-xl border border-line bg-white px-4 py-2.5 font-semibold text-brand hover:bg-brand-light">
            <IndianRupee className="w-4 h-4" /> Today&apos;s money report →
          </Link>
        )}
      </div>
    </>
  );
}

/** Who is coming, leaving and staying today, with the Check In / Check Out / Payment buttons. */
async function HomeDesk({ user }: { user: SessionUser }) {
  // 50 each is more than a day's work
  const stay = (s: string) => listBookings(parseListQuery({ stay: s, limit: "50", sort: "checkIn" }, ["stay"]), user).then((r) => r.items);
  const [arriving, leaving, inHouse] = await Promise.all([stay("arrivals"), stay("departures"), stay("inhouse")]);
  return (
    <TodayDesk
      arriving={arriving}
      leaving={leaving}
      inHouse={inHouse}
      canCheck={can(user, "check_in_out", "update")}
      canPay={can(user, "payment", "create")}
      today={toDayString(todayIST())}
    />
  );
}

const bone = "animate-pulse rounded bg-slate-200/80";

function NumbersSkeleton() {
  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-3" aria-busy="true" aria-label="Loading">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
          <div className={`${bone} h-4 w-32`} />
          <div className={`${bone} h-8 w-20`} />
          <div className={`${bone} h-3 w-40`} />
        </div>
      ))}
    </div>
  );
}

function DeskSkeleton() {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4" aria-busy="true" aria-label="Loading">
      {[0, 1, 2].map((i) => (
        <div key={i} className="bg-white border border-line rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-line">
            <div className={`${bone} h-5 w-36`} />
          </div>
          {[0, 1, 2].map((r) => (
            <div key={r} className="px-4 py-3 border-b border-line last:border-b-0 space-y-2">
              <div className={`${bone} h-3.5 w-1/2`} />
              <div className={`${bone} h-3 w-2/3`} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function Big({ icon, tone, label, value, sub, href, danger }: { icon: ReactNode; tone: string; label: string; value: string; sub: string; href?: string; danger?: boolean }) {
  const body = (
    <div className="h-full bg-white rounded-xl border border-slate-200 p-4 shadow-xs hover:shadow-md hover:border-slate-300 transition">
      <div className="flex items-center gap-2">
        <span className={`w-9 h-9 rounded-lg flex items-center justify-center ${tone}`}>{icon}</span>
        <span className="text-sm font-semibold text-slate-600">{label}</span>
      </div>
      <p className={`mt-2 text-3xl font-black tabular-nums ${danger ? "text-rose-600" : "text-slate-900"}`}>{value}</p>
      <p className="text-xs text-slate-500">{sub}</p>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}
