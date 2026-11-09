import { RoomCreatePage } from "@/components/property/PropertyPages";

export const metadata = { title: "Add Rooms" };

export default function Page({ searchParams }: PageProps<"/dashboard/property/rooms/new">) {
  return <RoomCreatePage searchParams={searchParams} />;
}
