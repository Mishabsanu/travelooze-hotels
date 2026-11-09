import { APP_NAME, LOGO_SRC } from "@/lib/brand";
import { MEAL_PLANS } from "@/lib/constants";
import { formatDate, formatDay, formatINR } from "@/lib/format";
import type { Booking } from "@/lib/hotelTypes";
import { buildInvoice, stateOfGstin } from "@/lib/invoice";
import { timeLabel } from "@/lib/stayTimes";

const th = "px-2 py-1.5 border border-slate-300 text-[10px] font-bold uppercase tracking-wider text-slate-600 bg-slate-50";
const td = "px-2 py-1.5 border border-slate-300 align-top";

/** A4 GST tax invoice. Rendered on the server; the same markup is printed and turned into the PDF. */
export function InvoiceSheet({ b }: { b: Booking }) {
  const inv = buildInvoice(b);
  const h = b.hotel;
  const state = stateOfGstin(h?.gstin);
  const toAgent = b.billTo === "agent" && b.agent;
  const proforma = !b.invoiceNo;

  return (
    <div className="print-sheet bg-white w-full max-w-[820px] mx-auto border border-slate-200 shadow-xs p-6 sm:p-8 text-[11px] text-slate-800">
      <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b-2 border-brand">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={LOGO_SRC} alt={APP_NAME} className="h-14 w-auto" />
        <div className="text-right">
          <p className="text-base font-black text-slate-900">{h?.name}</p>
          {h?.address && <p className="max-w-[320px] ml-auto">{h.address}</p>}
          {h?.phone && <p>Phone: {h.phone}</p>}
          {h?.gstin && <p className="font-semibold">GSTIN: {h.gstin}</p>}
        </div>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3 py-3">
        <h1 className="text-lg font-black tracking-wide text-brand">{proforma ? "PROFORMA INVOICE" : "TAX INVOICE"}</h1>
        <div className="text-right leading-5">
          <p>
            Invoice No: <b>{b.invoiceNo ?? "— (not issued)"}</b>
          </p>
          <p>
            Invoice Date: <b>{b.invoiceDate ? formatDate(b.invoiceDate) : formatDate(new Date())}</b>
          </p>
          <p>
            Booking: <b>{b.bookingNo}</b>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        <div className="border border-slate-300 rounded p-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Bill To</p>
          {toAgent ? (
            <>
              <p className="font-bold text-slate-900">{b.agent!.name}</p>
              {b.agent!.gstin && <p>GSTIN: {b.agent!.gstin}</p>}
              <p className="text-slate-500">Guest: {b.guest.name}</p>
            </>
          ) : (
            <>
              <p className="font-bold text-slate-900">{b.guest.name}</p>
              <p>{b.guest.phone}</p>
              {b.guest.address && <p>{b.guest.address}</p>}
            </>
          )}
        </div>
        <div className="border border-slate-300 rounded p-3 leading-5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Stay</p>
          <p>
            {formatDay(b.checkIn)} {timeLabel(b.arrivalTime)} → {formatDay(b.checkOut)} {timeLabel(b.departureTime)} ({b.nights} night{b.nights > 1 ? "s" : ""})
          </p>
          <p>
            {b.rooms.length} room(s) · {b.adults} adult(s){b.children ? `, ${b.children} child(ren)` : ""} · {MEAL_PLANS[b.mealPlan]?.label}
          </p>
          <p>Place of supply: {state ?? "Hotel location"}</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse min-w-[620px]">
          <thead>
            <tr>
              <th className={`${th} text-left w-8`}>#</th>
              <th className={`${th} text-left`}>Description</th>
              <th className={`${th} text-left`}>SAC</th>
              <th className={`${th} text-right`}>Qty</th>
              <th className={`${th} text-right`}>Rate</th>
              <th className={`${th} text-right`}>Taxable</th>
              <th className={`${th} text-right`}>GST</th>
              <th className={`${th} text-right`}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {inv.lines.map((l, i) => (
              <tr key={i}>
                <td className={td}>{i + 1}</td>
                <td className={td}>{l.description}</td>
                <td className={`${td} font-mono`}>{l.sac}</td>
                <td className={`${td} text-right`}>{l.qty}</td>
                <td className={`${td} text-right tabular-nums`}>{formatINR(l.rate)}</td>
                <td className={`${td} text-right tabular-nums`}>{formatINR(l.taxable)}</td>
                <td className={`${td} text-right`}>{l.gstPercent}%</td>
                <td className={`${td} text-right tabular-nums font-semibold`}>{formatINR(l.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
        <table className="w-full border-collapse self-start">
          <thead>
            <tr>
              <th className={`${th} text-left`}>GST %</th>
              <th className={`${th} text-right`}>Taxable</th>
              <th className={`${th} text-right`}>CGST</th>
              <th className={`${th} text-right`}>SGST</th>
            </tr>
          </thead>
          <tbody>
            {inv.byRate.map((r) => (
              <tr key={r.rate}>
                <td className={td}>{r.rate}%</td>
                <td className={`${td} text-right tabular-nums`}>{formatINR(r.taxable)}</td>
                <td className={`${td} text-right tabular-nums`}>{formatINR(r.cgst)}</td>
                <td className={`${td} text-right tabular-nums`}>{formatINR(r.sgst)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <table className="w-full border-collapse self-start">
          <tbody>
            {[
              ["Taxable value", inv.taxable],
              ["CGST", inv.cgst],
              ["SGST", inv.sgst],
            ].map(([k, v]) => (
              <tr key={k as string}>
                <td className={td}>{k}</td>
                <td className={`${td} text-right tabular-nums`}>{formatINR(v as number)}</td>
              </tr>
            ))}
            <tr className="bg-brand-light">
              <td className={`${td} font-black`}>Invoice Total</td>
              <td className={`${td} text-right tabular-nums font-black text-sm`}>{formatINR(inv.total)}</td>
            </tr>
            <tr>
              <td className={td}>Paid</td>
              <td className={`${td} text-right tabular-nums`}>{formatINR(inv.paid)}</td>
            </tr>
            <tr>
              <td className={`${td} font-bold`}>Balance</td>
              <td className={`${td} text-right tabular-nums font-bold`}>{formatINR(Math.max(0, inv.balance))}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p className="mt-3">
        <span className="text-slate-500">Amount in words:</span> <b>{inv.words}</b>
      </p>
      {toAgent && b.extrasTotal > 0 && <p className="mt-1 text-slate-500">Extra charges (food, laundry, …) are payable by the guest at the hotel.</p>}

      <div className="flex flex-wrap justify-between items-end gap-6 mt-10">
        <p className="text-[10px] text-slate-500 max-w-[420px]">
          This is a computer-generated invoice. Tax on accommodation and services as per GST rules. Thank you for staying with us.
        </p>
        <div className="text-center">
          <div className="w-48 border-t border-slate-400 pt-1 font-semibold">Authorised Signatory</div>
          <p className="text-[10px] text-slate-500">for {h?.name}</p>
        </div>
      </div>
    </div>
  );
}
