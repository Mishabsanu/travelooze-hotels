import { AnalyticsPage } from "@/components/analytics/AnalyticsPage";

export const metadata = { title: "Analytics" };

export default function Page({ searchParams }: PageProps<"/dashboard/overview/analytics">) {
  return <AnalyticsPage searchParams={searchParams} />;
}
