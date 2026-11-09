import { BookingDetailPage } from "@/components/bookings/BookingPages";

export const metadata = { title: "Booking" };

export default function Page({ params }: PageProps<"/dashboard/front-office/bookings/[id]">) {
  return <BookingDetailPage params={params} />;
}
