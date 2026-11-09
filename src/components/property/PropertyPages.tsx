import { Building2, Plus } from "lucide-react";
import Link from "next/link";
import { AccessDenied } from "@/components/ui/AccessDenied";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { DetailCard, DetailItem, DetailSection } from "@/components/ui/DetailCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { HOTEL_CATEGORIES } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import { timeLabel } from "@/lib/stayTimes";
import { can, type PermissionModule } from "@/lib/permissions";
import { getPageAccess } from "@/server/auth/session";
import { parseListQuery } from "@/server/http/query";
import { getHotel, listHotelOptions, listHotels } from "@/server/services/hotel.service";
import { getRoom, getRoomType, listRoomTypeOptions, listRoomTypes, listRooms } from "@/server/services/room.service";
import { orNotFound } from "@/server/utils/pageData";
import { HotelForm, HotelListView } from "./HotelViews";
import { HOTEL_UI, ROOM_TYPE_UI, ROOM_UI } from "./propertyConfig";
import { RoomTypeForm, RoomTypeListView } from "./RoomTypeViews";
import { RoomCreateForm, RoomEditForm, RoomListView } from "./RoomViews";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
type IdParams = Promise<{ id: string }>;

const addButton = (href: string, label: string) => (
  <Link
    href={href}
    className="inline-flex items-center gap-1.5 bg-brand hover:bg-brand-dark text-white rounded-lg px-3.5 py-2 font-bold text-xs shadow-xs transition"
  >
    <Plus className="w-4 h-4" />
    {label}
  </Link>
);

function header(ui: { plural: string; description: string; basePath: string; label: string }, show: boolean, label = `Add ${ui.label}`) {
  return <PageHeader title={ui.plural} description={ui.description} actions={show && addButton(`${ui.basePath}/new`, label)} />;
}

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;

/* ───────────── Hotels ───────────── */

export async function HotelListPage({ searchParams }: { searchParams: SearchParams }) {
  const { user, allowed } = await getPageAccess("hotel", "view");
  if (!allowed) return <AccessDenied />;
  const data = await listHotels(parseListQuery(await searchParams, ["category"]), user);
  return (
    <>
      {header(HOTEL_UI, can(user, "hotel", "create"))}
      <HotelListView data={data} />
    </>
  );
}

export async function HotelCreatePage() {
  const { allowed } = await getPageAccess("hotel", "create");
  if (!allowed) return <AccessDenied />;
  return <HotelForm />;
}

export async function HotelEditPage({ params }: { params: IdParams }) {
  const { user, allowed } = await getPageAccess("hotel", "update");
  if (!allowed) return <AccessDenied />;
  return <HotelForm initial={await orNotFound(getHotel((await params).id, user))} />;
}

export async function HotelDetailPage({ params }: { params: IdParams }) {
  const { user, allowed } = await getPageAccess("hotel", "view");
  if (!allowed) return <AccessDenied />;
  const hotel = await orNotFound(getHotel((await params).id, user));
  const link = (module: PermissionModule, href: string, text: string) =>
    can(user, module, "view") ? (
      <Link href={href} className="text-brand hover:underline">
        {text}
      </Link>
    ) : (
      text
    );
  return (
    <DetailCard
      title={hotel.name}
      subtitle={hotel.code}
      badge={
        <>
          <Badge variant="brand">{HOTEL_CATEGORIES[hotel.category]}</Badge>
          <StatusBadge status={hotel.status} />
        </>
      }
      icon={<Building2 className="w-4.5 h-4.5" />}
      backHref={HOTEL_UI.basePath}
      editHref={can(user, "hotel", "update") ? `${HOTEL_UI.basePath}/${hotel._id}/edit` : undefined}
    >
      <DetailSection title="Hotel">
        <DetailItem label="Name" value={hotel.name} />
        <DetailItem label="Code" value={hotel.code} mono />
        <DetailItem label="Category" value={HOTEL_CATEGORIES[hotel.category]} />
        <DetailItem label="Phone" value={hotel.phone} />
        <DetailItem label="Email" value={hotel.email} />
        <DetailItem label="GSTIN" value={hotel.gstin} mono />
        <DetailItem label="Check-in Time" value={timeLabel(hotel.checkInTime || "12:00")} />
        <DetailItem label="Check-out Time" value={timeLabel(hotel.checkOutTime || "11:00")} />
        <DetailItem label="Address" value={hotel.address} />
      </DetailSection>
      <DetailSection title="Rooms">
        <DetailItem label="Active Rooms" value={link("room", `/dashboard/property/rooms?hotel=${hotel._id}`, String(hotel.roomCount ?? 0))} />
        <DetailItem label="Room Types & Rates" value={link("room_type", `/dashboard/property/room-types?hotel=${hotel._id}`, "Open")} />
        <DetailItem label="Availability" value={link("booking", `/dashboard/front-office/availability?hotel=${hotel._id}`, "Open chart")} />
      </DetailSection>
      <DetailSection title="Audit">
        <DetailItem label="Created By" value={hotel.createdBy?.name} />
        <DetailItem label="Created" value={formatDateTime(hotel.createdAt)} />
        <DetailItem label="Last Updated" value={formatDateTime(hotel.updatedAt)} />
      </DetailSection>
    </DetailCard>
  );
}

/* ───────────── Room types ───────────── */

export async function RoomTypeListPage({ searchParams }: { searchParams: SearchParams }) {
  const { user, allowed } = await getPageAccess("room_type", "view");
  if (!allowed) return <AccessDenied />;
  const sp = await searchParams;
  const [data, hotelOptions] = await Promise.all([listRoomTypes(parseListQuery(sp, ["hotel"]), user), listHotelOptions(user)]);
  const hotel = first(sp.hotel);
  return (
    <>
      <PageHeader
        title={ROOM_TYPE_UI.plural}
        description={ROOM_TYPE_UI.description}
        actions={can(user, "room_type", "create") && addButton(`${ROOM_TYPE_UI.basePath}/new${hotel ? `?hotel=${hotel}` : ""}`, "Add Room Type")}
      />
      <RoomTypeListView data={data} hotelOptions={hotelOptions} />
    </>
  );
}

export async function RoomTypeCreatePage({ searchParams }: { searchParams: SearchParams }) {
  const { user, allowed } = await getPageAccess("room_type", "create");
  if (!allowed) return <AccessDenied />;
  return <RoomTypeForm hotelOptions={await listHotelOptions(user)} defaultHotel={first((await searchParams).hotel)} />;
}

export async function RoomTypeEditPage({ params }: { params: IdParams }) {
  const { user, allowed } = await getPageAccess("room_type", "update");
  if (!allowed) return <AccessDenied />;
  const [type, hotelOptions] = await Promise.all([orNotFound(getRoomType((await params).id, user)), listHotelOptions(user, { includeInactive: true })]);
  return <RoomTypeForm initial={type} hotelOptions={hotelOptions} />;
}

/* ───────────── Rooms ───────────── */

export async function RoomListPage({ searchParams }: { searchParams: SearchParams }) {
  const { user, allowed } = await getPageAccess("room", "view");
  if (!allowed) return <AccessDenied />;
  const sp = await searchParams;
  const hotel = first(sp.hotel);
  const [data, hotelOptions, typeOptions] = await Promise.all([
    listRooms(parseListQuery(sp, ["hotel", "roomType", "housekeeping"]), user),
    listHotelOptions(user),
    listRoomTypeOptions(user, hotel),
  ]);
  return (
    <>
      <PageHeader
        title={ROOM_UI.plural}
        description={ROOM_UI.description}
        actions={can(user, "room", "create") && addButton(`${ROOM_UI.basePath}/new${hotel ? `?hotel=${hotel}` : ""}`, "Add Rooms")}
      />
      <RoomListView data={data} hotelOptions={hotelOptions} typeOptions={typeOptions} />
    </>
  );
}

export async function RoomCreatePage({ searchParams }: { searchParams: SearchParams }) {
  const { user, allowed } = await getPageAccess("room", "create");
  if (!allowed) return <AccessDenied />;
  const [hotelOptions, typeOptions] = await Promise.all([listHotelOptions(user), listRoomTypeOptions(user)]);
  return <RoomCreateForm hotelOptions={hotelOptions} typeOptions={typeOptions} defaultHotel={first((await searchParams).hotel)} />;
}

export async function RoomEditPage({ params }: { params: IdParams }) {
  const { user, allowed } = await getPageAccess("room", "update");
  if (!allowed) return <AccessDenied />;
  const room = await orNotFound(getRoom((await params).id, user));
  return <RoomEditForm room={room} typeOptions={await listRoomTypeOptions(user, room.hotel?._id)} />;
}
