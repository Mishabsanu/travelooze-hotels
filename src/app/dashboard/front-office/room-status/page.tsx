import { RoomBoardPage } from "@/components/bookings/GridPages";

export const metadata = { title: "Room Status" };

export default function Page({ searchParams }: PageProps<"/dashboard/front-office/room-status">) {
  return <RoomBoardPage searchParams={searchParams} />;
}
