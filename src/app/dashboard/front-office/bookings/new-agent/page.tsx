import { BookingCreatePage } from "@/components/bookings/BookingPages";

export const metadata = { title: "New Agent Booking" };

export default function Page({ searchParams }: PageProps<"/dashboard/front-office/bookings/new-agent">) {
  return <BookingCreatePage searchParams={searchParams} source="agent" />;
}
