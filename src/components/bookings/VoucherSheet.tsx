import { APP_NAME, LOGO_SRC } from "@/lib/brand";
import { BOOKING_STATUS, MEAL_PLANS } from "@/lib/constants";
import { formatDateTime, formatDay, formatINR, paxLabel } from "@/lib/format";
import type { Booking } from "@/lib/hotelTypes";
import { timeLabel } from "@/lib/stayTimes";

const th = "px-2 py-1.5 border border-slate-300 text-[10px] font-bold uppercase tracking-wider text-slate-600 bg-slate-50 text-left";
const td = "px-2 py-1.5 border border-slate-300 align-top";
const box = "border border-slate-300 rounded p-3";
const label = "text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1";

/** A4 booking voucher (confirmation for the guest / agent). Same markup on screen, in print and in the PDF. */
export function VoucherSheet({ b, showAmounts }: { b: Booking; showAmounts: boolean }) {
  const h = b.hotel;
  const names = b.rooms.flatMap((r) => r.guests.filter((g) => g.name.trim()).map((g) => ({ room: r.roomNumber, name: g.name, type: g.type })));
  const cancelled = b.status === "cancelled" || b.status === "no_show";

  return (
    <div className="print-sheet bg-white w-full max-w-[820px] mx-auto border border-slate-200 shadow-xs p-6 sm:p-8 text-[11px] text-slate-800">
      <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b-2 border-brand">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={LOGO_SRC} alt={APP_NAME} className="h-14 w-auto" />
        <div className="text-right">
          <p className="text-base font-black text-slate-900">{h?.name}</p>
          {h?.address && <p className="max-w-[320px] ml-auto">{h.address}</p>}
          {h?.phone && <p>Phone: {h.phone}</p>}
        </div>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3 py-3">
        <div>
          <h1 className="text-lg font-black tracking-wide text-brand">BOOKING VOUCHER</h1>
          <p className={`mt-0.5 inline-block rounded px-2 py-0.5 text-[10px] font-bold uppercase ${cancelled ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}>
            {cancelled ? BOOKING_STATUS[b.status] : "Confirmed"}
          </p>
        </div>
        <div className="text-right leading-5">
          <p>
            Voucher / Booking No: <b className="font-mono text-[12px]">{b.bookingNo}</b>
          </p>
          {b.agentRef && (
            <p>
              Agent Ref: <b>{b.agentRef}</b>
            </p>
          )}
          <p>
            Booked on: <b>{formatDateTime(b.createdAt)}</b>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <div className={box}>
          <p className={label}>Guest</p>
          <p className="text-[13px] font-bold text-slate-900">{b.guest.name}</p>
          {b.guest.phone && <p>{b.guest.phone}</p>}
          {b.agent && (
            <p className="mt-1 text-slate-600">
              Booked through <b>{b.agent.name}</b>
            </p>
          )}
        </div>
        <div className={box}>
          <p className={label}>Stay</p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-slate-500">Check-in</p>
              <p className="text-[13px] font-bold text-slate-900">{formatDay(b.checkIn)}</p>
              <p>from {timeLabel(h?.checkInTime || "12:00")}</p>
            </div>
            <div>
              <p className="text-slate-500">Check-out</p>
              <p className="text-[13px] font-bold text-slate-900">{formatDay(b.checkOut)}</p>
              <p>by {timeLabel(h?.checkOutTime || "11:00")}</p>
            </div>
          </div>
          <p className="mt-1.5">
            <b>{b.nights}</b> night{b.nights === 1 ? "" : "s"} · <b>{b.rooms.length}</b> room{b.rooms.length === 1 ? "" : "s"} · {paxLabel(b.adults, b.children)}
            {b.focPax ? ` (incl. ${b.focPax} complimentary)` : ""}
          </p>
          <p>
            Meal plan: <b>{MEAL_PLANS[b.mealPlan]?.label}</b>
          </p>
        </div>
      </div>

      <table className="w-full border-collapse mb-3">
        <thead>
          <tr>
            <th className={th}>Room</th>
            <th className={th}>Room Type</th>
            <th className={th}>Guests</th>
            <th className={th}>Extra Bed</th>
          </tr>
        </thead>
        <tbody>
          {b.rooms.map((r) => (
            <tr key={r.room}>
              <td className={`${td} font-mono font-bold`}>{r.roomNumber}</td>
              <td className={td}>{r.roomTypeName}</td>
              <td className={td}>
                {paxLabel(r.adults, r.children)}
                {r.guests.some((g) => g.name.trim()) && (
                  <span className="block text-slate-500">
                    {r.guests
                      .filter((g) => g.name.trim())
                      .map((g) => g.name)
                      .join(", ")}
                  </span>
                )}
              </td>
              <td className={td}>{r.extraBeds ? `${r.extraBeds}` : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {names.length === 0 && <p className="mb-3 text-slate-500">Guest names can be given at check-in.</p>}

      {showAmounts && (
        <div className="mb-3 ml-auto w-full max-w-[300px] border border-slate-300 rounded p-3 leading-6">
          <div className="flex justify-between">
            <span>Total (incl. GST)</span>
            <b>{formatINR(b.grandTotal)}</b>
          </div>
          <div className="flex justify-between">
            <span>Paid</span>
            <b>{formatINR(b.paid)}</b>
          </div>
          <div className="flex justify-between border-t border-slate-300 pt-1">
            <span className="font-bold">Balance</span>
            <b className={b.balance > 0 ? "text-rose-600" : "text-emerald-700"}>{formatINR(b.balance)}</b>
          </div>
          {b.billTo === "agent" && <p className="text-[10px] text-slate-500">Room charges are billed to the agent.</p>}
        </div>
      )}

      <div className="border-t border-slate-200 pt-3 text-[10.5px] text-slate-600 space-y-1">
        <p className="font-bold text-slate-700">Please note</p>
        <ul className="list-disc pl-4 space-y-0.5">
          <li>
            Check-in from {timeLabel(h?.checkInTime || "12:00")}, check-out by {timeLabel(h?.checkOutTime || "11:00")}. Early check-in / late check-out subject to availability.
          </li>
          <li>Every adult guest must show a valid photo ID (Aadhaar, passport, driving licence or voter ID) at check-in.</li>
          <li>Please show this voucher (printed or on phone) at the front desk.</li>
        </ul>
        <p className="pt-2 text-slate-400">
          Issued by {APP_NAME} · {h?.name}
        </p>
      </div>
    </div>
  );
}
