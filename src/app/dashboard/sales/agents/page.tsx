import { AgentListPage } from "@/components/sales/AgentPages";

export const metadata = { title: "B2B Agents" };

export default function Page({ searchParams }: PageProps<"/dashboard/sales/agents">) {
  return <AgentListPage searchParams={searchParams} />;
}
