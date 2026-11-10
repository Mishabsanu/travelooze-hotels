import { ArrowLeft, CalendarCheck, CheckCircle2, Download, Eye, FileDown, FileText, Plus } from "lucide-react";
import Link from "next/link";
import { AccessDenied } from "@/components/ui/AccessDenied";
import { APP_NAME, LOGO_SRC } from "@/lib/brand";
import { isEarlyCheckIn, isLateCheckOut, timeLabel } from "@/lib/stayTimes";
import { Badge } from "@/components/ui/Badge";
import { DetailItem, DetailSection } from "@/components/ui/DetailCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { agentBookingsOnly, canBooking, canListBookings } from "@/lib/bookingAccess";
import { MEAL_PLANS, PAYMENT_MODES, gstRateFor } from "@/lib/constants";
import { formatDateTime, formatDay, formatINR, paxLabel, toDayString } from "@/lib/format";
import { can } from "@/lib/permissions";
import { requireUser } from "@/server/auth/session";
import { parseListQuery } from "@/server/http/query";
import { listAgentOptions } from "@/server/services/agent.service";
import { getBooking, listBookings } from "@/server/services/booking/booking.service";
import { listHotelOptions } from "@/server/services/hotel.service";
import { addDays, todayIST } from "@/server/services/stay";
import { orNotFound } from "@/server/utils/pageData";
import { BookingActions } from "./BookingActions";
import { BookingTabs } from "./BookingTabs";
import { BookingForm } from "./BookingForm";
import { BOOKING_BASE } from "./bookingConfig";
import { BookingListView, BookingStatusBadge, SourceBadge } from "./BookingListView";
import { FolioList } from "./FolioList";
import { InvoiceSheet } from "./InvoiceSheet";
import { InvoiceToolbar } from "./InvoiceToolbar";
import { RoomingList } from "./RoomingList";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
type IdParams = Promise<{ id: string }>;

const FILTERS = ["hotel", "source", "agent", "mealPlan", "stay", "date"];
const btnClass = "inline-flex items-center gap-1.5 bg-brand hover:bg-brand-dark text-white rounded-lg px-3.5 py-2 font-bold text-xs shadow-xs transition";
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;

export async function BookingListPage({ searchParams, agentOnly = false }: { searchParams: SearchParams; agentOnly?: boolean }) {
  const user = await requireUser();
  const allowed = agentOnly ? canBooking(user, "agent", "view") : canListBookings(user);
  if (!allowed) return <AccessDenied />;
  const onlyAgent = agentOnly || agentBookingsOnly(user);
  const sp = await searchParams;
  const createdId = first(sp.created);
  const [data, hotelOptions, created] = await Promise.all([
    listBookings(parseListQuery(sp, FILTERS), user, onlyAgent ? "agent" : undefined),
    listHotelOptions(user),
    // Just saved from the booking form: show its invoice right here
    createdId ? getBooking(createdId, user).catch(() => null) : null,
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
      {created && <CreatedBanner b={created} />}
      <BookingListView data={data} hotelOptions={hotelOptions} agentOnly={onlyAgent} today={toDayString(todayIST())} />
    </>
  );
}

const bannerBtn = "inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-xs font-bold transition";

/** After creating a booking: its number, total and the invoice (view / download PDF). */
function CreatedBanner({ b }: { b: Awaited<ReturnType<typeof getBooking>> }) {
  const href = `${BOOKING_BASE}/${b._id}`;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3" role="status">
      <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-600" />
      <div className="min-w-0 flex-1 text-xs text-emerald-900">
        <p className="text-sm font-bold">
          Booking <span className="font-mono">{b.bookingNo}</span> confirmed
        </p>
        <p>
          {b.guest.name} · {b.hotel?.name} · {formatDay(b.checkIn)} → {formatDay(b.checkOut)} · {b.rooms.length} room
          {b.rooms.length === 1 ? "" : "s"} · <b>{formatINR(b.grandTotal)}</b>
        </p>
      </div>
      <Link href={`${href}/invoice`} className={`${bannerBtn} bg-brand text-white hover:bg-brand-dark`}>
        <FileText className="h-4 w-4" /> View Invoice
      </Link>
      <Link href={`${href}/invoice?download=1`} className={`${bannerBtn} border border-brand-border bg-white text-brand hover:bg-brand-light`}>
        <FileDown className="h-4 w-4" /> Download PDF
      </Link>
      <Link href={href} className={`${bannerBtn} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50`}>
        <Eye className="h-4 w-4" /> Open Booking
      </Link>
    </div>
  );
}

export async function BookingCreatePage({ searchParams, source }: { searchParams: SearchParams; source: "walkin" | "agent" }) {
  const user = await requireUser();
  if (!canBooking(user, source, "create")) return <AccessDenied />;
  const sp = await searchParams;
  const today = todayIST();
  const [hotelOptions, agentOptions] = await Promise.all([listHotelOptions(user), source === "agent" ? listAgentOptions() : []]);
  // Prefill from the booking grid / room board: ?hotel=&room=&checkIn=&checkOut=
  const isDay = (v?: string) => Boolean(v && /^\d{4}-\d{2}-\d{2}$/.test(v) && v >= toDayString(today));
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

export async function BookingDetailPage({ params, searchParams }: { params: IdParams; searchParams?: SearchParams }) {
  const user = await requireUser();
  if (!canListBookings(user)) return <AccessDenied />;
  const b = await orNotFound(getBooking((await params).id, user));
  const sp = await searchParams;
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
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
          {/* Header */}
          <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 px-4 py-4 sm:px-6">
            <Link
              href={b.source === "agent" && agentBookingsOnly(user) ? "/dashboard/sales/agent-bookings" : BOOKING_BASE}
              title="Back to list"
              className="no-print shrink-0 rounded-lg bg-slate-100 p-2 text-slate-600 transition hover:bg-slate-200"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-brand-border bg-brand-light text-brand">
              <CalendarCheck className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-base font-bold text-slate-900">{b.bookingNo}</h1>
                <BookingStatusBadge status={b.status} />
                <SourceBadge b={b} />
              </div>
              <p className="mt-0.5 font-mono text-xs text-slate-500">
                {b.hotel?.name ?? ""} · booked {formatDateTime(b.createdAt)} by {b.createdBy?.name ?? "—"}
              </p>
            </div>
          </div>
          <BookingTabs
            initial={first(sp?.tab) ?? (first(sp?.do) === "checkin" ? "rooming" : undefined)}
            tabs={[
              {
                id: "details",
                label: "Details",
                content: (
                  <>
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
                      <DetailItem label="Nights / Guests" value={`${b.nights} night${b.nights === 1 ? "" : "s"} · ${paxLabel(b.adults, b.children)}`} />
                      <DetailItem label="Meal Plan" value={MEAL_PLANS[b.mealPlan].label} />
                      {b.perHeadRate ? (
                        <DetailItem
                          label="Group Rate"
                          value={`${formatINR(b.perHeadRate)} per head / night · ${b.adults + b.children - (b.focPax ?? 0)} paying${b.focPax ? ` + ${b.focPax} complimentary` : ""}`}
                        />
                      ) : null}
                      {b.source === "agent" && <DetailItem label="Agent / Ref" value={`${b.agent?.name ?? "—"}${b.agentRef ? ` · ${b.agentRef}` : ""}`} />}
                      {b.source === "agent" && <DetailItem label="Bill To" value={b.billTo === "agent" ? "Agent" : "Guest"} />}
                    </DetailSection>

                    {/* Guests (names, phones, IDs) are in the Rooming List; only older bookings kept an ID on the booking itself */}
                    {b.guest.idFiles.length > 0 && (
                      <DetailSection title="ID Proof (older booking)">
                        <DetailItem
                          label="Files"
                          value={
                            canSeeIds ? (
                              <span className="flex flex-wrap gap-2 no-print">
                                {b.guest.idFiles.map((f, i) => (
                                  <a
                                    key={f}
                                    href={`/api/bookings/${b._id}/id-files/${i}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 text-brand hover:underline"
                                  >
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
                    )}

                    {b.notes && (
                      <section className="space-y-2">
                        <h2 className="text-xs font-bold text-brand uppercase tracking-wider pb-1.5 border-b border-slate-100">Notes</h2>
                        <p className="text-xs text-slate-700 whitespace-pre-line">{b.notes}</p>
                      </section>
                    )}
                  </>
                ),
              },
              {
                id: "rooming",
                label: "Rooming List",
                count: `${b.adults + b.children}`,
                content: (
                  <>
                    {/* Re-mounts after any change to the booking (move room, dates, ...) so the table matches it */}
                    <RoomingList key={`${b.updatedAt ?? ""}-${b.rooms.map((r) => r.room).join()}`} booking={b} />
                  </>
                ),
              },
              {
                id: "bill",
                label: "Bill & Payments",
                count: b.balance > 0 ? formatINR(b.balance) : undefined,
                content: (
                  <>
                    <section className="space-y-3">
                      <h2 className="text-xs font-bold text-brand uppercase tracking-wider pb-1.5 border-b border-slate-100">Bill</h2>
                      <div className="border border-line overflow-x-auto">
                        <table className="w-full text-xs border-collapse min-w-[640px]">
                          <thead>
                            <tr className="border-b border-line bg-head text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                              {["Room", "Type", "Guests", "Rate / Night", "Extra Bed / Night", "Nights", "GST", "Amount"].map((h, i) => (
                                <th key={h} className={`px-3 py-2 border-r border-line last:border-r-0 whitespace-nowrap ${i > 2 ? "text-right" : "text-left"}`}>
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-line">
                            {b.rooms.map((r) => {
                              const perNight = r.ratePerNight + r.extraBeds * r.extraBedRate;
                              return (
                                <tr key={r.room}>
                                  <td className="px-3 py-2 border-r border-line font-mono font-bold">{r.roomNumber}</td>
                                  <td className="px-3 py-2 border-r border-line">{r.roomTypeName}</td>
                                  <td className="px-3 py-2 border-r border-line whitespace-nowrap">{paxLabel(r.adults, r.children)}</td>
                                  <td className="px-3 py-2 border-r border-line text-right tabular-nums">{formatINR(r.ratePerNight)}</td>
                                  <td className="px-3 py-2 border-r border-line text-right tabular-nums">{r.extraBeds ? `${r.extraBeds} × ${formatINR(r.extraBedRate)}` : "—"}</td>
                                  <td className="px-3 py-2 border-r border-line text-right">{b.nights}</td>
                                  <td className="px-3 py-2 border-r border-line text-right">{gstRateFor(perNight * (1 - discountRatio))}%</td>
                                  <td className="px-3 py-2 text-right tabular-nums">{formatINR(perNight * b.nights)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot className="border-t border-line">
                            <BillRow label="Room charges" value={formatINR(b.roomCharges)} />
                            {b.extraBedCharges > 0 && <BillRow label="Extra beds" value={formatINR(b.extraBedCharges)} />}
                            {b.discount > 0 && <BillRow label="Discount" value={`− ${formatINR(b.discount)}`} />}
                            <BillRow label="GST" value={formatINR(b.gstAmount)} />
                            <BillRow label="Accommodation total" value={formatINR(b.total)} strong />
                            {b.extrasTotal > 0 && <BillRow label="Extra charges (incl. GST)" value={formatINR(b.extrasTotal)} />}
                            {b.extrasTotal > 0 && <BillRow label="Grand total" value={formatINR(b.grandTotal)} strong />}
                            <BillRow label="Paid" value={formatINR(b.paid)} />
                            <BillRow label="Balance Due" value={formatINR(b.balance)} strong tone={b.balance > 0 ? "text-rose-600" : "text-emerald-700"} />
                            {b.billTo === "agent" && (
                              <BillRow label="To collect from guest (extras)" value={formatINR(b.guestDue)} tone={b.guestDue > 0 ? "text-rose-600" : "text-emerald-700"} />
                            )}
                          </tfoot>
                        </table>
                      </div>
                    </section>

                    <FolioList booking={b} />

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
                  </>
                ),
              },
            ]}
          />
        </div>

        {/* Right panel: summary + every action */}
        <aside className="no-print order-first space-y-3 lg:sticky lg:top-[140px] lg:order-none">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Stay</p>
            <p className="mt-0.5 text-sm font-bold text-slate-900">
              {formatDay(b.checkIn)} → {formatDay(b.checkOut)}
            </p>
            <p className="text-[11px] text-slate-500">
              {b.nights} night{b.nights === 1 ? "" : "s"} · {b.rooms.length} room{b.rooms.length === 1 ? "" : "s"} ({b.rooms.map((r) => r.roomNumber).join(", ")}) ·{" "}
              {paxLabel(b.adults, b.children)}
            </p>
            <dl className="mt-3 space-y-1.5 border-t border-slate-100 pt-3 text-xs">
              <div className="flex justify-between">
                <dt className="text-slate-500">Total</dt>
                <dd className="font-bold tabular-nums text-slate-900">{formatINR(b.grandTotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Paid</dt>
                <dd className="font-semibold tabular-nums text-slate-700">{formatINR(b.paid)}</dd>
              </div>
              <div className="flex justify-between border-t border-slate-100 pt-1.5">
                <dt className="font-bold text-slate-700">Balance</dt>
                <dd className={`font-black tabular-nums ${b.balance > 0 ? "text-rose-600" : "text-emerald-700"}`}>{formatINR(b.balance)}</dd>
              </div>
            </dl>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-xs">
            <p className="mb-2 px-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">Actions</p>
            <BookingActions booking={b} today={toDayString(todayIST())} autoOpen={first(sp?.do)} side />
          </div>
        </aside>
      </div>
    </div>
  );
}

function BillRow({ label, value, strong, tone = "" }: { label: string; value: string; strong?: boolean; tone?: string }) {
  return (
    <tr className={strong ? "bg-head" : ""}>
      <td colSpan={7} className={`px-3 py-1.5 text-right ${strong ? "font-bold text-slate-800" : "text-slate-500"}`}>
        {label}
      </td>
      <td className={`px-3 py-1.5 text-right tabular-nums ${strong ? "font-black" : "font-semibold"} ${tone}`}>{value}</td>
    </tr>
  );
}

export async function InvoicePage({ params, searchParams }: { params: IdParams; searchParams?: SearchParams }) {
  const user = await requireUser();
  if (!canListBookings(user)) return <AccessDenied />;
  const b = await orNotFound(getBooking((await params).id, user));
  return (
    <div className="space-y-4">
      <InvoiceToolbar b={b} autoDownload={first((await searchParams)?.download) === "1"} />
      <InvoiceSheet b={b} />
    </div>
  );
}
