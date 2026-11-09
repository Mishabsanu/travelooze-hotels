import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { requireUser } from "@/server/auth/session";
import { listSwitcherHotels } from "@/server/services/hotel.service";

/** Every /dashboard page is server-rendered behind a verified session. */
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const hotels = await listSwitcherHotels(user);
  return (
    <AppShell user={user} hotels={hotels}>
      {children}
    </AppShell>
  );
}
