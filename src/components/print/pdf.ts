"use client";

const A4 = { width: 210, height: 297 }; // mm
const MARGIN = 10; // mm

/**
 * Renders a DOM element to an A4 PDF and downloads it.
 * html-to-image lets the browser itself paint the element (SVG foreignObject), so Tailwind v4
 * colours (oklch) come out exactly as on screen — unlike html2canvas, which AKOD had to strip
 * colours for. Tall documents are split across pages.
 */
export async function downloadElementAsPdf(
  element: HTMLElement,
  fileName: string,
  orientation: "portrait" | "landscape" = "portrait"
): Promise<void> {
  const page = orientation === "landscape" ? { width: A4.height, height: A4.width } : A4;
  const [{ toCanvas }, { jsPDF }] = await Promise.all([import("html-to-image"), import("jspdf")]);

  const canvas = await toCanvas(element, {
    pixelRatio: 2,
    backgroundColor: "#ffffff",
    cacheBust: true,
    // The on-screen card frame is not part of the document
    style: { border: "none", boxShadow: "none", margin: "0", maxWidth: "none" },
    filter: (node) => !(node instanceof HTMLElement && node.classList.contains("no-print")),
  });

  const pdf = new jsPDF({ orientation, unit: "mm", format: "a4", compress: true });
  const contentWidth = page.width - MARGIN * 2;
  const contentHeight = page.height - MARGIN * 2;
  const pxPerMm = canvas.width / contentWidth;
  const pageHeightPx = Math.floor(contentHeight * pxPerMm);

  let offset = 0;
  let pages = 0;
  while (offset < canvas.height) {
    const sliceHeight = Math.min(pageHeightPx, canvas.height - offset);
    const slice = document.createElement("canvas");
    slice.width = canvas.width;
    slice.height = sliceHeight;
    const ctx = slice.getContext("2d");
    if (!ctx) throw new Error("Canvas is not available in this browser");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, slice.width, slice.height);
    ctx.drawImage(canvas, 0, offset, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);

    if (pages > 0) pdf.addPage();
    pdf.addImage(slice.toDataURL("image/jpeg", 0.92), "JPEG", MARGIN, MARGIN, contentWidth, sliceHeight / pxPerMm);
    offset += sliceHeight;
    pages++;
  }

  // Page numbers on multi-page documents
  if (pages > 1) {
    pdf.setFontSize(8);
    pdf.setTextColor(100, 116, 139);
    for (let i = 1; i <= pages; i++) {
      pdf.setPage(i);
      pdf.text(`Page ${i} of ${pages}`, page.width - MARGIN, page.height - 4, { align: "right" });
    }
  }

  pdf.save(fileName.toLowerCase().endsWith(".pdf") ? fileName : `${fileName}.pdf`);
}

/** Renders a DOM element to a PNG image (same look as the PDF) and downloads it. */
export async function downloadElementAsImage(element: HTMLElement, fileName: string): Promise<void> {
  const { toPng } = await import("html-to-image");
  const dataUrl = await toPng(element, {
    pixelRatio: 2,
    backgroundColor: "#ffffff",
    cacheBust: true,
    style: { border: "none", boxShadow: "none", margin: "0", maxWidth: "none" },
    filter: (node) => !(node instanceof HTMLElement && node.classList.contains("no-print")),
  });
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = `${fileName.replace(/\.pdf$/i, "")}.png`;
  link.click();
}

/** Safe file name from document title + number, e.g. "Delivery-Note-DN-00001". */
export function pdfFileName(...parts: (string | undefined | null)[]): string {
  return parts
    .filter(Boolean)
    .join("-")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
