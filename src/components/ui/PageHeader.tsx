import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  description?: string;
  /** Kept for existing callers; Sentinel-style headers don't show a breadcrumb. */
  breadcrumb?: string;
  actions?: ReactNode;
}

/** Plain title row on the page background — no card or border, as in Sentinel iWMS list pages. */
export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
      <div>
        <h1 className="text-base font-semibold text-slate-800 tracking-tight">{title}</h1>
        {description && <p className="text-[11.5px] text-slate-500 mt-0.5">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">{actions}</div>}
    </div>
  );
}
