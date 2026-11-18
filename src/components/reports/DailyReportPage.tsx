import { BedDouble, ChevronLeft, ChevronRight, IndianRupee, LogIn, Wallet } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { BOOKING_BASE } from "@/components/bookings/bookingConfig";
import { BookingStatusBadge } from "@/components/bookings/BookingListView";
import { AccessDenied } from "@/components/ui/AccessDenied";
import { PageHeader } from "@/components/ui/PageHeader";
import { PAYMENT_MODES, type BookingStatus, type PaymentMode } from "@/lib/constants";
import { formatDay, formatINR, toDayString } from "@/lib/format";
import { getPageAccess } from "@/server/auth/session";
import { getDailyReport, type DailyMove } from "@/server/services/dailyReport.service";
import { listHotelOptions } from "@/server/services/hotel.service";
import { CsvButton } from "./CsvButton";
import { PrintButton } from "./PrintButton";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;
const th = "px-3 py-2 border-r border-line last:border-r-0 whitespace-nowrap";
const td = "px-3 py-2 border-r border-line last:border-r-0 whitespace-nowrap";
const shift = (iso: string, n: number) => new Date(new Date(iso).getTime() + n * 86_400_000).toISOString().slice(0, 10);
const time = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });

/** Daily report: money in, money earned, arrivals / departures and every open balance, for one day. */
export async function DailyReportPage({ searchParams }: { searchParams: SearchParams }) {
  const { user, allowed } = await getPageAccess("report", "view");
  if (!allowed) return <AccessDenied />;
  const sp = await searchParams;
  const hotel = first(sp.hotel);
  const [r, hotelOptions] = await Promise.all([getDailyReport(user, first(sp.date), hotel), listHotelOptions(user)]);
  const day = toDayString(r.day);
  const q = (d: string) => `?${new URLSearchParams({ date: d, ...(hotel ? { hotel } : {}) })}`;

  const arrived = r.arrivals.filter((a) => a.status === "checked_in" || a.status === "checked_out").length;
  const left = r.departures.filter((a) => a.status === "checked_out").length;
  const modes = (Object.keys(PAYMENT_MODES) as PaymentMode[]).filter((m) => r.collected.byMode[m] > 0);

  return (
    <>
      <PageHeader
        title={`Daily Report · ${formatDay(r.day)}`}
        description="How much money came in, who still has to pay, and which guests came and left."
        actions={<PrintButton />}
      />

      {/* Day picker */}
      <form className="no-print w-full bg-white border border-line flex flex-wrap items-stretch text-sm">
        <Link href={q(shift(r.day, -1))} className="flex items-center px-3 h-10 border-r border-line hover:bg-head" title="Previous day" aria-label="Previous day">
          <ChevronLeft className="w-4 h-4" />
        </Link>
        <input type="date" name="date" defaultValue={day} aria-label="Day" className="h-10 px-3 border-r border-line outline-none" />
        <Link href={q(shift(r.day, 1))} className="flex items-center px-3 h-10 border-r border-line hover:bg-head" title="Next day" aria-label="Next day">
          <ChevronRight className="w-4 h-4" />
        </Link>
        {hotelOptions.length > 1 && (
          <select name="hotel" defaultValue={hotel ?? ""} aria-label="Hotel" className="h-10 px-3 border-r border-line bg-white outline-none">
            <option value="">All hotels</option>
            {hotelOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        )}
        <button className="px-4 h-10 font-bold text-brand hover:bg-brand-light border-r border-line">Show</button>
        {!r.isToday && (
          <Link href={hotel ? `?hotel=${hotel}` : "?"} className="px-4 h-10 flex items-center font-bold text-slate-600 hover:bg-head">
            Today
          </Link>
        )}
      </form>

      {/* Four numbers, plain words */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <Tile icon={<Wallet className="w-5 h-5" />} tone="bg-emerald-50 text-emerald-700 border-emerald-200" label="Money received" value={formatINR(r.collected.total)}>
          {modes.length ? modes.map((m) => `${PAYMENT_MODES[m]} ${formatINR(r.collected.byMode[m])}`).join(" · ") : "No payment on this day"}
        </Tile>
        <Tile icon={<IndianRupee className="w-5 h-5" />} tone="bg-rose-50 text-rose-700 border-rose-200" label="Money to collect" value={formatINR(r.dueTotals.total)} strong={r.dueTotals.total > 0}>
          {r.dues.length ? `${r.dues.length} booking${r.dues.length > 1 ? "s" : ""} not fully paid` : "Everyone has paid"}
        </Tile>
        <Tile icon={<BedDouble className="w-5 h-5" />} tone="bg-brand-light text-brand border-brand-border" label="Rooms taken" value={`${r.occupancy.occupied} / ${r.occupancy.rooms}`}>
          {r.occupancy.pct}% full · {r.occupancy.rooms - r.occupancy.occupied} free
        </Tile>
        <Tile icon={<LogIn className="w-5 h-5" />} tone="bg-sky-50 text-sky-700 border-sky-200" label="Guests in / out" value={`${arrived} in · ${left} out`}>
          {r.arrivals.length - arrived || r.departures.length - left
            ? `Still waiting: ${r.arrivals.length - arrived} to check in, ${r.departures.length - left} to check out`
            : "All check-ins and check-outs done"}
        </Tile>
      </div>

      {/* Pending dues */}
      <Panel
        title={`Who still has to pay · ${r.dues.length}`}
        note="Guests staying now or already left, with money not yet paid (shown as of now)"
        action={
          <CsvButton
            fileName={`pending-dues-${day}.csv`}
            header={["Booking", "Guest", "Phone", "Rooms", "Status", "Check-in", "Check-out", "Bill to", "Agent", "Total", "Paid", "Balance", "Guest owes", "Agent owes"]}
            rows={r.dues.map((d) => [d.bookingNo, d.guest, d.phone, d.rooms, d.status, toDayString(d.checkIn), toDayString(d.checkOut), d.billTo, d.agent, d.grandTotal, d.paid, d.balance, d.guestDue, d.agentDue])}
          />
        }
      >
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b border-line bg-head text-[11px] font-bold text-slate-600 uppercase tracking-wider">
              <th className={`${th} text-left`}>Booking</th>
              <th className={`${th} text-left`}>Guest</th>
              <th className={`${th} text-left`}>Rooms</th>
              <th className={`${th} text-center`}>Status</th>
              <th className={`${th} text-left`}>Stay</th>
              <th className={`${th} text-left`}>Bill to</th>
              <th className={`${th} text-right`}>Total</th>
              <th className={`${th} text-right`}>Paid</th>
              <th className={`${th} text-right`}>To pay</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {r.dues.map((d) => (
              <tr key={d.bookingId} className={d.status === "checked_out" ? "bg-rose-50/50" : "hover:bg-head"}>
                <td className={td}>
                  <BookingLink id={d.bookingId} no={d.bookingNo} />
                </td>
                <td className={td}>
                  <span className="font-semibold text-slate-800">{d.guest || "—"}</span>
                  {d.phone && <span className="block text-[10.5px] text-slate-400">{d.phone}</span>}
                </td>
                <td className={`${td} font-mono`}>{d.rooms}</td>
                <td className={`${td} text-center`}>
                  <BookingStatusBadge status={d.status as BookingStatus} />
                  {d.status === "checked_out" && <span className="block mt-0.5 text-[10px] font-bold text-rose-600">Left without paying</span>}
                </td>
                <td className={td}>
                  {formatDay(d.checkIn)} → {formatDay(d.checkOut)}
                </td>
                <td className={td}>{d.billTo === "agent" ? `Agent · ${d.agent}` : "Guest"}</td>
                <td className={`${td} text-right tabular-nums`}>{formatINR(d.grandTotal)}</td>
                <td className={`${td} text-right tabular-nums`}>{formatINR(d.paid)}</td>
                <td className={`${td} text-right tabular-nums font-bold text-rose-600`}>
                  {formatINR(d.balance)}
                  {d.billTo === "agent" && d.guestDue > 0 && <span className="block text-[10.5px] font-semibold">guest {formatINR(d.guestDue)}</span>}
                </td>
              </tr>
            ))}
            {r.dues.length === 0 && <Empty span={9} text="No pending dues. Everyone has paid." />}
          </tbody>
          {r.dues.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-line bg-head font-bold">
                <td className={td} colSpan={6}>
                  Total to collect
                </td>
                <td className={`${td} text-right tabular-nums`}>{formatINR(r.dues.reduce((s, d) => s + d.grandTotal, 0))}</td>
                <td className={`${td} text-right tabular-nums`}>{formatINR(r.dues.reduce((s, d) => s + d.paid, 0))}</td>
                <td className={`${td} text-right tabular-nums text-rose-600`}>{formatINR(r.dueTotals.total)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </Panel>

      {/* Payments received */}
      <Panel
        title={`Money received · ${r.payments.length} payment${r.payments.length === 1 ? "" : "s"}`}
        note={`Every payment taken on ${formatDay(r.day)}`}
        action={
          <CsvButton
            fileName={`payments-${day}.csv`}
            header={["Time", "Booking", "Guest", "Rooms", "Mode", "Reference", "Paid by", "Amount", "Taken by"]}
            rows={r.payments.map((p) => [time(p.at), p.bookingNo, p.guest, p.rooms, PAYMENT_MODES[p.mode], p.reference, p.paidBy, p.amount, p.by])}
          />
        }
      >
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b border-line bg-head text-[11px] font-bold text-slate-600 uppercase tracking-wider">
              <th className={`${th} text-left`}>Time</th>
              <th className={`${th} text-left`}>Booking</th>
              <th className={`${th} text-left`}>Guest</th>
              <th className={`${th} text-left`}>Mode</th>
              <th className={`${th} text-left`}>Reference</th>
              <th className={`${th} text-left`}>Paid by</th>
              <th className={`${th} text-left`}>Taken by</th>
              <th className={`${th} text-right`}>Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {r.payments.map((p, i) => (
              <tr key={`${p.bookingId}-${i}`} className="hover:bg-head">
                <td className={`${td} tabular-nums`}>{time(p.at)}</td>
                <td className={td}>
                  <BookingLink id={p.bookingId} no={p.bookingNo} />
                </td>
                <td className={td}>
                  <span className="font-semibold text-slate-800">{p.guest || "—"}</span>
                  <span className="text-slate-400"> · {p.rooms}</span>
                </td>
                <td className={td}>{PAYMENT_MODES[p.mode]}</td>
                <td className={`${td} text-slate-500`}>{p.reference || "—"}</td>
                <td className={td}>{p.paidBy === "agent" ? "Agent" : "Guest"}</td>
                <td className={`${td} text-slate-500`}>{p.by || "—"}</td>
                <td className={`${td} text-right tabular-nums font-semibold text-emerald-700`}>{formatINR(p.amount)}</td>
              </tr>
            ))}
            {r.payments.length === 0 && <Empty span={8} text="No payments on this day" />}
          </tbody>
          {r.payments.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-line bg-head font-bold">
                <td className={td} colSpan={7}>
                  Total collected {modes.length > 0 && <span className="font-normal text-slate-500">({modes.map((m) => `${PAYMENT_MODES[m]} ${formatINR(r.collected.byMode[m])}`).join(" · ")})</span>}
                </td>
                <td className={`${td} text-right tabular-nums text-emerald-700`}>{formatINR(r.collected.total)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </Panel>

      {/* Guests in / out */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Panel title={`Guests coming · ${r.arrivals.length}`} note={`Check-in date ${formatDay(r.day)}`}>
          <MoveTable rows={r.arrivals} empty="No arrivals" />
        </Panel>
        <Panel title={`Guests leaving · ${r.departures.length}`} note={`Check-out date ${formatDay(r.day)}`}>
          <MoveTable rows={r.departures} empty="No departures" />
        </Panel>
      </div>
    </>
  );
}

function MoveTable({ rows, empty }: { rows: DailyMove[]; empty: string }) {
  return (
    <table className="w-full text-xs border-collapse">
      <thead>
        <tr className="border-b border-line bg-head text-[11px] font-bold text-slate-600 uppercase tracking-wider">
          <th className={`${th} text-left`}>Booking</th>
          <th className={`${th} text-left`}>Guest</th>
          <th className={`${th} text-left`}>Rooms</th>
          <th className={`${th} text-center`}>Status</th>
          <th className={`${th} text-right`}>To pay</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-line">
        {rows.map((m) => (
          <tr key={m.bookingId} className="hover:bg-head">
            <td className={td}>
              <BookingLink id={m.bookingId} no={m.bookingNo} />
            </td>
            <td className={td}>
              <span className="font-semibold text-slate-800">{m.guest || "—"}</span>
              <span className="block text-[10.5px] text-slate-400">
                {m.pax} pax{m.source === "agent" && m.agent ? ` · ${m.agent}` : ""}
              </span>
            </td>
            <td className={`${td} font-mono`}>{m.rooms}</td>
            <td className={`${td} text-center`}>
              <BookingStatusBadge status={m.status as BookingStatus} />
            </td>
            <td className={`${td} text-right tabular-nums ${m.balance > 0 ? "font-bold text-rose-600" : "text-slate-400"}`}>{formatINR(Math.max(0, m.balance))}</td>
          </tr>
        ))}
        {rows.length === 0 && <Empty span={5} text={empty} />}
      </tbody>
    </table>
  );
}

function Tile({ icon, tone, label, value, strong, children }: { icon: ReactNode; tone: string; label: string; value: string; strong?: boolean; children: ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-600">{label}</p>
          <p className={`text-2xl font-black mt-1 tabular-nums ${strong ? "text-rose-600" : "text-slate-900"}`}>{value}</p>
        </div>
        <span className={`w-9 h-9 shrink-0 rounded-lg border flex items-center justify-center ${tone}`}>{icon}</span>
      </div>
      <p className="mt-1 text-xs text-slate-500">{children}</p>
    </div>
  );
}

function Panel({ title, note, action, children }: { title: string; note?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="bg-white border border-line rounded-xl overflow-hidden break-inside-avoid">
      <div className="px-4 py-3 border-b border-line flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 className="text-sm font-bold text-slate-800">{title}</h2>
        {note && <span className="text-xs text-slate-400">{note}</span>}
        {action && <span className="no-print ml-auto">{action}</span>}
      </div>
      <div className="overflow-x-auto">{children}</div>
    </section>
  );
}

function BookingLink({ id, no }: { id: string; no: string }) {
  return (
    <Link href={`${BOOKING_BASE}/${id}`} className="font-mono font-semibold text-brand hover:underline">
      {no}
    </Link>
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
