import { BookingGridPage } from "@/components/bookings/GridPages";

export const metadata = { title: "Booking Grid" };

export default function Page({ searchParams }: PageProps<"/dashboard/overview/booking-grid">) {
  return <BookingGridPage searchParams={searchParams} />;
}
