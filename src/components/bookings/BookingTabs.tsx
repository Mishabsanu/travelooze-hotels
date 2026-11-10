"use client";

import { useState, type ReactNode } from "react";

export interface BookingTab {
  id: string;
  label: string;
  /** Small count next to the label, e.g. guests */
  count?: string;
  content: ReactNode;
}

/**
 * Tabs of the booking page. Every tab stays mounted (only hidden), so unsaved rooming-list edits
 * survive switching tabs; printing shows all of them one after another.
 */
export function BookingTabs({ tabs, initial }: { tabs: BookingTab[]; initial?: string }) {
  const [active, setActive] = useState(tabs.some((t) => t.id === initial) ? initial! : tabs[0].id);
  return (
    <div>
      <div role="tablist" aria-label="Booking sections" className="no-print flex gap-1 overflow-x-auto border-b border-slate-200 px-4 sm:px-6">
        {tabs.map((t) => {
          const on = t.id === active;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={on}
              aria-controls={`panel-${t.id}`}
              onClick={() => setActive(t.id)}
              className={`-mb-px inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-bold transition ${
                on ? "border-brand text-brand" : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              {t.label}
              {t.count && <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${on ? "bg-brand-light text-brand" : "bg-slate-100 text-slate-500"}`}>{t.count}</span>}
            </button>
          );
        })}
      </div>
      {tabs.map((t) => (
        <div
          key={t.id}
          role="tabpanel"
          id={`panel-${t.id}`}
          aria-labelledby={`tab-${t.id}`}
          className={`space-y-4 p-4 sm:p-6 ${t.id === active ? "" : "hidden print:block"}`}
        >
          {t.content}
        </div>
      ))}
    </div>
  );
}
