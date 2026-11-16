import { redirect } from "next/navigation";

/** The agent bookings list is the main Bookings list filtered to agents. */
export default function Page() {
  redirect("/dashboard/front-office/bookings?source=agent");
}
