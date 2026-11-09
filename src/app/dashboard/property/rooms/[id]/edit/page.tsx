import { RoomEditPage } from "@/components/property/PropertyPages";

export const metadata = { title: "Edit Room" };

export default function Page({ params }: PageProps<"/dashboard/property/rooms/[id]/edit">) {
  return <RoomEditPage params={params} />;
}
