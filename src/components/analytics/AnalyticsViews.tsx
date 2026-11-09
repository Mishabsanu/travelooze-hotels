"use client";

import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { useListParams } from "@/hooks/useListParams";
import { formatINR } from "@/lib/format";
import type { Analytics, Breakdown, GroupBy } from "@/server/services/analytics.service";
import { PRESETS } from "./analyticsConfig";
import { ChartCard, ColumnChart, compactINR, LineChart } from "./charts";

/** Validated pair (dataviz validator: CVD ΔE 29, normal ΔE 36, contrast ≥ 3:1 on white) */
const BRAND = "#5439a3";
const AGENT = "#eb6834";

const GROUPS: { value: GroupBy; label: string }[] = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "year", label: "Year" },
];

const M = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function bucketLabel(key: string, g: GroupBy): string {
  const [y, m, d] = key.split("-").map(Number);
  if (g === "year") return String(y);
  if (g === "month") return `${M[m - 1]} ${String(y).slice(2)}`;
  return `${d} ${M[m - 1]}`;
}

/** One row of filters above everything they scope. */
export function AnalyticsFilters({ preset, groupBy, from, to }: { preset: string; groupBy: GroupBy; from: string; to: string }) {
  const { update, isPending } = useListParams();
  return (
    <div className={`w-full bg-white border border-line flex flex-wrap items-stretch text-xs ${isPending ? "opacity-60" : ""}`}>
      <select value={preset} onChange={(e) => update({ period: e.target.value === "30d" ? undefined : e.target.value, by: undefined })} aria-label="Period" className="h-9 border-r border-line px-3 bg-white outline-none cursor-pointer min-w-[160px] font-semibold">
        {PRESETS.map((p) => (
          <option key={p.value} value={p.value}>
            {p.label}
          </option>
        ))}
      </select>
      {preset === "custom" && (
        <>
          <input type="date" value={from} max={to} onChange={(e) => update({ from: e.target.value })} aria-label="From" className="h-9 border-r border-line px-3 outline-none" />
          <input type="date" value={to} min={from} onChange={(e) => update({ to: e.target.value })} aria-label="To" className="h-9 border-r border-line px-3 outline-none" />
        </>
      )}
      <div className="flex border-r border-line" role="group" aria-label="Group by">
        {GROUPS.map((g) => (
          <button key={g.value} type="button" onClick={() => update({ by: g.value })} className={`h-9 px-3 font-semibold ${groupBy === g.value ? "bg-brand text-white" : "text-slate-600 hover:bg-head"}`}>
            {g.label}
          </button>
        ))}
      </div>
      <span className="flex items-center px-3 text-slate-500">
        {from} → {to}
      </span>
    </div>
  );
}

function Delta({ now, before, invert = false }: { now: number; before: number; invert?: boolean }) {
  if (!before && !now) return <span className="text-[11px] text-slate-400">no data</span>;
  if (!before) return <span className="text-[11px] text-slate-400">new vs previous</span>;
  const pct = ((now - before) / Math.abs(before)) * 100;
  const flat = Math.abs(pct) < 0.5;
  const good = invert ? pct < 0 : pct > 0;
  const Icon = flat ? Minus : pct > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-semibold ${flat ? "text-slate-500" : good ? "text-[#006300]" : "text-rose-700"}`}>
      <Icon className="w-3.5 h-3.5" />
      {flat ? "0%" : `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`}
      <span className="font-normal text-slate-400 ml-1">vs previous</span>
    </span>
  );
}

function Kpi({ label, value, now, before, hint }: { label: string; value: string; now: number; before: number; hint?: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{label}</p>
      <p className="text-xl font-black text-slate-900 mt-1">{value}</p>
      <Delta now={now} before={before} />
      {hint && <p className="text-[10.5px] text-slate-400 mt-0.5">{hint}</p>}
    </div>
  );
}

const pct = (a: number, b: number) => (b ? (a / b) * 100 : 0);

export function KpiRow({ a }: { a: Analytics }) {
  const t = a.totals;
  const p = a.previous;
  const occ = pct(t.nights, t.available);
  const pocc = pct(p.nights, p.available);
  const adr = t.nights ? t.roomRevenue / t.nights : 0;
  const padr = p.nights ? p.roomRevenue / p.nights : 0;
  const revpar = t.available ? t.roomRevenue / t.available : 0;
  const prevpar = p.available ? p.roomRevenue / p.available : 0;
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 2xl:grid-cols-8 gap-3">
      <Kpi label="Revenue (excl. GST)" value={formatINR(t.revenue)} now={t.revenue} before={p.revenue} hint={`Rooms ${compactINR(t.roomRevenue)} · extras ${compactINR(t.extras)}`} />
      <Kpi label="Occupancy" value={`${occ.toFixed(1)}%`} now={occ} before={pocc} hint={`${t.nights} of ${t.available} room nights`} />
      <Kpi label="ADR" value={formatINR(Math.round(adr))} now={adr} before={padr} hint="Average rate per sold room night" />
      <Kpi label="RevPAR" value={formatINR(Math.round(revpar))} now={revpar} before={prevpar} hint="Room revenue per available room night" />
      <Kpi label="Room nights sold" value={t.nights.toLocaleString("en-IN")} now={t.nights} before={p.nights} />
      <Kpi label="Bookings made" value={t.bookings.toLocaleString("en-IN")} now={t.bookings} before={p.bookings} hint={t.cancelled ? `${t.cancelled} cancelled / no-show` : undefined} />
      <Kpi label="Collected" value={formatINR(t.collected)} now={t.collected} before={p.collected} hint="Payments received" />
      <Kpi label="Extras" value={formatINR(t.extras)} now={t.extras} before={p.extras} hint="Food, laundry, … excl. GST" />
    </div>
  );
}

export function TrendCharts({ a }: { a: Analytics }) {
  const labels = a.buckets.map((b) => bucketLabel(b.key, a.groupBy));
  const rev = [
    { key: "walkin", label: "Walk-in", color: BRAND, values: a.buckets.map((b) => b.walkin) },
    { key: "agent", label: "B2B agents", color: AGENT, values: a.buckets.map((b) => b.agent) },
  ];
  const occ = a.buckets.map((b) => (b.available ? Math.round((b.nights / b.available) * 1000) / 10 : 0));
  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <div className="xl:col-span-2">
        <ChartCard
          title="Room revenue by period"
          subtitle="Excl. GST, counted on the nights guests stay"
          legend={rev}
          table={{ head: ["Period", "Walk-in", "B2B agents", "Total"], rows: a.buckets.map((b, i) => [labels[i], formatINR(b.walkin), formatINR(b.agent), formatINR(b.walkin + b.agent)]) }}
        >
          <ColumnChart labels={labels} series={rev} format={compactINR} height={240} />
        </ChartCard>
      </div>
      <ChartCard title="Occupancy %" subtitle="Room nights sold ÷ sellable room nights" table={{ head: ["Period", "Occupancy", "Sold", "Available"], rows: a.buckets.map((b, i) => [labels[i], `${occ[i]}%`, b.nights, b.available]) }}>
        <LineChart labels={labels} values={occ} color={BRAND} max={100} format={(n) => `${n}%`} label="Occupancy" />
      </ChartCard>
      <ChartCard title="Bookings made" subtitle="New bookings created in each period" table={{ head: ["Period", "Bookings", "Collected"], rows: a.buckets.map((b, i) => [labels[i], b.bookings, formatINR(b.collected)]) }}>
        <ColumnChart labels={labels} series={[{ key: "bookings", label: "Bookings", color: BRAND, values: a.buckets.map((b) => b.bookings) }]} format={(n) => String(Math.round(n))} />
      </ChartCard>
    </div>
  );
}

/** "What sells best": ranked horizontal bars (one hue) beside their figures. */
export function RankedCard({ title, subtitle, rows, empty = "No stays in this period" }: { title: string; subtitle?: string; rows: Breakdown[]; empty?: string }) {
  const total = rows.reduce((s, r) => s + r.revenue, 0);
  const max = Math.max(...rows.map((r) => r.revenue), 1);
  return (
    <div className="bg-white border border-line">
      <div className="px-3 py-2 border-b border-line">
        <h2 className="text-[11px] font-bold text-brand uppercase tracking-wider">{title}</h2>
        {subtitle && <p className="text-[10.5px] text-slate-400">{subtitle}</p>}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse min-w-[460px]">
          <thead>
            <tr className="border-b border-line bg-head text-[10.5px] font-bold text-slate-600 uppercase tracking-wider">
              <th className="px-3 py-2 text-left">Name</th>
              <th className="px-3 py-2 text-left w-[34%]">Revenue</th>
              <th className="px-3 py-2 text-right">Nights</th>
              <th className="px-3 py-2 text-right">ADR</th>
              <th className="px-3 py-2 text-right">Share</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.key} className="hover:bg-head">
                <td className="px-3 py-2 font-semibold text-slate-800">{r.name}</td>
                <td className="px-3 py-2">
                  <span className="flex items-center gap-2" title={formatINR(r.revenue)}>
                    <span className="h-2.5 rounded-r" style={{ width: `${Math.max(2, (r.revenue / max) * 100)}%`, maxWidth: "70%", background: BRAND }} />
                    <span className="tabular-nums text-slate-700 whitespace-nowrap">{compactINR(r.revenue)}</span>
                  </span>
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{r.nights}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatINR(Math.round(r.nights ? r.revenue / r.nights : 0))}</td>
                <td className="px-3 py-2 text-right tabular-nums">{total ? ((r.revenue / total) * 100).toFixed(1) : "0"}%</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-slate-400">
                  {empty}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
