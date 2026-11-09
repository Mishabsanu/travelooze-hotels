import { RoomTypeEditPage } from "@/components/property/PropertyPages";

export const metadata = { title: "Edit Room Type" };

export default function Page({ params }: PageProps<"/dashboard/property/room-types/[id]/edit">) {
  return <RoomTypeEditPage params={params} />;
}
