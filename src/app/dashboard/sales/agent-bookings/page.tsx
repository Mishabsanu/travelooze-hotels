import { BookingListPage } from "@/components/bookings/BookingPages";

export const metadata = { title: "Agent Bookings" };

export default function Page({ searchParams }: PageProps<"/dashboard/sales/agent-bookings">) {
  return <BookingListPage searchParams={searchParams} agentOnly />;
}
