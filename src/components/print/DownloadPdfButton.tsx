"use client";

import { FileDown, ImageDown } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { downloadElementAsImage, downloadElementAsPdf } from "./pdf";

interface DownloadPdfButtonProps {
  /** CSS selector of the sheet to export, e.g. ".print-sheet" */
  target: string;
  fileName: string;
  label?: string;
  orientation?: "portrait" | "landscape";
}

/** Downloads the on-screen document as a branded A4 PDF (same layout as Print). */
export function DownloadPdfButton({ target, fileName, label = "Download PDF", orientation }: DownloadPdfButtonProps) {
  const [busy, setBusy] = useState(false);

  const handleClick = async () => {
    const element = document.querySelector<HTMLElement>(target);
    if (!element) {
      toast.error("Nothing to export on this page");
      return;
    }
    setBusy(true);
    const toastId = toast.loading("Preparing PDF…");
    try {
      await downloadElementAsPdf(element, fileName, orientation);
      toast.success("PDF downloaded", { id: toastId });
    } catch (error) {
      console.error("PDF export failed", error);
      toast.error("Could not create the PDF. Use Print → Save as PDF instead.", { id: toastId });
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      className="no-print inline-flex items-center gap-1.5 bg-white hover:bg-brand-light text-brand border border-brand-border rounded-lg px-3.5 py-2 font-bold text-xs shadow-xs transition disabled:opacity-60"
    >
      {busy ? (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand border-t-transparent" />
      ) : (
        <FileDown className="w-4 h-4" />
      )}
      {busy ? "Preparing…" : label}
    </button>
  );
}

/** Downloads the on-screen document as a PNG image. */
export function DownloadImageButton({ target, fileName, label = "Download Image" }: Omit<DownloadPdfButtonProps, "orientation">) {
  const [busy, setBusy] = useState(false);

  const handleClick = async () => {
    const element = document.querySelector<HTMLElement>(target);
    if (!element) {
      toast.error("Nothing to export on this page");
      return;
    }
    setBusy(true);
    const toastId = toast.loading("Preparing image…");
    try {
      await downloadElementAsImage(element, fileName);
      toast.success("Image downloaded", { id: toastId });
    } catch (error) {
      console.error("Image export failed", error);
      toast.error("Could not create the image", { id: toastId });
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      className="no-print inline-flex items-center gap-1.5 bg-white hover:bg-brand-light text-brand border border-brand-border rounded-lg px-3.5 py-2 font-bold text-xs shadow-xs transition disabled:opacity-60"
    >
      {busy ? (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand border-t-transparent" />
      ) : (
        <ImageDown className="w-4 h-4" />
      )}
      {busy ? "Preparing…" : label}
    </button>
  );
}
