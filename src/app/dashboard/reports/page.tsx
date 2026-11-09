import { ReportPage } from "@/components/reports/ReportPage";

export const metadata = { title: "Reports" };

export default function Page({ searchParams }: PageProps<"/dashboard/reports">) {
  return <ReportPage searchParams={searchParams} />;
}
