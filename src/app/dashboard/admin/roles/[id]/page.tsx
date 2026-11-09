import { RoleDetailPage } from "@/components/roles/RolePages";

export const metadata = { title: "Role" };

export default function Page({ params }: PageProps<"/dashboard/admin/roles/[id]">) {
  return <RoleDetailPage params={params} />;
}
