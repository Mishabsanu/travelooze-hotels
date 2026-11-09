import { RoomTypeListPage } from "@/components/property/PropertyPages";

export const metadata = { title: "Room Types & Rates" };

export default function Page({ searchParams }: PageProps<"/dashboard/property/room-types">) {
  return <RoomTypeListPage searchParams={searchParams} />;
}
