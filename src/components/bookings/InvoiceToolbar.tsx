"use client";

import { ArrowLeft, FileCheck2, Printer } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { DownloadPdfButton } from "@/components/print/DownloadPdfButton";
import { pdfFileName } from "@/components/print/pdf";
import { usePermission } from "@/components/providers/SessionProvider";
import { Button } from "@/components/ui/Button";
import type { Booking } from "@/lib/hotelTypes";
import { ApiError, apiRequest } from "@/services/apiClient";
import { BOOKING_BASE } from "./bookingConfig";

/** Back / Issue invoice number / Download PDF / Print */
export function InvoiceToolbar({ b }: { b: Booking }) {
  const router = useRouter();
  const canIssue = usePermission("payment", "create");
  const [busy, setBusy] = useState(false);

  const issue = async () => {
    setBusy(true);
    try {
      await apiRequest(`/api/bookings/${b._id}/invoice`, "POST", {});
      toast.success("Invoice number issued");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not issue the invoice");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="no-print flex flex-wrap items-center gap-2 max-w-[820px] mx-auto">
      <Link href={`${BOOKING_BASE}/${b._id}`} className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg border border-slate-300 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50">
        <ArrowLeft className="w-4 h-4" /> Booking
      </Link>
      <div className="flex-1" />
      {!b.invoiceNo && canIssue && b.status !== "cancelled" && (
        <Button icon={<FileCheck2 className="w-4 h-4" />} loading={busy} onClick={issue}>
          Issue Invoice Number
        </Button>
      )}
      <DownloadPdfButton target=".print-sheet" fileName={pdfFileName("Invoice", b.invoiceNo ?? `Proforma-${b.bookingNo}`)} />
      <Button variant="outline" icon={<Printer className="w-4 h-4" />} onClick={() => window.print()}>
        Print
      </Button>
    </div>
  );
}
