import Link from "next/link";
import { AccessDenied } from "@/components/ui/AccessDenied";
import { PageHeader } from "@/components/ui/PageHeader";
import { formatINR, formatNumber, toDayString } from "@/lib/format";
import { can } from "@/lib/permissions";
import { getPageAccess } from "@/server/auth/session";
import { getReport } from "@/server/services/report.service";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;
const th = "px-3 py-2 border-r border-line last:border-r-0 whitespace-nowrap";
const td = "px-3 py-2 border-r border-line last:border-r-0 whitespace-nowrap tabular-nums";

export async function ReportPage({ searchParams }: { searchParams: SearchParams }) {
  const { user, allowed } = await getPageAccess("report", "view");
  if (!allowed) return <AccessDenied />;
  const sp = await searchParams;
  const r = await getReport(user, first(sp.from), first(sp.to), can(user, "agent", "view") || user.allHotels);
  const money = ["roomCharges", "discount", "gst", "total", "collected", "walkin", "agent"] as const;

  return (
    <>
      <PageHeader title="Revenue & Agent Outstanding" description="Bookings by arrival date (cancelled excluded), and every agent's balance" />

      <form className="w-full bg-white border border-line flex items-stretch h-9 text-xs">
        <label className="flex items-center gap-2 px-3 border-r border-line text-slate-500">
          From
          <input type="date" name="from" defaultValue={toDayString(r.from)} className="outline-none text-slate-800" />
        </label>
        <label className="flex items-center gap-2 px-3 border-r border-line text-slate-500">
          To
          <input type="date" name="to" defaultValue={toDayString(r.to)} className="outline-none text-slate-800" />
        </label>
        <button className="px-4 font-bold text-brand hover:bg-brand-light">Apply</button>
      </form>

      <div className="bg-white border border-line overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b border-line bg-head text-[11px] font-bold text-slate-600 uppercase tracking-wider">
              <th className={`${th} text-left`}>Hotel</th>
              <th className={`${th} text-right`}>Bookings</th>
              <th className={`${th} text-right`}>Room Nights</th>
              <th className={`${th} text-right`}>Room Charges</th>
              <th className={`${th} text-right`}>Discount</th>
              <th className={`${th} text-right`}>GST</th>
              <th className={`${th} text-right`}>Total</th>
              <th className={`${th} text-right`}>Collected</th>
              <th className={`${th} text-right`}>Walk-in</th>
              <th className={`${th} text-right`}>Agent</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {r.rows.map((row) => (
              <tr key={row._id} className="hover:bg-head">
                <td className={`${td} font-semibold`}>{row.name}</td>
                <td className={`${td} text-right`}>{formatNumber(row.bookings)}</td>
                <td className={`${td} text-right`}>{formatNumber(row.roomNights)}</td>
                {money.map((k) => (
                  <td key={k} className={`${td} text-right`}>
                    {formatINR(row[k])}
                  </td>
                ))}
              </tr>
            ))}
            {r.rows.length === 0 && (
              <tr>
                <td colSpan={10} className="px-6 py-10 text-center text-slate-400">
                  No bookings in this period
                </td>
              </tr>
            )}
          </tbody>
          {r.rows.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-line bg-head font-bold">
                <td className={td}>Total</td>
                <td className={`${td} text-right`}>{formatNumber(r.totals.bookings)}</td>
                <td className={`${td} text-right`}>{formatNumber(r.totals.roomNights)}</td>
                {money.map((k) => (
                  <td key={k} className={`${td} text-right`}>
                    {formatINR(r.totals[k])}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {r.agents.length > 0 && (
        <div className="bg-white border border-line overflow-x-auto">
          <div className="px-3 py-2 border-b border-line text-[11px] font-bold text-brand uppercase tracking-wider">Agent Outstanding (all time)</div>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-line bg-head text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                <th className={`${th} text-left`}>Code</th>
                <th className={`${th} text-left`}>Agent</th>
                <th className={`${th} text-right`}>Bookings</th>
                <th className={`${th} text-right`}>Billed</th>
                <th className={`${th} text-right`}>Received</th>
                <th className={`${th} text-right`}>Outstanding</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {r.agents.map((a) => (
                <tr key={a._id} className="hover:bg-head">
                  <td className={`${td} font-mono`}>{a.code}</td>
                  <td className={td}>
                    {can(user, "agent", "view") ? (
                      <Link href={`/dashboard/sales/agents/${a._id}`} className="text-brand font-semibold hover:underline">
                        {a.name}
                      </Link>
                    ) : (
                      a.name
                    )}
                  </td>
                  <td className={`${td} text-right`}>{a.count}</td>
                  <td className={`${td} text-right`}>{formatINR(a.billed)}</td>
                  <td className={`${td} text-right`}>{formatINR(a.paid)}</td>
                  <td className={`${td} text-right font-semibold ${a.due > 0 ? "text-amber-700" : ""}`}>
                    {formatINR(a.due)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
