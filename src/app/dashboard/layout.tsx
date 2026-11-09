import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { requireUser } from "@/server/auth/session";

/** Every /dashboard page is server-rendered behind a verified session. */
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  return <AppShell user={user}>{children}</AppShell>;
}
