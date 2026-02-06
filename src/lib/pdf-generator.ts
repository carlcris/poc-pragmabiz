import jsPDF from "jspdf";
import html2canvas from "html2canvas";

export interface StockRequisitionPDFData {
  srNumber: string;
  supplierName: string;
  requisitionDate: string;
  requiredByDate?: string;
  totalAmount: string;
  items: Array<{
    itemCode: string;
    itemName: string;
    requestedQty: number;
    unitPrice: string;
    totalPrice: string;
  }>;
  notes?: string;
  createdBy: string;
  businessUnit?: string;
}

/**
 * Generate and download Stock Requisition PDF
 */
export async function generateStockRequisitionPDF(data: StockRequisitionPDFData) {
  // Create a temporary container for the PDF content
  const container = document.createElement("div");
  container.style.position = "absolute";
  container.style.left = "-9999px";
  container.style.width = "800px";
  container.style.background = "#ffffff";
  container.style.padding = "40px";
  container.style.fontFamily = "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif";

  // Build items table rows
  const itemsRows = data.items
    .map(
      (item, index) => `
    <tr style="${index % 2 === 0 ? 'background-color: #ffffff;' : 'background-color: #f9fafb;'}">
      <td style="padding: 12px; text-align: left; font-size: 12px; color: #6b7280; font-family: 'Courier New', monospace; font-weight: 600; border-bottom: 1px solid #e5e7eb;">${item.itemCode}</td>
      <td style="padding: 12px; text-align: left; font-size: 13px; color: #1f2937; font-weight: 500; border-bottom: 1px solid #e5e7eb;">${item.itemName}</td>
      <td style="padding: 12px; text-align: right; font-size: 13px; color: #1f2937; font-weight: 600; border-bottom: 1px solid #e5e7eb;">${item.requestedQty}</td>
      <td style="padding: 12px; text-align: right; font-size: 13px; color: #1f2937; font-weight: 600; border-bottom: 1px solid #e5e7eb;">${item.unitPrice}</td>
      <td style="padding: 12px; text-align: right; font-size: 13px; color: #1f2937; font-weight: 700; border-bottom: 1px solid #e5e7eb;">${item.totalPrice}</td>
    </tr>
  `
    )
    .join("");

  // Create HTML content similar to email template
  container.innerHTML = `
    <div style="max-width: 800px; margin: 0 auto; background: #ffffff; padding: 40px;">
      <!-- Header Section -->
      <div style="border-bottom: 3px solid #1f2937; padding-bottom: 30px; margin-bottom: 30px;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="width: 80px; vertical-align: top;">
              <img src="/achlers_circle.png" alt="Company Logo" style="width: 70px; height: 70px; display: block;" />
            </td>
            <td style="text-align: right; vertical-align: top;">
              <h1 style="margin: 0 0 8px 0; color: #1f2937; font-size: 28px; font-weight: 700;">Achlers Integrated</h1>
              <p style="margin: 0; color: #6b7280; font-size: 13px; line-height: 1.4;">Stock Requisition Document</p>
            </td>
          </tr>
        </table>
      </div>

      <!-- SR Number -->
      <div style="margin-bottom: 30px;">
        <h2 style="margin: 0 0 4px 0; color: #6b7280; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Requisition Number</h2>
        <p style="margin: 0; color: #1f2937; font-size: 24px; font-weight: 700;">${data.srNumber}</p>
      </div>

      <!-- Supplier Info -->
      <div style="margin-bottom: 30px;">
        <p style="margin: 0 0 4px 0; font-size: 14px; color: #6b7280;">To:</p>
        <p style="margin: 0; font-size: 18px; color: #1f2937; font-weight: 600;">${data.supplierName}</p>
      </div>

        <!-- Requisition Information -->
        <div style="margin-bottom: 30px;">
          <h3 style="margin: 0 0 16px 0; font-size: 14px; color: #1f2937; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px;">Requisition Information</h3>
          <table style="width: 100%; border-collapse: collapse;">
            ${
              data.businessUnit
                ? `
            <tr style="border-bottom: 1px solid #f3f4f6;">
              <td style="color: #6b7280; font-size: 13px; padding: 12px 0; width: 35%;">Business Unit</td>
              <td style="color: #1f2937; font-size: 13px; font-weight: 600; padding: 12px 0;">${data.businessUnit}</td>
            </tr>
            `
                : ""
            }
            <tr style="border-bottom: 1px solid #f3f4f6;">
              <td style="color: #6b7280; font-size: 13px; padding: 12px 0; width: 35%;">Requisition Date</td>
              <td style="color: #1f2937; font-size: 13px; font-weight: 600; padding: 12px 0;">${data.requisitionDate}</td>
            </tr>
            ${
              data.requiredByDate
                ? `
            <tr style="border-bottom: 1px solid #f3f4f6;">
              <td style="color: #6b7280; font-size: 13px; padding: 12px 0;">Required By Date</td>
              <td style="color: #1f2937; font-size: 13px; font-weight: 700; padding: 12px 0;">${data.requiredByDate}</td>
            </tr>
            `
                : ""
            }
            <tr style="border-bottom: 1px solid #f3f4f6;">
              <td style="color: #6b7280; font-size: 13px; padding: 12px 0;">Requested By</td>
              <td style="color: #1f2937; font-size: 13px; font-weight: 600; padding: 12px 0;">${data.createdBy}</td>
            </tr>
            <tr>
              <td style="color: #6b7280; font-size: 13px; padding: 12px 0; font-weight: 700;">Total Amount</td>
              <td style="color: #1f2937; font-size: 20px; font-weight: 700; padding: 12px 0;">${data.totalAmount}</td>
            </tr>
          </table>
        </div>

        <!-- Items Section -->
        <h3 style="margin: 30px 0 16px 0; font-size: 14px; color: #1f2937; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px;">Requested Items</h3>
        <table style="width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb;">
          <thead>
            <tr style="background-color: #f9fafb;">
              <th style="padding: 12px; text-align: left; font-size: 11px; color: #6b7280; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #d1d5db;">Item Code</th>
              <th style="padding: 12px; text-align: left; font-size: 11px; color: #6b7280; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #d1d5db;">Item Name</th>
              <th style="padding: 12px; text-align: right; font-size: 11px; color: #6b7280; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #d1d5db;">Quantity</th>
              <th style="padding: 12px; text-align: right; font-size: 11px; color: #6b7280; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #d1d5db;">Unit Price</th>
              <th style="padding: 12px; text-align: right; font-size: 11px; color: #6b7280; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #d1d5db;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsRows}
          </tbody>
        </table>

        ${
          data.notes
            ? `
        <!-- Notes Section -->
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
          <h3 style="margin: 0 0 12px 0; font-size: 13px; color: #6b7280; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Notes</h3>
          <p style="margin: 0; font-size: 13px; color: #4b5563; line-height: 1.6; white-space: pre-wrap;">${data.notes}</p>
        </div>
        `
            : ""
        }

      <!-- Footer -->
      <div style="margin-top: 50px; padding-top: 20px; border-top: 2px solid #e5e7eb;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="vertical-align: top;">
              <p style="margin: 0; font-size: 11px; color: #9ca3af;">Achlers Integrated</p>
              <p style="margin: 4px 0 0 0; font-size: 10px; color: #9ca3af;">Stock Requisition Document</p>
            </td>
            <td style="text-align: right; vertical-align: top;">
              <p style="margin: 0; font-size: 10px; color: #9ca3af;">Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
            </td>
          </tr>
        </table>
      </div>
    </div>
  `;

  document.body.appendChild(container);

  try {
    // Convert HTML to canvas
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
    });

    // Calculate PDF dimensions
    const imgWidth = 210; // A4 width in mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    // Create PDF
    const pdf = new jsPDF({
      orientation: imgHeight > imgWidth ? "portrait" : "portrait",
      unit: "mm",
      format: "a4",
    });

    const imgData = canvas.toDataURL("image/png");
    pdf.addImage(imgData, "PNG", 0, 0, imgWidth, imgHeight);

    // Download PDF
    pdf.save(`Stock-Requisition-${data.srNumber}.pdf`);
  } finally {
    // Clean up
    document.body.removeChild(container);
  }
}
