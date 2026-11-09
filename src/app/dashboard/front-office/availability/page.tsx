import { BookingGridPage } from "@/components/bookings/GridPages";

export const metadata = { title: "Booking Grid" };

export default function Page({ searchParams }: PageProps<"/dashboard/front-office/availability">) {
  return <BookingGridPage searchParams={searchParams} />;
}
