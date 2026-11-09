import { UserEditPage } from "@/components/users/UserPages";

export const metadata = { title: "Edit User" };

export default function Page({ params }: PageProps<"/dashboard/admin/users/[id]/edit">) {
  return <UserEditPage params={params} />;
}
