import { BookingCreatePage } from "@/components/bookings/BookingPages";

export const metadata = { title: "New Booking" };

export default function Page({ searchParams }: PageProps<"/dashboard/front-office/bookings/new">) {
  return <BookingCreatePage searchParams={searchParams} source="walkin" />;
}
