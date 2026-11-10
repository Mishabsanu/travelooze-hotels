import { VoucherPage } from "@/components/bookings/BookingPages";

export const metadata = { title: "Booking Voucher" };

export default function Page({ params, searchParams }: PageProps<"/dashboard/front-office/bookings/[id]/voucher">) {
  return <VoucherPage params={params} searchParams={searchParams} />;
}
