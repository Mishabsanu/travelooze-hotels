import { redirect } from "next/navigation";

/** The recycle bin moved to Admin (one place for every module). */
export default function Page() {
  redirect("/dashboard/admin/recycle-bin?tab=booking");
}
