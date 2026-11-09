import { AccessDenied } from "@/components/ui/AccessDenied";
import { PageHeader } from "@/components/ui/PageHeader";
import { canListBookings } from "@/lib/bookingAccess";
import { toDayString } from "@/lib/format";
import { requireUser } from "@/server/auth/session";
import { getGrid, getRoomBoard } from "@/server/services/booking/grid";
import { listHotelOptions } from "@/server/services/hotel.service";
import { listRoomTypeOptions } from "@/server/services/room.service";
import { parseDay, todayIST } from "@/server/services/stay";
import { BookingGrid } from "./BookingGrid";
import { RoomBoard } from "./RoomBoard";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;

/** Picks the requested hotel if the user may see it, otherwise their first hotel. */
async function resolveHotel(sp: Record<string, string | string[] | undefined>) {
  const user = await requireUser();
  if (!canListBookings(user)) return { user, denied: true as const };
  const hotelOptions = await listHotelOptions(user);
  const requested = first(sp.hotel);
  const hotel = hotelOptions.find((o) => o.value === requested)?.value ?? hotelOptions[0]?.value;
  return { user, denied: false as const, hotelOptions, hotel };
}

export async function BookingGridPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const r = await resolveHotel(sp);
  if (r.denied) return <AccessDenied />;
  if (!r.hotel) return <AccessDenied title="No hotel assigned" message="Ask an admin to assign you to a hotel." />;

  const today = todayIST();
  let from = today;
  try {
    if (first(sp.from)) from = parseDay(first(sp.from)!);
  } catch {}
  const days = [7, 14, 30].includes(Number(first(sp.days))) ? Number(first(sp.days)) : 14;
  const typeOptions = (await listRoomTypeOptions(r.user, r.hotel)).map((o) => ({ value: o.value, label: o.label.replace(/ \(\w+\)$/, "") }));
  const roomType = typeOptions.find((o) => o.value === first(sp.roomType))?.value ?? "";
  const grid = await getGrid(r.hotel, from, days, roomType || undefined);

  return (
    <>
      <PageHeader title="Booking Grid" description="Every room by date. Click free cells to book, click a bar to open the booking." />
      <BookingGrid grid={grid} hotel={r.hotel} hotelOptions={r.hotelOptions} typeOptions={typeOptions} roomType={roomType} days={days} today={toDayString(today)} />
    </>
  );
}

export async function RoomBoardPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const r = await resolveHotel(sp);
  if (r.denied) return <AccessDenied />;
  if (!r.hotel) return <AccessDenied title="No hotel assigned" message="Ask an admin to assign you to a hotel." />;
  const today = todayIST();
  const rooms = await getRoomBoard(r.hotel, today);
  return (
    <>
      <PageHeader title="Room Status" description="What every room is doing today, with housekeeping status. Dot: green clean · amber cleaning · red maintenance." />
      <RoomBoard rooms={rooms} hotel={r.hotel} hotelOptions={r.hotelOptions} today={toDayString(today)} />
    </>
  );
}
