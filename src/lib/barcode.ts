import QRCode from "qrcode";
import { jsPDF } from "jspdf";

const LABEL_WIDTH_MM = 101.6;
const LABEL_HEIGHT_MM = 50.8;

const fitText = (pdf: jsPDF, value: string, maxWidth: number) => {
  if (pdf.getTextWidth(value) <= maxWidth) return value;

  let shortened = value;
  while (shortened && pdf.getTextWidth(`${shortened}...`) > maxWidth) {
    shortened = shortened.slice(0, -1);
  }
  return `${shortened.trimEnd()}...`;
};

const wrapText = (pdf: jsPDF, value: string, maxWidth: number, maxLines: number) => {
  const lines = pdf.splitTextToSize(value, maxWidth) as string[];
  if (lines.length <= maxLines) return lines;

  const visibleLines = lines.slice(0, maxLines);
  visibleLines[maxLines - 1] = fitText(pdf, `${visibleLines[maxLines - 1]}...`, maxWidth);
  return visibleLines;
};

/**
 * Barcode data structure for GRN boxes
 */
export type BarcodeData = {
  boxId: string;
  itemId?: string;
  batchLocationSku?: string | null;
  batchNumber: string;
  grnNumber: string;
  itemCode: string;
  itemName: string;
  boxNumber: number;
  qtyPerBox: number;
  deliveryDate: string;
  containerNumber?: string;
  sealNumber?: string;
  warehouseCode?: string;
  locationId?: string | null;
  locationCode?: string;
};

/**
 * Generate QR code as data URL
 */
export async function generateQRCode(data: BarcodeData): Promise<string> {
  try {
    const qrData = JSON.stringify({
      id: data.boxId,
      batchNumber: data.batchNumber,
      itemId: data.itemId || null,
      item: data.itemCode,
      box: data.boxNumber,
      qty: data.qtyPerBox,
      date: data.deliveryDate,
      container: data.containerNumber,
      seal: data.sealNumber,
      location: data.locationId || null,
      batchLocationSku: data.batchLocationSku || null,
    });
    const qrCodeDataURL = await QRCode.toDataURL(qrData, {
      errorCorrectionLevel: "H",
      type: "image/png",
      width: 256,
      margin: 1,
    });

    return qrCodeDataURL;
  } catch (error) {
    console.error("Error generating QR code:", error);
    throw new Error("Failed to generate QR code");
  }
}

/**
 * Generate printable barcode labels as a PDF with one 4-by-2-inch landscape label per page.
 * The 3 mm die-cut gap belongs in the printer media settings, outside the PDF page.
 */
export async function generateBarcodeLabelsPDF(boxes: BarcodeData[]): Promise<Blob> {
  // Match the PDF page to the physical label so printers do not scale the output.
  const pdf = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: [LABEL_WIDTH_MM, LABEL_HEIGHT_MM],
  });

  for (const [boxIndex, box] of boxes.entries()) {
    if (boxIndex > 0) {
      pdf.addPage([LABEL_WIDTH_MM, LABEL_HEIGHT_MM], "landscape");
    }

    // Generate QR code for this box
    const qrCodeDataURL = await generateQRCode(box);

    // Fill the label height while leaving room for the SKU below the QR code.
    const qrSize = 40;
    const qrX = 2;
    pdf.addImage(qrCodeDataURL, "PNG", qrX, 1.2, qrSize, qrSize);

    // Add text information (right side of QR)
    const textX = qrX + qrSize + 2.5;
    const textMaxWidth = LABEL_WIDTH_MM - textX - 2;

    // Batch number and item code
    pdf.setFontSize(14);
    pdf.setFont("helvetica", "bold");
    pdf.text(fitText(pdf, box.batchNumber, textMaxWidth), textX, 7);

    pdf.setFontSize(10);
    pdf.setFont("helvetica", "normal");
    pdf.text(fitText(pdf, box.itemCode, textMaxWidth), textX, 13);

    // Let longer names use the available height without colliding with the destination.
    pdf.setFontSize(10);
    const itemNameY = 19;
    const itemNameLines = wrapText(pdf, box.itemName, textMaxWidth, 3);
    pdf.text(itemNameLines, textX, itemNameY);
    const locationY = itemNameY + Math.max(0, itemNameLines.length - 1) * 4.1 + 6;

    let locationLineCount = 0;
    if (box.warehouseCode || box.locationCode) {
      const locationInfo = [box.warehouseCode || "", box.locationCode || ""]
        .filter(Boolean)
        .join(" | ");
      pdf.setFont("helvetica", "bold");
      const locationLines = wrapText(pdf, locationInfo, textMaxWidth, 2);
      locationLineCount = locationLines.length;
      pdf.text(locationLines, textX, locationY);
    }

    // Place quantity directly beneath the destination, including wrapped locations.
    pdf.setFontSize(15);
    pdf.setFont("helvetica", "bold");
    const quantityY = locationY + Math.max(0, locationLineCount - 1) * 4.1 + 6.5;
    pdf.text(fitText(pdf, `Qty: ${box.qtyPerBox}`, textMaxWidth), textX, quantityY);

    if (box.batchLocationSku) {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      const skuLines = wrapText(pdf, box.batchLocationSku, qrSize, 2);
      skuLines.forEach((skuLine, index) => {
        const skuX = qrX + (qrSize - pdf.getTextWidth(skuLine)) / 2;
        pdf.text(skuLine, skuX, 48 - (skuLines.length - 1 - index) * 3.5);
      });
    }
  }

  return pdf.output("blob");
}

/**
 * Print barcode labels
 */
export async function printBarcodeLabels(boxes: BarcodeData[]): Promise<void> {
  try {
    const pdfBlob = await generateBarcodeLabelsPDF(boxes);
    const pdfURL = URL.createObjectURL(pdfBlob);

    // Open PDF in new window for printing
    const printWindow = window.open(pdfURL, "_blank");
    if (printWindow) {
      printWindow.onload = () => {
        printWindow.print();
      };
    } else {
      // Fallback: trigger download if popup blocked
      const link = document.createElement("a");
      link.href = pdfURL;
      link.download = `barcode-labels-${Date.now()}.pdf`;
      link.click();
    }

    // Clean up
    setTimeout(() => URL.revokeObjectURL(pdfURL), 60000);
  } catch (error) {
    console.error("Error printing labels:", error);
    throw new Error("Failed to print barcode labels");
  }
}
