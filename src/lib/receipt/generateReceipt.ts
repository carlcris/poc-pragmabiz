import { jsPDF } from "jspdf";
import QRCode from "qrcode";
import type { POSTransaction } from "@/types/pos";

type CompanyInfo = {
  name: string;
  address: string;
  phone: string;
  tin: string;
};

// Hardcoded company info - can be moved to settings later
const COMPANY_INFO: CompanyInfo = {
  name: "Your Company Name",
  address: "123 Main Street, City, Country",
  phone: "(123) 456-7890",
  tin: "123-456-789-000",
};

// Receipt width in mm (80mm thermal printer standard)
const RECEIPT_WIDTH = 80;
const MARGIN = 5;
const CONTENT_WIDTH = RECEIPT_WIDTH - MARGIN * 2;

export async function generateReceiptPDF(transaction: POSTransaction): Promise<string> {
  // Create PDF with 80mm width
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: [RECEIPT_WIDTH, 297], // A4 height, will auto-adjust
  });

  let yPos = MARGIN;
  const lineHeight = 5;
  const smallLineHeight = 4;

  // Helper function to add centered text
  const addCenteredText = (
    text: string,
    y: number,
    fontSize: number = 10,
    isBold: boolean = false
  ) => {
    doc.setFontSize(fontSize);
    doc.setFont("helvetica", isBold ? "bold" : "normal");
    const textWidth = doc.getTextWidth(text);
    const x = (RECEIPT_WIDTH - textWidth) / 2;
    doc.text(text, x, y);
  };

  // Helper function to add left-aligned text
  const addLeftText = (text: string, y: number, fontSize: number = 9) => {
    doc.setFontSize(fontSize);
    doc.setFont("helvetica", "normal");
    doc.text(text, MARGIN, y);
  };

  // Helper function to add two-column text (label on left, value on right)
  const addTwoColumn = (
    label: string,
    value: string,
    y: number,
    fontSize: number = 9,
    isBold: boolean = false
  ) => {
    doc.setFontSize(fontSize);
    doc.setFont("helvetica", isBold ? "bold" : "normal");
    doc.text(label, MARGIN, y);
    const valueWidth = doc.getTextWidth(value);
    doc.text(value, RECEIPT_WIDTH - MARGIN - valueWidth, y);
  };

  // Helper function to add separator line
  const addSeparator = (y: number, isDashed: boolean = true) => {
    // jsPDF doesn't have setLineDash in types, but we can draw lines directly
    if (isDashed) {
      // Draw dashed line manually with small segments
      let x = MARGIN;
      while (x < RECEIPT_WIDTH - MARGIN) {
        doc.line(x, y, Math.min(x + 1, RECEIPT_WIDTH - MARGIN), y);
        x += 2;
      }
    } else {
      // Solid line
      doc.line(MARGIN, y, RECEIPT_WIDTH - MARGIN, y);
    }
  };

  // Helper function to format currency
  const formatCurrency = (amount: number): string => {
    // Use Math.abs to ensure positive number, format with 2 decimals
    const formatted = Math.abs(amount).toFixed(2);
    // Add thousand separators
    const parts = formatted.split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return `PHP ${parts.join(".")}`;
  };

  // Helper function to format date
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // Helper function to format time
  const formatTime = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  // Company name (bold, larger)
  addCenteredText(COMPANY_INFO.name, yPos, 12, true);
  yPos += lineHeight;

  // Address
  addCenteredText(COMPANY_INFO.address, yPos, 8);
  yPos += smallLineHeight;

  // Phone
  addCenteredText(`Tel: ${COMPANY_INFO.phone}`, yPos, 8);
  yPos += smallLineHeight;

  // TIN
  addCenteredText(`TIN: ${COMPANY_INFO.tin}`, yPos, 8);
  yPos += smallLineHeight;

  addSeparator(yPos, false);
  yPos += lineHeight;

  // ===== TRANSACTION INFORMATION =====
  addLeftText(`Receipt #: ${transaction.transactionNumber}`, yPos, 9);
  yPos += smallLineHeight;

  addLeftText(
    `Date: ${formatDate(transaction.transactionDate)}  ${formatTime(transaction.transactionDate)}`,
    yPos,
    9
  );
  yPos += smallLineHeight;

  addLeftText(`Cashier: ${transaction.cashierName}`, yPos, 9);
  yPos += smallLineHeight;

  if (transaction.customerName) {
    addLeftText(`Customer: ${transaction.customerName}`, yPos, 9);
    yPos += smallLineHeight;
  }

  yPos += smallLineHeight;
  addSeparator(yPos);
  yPos += lineHeight;

  // ===== ITEMS HEADER =====
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("ITEM", MARGIN, yPos);
  doc.text("QTY", MARGIN + 35, yPos);
  doc.text("PRICE", MARGIN + 45, yPos);
  const totalHeaderWidth = doc.getTextWidth("TOTAL");
  doc.text("TOTAL", RECEIPT_WIDTH - MARGIN - totalHeaderWidth, yPos);
  yPos += smallLineHeight;

  addSeparator(yPos);
  yPos += smallLineHeight;

  // ===== ITEMS =====
  doc.setFont("helvetica", "normal");

  for (const item of transaction.items) {
    // Item name (may wrap to multiple lines)
    const maxItemNameWidth = CONTENT_WIDTH - 5;
    const itemNameLines = doc.splitTextToSize(item.itemName, maxItemNameWidth);

    doc.setFontSize(9);
    doc.text(itemNameLines[0], MARGIN, yPos);

    // Quantity, price, total on same line as first line of item name
    doc.text(item.quantity.toString(), MARGIN + 35, yPos);
    doc.text(formatCurrency(item.unitPrice).replace("PHP", "").trim(), MARGIN + 45, yPos);
    const lineTotalText = formatCurrency(item.lineTotal).replace("PHP", "").trim();
    const lineTotalWidth = doc.getTextWidth(lineTotalText);
    doc.text(lineTotalText, RECEIPT_WIDTH - MARGIN - lineTotalWidth, yPos);
    yPos += smallLineHeight;

    // Additional lines of item name if it wrapped
    for (let i = 1; i < itemNameLines.length; i++) {
      doc.text(itemNameLines[i], MARGIN, yPos);
      yPos += smallLineHeight;
    }

    // Show discount if any
    if (item.discount > 0) {
      doc.setFontSize(8);
      const discountAmount = (item.quantity * item.unitPrice * item.discount) / 100;
      const discountText = `  Disc (${item.discount}%)`;
      doc.text(discountText, MARGIN, yPos);
      const discountValueText = "-" + formatCurrency(discountAmount).replace("PHP", "").trim();
      const discountValueWidth = doc.getTextWidth(discountValueText);
      doc.text(discountValueText, RECEIPT_WIDTH - MARGIN - discountValueWidth, yPos);
      yPos += smallLineHeight;
    }
  }

  addSeparator(yPos);
  yPos += lineHeight;

  // ===== TOTALS =====
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");

  addTwoColumn("Subtotal:", formatCurrency(transaction.subtotal), yPos);
  yPos += smallLineHeight;

  if (transaction.totalDiscount > 0) {
    addTwoColumn("Discount:", "-" + formatCurrency(transaction.totalDiscount), yPos);
    yPos += smallLineHeight;
  }

  if (transaction.totalTax > 0) {
    addTwoColumn(`Tax (${transaction.taxRate}%):`, formatCurrency(transaction.totalTax), yPos);
    yPos += smallLineHeight;
  }

  addSeparator(yPos, false);
  yPos += lineHeight;

  // Grand total (bold, larger)
  addTwoColumn("TOTAL:", formatCurrency(transaction.totalAmount), yPos, 11, true);
  yPos += lineHeight + 2;

  // ===== PAYMENT =====
  const paymentMethod =
    transaction.payments.length > 0 ? transaction.payments.map((p) => p.method).join(", ") : "Cash";

  addLeftText(`Payment Method: ${paymentMethod}`, yPos, 9);
  yPos += smallLineHeight;

  addTwoColumn("Amount Paid:", formatCurrency(transaction.amountPaid), yPos);
  yPos += smallLineHeight;

  addTwoColumn("Change:", formatCurrency(transaction.changeAmount), yPos);
  yPos += lineHeight + 2;

  addSeparator(yPos, false);
  yPos += lineHeight;

  // ===== QR CODE =====
  // Generate QR code with transaction number
  const qrCodeDataUrl = await QRCode.toDataURL(transaction.transactionNumber, {
    width: 150,
    margin: 1,
  });

  const qrSize = 30;
  const qrX = (RECEIPT_WIDTH - qrSize) / 2;
  doc.addImage(qrCodeDataUrl, "PNG", qrX, yPos, qrSize, qrSize);
  yPos += qrSize + smallLineHeight;

  // ===== FOOTER =====
  addCenteredText("Thank you for your purchase!", yPos, 9, true);
  yPos += smallLineHeight;

  addCenteredText("This serves as your official receipt", yPos, 8);
  yPos += smallLineHeight;

  addCenteredText("Please come again!", yPos, 8);
  yPos += smallLineHeight;

  addSeparator(yPos, false);

  // Return PDF as data URL
  return doc.output("dataurlstring");
}
