"use client";

import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { can, type PermissionAction, type PermissionModule } from "@/lib/permissions";
import type { SessionUser } from "@/lib/types";

const SessionContext = createContext<SessionUser | null>(null);

/** Time of the last /api/auth/me check (module level so it survives re-renders). */
let lastCheck = Date.now();

/**
 * Starts with the user from the server layout (no loading flash). The layout is not re-rendered on
 * client navigation, so the session is re-read on every route change and when the tab regains focus:
 * role / permission changes then hide or show buttons without a full page reload.
 */
export function SessionProvider({ user, children }: { user: SessionUser; children: ReactNode }) {
  const [current, setCurrent] = useState(user);
  const [fromServer, setFromServer] = useState(user);
  const pathname = usePathname();

  // A fresh server render (router.refresh, full load) wins
  if (user !== fromServer) {
    setFromServer(user);
    setCurrent(user);
  }

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      // Throttled: at most one check per 30 s while clicking around (the API enforces permissions anyway)
      if (Date.now() - lastCheck < 30_000) return;
      lastCheck = Date.now();
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store", credentials: "same-origin" });
        if (!res.ok) return;
        const data = (await res.json()) as { user?: SessionUser };
        if (!cancelled && data.user) {
          setCurrent((prev) => (JSON.stringify(prev) === JSON.stringify(data.user) ? prev : data.user!));
        }
      } catch {
        // Offline: keep the last known session; the API still enforces every permission
      }
    };
    void refresh();
    window.addEventListener("focus", refresh);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", refresh);
    };
  }, [pathname]);

  return <SessionContext.Provider value={current}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionUser {
  const user = useContext(SessionContext);
  if (!user) throw new Error("useSession must be used inside SessionProvider");
  return user;
}

export function usePermission(module: PermissionModule, action: PermissionAction = "view"): boolean {
  return can(useSession(), module, action);
}
