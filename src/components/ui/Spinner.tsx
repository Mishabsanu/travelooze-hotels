export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-12">
      <div className="h-7 w-7 animate-spin rounded-full border-[3px] border-brand border-t-transparent" />
      {label && <span className="text-xs font-semibold text-slate-500">{label}</span>}
    </div>
  );
}
