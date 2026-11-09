import { CalendarPage } from "@/components/bookings/GridPages";

export const metadata = { title: "Calendar" };

export default function Page({ searchParams }: PageProps<"/dashboard/front-office/calendar">) {
  return <CalendarPage searchParams={searchParams} />;
}
