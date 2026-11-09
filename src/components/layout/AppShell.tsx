"use client";

import { useCallback, useState, type ReactNode } from "react";
import type { SessionUser } from "@/lib/types";
import { SessionProvider, useSession } from "@/components/providers/SessionProvider";
import { LeftSidebar } from "./LeftSidebar";
import { MobileNav } from "./MobileNav";
import { TopHeader } from "./TopHeader";
import { visibleModules } from "./navigation";

/** Menus follow the live session, so a role change updates the rail and tabs too. */
function ShellFrame({ children }: { children: ReactNode }) {
  const modules = visibleModules(useSession());
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  return (
    <div className="min-h-screen flex flex-col bg-canvas text-slate-900">
      <TopHeader modules={modules} onMenu={() => setMenuOpen(true)} />
      <MobileNav modules={modules} open={menuOpen} onClose={closeMenu} />
      <div className="flex flex-1 min-h-screen">
        <LeftSidebar modules={modules} />
        <main className="flex-1 print:m-0 ml-0 md:ml-[88px] mt-[128px] p-3 sm:p-5 lg:p-7 w-full min-w-0 overflow-x-hidden">
          <div className="w-full max-w-[1600px] mx-auto space-y-4 sm:space-y-5">{children}</div>
        </main>
      </div>
    </div>
  );
}

/** Fixed 88px rail + 128px header; the page content scrolls in the canvas. */
export function AppShell({ user, children }: { user: SessionUser; children: ReactNode }) {
  return (
    <SessionProvider user={user}>
      <ShellFrame>{children}</ShellFrame>
    </SessionProvider>
  );
}
