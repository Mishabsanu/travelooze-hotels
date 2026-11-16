import { RecycleBinPage } from "@/components/admin/RecycleBinPage";

export const metadata = { title: "Recycle Bin" };

export default function Page({ searchParams }: PageProps<"/dashboard/admin/recycle-bin">) {
  return <RecycleBinPage searchParams={searchParams} />;
}
