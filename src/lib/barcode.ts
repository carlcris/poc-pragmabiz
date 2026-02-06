import QRCode from "qrcode";
import { jsPDF } from "jspdf";

/**
 * Barcode data structure for GRN boxes
 */
export type BarcodeData = {
  boxId: string;
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
      item: data.itemCode,
      box: data.boxNumber,
      qty: data.qtyPerBox,
      date: data.deliveryDate,
      container: data.containerNumber,
      seal: data.sealNumber,
      location: data.locationCode,
    });
    const qrCodeDataURL = await QRCode.toDataURL(qrData, {
      errorCorrectionLevel: "H",
      type: "image/png",
      width: 256, // Slightly larger for better scanning on 80mm labels
      margin: 1,
    });

    return qrCodeDataURL;
  } catch (error) {
    console.error("Error generating QR code:", error);
    throw new Error("Failed to generate QR code");
  }
}

/**
 * Generate printable barcode labels as PDF optimized for 80mm paper
 */
export async function generateBarcodeLabelsPDF(
  boxes: BarcodeData[],
  options?: {
    labelWidth?: number;
    labelHeight?: number;
    margin?: number;
  }
): Promise<Blob> {
  const {
    labelWidth = 74, // mm (80mm paper with margins)
    labelHeight = 58, // mm (compact but professional)
    margin = 3, // mm
  } = options || {};

  // Create PDF sized for 80mm paper
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: [80, 297], // 80mm width, long roll
  });

  const pageHeight = pdf.internal.pageSize.getHeight();
  let yOffset = margin;
  let isFirstLabel = true;

  for (const box of boxes) {
    // Add new page if needed
    if (!isFirstLabel && yOffset + labelHeight + margin > pageHeight) {
      pdf.addPage();
      yOffset = margin;
    }

    isFirstLabel = false;

    // Generate QR code for this box
    const qrCodeDataURL = await generateQRCode(box);

    // Draw label border
    pdf.setDrawColor(200, 200, 200);
    pdf.setLineWidth(0.2);
    pdf.rect(margin, yOffset, labelWidth, labelHeight);

    // Add QR code (left side, compact)
    const qrSize = 35;
    pdf.addImage(qrCodeDataURL, "PNG", margin + 2, yOffset + 3, qrSize, qrSize);

    // Add text information (right side of QR)
    const textX = margin + qrSize + 5;
    let textY = yOffset + 6;

    // GRN Number - prominent
    pdf.setFontSize(11);
    pdf.setFont("helvetica", "bold");
    pdf.text(box.batchNumber, textX, textY);

    // Item Code
    textY += 5;
    pdf.setFontSize(8);
    pdf.setFont("helvetica", "normal");
    pdf.text(`${box.itemCode}`, textX, textY);

    // Item Name (truncated to fit)
    textY += 4;
    pdf.setFontSize(7);
    const itemName = box.itemName.length > 22 ? box.itemName.substring(0, 22) + "..." : box.itemName;
    pdf.text(itemName, textX, textY);

    // Quantity - prominent
    textY += 5;
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "bold");
    pdf.text(`Qty: ${box.qtyPerBox}`, textX, textY);

    // Details below QR code (using full width)
    textY = yOffset + qrSize + 5;

    // Warehouse & Location
    if (box.warehouseCode || box.locationCode) {
      textY += 4;
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8);
      const locationInfo = [
        box.warehouseCode ? `WH: ${box.warehouseCode}` : "",
        box.locationCode ? `Loc: ${box.locationCode}` : ""
      ].filter(Boolean).join(" | ");
      pdf.text(locationInfo, margin + 2, textY);
    }

    // Move to next label position
    yOffset += labelHeight + margin;
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
