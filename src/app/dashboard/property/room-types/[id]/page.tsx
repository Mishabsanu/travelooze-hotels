import { RoomTypeDetailPage } from "@/components/property/PropertyPages";

export const metadata = { title: "Room Type" };

export default function Page({ params }: PageProps<"/dashboard/property/room-types/[id]">) {
  return <RoomTypeDetailPage params={params} />;
}
