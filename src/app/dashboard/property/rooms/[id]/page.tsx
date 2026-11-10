import { RoomDetailPage } from "@/components/property/PropertyPages";

export const metadata = { title: "Room" };

export default function Page({ params }: PageProps<"/dashboard/property/rooms/[id]">) {
  return <RoomDetailPage params={params} />;
}
