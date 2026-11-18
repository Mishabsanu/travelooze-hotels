import { redirect } from "next/navigation";

/** Moved to Front Office (each page lives in one menu only); old links still work. */
export default async function Page({ searchParams }: PageProps<"/dashboard/overview/booking-grid">) {
  const q = new URLSearchParams(Object.entries(await searchParams).flatMap(([k, v]) => (Array.isArray(v) ? v : v ? [v] : []).map((x) => [k, x])));
  redirect(`/dashboard/front-office/availability${q.size ? `?${q}` : ""}`);
}
