import { BookingListPage } from "@/components/bookings/BookingPages";

export const metadata = { title: "Bookings" };

export default function Page({ searchParams }: PageProps<"/dashboard/front-office/bookings">) {
  return <BookingListPage searchParams={searchParams} />;
}
