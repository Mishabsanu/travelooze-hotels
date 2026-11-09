import { AgentEditPage } from "@/components/sales/AgentPages";

export const metadata = { title: "Edit Agent" };

export default function Page({ params }: PageProps<"/dashboard/sales/agents/[id]/edit">) {
  return <AgentEditPage params={params} />;
}
