import { UserDetailPage } from "@/components/users/UserPages";

export const metadata = { title: "User" };

export default function Page({ params }: PageProps<"/dashboard/admin/users/[id]">) {
  return <UserDetailPage params={params} />;
}
