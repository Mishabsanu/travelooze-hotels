import { AgentReportPage } from "@/components/reports/AgentReportPage";

export const metadata = { title: "Agent Report" };

export default function Page({ searchParams }: PageProps<"/dashboard/reports/agents">) {
  return <AgentReportPage searchParams={searchParams} />;
}
