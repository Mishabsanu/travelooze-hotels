import { RoomListPage } from "@/components/property/PropertyPages";

export const metadata = { title: "Rooms" };

export default function Page({ searchParams }: PageProps<"/dashboard/property/rooms">) {
  return <RoomListPage searchParams={searchParams} />;
}
