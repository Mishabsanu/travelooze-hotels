import { RoomReportPage } from "@/components/reports/RoomReportPage";

export const metadata = { title: "Room Report" };

export default function Page({ searchParams }: PageProps<"/dashboard/overview/rooms">) {
  return <RoomReportPage searchParams={searchParams} />;
}
