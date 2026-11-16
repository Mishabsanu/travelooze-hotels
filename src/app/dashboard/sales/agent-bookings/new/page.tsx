import { redirect } from "next/navigation";

/** Moved under Front Office (keeps ?agent= / ?hotel= / dates). */
export default async function Page({ searchParams }: PageProps<"/dashboard/sales/agent-bookings/new">) {
  const sp = await searchParams;
  const q = new URLSearchParams(Object.entries(sp).flatMap(([k, v]) => (v === undefined ? [] : (Array.isArray(v) ? v : [v]).map((x) => [k, x] as [string, string]))));
  redirect(`/dashboard/front-office/bookings/new-agent${q.size ? `?${q}` : ""}`);
}
