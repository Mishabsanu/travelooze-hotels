import { CalendarCheck, Download, Plus } from "lucide-react";
import Link from "next/link";
import { AccessDenied } from "@/components/ui/AccessDenied";
import { APP_NAME, LOGO_SRC } from "@/lib/brand";
import { isEarlyCheckIn, isLateCheckOut, timeLabel } from "@/lib/stayTimes";
import { Badge } from "@/components/ui/Badge";
import { DetailCard, DetailItem, DetailSection } from "@/components/ui/DetailCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { agentBookingsOnly, canBooking, canListBookings } from "@/lib/bookingAccess";
import { MEAL_PLANS, PAYMENT_MODES, gstRateFor } from "@/lib/constants";
import { formatDateTime, formatDay, formatINR, toDayString } from "@/lib/format";
import { can } from "@/lib/permissions";
import { requireUser } from "@/server/auth/session";
import { parseListQuery } from "@/server/http/query";
import { listAgentOptions } from "@/server/services/agent.service";
import { getBooking, listBookings } from "@/server/services/booking/booking.service";
import { listHotelOptions } from "@/server/services/hotel.service";
import { addDays, todayIST } from "@/server/services/stay";
import { orNotFound } from "@/server/utils/pageData";
import { BookingActions } from "./BookingActions";
import { BookingForm } from "./BookingForm";
import { BOOKING_BASE } from "./bookingConfig";
import { BookingListView, BookingStatusBadge, SourceBadge } from "./BookingListView";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
type IdParams = Promise<{ id: string }>;

const FILTERS = ["hotel", "source", "agent", "mealPlan", "stay", "date"];
const btnClass =
  "inline-flex items-center gap-1.5 bg-brand hover:bg-brand-dark text-white rounded-lg px-3.5 py-2 font-bold text-xs shadow-xs transition";
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;

export async function BookingListPage({ searchParams, agentOnly = false }: { searchParams: SearchParams; agentOnly?: boolean }) {
  const user = await requireUser();
  const allowed = agentOnly ? canBooking(user, "agent", "view") : canListBookings(user);
  if (!allowed) return <AccessDenied />;
  const onlyAgent = agentOnly || agentBookingsOnly(user);
  const [data, hotelOptions] = await Promise.all([
    listBookings(parseListQuery(await searchParams, FILTERS), user, onlyAgent ? "agent" : undefined),
    listHotelOptions(user),
  ]);
  const createSource = onlyAgent ? "agent" : "walkin";
  const createHref = onlyAgent ? "/dashboard/sales/agent-bookings/new" : `${BOOKING_BASE}/new`;
  return (
    <>
      <PageHeader
        title={onlyAgent ? "Agent Bookings" : "Bookings"}
        description={onlyAgent ? "B2B bookings made by the sales team for agents" : "Walk-in and agent bookings of your hotels"}
        actions={
          canBooking(user, createSource, "create") && (
            <Link href={createHref} className={btnClass}>
              <Plus className="w-4 h-4" />
              {onlyAgent ? "New Agent Booking" : "New Booking"}
            </Link>
          )
        }
      />
      <BookingListView data={data} hotelOptions={hotelOptions} agentOnly={onlyAgent} />
    </>
  );
}

export async function BookingCreatePage({ searchParams, source }: { searchParams: SearchParams; source: "walkin" | "agent" }) {
  const user = await requireUser();
  if (!canBooking(user, source, "create")) return <AccessDenied />;
  const sp = await searchParams;
  const today = todayIST();
  const [hotelOptions, agentOptions] = await Promise.all([listHotelOptions(user), source === "agent" ? listAgentOptions() : []]);
  // Prefill from the booking grid / room board: ?hotel=&room=&checkIn=&checkOut=
  const isDay = (v?: string) => Boolean(v && /^d{4}-d{2}-d{2}$/.test(v) && v >= toDayString(today));
  const ci = first(sp.checkIn);
  const co = first(sp.checkOut);
  const preset = {
    hotel: hotelOptions.find((o) => o.value === first(sp.hotel))?.value,
    room: first(sp.room),
    checkIn: isDay(ci) ? ci : undefined,
    checkOut: isDay(ci) && isDay(co) && co! > ci! ? co : undefined,
  };
  return (
    <BookingForm
      source={source}
      hotelOptions={hotelOptions}
      agentOptions={agentOptions}
      presetAgent={first(sp.agent)}
      preset={preset}
      canDiscount={can(user, "room_type", "update")}
      canPay={can(user, "payment", "create")}
      canUploadId={can(user, "guest_id", "create")}
      canCheckIn={can(user, "check_in_out", "update")}
      isSuperAdmin={user.isSuperAdmin}
      today={toDayString(today)}
      tomorrow={toDayString(addDays(today, 1))}
      backHref={source === "agent" ? "/dashboard/sales/agent-bookings" : BOOKING_BASE}
    />
  );
}

export async function BookingDetailPage({ params }: { params: IdParams }) {
  const user = await requireUser();
  if (!canListBookings(user)) return <AccessDenied />;
  const b = await orNotFound(getBooking((await params).id, user));
  const canSeeIds = can(user, "guest_id", "view");
  const discountRatio = b.roomCharges ? b.discount / b.roomCharges : 0;

  return (
    <div className="space-y-4">
      {/* Letterhead, only on paper / PDF */}
      <div className="hidden print:flex items-center justify-between border-b border-slate-300 pb-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={LOGO_SRC} alt={APP_NAME} className="h-14 w-auto" />
        <div className="text-right text-xs text-slate-600">
          <p className="font-bold text-slate-900">{b.hotel?.name}</p>
          {b.hotel?.address && <p>{b.hotel.address}</p>}
          {b.hotel?.phone && <p>{b.hotel.phone}</p>}
          {b.hotel?.gstin && <p>GSTIN {b.hotel.gstin}</p>}
        </div>
      </div>
      <BookingActions booking={b} today={toDayString(todayIST())} />
      <DetailCard
        title={b.bookingNo}
        subtitle={`${b.hotel?.name ?? ""} · booked ${formatDateTime(b.createdAt)} by ${b.createdBy?.name ?? "—"}`}
        badge={
          <>
            <BookingStatusBadge status={b.status} />
            <SourceBadge b={b} />
          </>
        }
        icon={<CalendarCheck className="w-4.5 h-4.5" />}
        backHref={b.source === "agent" && agentBookingsOnly(user) ? "/dashboard/sales/agent-bookings" : BOOKING_BASE}
      >
        <DetailSection title="Stay">
          <DetailItem label="Arrival" value={`${formatDay(b.checkIn)} · expected ${timeLabel(b.arrivalTime || b.hotel?.checkInTime || "12:00")}`} />
          <DetailItem label="Departure" value={`${formatDay(b.checkOut)} · expected ${timeLabel(b.departureTime || b.hotel?.checkOutTime || "11:00")}`} />
          <DetailItem
            label="Checked In At"
            value={
              b.checkedInAt ? (
                <span className="inline-flex flex-wrap items-center gap-1.5">
                  {formatDateTime(b.checkedInAt)}
                  {isEarlyCheckIn(b) && <Badge variant="warning">Early check-in</Badge>}
                </span>
              ) : (
                "Not yet"
              )
            }
          />
          <DetailItem
            label="Checked Out At"
            value={
              b.checkedOutAt ? (
                <span className="inline-flex flex-wrap items-center gap-1.5">
                  {formatDateTime(b.checkedOutAt)}
                  {isLateCheckOut(b) && <Badge variant="warning">Late check-out</Badge>}
                </span>
              ) : (
                "Not yet"
              )
            }
          />
          <DetailItem label="Hotel Times" value={`In ${timeLabel(b.hotel?.checkInTime || "12:00")} · Out ${timeLabel(b.hotel?.checkOutTime || "11:00")}`} />
          <DetailItem label="Nights / Guests" value={`${b.nights} night(s) · ${b.adults} adult(s)${b.children ? `, ${b.children} child` : ""}`} />
          <DetailItem label="Meal Plan" value={MEAL_PLANS[b.mealPlan].label} />
          {b.source === "agent" && <DetailItem label="Agent / Ref" value={`${b.agent?.name ?? "—"}${b.agentRef ? ` · ${b.agentRef}` : ""}`} />}
          {b.source === "agent" && <DetailItem label="Bill To" value={b.billTo === "agent" ? "Agent credit account" : "Guest"} />}
        </DetailSection>

        <DetailSection title="Guest">
          <DetailItem label="Name" value={b.guest.name} />
          <DetailItem label="Phone" value={b.guest.phone} />
          <DetailItem label="Aadhaar" value={b.guest.aadhaarLast4 ? `XXXX XXXX ${b.guest.aadhaarLast4}` : undefined} mono />
          <DetailItem label="Address" value={b.guest.address} />
          <DetailItem
            label="ID Proof"
            value={
              b.guest.idFiles.length === 0 ? (
                <span className="text-amber-700">Not uploaded{b.status === "confirmed" ? " — needed before check-in" : ""}</span>
              ) : canSeeIds ? (
                <span className="flex flex-wrap gap-2 no-print">
                  {b.guest.idFiles.map((f, i) => (
                    <a key={f} href={`/api/bookings/${b._id}/id-files/${i}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand hover:underline">
                      <Download className="w-3 h-3" /> File {i + 1}
                    </a>
                  ))}
                </span>
              ) : (
                `${b.guest.idFiles.length} file(s) on record`
              )
            }
          />
        </DetailSection>

        <section className="space-y-3">
          <h2 className="text-xs font-bold text-brand uppercase tracking-wider pb-1.5 border-b border-slate-100">Bill</h2>
          <div className="border border-line overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-line bg-head text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  {["Room", "Type", "Rate / Night", "Nights", "GST", "Amount"].map((h, i) => (
                    <th key={h} className={`px-3 py-2 border-r border-line last:border-r-0 ${i > 1 ? "text-right" : "text-left"}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {b.rooms.map((r) => (
                  <tr key={r.room}>
                    <td className="px-3 py-2 border-r border-line font-mono font-bold">{r.roomNumber}</td>
                    <td className="px-3 py-2 border-r border-line">{r.roomTypeName}</td>
                    <td className="px-3 py-2 border-r border-line text-right tabular-nums">{formatINR(r.ratePerNight)}</td>
                    <td className="px-3 py-2 border-r border-line text-right">{b.nights}</td>
                    <td className="px-3 py-2 border-r border-line text-right">{gstRateFor(r.ratePerNight * (1 - discountRatio))}%</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatINR(r.ratePerNight * b.nights)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-line">
                <BillRow label="Room charges" value={formatINR(b.roomCharges)} />
                {b.discount > 0 && <BillRow label="Discount" value={`− ${formatINR(b.discount)}`} />}
                <BillRow label="GST" value={formatINR(b.gstAmount)} />
                <BillRow label="Total" value={formatINR(b.total)} strong />
                <BillRow label="Paid" value={formatINR(b.paid)} />
                <BillRow label="Balance Due" value={formatINR(b.balance)} strong tone={b.balance > 0 ? "text-rose-600" : "text-emerald-700"} />
              </tfoot>
            </table>
          </div>
        </section>

        {b.payments.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-xs font-bold text-brand uppercase tracking-wider pb-1.5 border-b border-slate-100">Payments</h2>
            <div className="border border-line overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-line bg-head text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    {["Date", "Mode", "Paid By", "Reference", "Received By", "Amount"].map((h) => (
                      <th key={h} className="px-3 py-2 border-r border-line last:border-r-0 text-left last:text-right">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {b.payments.map((p) => (
                    <tr key={p._id}>
                      <td className="px-3 py-2 border-r border-line">{formatDateTime(p.at)}</td>
                      <td className="px-3 py-2 border-r border-line">{PAYMENT_MODES[p.mode]}</td>
                      <td className="px-3 py-2 border-r border-line">
                        <Badge variant={p.paidBy === "agent" ? "warning" : "neutral"}>{p.paidBy}</Badge>
                      </td>
                      <td className="px-3 py-2 border-r border-line font-mono">{p.reference || "—"}</td>
                      <td className="px-3 py-2 border-r border-line">{p.by?.name ?? "—"}</td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatINR(p.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {b.notes && (
          <section className="space-y-2">
            <h2 className="text-xs font-bold text-brand uppercase tracking-wider pb-1.5 border-b border-slate-100">Notes</h2>
            <p className="text-xs text-slate-700 whitespace-pre-line">{b.notes}</p>
          </section>
        )}
      </DetailCard>
    </div>
  );
}

function BillRow({ label, value, strong, tone = "" }: { label: string; value: string; strong?: boolean; tone?: string }) {
  return (
    <tr className={strong ? "bg-head" : ""}>
      <td colSpan={5} className={`px-3 py-1.5 text-right ${strong ? "font-bold text-slate-800" : "text-slate-500"}`}>
        {label}
      </td>
      <td className={`px-3 py-1.5 text-right tabular-nums ${strong ? "font-black" : "font-semibold"} ${tone}`}>{value}</td>
    </tr>
  );
}
