import { DailyReportPage } from "@/components/reports/DailyReportPage";

export const metadata = { title: "Daily Report" };

export default function Page({ searchParams }: PageProps<"/dashboard/reports/daily">) {
  return <DailyReportPage searchParams={searchParams} />;
}
