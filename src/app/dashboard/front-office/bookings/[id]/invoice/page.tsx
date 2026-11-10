import { InvoicePage } from "@/components/bookings/BookingPages";

export const metadata = { title: "Invoice" };

export default function Page({ params, searchParams }: PageProps<"/dashboard/front-office/bookings/[id]/invoice">) {
  return <InvoicePage params={params} searchParams={searchParams} />;
}
