/**
 * Loading skeletons shown instantly while a page's data loads (used by the route loading.tsx files).
 * Pure server components: no JavaScript is shipped for them.
 */

function Bone({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-slate-200/80 ${className}`} />;
}

function HeaderSkeleton({ action = true }: { action?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 pt-2">
      <div className="space-y-2">
        <Bone className="h-4 w-48" />
        <Bone className="h-3 w-80 max-w-full" />
      </div>
      {action && <Bone className="h-9 w-32 rounded-lg" />}
    </div>
  );
}

/** List page: title, filter bar, grid table, pagination. */
export function TableSkeleton({ rows = 10, cols = 7 }: { rows?: number; cols?: number }) {
  return (
    <div aria-busy="true" aria-label="Loading" className="space-y-5">
      <HeaderSkeleton />
      <div className="w-full bg-white border border-line">
        <div className="flex h-9 border-b border-line">
          {[160, 140, 140].map((w, i) => (
            <div key={i} className="border-r border-line px-3 flex items-center" style={{ width: w }}>
              <Bone className="h-3 w-full" />
            </div>
          ))}
          <div className="flex-1 px-3 flex items-center">
            <Bone className="h-3 w-64" />
          </div>
        </div>
        <div className="flex justify-end px-3 py-1.5">
          <Bone className="h-3 w-16" />
        </div>
        <div className="border-t border-line">
          <div className="flex bg-head border-b border-line">
            {Array.from({ length: cols }, (_, i) => (
              <div key={i} className="flex-1 px-3 py-2.5 border-r border-line last:border-r-0">
                <Bone className="h-3 w-2/3" />
              </div>
            ))}
          </div>
          {Array.from({ length: rows }, (_, r) => (
            <div key={r} className="flex border-b border-line last:border-b-0">
              {Array.from({ length: cols }, (_, c) => (
                <div key={c} className="flex-1 px-3 py-3 border-r border-line last:border-r-0">
                  <Bone className={`h-3 ${c === 0 ? "w-3/4" : c % 3 === 0 ? "w-1/2" : "w-5/6"}`} />
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between px-3 py-2 border-t border-line">
          <Bone className="h-3 w-32" />
          <Bone className="h-3 w-40" />
        </div>
      </div>
    </div>
  );
}

/** Create / edit form: FormCard with sections of fields. */
export function FormSkeleton({ sections = 2 }: { sections?: number }) {
  return (
    <div aria-busy="true" aria-label="Loading" className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-200 flex items-center gap-3">
        <Bone className="h-8 w-8 rounded-lg" />
        <Bone className="h-9 w-9 rounded-lg" />
        <div className="space-y-2">
          <Bone className="h-4 w-44" />
          <Bone className="h-3 w-72" />
        </div>
      </div>
      <div className="px-6 py-5 space-y-6">
        {Array.from({ length: sections }, (_, s) => (
          <div key={s} className="space-y-3">
            <Bone className="h-3 w-28" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-5 gap-y-4">
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="space-y-1.5">
                  <Bone className="h-3 w-24" />
                  <Bone className="h-9 w-full rounded-lg" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="px-6 py-4 bg-slate-50/80 border-t border-slate-200 flex justify-end gap-3">
        <Bone className="h-9 w-20 rounded-lg" />
        <Bone className="h-9 w-32 rounded-lg" />
      </div>
    </div>
  );
}

/** Record view: DetailCard with labelled value boxes. */
export function DetailSkeleton({ sections = 3 }: { sections?: number }) {
  return (
    <div aria-busy="true" aria-label="Loading" className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-200 flex items-center gap-3">
        <Bone className="h-8 w-8 rounded-lg" />
        <Bone className="h-9 w-9 rounded-lg" />
        <div className="space-y-2">
          <Bone className="h-4 w-40" />
          <Bone className="h-3 w-64" />
        </div>
      </div>
      <div className="p-6 space-y-6">
        {Array.from({ length: sections }, (_, s) => (
          <div key={s} className="space-y-3">
            <Bone className="h-3 w-24" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="p-2.5 bg-slate-50/70 border border-slate-200/80 rounded-lg space-y-2">
                  <Bone className="h-2.5 w-16" />
                  <Bone className="h-3.5 w-3/4" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Home overview: stat cards + two panels. */
export function OverviewSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading" className="space-y-5">
      <HeaderSkeleton action={false} />
      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex justify-between">
            <div className="space-y-2.5">
              <Bone className="h-2.5 w-24" />
              <Bone className="h-6 w-16" />
              <Bone className="h-2.5 w-20" />
            </div>
            <Bone className="h-9 w-9 rounded-lg" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {[0, 1].map((p) => (
          <div key={p} className="bg-white border border-line">
            <div className="px-3 py-2.5 border-b border-line">
              <Bone className="h-3 w-40" />
            </div>
            {Array.from({ length: 4 }, (_, r) => (
              <div key={r} className="flex gap-4 px-3 py-3 border-b border-line last:border-b-0">
                <Bone className="h-3 w-1/3" />
                <Bone className="h-3 w-1/6" />
                <Bone className="h-3 w-1/6" />
                <Bone className="h-3 w-1/6" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Booking grid: toolbar, date header and room rows with a few bars. */
export function GridSkeleton() {
  const days = 14;
  return (
    <div aria-busy="true" aria-label="Loading" className="space-y-5">
      <HeaderSkeleton action={false} />
      <div className="bg-white border border-line">
        <div className="flex h-9 border-b border-line">
          {[190, 150, 140, 120, 110].map((w, i) => (
            <div key={i} className="border-r border-line px-3 flex items-center" style={{ width: w }}>
              <Bone className="h-3 w-full" />
            </div>
          ))}
        </div>
        <div className="overflow-hidden">
          <div className="flex bg-head border-b border-line">
            <div className="w-[150px] shrink-0 px-3 py-3 border-r border-line">
              <Bone className="h-3 w-12" />
            </div>
            {Array.from({ length: days }, (_, i) => (
              <div key={i} className="flex-1 min-w-[56px] py-2 border-r border-line flex flex-col items-center gap-1">
                <Bone className="h-2 w-6" />
                <Bone className="h-3.5 w-5" />
              </div>
            ))}
          </div>
          {Array.from({ length: 10 }, (_, r) => {
            const start = (r * 3) % 9;
            const span = 2 + (r % 4);
            return (
              <div key={r} className="flex border-b border-line h-9">
                <div className="w-[150px] shrink-0 px-3 flex items-center border-r border-line">
                  <Bone className="h-3 w-14" />
                </div>
                <div className="flex-1 relative">
                  <div
                    className="absolute top-1.5 h-6 rounded bg-brand-light animate-pulse"
                    style={{ left: `${(start / days) * 100}%`, width: `${(span / days) * 100}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** Room status board: filter chips + room cards. */
export function BoardSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading" className="space-y-5">
      <HeaderSkeleton action={false} />
      <div className="bg-white border border-line flex h-9">
        {[190, 70, 90, 90, 90, 90, 120].map((w, i) => (
          <div key={i} className="border-r border-line px-3 flex items-center" style={{ width: w }}>
            <Bone className="h-3 w-full" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2.5">
        {Array.from({ length: 16 }, (_, i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-lg p-2.5 space-y-2">
            <div className="flex justify-between">
              <Bone className="h-4 w-10" />
              <Bone className="h-2.5 w-2.5 rounded-full" />
            </div>
            <Bone className="h-2.5 w-20" />
            <Bone className="h-4 w-16" />
            <Bone className="h-3 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Month calendar: toolbar, 7 × 5 day cells and the day list beside it. */
export function CalendarSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading" className="space-y-5">
      <HeaderSkeleton action={false} />
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_400px] gap-4">
        <div className="bg-white border border-line p-3">
          <Bone className="h-6 w-72 mb-3" />
          <div className="grid grid-cols-7 gap-1.5">
            {Array.from({ length: 35 }, (_, i) => (
              <Bone key={i} className="h-16 sm:h-[92px] rounded-lg" />
            ))}
          </div>
        </div>
        <div className="bg-white border border-line p-3 space-y-3">
          <Bone className="h-4 w-40" />
          {Array.from({ length: 8 }, (_, i) => (
            <Bone key={i} className="h-9 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
