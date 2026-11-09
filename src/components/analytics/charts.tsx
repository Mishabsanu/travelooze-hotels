"use client";

/**
 * Small SVG chart kit (no chart library): column (single or stacked), line with area wash, and the
 * shared chart card with a table view. Mark specs follow the dataviz guide: bars <= 24px with 4px
 * rounded data-ends, 2px surface gaps, 2px lines, hairline grid, text in ink tokens (never series colour).
 */
import { useEffect, useRef, useState, type ReactNode } from "react";

export const INK = { primary: "#0f172a", secondary: "#475569", muted: "#94a3b8", grid: "#e5e7eb", axis: "#cbd5e1", surface: "#ffffff" };

export interface Series {
  key: string;
  label: string;
  color: string;
  values: number[];
}

/** ₹1,234 · ₹12.3K · ₹4.5L · ₹1.2Cr (Indian compact) */
export function compactINR(n: number): string {
  const a = Math.abs(n);
  const s = n < 0 ? "-" : "";
  if (a >= 1e7) return `${s}₹${trim(a / 1e7)}Cr`;
  if (a >= 1e5) return `${s}₹${trim(a / 1e5)}L`;
  if (a >= 1e4) return `${s}₹${trim(a / 1e3)}K`;
  return `${s}₹${Math.round(a).toLocaleString("en-IN")}`;
}
const trim = (n: number) => (n >= 100 ? Math.round(n).toString() : n.toFixed(1).replace(/\.0$/, ""));

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.floor(e.contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/** Clean axis ticks: 0 → a round max with 4–5 steps. */
function niceTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0, 1];
  const raw = max / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const top = Math.ceil(max / step) * step;
  return Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
}

/** Column with only the top corners rounded (4px), square at the baseline. */
function topRounded(x: number, y: number, w: number, h: number, r = 4) {
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
}

function Legend({ series, kind = "rect" }: { series: Pick<Series, "label" | "color">[]; kind?: "rect" | "line" }) {
  if (series.length < 2) return null;
  return (
    <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-600">
      {series.map((s) => (
        <span key={s.label} className="inline-flex items-center gap-1.5">
          {kind === "rect" ? <span className="w-2.5 h-2.5 rounded-sm" style={{ background: s.color }} /> : <span className="w-3 h-0.5 rounded" style={{ background: s.color }} />}
          {s.label}
        </span>
      ))}
    </div>
  );
}

function Tooltip({ x, y, width, title, rows }: { x: number; y: number; width: number; title: string; rows: { label: string; color?: string; value: string }[] }) {
  const left = Math.min(Math.max(x - 80, 0), Math.max(0, width - 170));
  return (
    <div className="pointer-events-none absolute z-10 w-[170px] rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-lg text-[11px]" style={{ left, top: Math.max(0, y - 8) }}>
      <p className="font-semibold text-slate-500 mb-1">{title}</p>
      {rows.map((r) => (
        <p key={r.label} className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-slate-500">
            {r.color && <span className="w-2.5 h-0.5 rounded" style={{ background: r.color }} />}
            {r.label}
          </span>
          <b className="text-slate-900 tabular-nums">{r.value}</b>
        </p>
      ))}
    </div>
  );
}

const PAD = { top: 12, right: 8, bottom: 26, left: 52 };

/** Columns per period; two or more series are stacked (2px surface gap between segments). */
export function ColumnChart({ labels, series, format, height = 220, totalLabel = "Total" }: { labels: string[]; series: Series[]; format: (n: number) => string; height?: number; totalLabel?: string }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const totals = labels.map((_, i) => series.reduce((s, x) => s + (x.values[i] || 0), 0));
  const ticks = niceTicks(Math.max(...totals, 0));
  const top = ticks[ticks.length - 1] || 1;
  const plotW = Math.max(0, width - PAD.left - PAD.right);
  const plotH = height - PAD.top - PAD.bottom;
  const band = labels.length ? plotW / labels.length : 0;
  const barW = Math.max(2, Math.min(24, band * 0.6));
  const y = (v: number) => PAD.top + plotH - (v / top) * plotH;
  const every = Math.max(1, Math.ceil(labels.length / Math.max(1, Math.floor(plotW / 64))));

  return (
    <div ref={ref} className="relative w-full" style={{ height }} onMouseLeave={() => setHover(null)}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={`${series.map((s) => s.label).join(", ")} by period`}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke={t === 0 ? INK.axis : INK.grid} strokeWidth={1} />
              <text x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={10} fill={INK.muted} className="tabular-nums">
                {format(t)}
              </text>
            </g>
          ))}
          {labels.map((label, i) => {
            const cx = PAD.left + band * i + band / 2;
            let acc = 0;
            const visible = series.filter((s) => (s.values[i] || 0) > 0);
            return (
              <g key={label + i} opacity={hover === null || hover === i ? 1 : 0.55}>
                {visible.map((s, si) => {
                  const v = s.values[i] || 0;
                  const y0 = y(acc);
                  acc += v;
                  const y1 = y(acc);
                  const gap = si > 0 ? 2 : 0; // surface gap between stacked segments
                  const h = Math.max(0, y0 - y1 - gap);
                  const isTop = si === visible.length - 1;
                  return isTop ? (
                    <path key={s.key} d={topRounded(cx - barW / 2, y1, barW, h)} fill={s.color} />
                  ) : (
                    <rect key={s.key} x={cx - barW / 2} y={y1} width={barW} height={h} fill={s.color} />
                  );
                })}
                {i % every === 0 && (
                  <text x={cx} y={height - 8} textAnchor="middle" fontSize={10} fill={INK.muted}>
                    {label}
                  </text>
                )}
                {/* hit target: the whole band, bigger than the mark */}
                <rect x={PAD.left + band * i} y={PAD.top} width={band} height={plotH} fill="transparent" onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} tabIndex={0} aria-label={`${label}: ${format(totals[i])}`} />
              </g>
            );
          })}
        </svg>
      )}
      {hover !== null && width > 0 && (
        <Tooltip
          x={PAD.left + band * hover + band / 2}
          y={y(totals[hover]) - 70}
          width={width}
          title={labels[hover]}
          rows={[
            ...(series.length > 1 ? [{ label: totalLabel, value: format(totals[hover]) }] : []),
            ...series.map((s) => ({ label: s.label, color: s.color, value: format(s.values[hover] || 0) })),
          ]}
        />
      )}
    </div>
  );
}

/** One series over time: 2px line, 10% area wash, crosshair + tooltip that snap to the nearest period. */
export function LineChart({ labels, values, color, format, max, height = 220, label }: { labels: string[]; values: number[]; color: string; format: (n: number) => string; max?: number; height?: number; label: string }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const ticks = niceTicks(max ?? Math.max(...values, 0));
  const top = max ?? (ticks[ticks.length - 1] || 1);
  const plotW = Math.max(0, width - PAD.left - PAD.right);
  const plotH = height - PAD.top - PAD.bottom;
  const step = labels.length > 1 ? plotW / (labels.length - 1) : 0;
  const x = (i: number) => PAD.left + (labels.length > 1 ? step * i : plotW / 2);
  const y = (v: number) => PAD.top + plotH - (Math.min(v, top) / top) * plotH;
  const pts = values.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  const every = Math.max(1, Math.ceil(labels.length / Math.max(1, Math.floor(plotW / 64))));
  const last = values.length - 1;

  return (
    <div
      ref={ref}
      className="relative w-full"
      style={{ height }}
      onMouseLeave={() => setHover(null)}
      onMouseMove={(e) => {
        if (!labels.length) return;
        const rx = e.clientX - e.currentTarget.getBoundingClientRect().left - PAD.left;
        setHover(Math.max(0, Math.min(labels.length - 1, Math.round(step ? rx / step : 0))));
      }}
    >
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={label}>
          {(max !== undefined ? [0, 25, 50, 75, 100].filter((t) => t <= top) : ticks).map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke={t === 0 ? INK.axis : INK.grid} strokeWidth={1} />
              <text x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={10} fill={INK.muted}>
                {format(t)}
              </text>
            </g>
          ))}
          {values.length > 1 && <polygon points={`${x(0)},${y(0)} ${pts} ${x(last)},${y(0)}`} fill={color} opacity={0.1} />}
          <polyline points={pts} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {labels.map((l, i) =>
            i % every === 0 ? (
              <text key={l + i} x={x(i)} y={height - 8} textAnchor="middle" fontSize={10} fill={INK.muted}>
                {l}
              </text>
            ) : null
          )}
          {last >= 0 && <circle cx={x(last)} cy={y(values[last])} r={4} fill={color} stroke={INK.surface} strokeWidth={2} />}
          {hover !== null && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + plotH} stroke={INK.axis} strokeWidth={1} />
              <circle cx={x(hover)} cy={y(values[hover])} r={4} fill={color} stroke={INK.surface} strokeWidth={2} />
            </g>
          )}
        </svg>
      )}
      {hover !== null && width > 0 && <Tooltip x={x(hover)} y={y(values[hover]) - 60} width={width} title={labels[hover]} rows={[{ label, color, value: format(values[hover]) }]} />}
    </div>
  );
}

/** Card around a chart: title, subtitle, legend and a Chart / Table toggle (the accessible twin). */
export function ChartCard({
  title,
  subtitle,
  legend,
  table,
  children,
}: {
  title: string;
  subtitle?: string;
  legend?: Pick<Series, "label" | "color">[];
  table: { head: string[]; rows: (string | number)[][] };
  children: ReactNode;
}) {
  const [asTable, setAsTable] = useState(false);
  return (
    <div className="bg-white border border-line">
      <div className="px-3 py-2 border-b border-line flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-[11px] font-bold text-brand uppercase tracking-wider">{title}</h2>
          {subtitle && <p className="text-[10.5px] text-slate-400">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-3">
          {legend && <Legend series={legend} />}
          <button type="button" onClick={() => setAsTable((v) => !v)} className="text-[11px] font-semibold text-slate-500 hover:text-brand">
            {asTable ? "Chart" : "Table"}
          </button>
        </div>
      </div>
      <div className="p-3">
        {asTable ? (
          <div className="max-h-[260px] overflow-auto">
            <table className="w-full text-xs border-collapse">
              <thead className="sticky top-0 bg-head">
                <tr>
                  {table.head.map((h, i) => (
                    <th key={h} className={`px-2 py-1.5 border-b border-line font-bold text-slate-600 ${i ? "text-right" : "text-left"}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {table.rows.map((r, i) => (
                  <tr key={i}>
                    {r.map((c, j) => (
                      <td key={j} className={`px-2 py-1.5 ${j ? "text-right tabular-nums" : ""}`}>
                        {c}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
