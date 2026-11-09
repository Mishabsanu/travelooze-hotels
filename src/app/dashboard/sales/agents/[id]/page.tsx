import { AgentDetailPage } from "@/components/sales/AgentPages";

export const metadata = { title: "Agent" };

export default function Page({ params, searchParams }: PageProps<"/dashboard/sales/agents/[id]">) {
  return <AgentDetailPage params={params} searchParams={searchParams} />;
}
