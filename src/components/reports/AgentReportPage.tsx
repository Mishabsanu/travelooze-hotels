import Link from "next/link";
import { AccessDenied } from "@/components/ui/AccessDenied";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import { BOOKING_STATUS, type BookingStatus } from "@/lib/constants";
import { formatDay, formatINR, formatNumber } from "@/lib/format";
import { getPageAccess } from "@/server/auth/session";
import { getAgentReport, type GroupBy } from "@/server/services/agentReport.service";
import { BOOKING_BASE } from "@/components/bookings/bookingConfig";
import { CsvButton } from "./CsvButton";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;
const th = "px-3 py-2 border-r border-line last:border-r-0 whitespace-nowrap";
const td = "px-3 py-2 border-r border-line last:border-r-0 whitespace-nowrap tabular-nums";
const BASE = "/dashboard/reports/agents";

const PRESETS = [
  { v: "today", l: "Today" },
  { v: "week", l: "This Week" },
  { v: "month", l: "This Month" },
  { v: "year", l: "This Year" },
  { v: "custom", l: "Custom" },
];
const GROUPS: { v: GroupBy; l: string }[] = [
  { v: "day", l: "Daily" },
  { v: "week", l: "Weekly" },
  { v: "month", l: "Monthly" },
  { v: "year", l: "Yearly" },
];
const STATUS_VARIANT: Record<BookingStatus, BadgeVariant> = { confirmed: "info", checked_in: "success", checked_out: "neutral", cancelled: "danger", no_show: "warning" };

/** "2026-W46" → "Week 46, 2026"; "2026-11" → "Nov 2026"; "2026-11-10" → "10 Nov 2026" */
function periodLabel(p: string, g: GroupBy) {
  if (g === "week") {
    const [y, w] = p.split("-W");
    return `Week ${Number(w)}, ${y}`;
  }
  if (g === "month") return new Date(`${p}-01T00:00:00Z`).toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
  if (g === "day") return formatDay(p);
  return p;
}

export async function AgentReportPage({ searchParams }: { searchParams: SearchParams }) {
  const { user, allowed } = await getPageAccess("report", "view");
  if (!allowed) return <AccessDenied />;
  const sp = await searchParams;
  const r = await getAgentReport(user, { preset: first(sp.preset), from: first(sp.from), to: first(sp.to), agent: first(sp.agent), groupBy: first(sp.groupBy) });
  const link = (patch: Record<string, string>) => {
    const p = new URLSearchParams({ preset: r.preset, groupBy: r.groupBy, ...(r.agent ? { agent: r.agent } : {}), ...(r.preset === "custom" ? { from: r.from, to: r.to } : {}), ...patch });
    return `${BASE}?${p}`;
  };
  const agentName = r.agentOptions.find((a) => a.value === r.agent)?.label ?? "All Agents";
  const stamp = `${r.from}_to_${r.to}`;

  const tile = "rounded-lg border border-slate-200 bg-white p-3";
  return (
    <>
      <PageHeader
        title="Agent Report"
        description={`${agentName} · bookings arriving ${formatDay(r.from)} – ${formatDay(r.to)} (by check-in date)`}
        actions={
          <CsvButton
            fileName={`agent-bookings_${stamp}.csv`}
            header={["Booking", "Agent", "Agent Ref", "Hotel", "Guest", "Check-in", "Check-out", "Nights", "Rooms", "Pax", "Plan", "Status", "Total", "Paid", "Balance"]}
            rows={r.bookings.map((b) => [b.bookingNo, b.agent, b.agentRef, b.hotel, b.guest, b.checkIn, b.checkOut, b.nights, b.rooms, b.pax, b.mealPlan, BOOKING_STATUS[b.status as BookingStatus] ?? b.status, b.total, b.paid, b.balance])}
            label="Download Bookings (CSV)"
          />
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex flex-wrap rounded-lg border border-slate-300 bg-white p-0.5">
          {PRESETS.map((p) => (
            <Link
              key={p.v}
              href={link({ preset: p.v, groupBy: p.v === "year" ? "month" : p.v === "custom" ? r.groupBy : "day" })}
              className={`h-8 rounded-md px-3 text-xs font-bold leading-8 ${r.preset === p.v ? "bg-brand text-white" : "text-slate-600 hover:text-brand"}`}
            >
              {p.l}
            </Link>
          ))}
        </div>
        <div className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5">
          {GROUPS.map((g) => (
            <Link key={g.v} href={link({ groupBy: g.v })} className={`h-8 rounded-md px-3 text-xs font-bold leading-8 ${r.groupBy === g.v ? "bg-slate-800 text-white" : "text-slate-600 hover:text-brand"}`}>
              {g.l}
            </Link>
          ))}
        </div>
        <form action={BASE} className="flex flex-wrap items-center gap-2 text-xs">
          <input type="hidden" name="groupBy" value={r.groupBy} />
          <select name="agent" defaultValue={r.agent} className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-slate-800">
            <option value="">All Agents</option>
            {r.agentOptions.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
          <input type="hidden" name="preset" value="custom" />
          <input type="date" name="from" defaultValue={r.from} className="h-9 rounded-lg border border-slate-300 bg-white px-2" aria-label="From" />
          <span className="text-slate-400">to</span>
          <input type="date" name="to" defaultValue={r.to} className="h-9 rounded-lg border border-slate-300 bg-white px-2" aria-label="To" />
          <button className="h-9 rounded-lg bg-brand px-4 font-bold text-white hover:bg-brand-dark">Apply</button>
        </form>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-6">
        {[
          ["Bookings", formatNumber(r.totals.bookings), r.totals.cancelled ? `${r.totals.cancelled} cancelled` : ""],
          ["Room Nights", formatNumber(r.totals.roomNights), ""],
          ["Guests (Pax)", formatNumber(r.totals.pax), ""],
          ["Business", formatINR(r.totals.total), "incl. GST & extras"],
          ["Received", formatINR(r.totals.paid), ""],
          ["Due", formatINR(r.totals.due), ""],
        ].map(([k, v, s]) => (
          <div key={k} className={tile}>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{k}</p>
            <p className={`mt-1 text-lg font-black tabular-nums ${k === "Due" && r.totals.due > 0 ? "text-rose-600" : "text-slate-900"}`}>{v}</p>
            {s && <p className="text-[10.5px] text-slate-400">{s}</p>}
          </div>
        ))}
      </div>

      {/* Per agent */}
      <section className="overflow-x-auto border border-line bg-white">
        <h2 className="border-b border-line bg-head px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-brand">By Agent</h2>
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-line text-[11px] font-bold uppercase tracking-wider text-slate-600">
              <th className={`${th} text-left`}>Agent</th>
              <th className={`${th} text-right`}>Bookings</th>
              <th className={`${th} text-right`}>Cancelled</th>
              <th className={`${th} text-right`}>Room Nights</th>
              <th className={`${th} text-right`}>Pax</th>
              <th className={`${th} text-right`}>Business</th>
              <th className={`${th} text-right`}>Received</th>
              <th className={`${th} text-right`}>Due</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {r.summary.map((a) => (
              <tr key={a._id} className="hover:bg-head">
                <td className={`${td} font-semibold`}>
                  <Link href={link({ agent: a._id })} className="text-brand hover:underline">
                    {a.name}
                  </Link>
                  {a.code && <span className="ml-1.5 font-mono text-[10.5px] text-slate-400">{a.code}</span>}
                </td>
                <td className={`${td} text-right`}>{formatNumber(a.bookings)}</td>
                <td className={`${td} text-right text-slate-500`}>{a.cancelled || "—"}</td>
                <td className={`${td} text-right`}>{formatNumber(a.roomNights)}</td>
                <td className={`${td} text-right`}>{formatNumber(a.pax)}</td>
                <td className={`${td} text-right`}>{formatINR(a.total)}</td>
                <td className={`${td} text-right`}>{formatINR(a.paid)}</td>
                <td className={`${td} text-right font-semibold ${a.due > 0 ? "text-rose-600" : "text-slate-400"}`}>{formatINR(a.due)}</td>
              </tr>
            ))}
            {r.summary.length === 0 && (
              <tr>
                <td colSpan={8} className="px-6 py-10 text-center text-slate-400">
                  No agent bookings in this period
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {/* Trend */}
      <section className="overflow-x-auto border border-line bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-head px-3 py-1.5">
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-brand">{GROUPS.find((g) => g.v === r.groupBy)?.l} · {agentName}</h2>
          <CsvButton
            fileName={`agent-${r.groupBy}_${stamp}.csv`}
            header={["Period", "Bookings", "Room Nights", "Pax", "Business", "Received"]}
            rows={r.periods.map((p) => [periodLabel(p.period, r.groupBy), p.bookings, p.roomNights, p.pax, p.total, p.paid])}
            label="CSV"
          />
        </div>
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-line text-[11px] font-bold uppercase tracking-wider text-slate-600">
              <th className={`${th} text-left`}>{r.groupBy === "day" ? "Date" : r.groupBy === "week" ? "Week" : r.groupBy === "month" ? "Month" : "Year"}</th>
              <th className={`${th} text-right`}>Bookings</th>
              <th className={`${th} text-right`}>Room Nights</th>
              <th className={`${th} text-right`}>Pax</th>
              <th className={`${th} text-right`}>Business</th>
              <th className={`${th} text-right`}>Received</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {r.periods.map((p) => (
              <tr key={p.period} className="hover:bg-head">
                <td className={`${td} font-semibold`}>{periodLabel(p.period, r.groupBy)}</td>
                <td className={`${td} text-right`}>{formatNumber(p.bookings)}</td>
                <td className={`${td} text-right`}>{formatNumber(p.roomNights)}</td>
                <td className={`${td} text-right`}>{formatNumber(p.pax)}</td>
                <td className={`${td} text-right`}>{formatINR(p.total)}</td>
                <td className={`${td} text-right`}>{formatINR(p.paid)}</td>
              </tr>
            ))}
            {r.periods.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-slate-400">
                  Nothing to show
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {/* Bookings */}
      <section className="overflow-x-auto border border-line bg-white">
        <h2 className="border-b border-line bg-head px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-brand">
          All Bookings ({r.bookings.length}
          {r.bookings.length >= 1000 ? "+, first 1000 shown" : ""})
        </h2>
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-line text-[11px] font-bold uppercase tracking-wider text-slate-600">
              {["Booking", "Agent", "Guest", "Hotel", "Stay", "Rooms", "Pax", "Status", "Total", "Paid", "Balance"].map((h, i) => (
                <th key={h} className={`${th} ${i >= 5 && h !== "Status" ? "text-right" : "text-left"}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {r.bookings.map((b) => (
              <tr key={b._id} className="hover:bg-head">
                <td className={td}>
                  <Link href={`${BOOKING_BASE}/${b._id}`} className="font-mono text-brand hover:underline">
                    {b.bookingNo}
                  </Link>
                  {b.agentRef && <span className="block text-[10.5px] text-slate-400">Ref {b.agentRef}</span>}
                </td>
                <td className={td}>{b.agent}</td>
                <td className={`${td} font-semibold`}>{b.guest}</td>
                <td className={td}>{b.hotel}</td>
                <td className={td}>
                  {formatDay(b.checkIn)} → {formatDay(b.checkOut)}
                  <span className="block text-[10.5px] text-slate-400">
                    {b.nights} night{b.nights === 1 ? "" : "s"} · {b.mealPlan}
                  </span>
                </td>
                <td className={`${td} text-right`}>{b.rooms}</td>
                <td className={`${td} text-right`}>{b.pax}</td>
                <td className={td}>
                  <Badge variant={STATUS_VARIANT[b.status as BookingStatus] ?? "neutral"} dot>
                    {BOOKING_STATUS[b.status as BookingStatus] ?? b.status}
                  </Badge>
                </td>
                <td className={`${td} text-right`}>{formatINR(b.total)}</td>
                <td className={`${td} text-right`}>{formatINR(b.paid)}</td>
                <td className={`${td} text-right font-semibold ${b.balance > 0 ? "text-rose-600" : "text-slate-400"}`}>{formatINR(b.balance)}</td>
              </tr>
            ))}
            {r.bookings.length === 0 && (
              <tr>
                <td colSpan={11} className="px-6 py-10 text-center text-slate-400">
                  No agent bookings in this period
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </>
  );
}
