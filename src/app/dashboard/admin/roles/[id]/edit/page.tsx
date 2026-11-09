import { RoleEditPage } from "@/components/roles/RolePages";

export const metadata = { title: "Edit Role" };

export default function Page({ params }: PageProps<"/dashboard/admin/roles/[id]/edit">) {
  return <RoleEditPage params={params} />;
}
