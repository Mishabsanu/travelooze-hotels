import { BedDouble, CalendarDays, Handshake, IndianRupee, User, Wallet } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { BOOKING_BASE } from "@/components/bookings/bookingConfig";
import { AccessDenied } from "@/components/ui/AccessDenied";
import { PageHeader } from "@/components/ui/PageHeader";
import { canListBookings } from "@/lib/bookingAccess";
import { formatDay, formatINR } from "@/lib/format";
import { can } from "@/lib/permissions";
import { requireUser } from "@/server/auth/session";
import { getRoomReport, type RoomRow, type RoomToday } from "@/server/services/roomReport.service";
import { CsvButton } from "./CsvButton";
import { PrintButton } from "./PrintButton";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;
const th = "px-3 py-2 border-r border-line last:border-r-0 whitespace-nowrap";
const td = "px-3 py-2 border-r border-line last:border-r-0 align-top";

const STATE: Record<RoomToday, { label: string; cls: string }> = {
  occupied: { label: "Guest in room", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  due_out: { label: "Leaving today", cls: "bg-amber-50 text-amber-800 border-amber-200" },
  arriving: { label: "Arriving today", cls: "bg-sky-50 text-sky-700 border-sky-200" },
  late: { label: "Not arrived (late)", cls: "bg-rose-50 text-rose-700 border-rose-200" },
  vacant: { label: "Free", cls: "bg-slate-50 text-slate-600 border-slate-200" },
  maintenance: { label: "Maintenance", cls: "bg-rose-50 text-rose-700 border-rose-200" },
};

const SHOW = [
  { v: "all", l: "All rooms" },
  { v: "occupied", l: "Guest in room" },
  { v: "free", l: "Free" },
  { v: "collect", l: "Money to collect" },
] as const;

/** Room Report: every room — who is in it, who pays what, next arrival, and the month's numbers per room. */
export async function RoomReportPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  if (!canListBookings(user)) return <AccessDenied />;
  const sp = await searchParams;
  const r = await getRoomReport(user, first(sp.hotel), first(sp.month));
  if (!r) return <AccessDenied title="No hotel assigned" message="Ask an admin to assign you to a hotel." />;
  const owner = can(user, "report", "view");
  const show = SHOW.some((s) => s.v === first(sp.show)) ? first(sp.show)! : "all";
  const q = (patch: Record<string, string>) => `?${new URLSearchParams({ hotel: r.hotel, month: r.month, show, ...patch })}`;
  const rows = r.rooms.filter((x) =>
    show === "occupied" ? x.today === "occupied" || x.today === "due_out" : show === "free" ? x.today === "vacant" : show === "collect" ? (x.stay?.balance ?? 0) > 0 : true
  );
  const monthName = new Date(`${r.month}-01T00:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

  return (
    <>
      <PageHeader title="Room Report" description="Every room: who is in it, who has to pay and how much, the next arrival, and this month's numbers." actions={<PrintButton />} />

      {/* Hotel + month */}
      <form className="no-print w-full bg-white border border-line flex flex-wrap items-stretch text-sm">
        {r.hotelOptions.length > 1 && (
          <select name="hotel" defaultValue={r.hotel} aria-label="Hotel" className="h-10 px-3 border-r border-line bg-white outline-none">
            {r.hotelOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        )}
        <input type="month" name="month" defaultValue={r.month} aria-label="Month" className="h-10 px-3 border-r border-line outline-none" />
        <input type="hidden" name="show" value={show} />
        <button className="px-4 h-10 font-bold text-brand hover:bg-brand-light border-r border-line">Show</button>
      </form>

      {/* Four numbers */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <Box icon={<BedDouble className="w-5 h-5" />} tone="bg-brand-light text-brand" label="Rooms occupied now" value={`${r.totals.occupied} / ${r.totals.rooms}`}>
          {r.totals.vacant} free · {r.totals.arriving} arriving · {r.totals.dueOut} leaving{r.totals.maintenance ? ` · ${r.totals.maintenance} maintenance` : ""}
        </Box>
        <Box icon={<IndianRupee className="w-5 h-5" />} tone="bg-rose-50 text-rose-700" label="Money to collect" value={formatINR(r.dueTotals.guests + r.dueTotals.agents)} danger={r.dueTotals.guests + r.dueTotals.agents > 0}>
          From guests {formatINR(r.dueTotals.guests)} · From agents {formatINR(r.dueTotals.agents)}
        </Box>
        {owner && (
          <Box icon={<Wallet className="w-5 h-5" />} tone="bg-emerald-50 text-emerald-700" label={`Room sales · ${monthName}`} value={formatINR(r.totals.monthSales)}>
            {r.totals.monthNights} room nights sold · without GST
          </Box>
        )}
        {owner && (
          <Box icon={<CalendarDays className="w-5 h-5" />} tone="bg-sky-50 text-sky-700" label="Rooms filled this month" value={`${r.totals.occupancy}%`}>
            Average room price {formatINR(r.totals.avgRate)} / night
          </Box>
        )}
      </div>

      {/* Who to collect from */}
      <div className="grid grid-cols-1 2xl:grid-cols-[3fr_2fr] gap-4">
        <Panel
          icon={<User className="w-4 h-4" />}
          title={`Collect from guests · ${formatINR(r.dueTotals.guests)}`}
          note="Call or ask at the desk. Guests who left without paying are first."
          action={
            <CsvButton
              fileName={`collect-from-guests-${r.month}.csv`}
              header={["Rooms", "Guest", "Phone", "Booking", "Status", "Check-in", "Check-out", "Amount"]}
              rows={r.fromGuests.map((c) => [c.rooms, c.guest, c.phone, c.bookingNo, c.status, formatDay(c.checkIn), formatDay(c.checkOut), c.guestDue])}
            />
          }
        >
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-line bg-head text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                <th className={`${th} text-left`}>Room</th>
                <th className={`${th} text-left`}>Guest</th>
                <th className={`${th} text-left`}>Stay</th>
                <th className={`${th} text-right`}>To collect</th>
                <th className={`${th} no-print`} />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {[...r.fromGuests]
                .sort((a, b) => order(a.status) - order(b.status))
                .map((c) => (
                  <tr key={c.bookingId} className={c.status === "checked_out" ? "bg-rose-50/50" : "hover:bg-head"}>
                    <td className={`${td} font-mono font-bold text-slate-900`}>{c.rooms}</td>
                    <td className={td}>
                      <span className="font-semibold text-slate-800">{c.guest || "—"}</span>
                      {c.phone && (
                        <a href={`tel:${c.phone}`} className="block text-[11px] text-brand hover:underline">
                          {c.phone}
                        </a>
                      )}
                    </td>
                    <td className={td}>
                      {formatDay(c.checkIn)} → {formatDay(c.checkOut)}
                      <span className={`block text-[10.5px] font-bold ${c.status === "checked_out" ? "text-rose-600" : c.status === "checked_in" ? "text-emerald-700" : "text-slate-400"}`}>
                        {c.status === "checked_out" ? "Left without paying" : c.status === "checked_in" ? "In the room" : "Not arrived yet"}
                      </span>
                    </td>
                    <td className={`${td} text-right tabular-nums font-bold text-rose-600`}>{formatINR(c.guestDue)}</td>
                    <td className={`${td} no-print text-right`}>
                      <Link href={`${BOOKING_BASE}/${c.bookingId}?do=pay`} className="inline-flex h-8 items-center rounded-lg border border-slate-300 px-3 font-bold text-slate-700 hover:bg-slate-50">
                        Take payment
                      </Link>
                    </td>
                  </tr>
                ))}
              {r.fromGuests.length === 0 && <Empty span={5} text="No guest owes money" />}
            </tbody>
          </table>
        </Panel>

        <Panel icon={<Handshake className="w-4 h-4" />} title={`Collect from agents · ${formatINR(r.dueTotals.agents)}`} note="Agents billed for the room">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-line bg-head text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                <th className={`${th} text-left`}>Agent</th>
                <th className={`${th} text-left`}>Rooms</th>
                <th className={`${th} text-right`}>Bookings</th>
                <th className={`${th} text-right`}>To collect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {r.fromAgents.map((a) => (
                <tr key={a.agent} className="hover:bg-head">
                  <td className={`${td} font-semibold text-slate-800`}>{a.agent}</td>
                  <td className={`${td} font-mono`}>{a.rooms}</td>
                  <td className={`${td} text-right tabular-nums`}>{a.bookings}</td>
                  <td className={`${td} text-right tabular-nums font-bold text-amber-700`}>{formatINR(a.amount)}</td>
                </tr>
              ))}
              {r.fromAgents.length === 0 && <Empty span={4} text="No agent owes money" />}
            </tbody>
          </table>
        </Panel>
      </div>

      {/* Every room */}
      <section className="bg-white border border-line rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-line flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-bold text-slate-800 mr-2">Every room · {rows.length}</h2>
          <div className="no-print flex flex-wrap gap-1.5">
            {SHOW.map((s) => (
              <Link key={s.v} href={q({ show: s.v })} className={`h-8 px-3 inline-flex items-center rounded-full text-xs font-bold border ${show === s.v ? "bg-brand text-white border-brand" : "bg-white text-slate-600 border-slate-300 hover:border-brand hover:text-brand"}`}>
                {s.l}
              </Link>
            ))}
          </div>
          <span className="no-print ml-auto">
            <CsvButton
              fileName={`room-report-${r.month}.csv`}
              header={["Room", "Type", "Floor", "Today", "Guest", "Phone", "Booking", "Check-in", "Check-out", "Collect from", "Amount", "Next arrival", `Nights (${r.month})`, `Sales (${r.month})`, "Occupancy %"]}
              rows={r.rooms.map((x) => [
                x.number,
                x.type,
                x.floor,
                STATE[x.today].label,
                x.stay?.guest ?? "",
                x.stay?.phone ?? "",
                x.stay?.bookingNo ?? "",
                x.stay ? formatDay(x.stay.checkIn) : "",
                x.stay ? formatDay(x.stay.checkOut) : "",
                x.stay ? whoPays(x) : "",
                x.stay?.balance ?? 0,
                x.next ? `${formatDay(x.next.checkIn)} ${x.next.guest}` : "",
                x.month.nights,
                x.month.sales,
                x.month.occupancy,
              ])}
            />
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-line bg-head text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                <th className={`${th} text-left`}>Room</th>
                <th className={`${th} text-left`}>Today</th>
                <th className={`${th} text-left`}>Guest / booking</th>
                <th className={`${th} text-left`}>Stay</th>
                <th className={`${th} text-right`}>To collect</th>
                <th className={`${th} text-left`}>Next arrival</th>
                {owner && <th className={`${th} text-right`}>{monthName}</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((x) => (
                <tr key={x._id} className="hover:bg-head">
                  <td className={td}>
                    <span className="font-mono text-sm font-bold text-slate-900">{x.number}</span>
                    <span className="block text-[10.5px] text-slate-400">
                      {x.type}
                      {x.floor ? ` · F${x.floor}` : ""}
                    </span>
                  </td>
                  <td className={td}>
                    <span className={`inline-flex rounded-md border px-2 py-0.5 text-[11px] font-bold ${STATE[x.today].cls}`}>{STATE[x.today].label}</span>
                    {x.housekeeping === "cleaning" && <span className="block mt-0.5 text-[10.5px] font-semibold text-amber-700">Needs cleaning</span>}
                  </td>
                  <td className={td}>
                    {x.stay ? (
                      <>
                        <Link href={`${BOOKING_BASE}/${x.stay.bookingId}`} className="font-semibold text-brand hover:underline">
                          {x.stay.guest || "—"}
                        </Link>
                        <span className="block text-[10.5px] text-slate-400">
                          {x.stay.bookingNo} · {x.stay.pax} pax{x.stay.source === "agent" ? ` · ${x.stay.agent}` : " · walk-in"}
                          {x.stay.roomsInBooking > 1 ? ` · ${x.stay.roomsInBooking} rooms: ${x.stay.rooms}` : ""}
                        </span>
                      </>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className={`${td} whitespace-nowrap`}>{x.stay ? `${formatDay(x.stay.checkIn)} → ${formatDay(x.stay.checkOut)}` : <span className="text-slate-300">—</span>}</td>
                  <td className={`${td} text-right whitespace-nowrap`}>
                    {x.stay && x.stay.balance > 0 ? (
                      <>
                        <span className="font-bold tabular-nums text-rose-600">{formatINR(x.stay.balance)}</span>
                        <span className="block text-[10.5px] text-slate-500">{whoPays(x)}</span>
                      </>
                    ) : x.stay ? (
                      <span className="font-semibold text-emerald-700">Paid</span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className={td}>
                    {x.next ? (
                      <Link href={`${BOOKING_BASE}/${x.next.bookingId}`} className="hover:underline">
                        <b>{formatDay(x.next.checkIn)}</b>
                        <span className="block text-[10.5px] text-slate-500">{x.next.guest}</span>
                      </Link>
                    ) : (
                      <span className="text-slate-300">No booking</span>
                    )}
                  </td>
                  {owner && (
                    <td className={`${td} text-right whitespace-nowrap`}>
                      <span className="font-semibold tabular-nums">{formatINR(x.month.sales)}</span>
                      <span className="block text-[10.5px] text-slate-500">
                        {x.month.nights} nights · {x.month.occupancy}% full
                      </span>
                    </td>
                  )}
                </tr>
              ))}
              {rows.length === 0 && <Empty span={owner ? 7 : 6} text="No rooms in this view" />}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

const order = (s: string) => ({ checked_out: 0, checked_in: 1, confirmed: 2 })[s] ?? 3;

/** "Guest pays" / "Agent pays" / both, for one room's booking */
function whoPays(x: RoomRow) {
  const s = x.stay!;
  if (s.guestDue > 0 && s.agentDue > 0) return `Guest ${formatINR(s.guestDue)} + ${s.agent || "agent"} ${formatINR(s.agentDue)}`;
  if (s.agentDue > 0) return `Agent pays · ${s.agent}`;
  return `Guest pays${s.roomsInBooking > 1 ? ` (for ${s.roomsInBooking} rooms)` : ""}`;
}

function Box({ icon, tone, label, value, danger, children }: { icon: ReactNode; tone: string; label: string; value: string; danger?: boolean; children: ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
      <div className="flex items-center gap-2">
        <span className={`w-9 h-9 rounded-lg flex items-center justify-center ${tone}`}>{icon}</span>
        <span className="text-sm font-semibold text-slate-600">{label}</span>
      </div>
      <p className={`mt-2 text-3xl font-black tabular-nums ${danger ? "text-rose-600" : "text-slate-900"}`}>{value}</p>
      <p className="text-xs text-slate-500">{children}</p>
    </div>
  );
}

function Panel({ icon, title, note, action, children }: { icon: ReactNode; title: string; note?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="bg-white border border-line rounded-xl overflow-hidden break-inside-avoid">
      <div className="px-4 py-3 border-b border-line flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="text-brand">{icon}</span>
        <h2 className="text-sm font-bold text-slate-800">{title}</h2>
        {note && <span className="text-xs text-slate-400">{note}</span>}
        {action && <span className="no-print ml-auto">{action}</span>}
      </div>
      <div className="overflow-x-auto">{children}</div>
    </section>
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
