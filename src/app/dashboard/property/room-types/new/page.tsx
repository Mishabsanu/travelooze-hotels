import { RoomTypeCreatePage } from "@/components/property/PropertyPages";

export const metadata = { title: "New Room Type" };

export default function Page({ searchParams }: PageProps<"/dashboard/property/room-types/new">) {
  return <RoomTypeCreatePage searchParams={searchParams} />;
}
