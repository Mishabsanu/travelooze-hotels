import { UserListPage } from "@/components/users/UserPages";

export const metadata = { title: "User Directory" };

export default function Page({ searchParams }: PageProps<"/dashboard/admin/users">) {
  return <UserListPage searchParams={searchParams} />;
}
