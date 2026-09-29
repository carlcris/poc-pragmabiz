/**
 * Handing a generated PDF to the browser.
 *
 * An earlier version of this module rasterised the on-screen form with
 * html2canvas. That produced two visible defects — underlines struck through
 * their own text, and collapsed word spacing ("CHOPANDJOIN") from html2canvas
 * 1.4.1 mis-measuring the `next/font` Inter face — so the forms are drawn as
 * real PDFs instead (see `components/framing/RequisitionPDF.tsx`) and this
 * module only delivers the resulting blob.
 */

/**
 * Opens the PDF in a new tab and asks the browser to print it.
 *
 * `window.print()` on the page itself is not usable: the app has no print
 * stylesheet, so it would print the whole dashboard with the modal chrome
 * around it.
 */
export async function openPdf(blob: Blob): Promise<void> {
  const url = URL.createObjectURL(blob);
  const printWindow = window.open(url, "_blank");

  if (!printWindow) {
    URL.revokeObjectURL(url);
    throw new Error("POPUP_BLOCKED");
  }

  // Some browsers fire `load` before the embedded viewer is ready and some
  // never fire it at all, so a timer backs it up; `didPrint` keeps whichever
  // arrives first from printing twice.
  let didPrint = false;
  const print = () => {
    if (didPrint || printWindow.closed) return;
    didPrint = true;
    printWindow.focus();
    printWindow.print();
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  printWindow.addEventListener("load", print, { once: true });
  window.setTimeout(print, 500);
}

/** Saves the PDF under `fileName`. */
export function savePdf(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName.endsWith(".pdf") ? fileName : `${fileName}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
