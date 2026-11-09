import { BookingCreatePage } from "@/components/bookings/BookingPages";

export const metadata = { title: "New Agent Booking" };

export default function Page({ searchParams }: PageProps<"/dashboard/sales/agent-bookings/new">) {
  return <BookingCreatePage searchParams={searchParams} source="agent" />;
}
