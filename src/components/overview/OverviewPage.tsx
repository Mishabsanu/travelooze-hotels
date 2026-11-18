import { BarChart3, BedDouble, CalendarClock, HandCoins, IndianRupee, LogIn, LogOut, Plus, Sparkles, UtensilsCrossed, Wallet } from "lucide-react";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import type { SessionUser } from "@/lib/types";
import { todayIST } from "@/server/services/stay";
import { canBooking, canListBookings } from "@/lib/bookingAccess";
import { PAYMENT_MODES, type PaymentMode } from "@/lib/constants";
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
      {/* Welcome banner: greeting, date, booking buttons and shortcuts */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand via-brand to-brand-dark px-5 py-5 sm:px-7 sm:py-6 text-white shadow-sm">
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-white/10" />
        <div aria-hidden className="pointer-events-none absolute right-24 -bottom-24 h-48 w-48 rounded-full bg-white/5" />
        <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <p className="text-sm text-white/70">{formatDay(todayIST())}</p>
            <h1 className="mt-0.5 text-2xl font-bold tracking-tight">
              {hello}, {user.name.split(" ")[0]} 👋
            </h1>
            <p className="mt-1 text-sm text-white/80">Here is your hotel today.</p>
          </div>
          {(canWalkin || canAgent) && (
            <div className="flex flex-wrap gap-2">
              {canWalkin && (
                <Link href={`${BOOKINGS}/new`} className="inline-flex items-center gap-2 h-11 px-5 rounded-xl bg-white text-brand hover:bg-brand-light text-sm font-bold shadow-sm">
                  <Plus className="w-5 h-5" /> New Walk-in
                </Link>
              )}
              {canAgent && (
                <Link href={`${BOOKINGS}/new-agent`} className="inline-flex items-center gap-2 h-11 px-5 rounded-xl border border-white/40 text-white hover:bg-white/10 text-sm font-bold">
                  <Plus className="w-5 h-5" /> Agent Booking
                </Link>
              )}
            </div>
          )}
        </div>
        {(bookings || reports) && (
          <div className="relative mt-4 flex flex-wrap gap-2 border-t border-white/15 pt-4 text-xs font-semibold">
            {bookings && <Shortcut href="/dashboard/overview/rooms" icon={<BedDouble className="w-4 h-4" />} label="Room report" />}
            {bookings && <Shortcut href="/dashboard/front-office/availability" icon={<CalendarClock className="w-4 h-4" />} label="Booking grid" />}
            {reports && <Shortcut href="/dashboard/reports/daily" icon={<IndianRupee className="w-4 h-4" />} label="Today's money" />}
            {reports && <Shortcut href="/dashboard/overview/analytics" icon={<BarChart3 className="w-4 h-4" />} label="Sales charts" />}
          </div>
        )}
      </section>

      <Suspense fallback={<NumbersSkeleton />}>
        <HomeNumbers user={user} bookings={bookings} reports={reports} />
      </Suspense>

      {bookings && <GroupTitle>Guests today</GroupTitle>}
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
      {/* Rooms and guests today */}
      <GroupTitle>Rooms &amp; guests</GroupTitle>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 !mt-2">
        <Big
          icon={<BedDouble className="w-5 h-5" />}
          tone="bg-brand-light text-brand"
          label="Rooms free tonight"
          value={`${free}`}
          sub={`${o.totals.occupied} of ${o.totals.rooms} rooms are taken`}
          bar={{ pct: o.totals.rooms ? (o.totals.occupied / o.totals.rooms) * 100 : 0, label: `${o.totals.rooms ? Math.round((o.totals.occupied / o.totals.rooms) * 100) : 0}% full tonight` }}
          accent="bg-brand"
          href={bookings ? "/dashboard/front-office/availability" : undefined}
        />
        <Big
          icon={<LogIn className="w-5 h-5" />}
          tone="bg-sky-50 text-sky-700"
          accent="bg-sky-500"
          label="Coming today"
          value={`${o.totals.arrivals}`}
          sub={o.totals.arrivals ? `${o.totals.arrivalsDone} checked in · ${o.totals.arrivals - o.totals.arrivalsDone} still to come` : "no arrivals today"}
          href={bookings ? `${BOOKINGS}?stay=arrivals` : undefined}
        />
        <Big
          icon={<LogOut className="w-5 h-5" />}
          tone="bg-amber-50 text-amber-700"
          accent="bg-amber-500"
          label="Leaving today"
          value={`${o.totals.departures}`}
          sub={o.totals.departures ? `${o.totals.departuresDone} checked out · ${o.totals.departures - o.totals.departuresDone} still here` : "no departures today"}
          href={bookings ? `${BOOKINGS}?stay=departures` : undefined}
        />
      </div>

      {/* Money today */}
      <GroupTitle>Money</GroupTitle>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 !mt-2">
        <Big
          icon={<Wallet className="w-5 h-5" />}
          tone="bg-emerald-50 text-emerald-700"
          accent="bg-emerald-500"
          label="Received today"
          value={rupees(o.received.amount)}
          sub={o.received.count ? (Object.keys(PAYMENT_MODES) as PaymentMode[]).filter((m) => o.received.byMode[m] > 0).map((m) => `${PAYMENT_MODES[m]} ${rupees(o.received.byMode[m])}`).join(" · ") : "No payment yet today"}
          good={o.received.amount > 0}
          href={reports ? "/dashboard/reports/daily" : undefined}
        />
        <Big
          icon={<HandCoins className="w-5 h-5" />}
          tone="bg-orange-50 text-orange-600"
          accent="bg-orange-500"
          label="To collect today"
          value={rupees(o.collectToday.amount)}
          sub={o.collectToday.amount ? `Leaving ${rupees(o.collectToday.leaving)} · Arriving ${rupees(o.collectToday.arriving)}` : "Nothing to collect from today's guests"}
          danger={o.collectToday.amount > 0}
          href={bookings ? "/dashboard/overview/rooms?show=collect" : undefined}
        />
        <Big
          icon={<IndianRupee className="w-5 h-5" />}
          tone="bg-rose-50 text-rose-700"
          accent="bg-rose-500"
          label="All money to collect"
          value={rupees(o.pending.amount)}
          sub={o.pending.bookings ? `Due now ${rupees(o.pending.now)} · Upcoming ${rupees(o.pending.upcoming)}` : "Everyone has paid"}
          danger={o.pending.amount > 0}
          href={bookings ? "/dashboard/overview/rooms?show=collect" : undefined}
        />
      </div>

      {o.totals.overdueArrivals > 0 && bookings && (
        <Link href={`${BOOKINGS}?status=confirmed&sort=checkIn`} className="block text-sm font-medium text-amber-900 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 hover:bg-amber-100">
          ⚠ {o.totals.overdueArrivals} guest{o.totals.overdueArrivals > 1 ? "s" : ""} did not come on their check-in date. <b className="underline">Check in or mark no-show →</b>
        </Link>
      )}

      {/* Good to know */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Info icon={<UtensilsCrossed className="w-4 h-4" />} tone="text-brand bg-brand-light" label="Meals today">
          Breakfast <b>{meals.b}</b> · Lunch <b>{meals.l}</b> · Dinner <b>{meals.d}</b>
        </Info>
        <Info icon={<Sparkles className="w-4 h-4" />} tone={o.roomsToClean ? "text-amber-700 bg-amber-50" : "text-emerald-700 bg-emerald-50"} label="Rooms to clean" href={bookings ? "/dashboard/front-office/room-status" : undefined}>
          {o.roomsToClean ? (
            <>
              <b>{o.roomsToClean}</b> {o.roomsToClean > 1 ? "rooms need" : "room needs"} cleaning
            </>
          ) : (
            "All rooms are clean"
          )}
        </Info>
        <Info icon={<CalendarClock className="w-4 h-4" />} tone="text-sky-700 bg-sky-50" label="Arriving tomorrow">
          <b>{o.arrivalsTomorrow}</b> booking{o.arrivalsTomorrow === 1 ? "" : "s"}
        </Info>
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
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3" aria-busy="true" aria-label="Loading">
      {[0, 1, 2, 3, 4, 5].map((i) => (
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

/** ₹ without paise on Home (₹7,800 instead of ₹7,800.00); keeps paise when there are any */
const rupees = (n: number) => (Number.isInteger(Math.round(n * 100) / 100) ? `₹${Math.round(n).toLocaleString("en-IN")}` : formatINR(n));

function GroupTitle({ children }: { children: ReactNode }) {
  return <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 pt-1">{children}</h2>;
}

function Shortcut({ href, icon, label }: { href: string; icon: ReactNode; label: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-white hover:bg-white/20">
      {icon} {label} →
    </Link>
  );
}

function Info({ icon, tone, label, href, children }: { icon: ReactNode; tone: string; label: string; href?: string; children: ReactNode }) {
  const body = (
    <div className="flex h-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 hover:border-slate-300">
      <span className={`w-9 h-9 shrink-0 rounded-full flex items-center justify-center ${tone}`}>{icon}</span>
      <div className="min-w-0 text-sm">
        <p className="text-xs font-semibold text-slate-500">{label}</p>
        <p className="text-slate-800">{children}</p>
      </div>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

function Big({
  icon,
  tone,
  accent = "bg-slate-300",
  label,
  value,
  sub,
  href,
  danger,
  good,
  bar,
}: {
  icon: ReactNode;
  tone: string;
  accent?: string;
  label: string;
  value: string;
  sub: string;
  href?: string;
  danger?: boolean;
  good?: boolean;
  bar?: { pct: number; label: string };
}) {
  const body = (
    <div className="group relative h-full overflow-hidden bg-white rounded-xl border border-slate-200 p-4 pl-5 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition">
      <span aria-hidden className={`absolute left-0 top-0 bottom-0 w-1 ${accent}`} />
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-semibold text-slate-600">{label}</span>
        <span className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center ${tone}`}>{icon}</span>
      </div>
      <p className={`-mt-1 text-3xl font-black tabular-nums tracking-tight ${danger ? "text-rose-600" : good ? "text-emerald-700" : "text-slate-900"}`}>{value}</p>
      <p className="mt-1 text-xs text-slate-500">{sub}</p>
      {bar && (
        <div className="mt-3">
          <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
            <div className={`h-full rounded-full ${accent}`} style={{ width: `${Math.min(100, bar.pct)}%` }} />
          </div>
          <p className="mt-1 text-[11px] font-semibold text-slate-500">{bar.label}</p>
        </div>
      )}
      {href && <span className="absolute right-4 bottom-3 text-xs font-bold text-brand opacity-0 group-hover:opacity-100 transition">Open →</span>}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}
