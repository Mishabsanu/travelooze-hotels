import { RoleListPage } from "@/components/roles/RolePages";

export const metadata = { title: "Roles & Permissions" };

export default function Page({ searchParams }: PageProps<"/dashboard/admin/roles">) {
  return <RoleListPage searchParams={searchParams} />;
}
