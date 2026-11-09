import { Spinner } from "@/components/ui/Spinner";

export default function Loading() {
  return (
    <div className="bg-white rounded-xl border border-slate-200">
      <Spinner label="Loading..." />
    </div>
  );
}
