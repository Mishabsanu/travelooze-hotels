import { BedDouble, CalendarClock, DoorOpen, IndianRupee, LogIn, LogOut, Users } from "lucide-react";
import Link from "next/link";
import { StatCard } from "@/components/dashboard/StatCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { canListBookings } from "@/lib/bookingAccess";
import { formatDay, formatINR } from "@/lib/format";
import { can } from "@/lib/permissions";
import { requireUser } from "@/server/auth/session";
import { TrendCharts } from "@/components/analytics/AnalyticsViews";
import { getAnalytics } from "@/server/services/analytics.service";
import { getOverview } from "@/server/services/overview.service";
import { addDays, todayIST } from "@/server/services/stay";

const BOOKINGS = "/dashboard/front-office/bookings";
const th = "px-3 py-2 border-r border-line last:border-r-0 whitespace-nowrap";
const td = "px-3 py-2 border-r border-line last:border-r-0 whitespace-nowrap";

export async function OverviewPage() {
  const user = await requireUser();
  const showTrends = can(user, "report", "view");
  const today = todayIST();
  const [o, trends] = await Promise.all([getOverview(user), showTrends ? getAnalytics(user, addDays(today, -29), today, "day") : null]);
  const bookings = canListBookings(user);
  const occ = o.totals.rooms ? Math.round((o.totals.occupied / o.totals.rooms) * 100) : 0;
  const href = (q: string) => (bookings ? `${BOOKINGS}?${q}` : undefined);

  return (
    <>
      <PageHeader title={`Welcome, ${user.name.split(" ")[0]}`} description={`${formatDay(o.today)} · ${user.roleName} · ${user.activeHotelId ? o.hotels[0]?.name ?? "" : user.allHotels ? "all hotels" : `${o.hotels.length} hotel(s)`}`} />

      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3">
        <StatCard label="Occupancy Tonight" value={`${occ}%`} hint={`${o.totals.occupied} of ${o.totals.rooms} rooms`} icon={BedDouble} />
        <StatCard label="Arrivals Today" value={o.totals.arrivals} icon={LogIn} tone="info" href={href("stay=arrivals")} />
        <StatCard label="Departures Today" value={o.totals.departures} icon={LogOut} tone="warning" href={href("stay=departures")} />
        <StatCard label="In-house" value={o.totals.inHouse} icon={Users} tone="success" href={href("stay=inhouse")} />
        <StatCard label="Free Rooms Tonight" value={o.totals.rooms - o.totals.occupied} icon={DoorOpen} tone="brand" />
        {o.month ? (
          <StatCard label="Booked This Month" value={formatINR(o.month.revenue)} hint={`${o.month.bookings} bookings · ${formatINR(o.month.collected)} collected`} icon={IndianRupee} tone="success" />
        ) : (
          <StatCard
            label="Missed Arrivals"
            value={o.totals.overdueArrivals}
            hint="Past check-in, never arrived"
            icon={CalendarClock}
            tone={o.totals.overdueArrivals ? "danger" : "brand"}
            href={href("status=confirmed&sort=checkIn")}
          />
        )}
      </div>

      {o.totals.overdueArrivals > 0 && bookings && (
        <div className="text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          {o.totals.overdueArrivals} confirmed booking(s) have a past check-in date and were never checked in.{" "}
          <Link href={`${BOOKINGS}?status=confirmed&sort=checkIn`} className="underline font-bold">
            Review — check in or mark no-show
          </Link>
        </div>
      )}

      {trends && (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-800">Last 30 days</h2>
            <Link href="/dashboard/overview/analytics" className="text-xs font-bold text-brand hover:underline">
              Open analytics (week / month / year) →
            </Link>
          </div>
          <TrendCharts a={trends} />
        </section>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Panel title="Hotels Tonight">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-line bg-head text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                <th className={`${th} text-left`}>Hotel</th>
                <th className={`${th} text-center`}>Rooms</th>
                <th className={`${th} text-center`}>Occupied</th>
                <th className={`${th} text-center`}>Arrivals</th>
                <th className={`${th} text-center`}>Departures</th>
                <th className={`${th} text-right`}>Occ %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {o.hotels.map((h) => {
                const pct = h.rooms ? Math.round((h.occupied / h.rooms) * 100) : 0;
                return (
                  <tr key={h._id} className="hover:bg-head">
                    <td className={`${td} font-semibold`}>
                      {bookings ? (
                        <Link href={`/dashboard/front-office/availability?hotel=${h._id}`} className="text-brand hover:underline">
                          {h.name}
                        </Link>
                      ) : (
                        h.name
                      )}
                    </td>
                    <td className={`${td} text-center`}>{h.rooms}</td>
                    <td className={`${td} text-center`}>{h.occupied}</td>
                    <td className={`${td} text-center`}>{h.arrivals}</td>
                    <td className={`${td} text-center`}>{h.departures}</td>
                    <td className={`${td} text-right`}>
                      <span className="inline-flex items-center gap-2">
                        <span className="w-16 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                          <span className="block h-full bg-brand" style={{ width: `${pct}%` }} />
                        </span>
                        <span className="tabular-nums font-semibold w-8">{pct}%</span>
                      </span>
                    </td>
                  </tr>
                );
              })}
              {o.hotels.length === 0 && <Empty span={6} text="No hotel assigned to you yet" />}
            </tbody>
          </table>
        </Panel>

        <Panel title="Kitchen — Meals for In-house Guests" note="Guests × meals included in their plan (EP / CP / MAP / AP)">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-line bg-head text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                <th className={`${th} text-left`}>Hotel</th>
                <th className={`${th} text-center`}>Breakfast</th>
                <th className={`${th} text-center`}>Lunch</th>
                <th className={`${th} text-center`}>Dinner</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {o.hotels.map((h) => (
                <tr key={h._id}>
                  <td className={`${td} font-semibold`}>{h.name}</td>
                  <td className={`${td} text-center tabular-nums`}>{h.meals.breakfast}</td>
                  <td className={`${td} text-center tabular-nums`}>{h.meals.lunch}</td>
                  <td className={`${td} text-center tabular-nums`}>{h.meals.dinner}</td>
                </tr>
              ))}
              {o.hotels.length === 0 && <Empty span={4} text="—" />}
            </tbody>
          </table>
        </Panel>
      </div>

      {o.agentDues && (
        <Panel title="Agent Outstanding" note="Top agents by balance billed to their account">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-line bg-head text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                <th className={`${th} text-left`}>Agent</th>
                <th className={`${th} text-right`}>Outstanding</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {o.agentDues.map((a) => (
                <tr key={a._id}>
                  <td className={td}>
                    <Link href={`/dashboard/sales/agents/${a._id}`} className="text-brand font-semibold hover:underline">
                      {a.name}
                    </Link>
                  </td>
                  <td className={`${td} text-right tabular-nums font-semibold text-amber-700`}>
                    {formatINR(a.due)}
                  </td>
                </tr>
              ))}
              {o.agentDues.length === 0 && <Empty span={2} text="No outstanding balances" />}
            </tbody>
          </table>
        </Panel>
      )}
      {!can(user, "booking", "view") && !can(user, "agent_booking", "view") && !can(user, "agent", "view") && (
        <p className="text-xs text-slate-500">Your role has no booking permissions yet. Ask an admin to update your role.</p>
      )}
    </>
  );
}

function Panel({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-line">
      <div className="px-3 py-2 border-b border-line flex items-baseline justify-between gap-2">
        <h2 className="text-[11px] font-bold text-brand uppercase tracking-wider">{title}</h2>
        {note && <span className="text-[10.5px] text-slate-400">{note}</span>}
      </div>
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

function Empty({ span, text }: { span: number; text: string }) {
  return (
    <tr>
      <td colSpan={span} className="px-6 py-8 text-center text-slate-400">
        {text}
      </td>
    </tr>
  );
}
