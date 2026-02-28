/**
 * Email utility for sending emails using Gmail SMTP
 *
 * Setup:
 * 1. Install nodemailer: npm install nodemailer @types/nodemailer
 * 2. Add Gmail credentials to your .env file:
 *    - GMAIL_USER: Your Gmail address
 *    - GMAIL_APP_PASSWORD: Your Gmail App Password (not your regular password)
 * 3. To get an App Password:
 *    - Go to https://myaccount.google.com/apppasswords
 *    - Select "Mail" and your device
 *    - Generate password and use it as GMAIL_APP_PASSWORD
 */

import nodemailer from "nodemailer";
import path from "path";

// Email configuration
const GMAIL_USER = process.env.GMAIL_USER || "";
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD || "";
const COMPANY_NAME = process.env.COMPANY_NAME || "Your Company";

// Logo path
const LOGO_PATH = path.join(process.cwd(), "public", "achlers_circle.png");

// Create transporter for Gmail
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: GMAIL_USER,
    pass: GMAIL_APP_PASSWORD,
  },
});

export interface StockRequisitionEmailData {
  language?: "english" | "chinese";
  srNumber: string;
  supplierName: string;
  supplierEmail: string;
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

const emailTextByLanguage = {
  english: {
    title: "Stock Requisition",
    srLabel: "SR #",
    greeting: "Dear",
    intro:
      "We kindly request your review and fulfillment of the following stock requisition. Please find the complete details below:",
    requisitionInformation: "Requisition Information",
    businessUnit: "Business Unit",
    requisitionDate: "Requisition Date",
    requiredByDate: "Required By Date",
    requestedBy: "Requested By",
    totalAmount: "Total Amount",
    itemsRequested: "Items Requested",
    code: "Code",
    item: "Item",
    qty: "Qty",
    unitPrice: "Unit Price",
    total: "Total",
    additionalNotes: "Additional Notes",
    actionRequired: "Action Required",
    actionBody:
      "Please review and confirm the availability of requested items at your earliest convenience.",
    automated: "This is an automated notification from",
    footerHelp: "For inquiries, please contact our procurement team.",
    subjectPrefix: "Stock Requisition",
  },
  chinese: {
    title: "库存请购单",
    srLabel: "请购单号 #",
    greeting: "尊敬的",
    intro: "烦请查阅并安排以下库存请购需求。完整明细如下：",
    requisitionInformation: "请购信息",
    businessUnit: "业务单元",
    requisitionDate: "请购日期",
    requiredByDate: "需求日期",
    requestedBy: "申请人",
    totalAmount: "总金额",
    itemsRequested: "请购物料",
    code: "编码",
    item: "物料",
    qty: "数量",
    unitPrice: "单价",
    total: "总计",
    additionalNotes: "备注",
    actionRequired: "需要您处理",
    actionBody: "请尽快确认所需物料的供货情况并回复。",
    automated: "此邮件为系统自动通知，来自",
    footerHelp: "如有疑问，请联系采购团队。",
    subjectPrefix: "库存请购单",
  },
} as const;

/**
 * Send stock requisition email to supplier
 */
export async function sendStockRequisitionEmail(data: StockRequisitionEmailData) {
  try {
    const language = data.language === "chinese" ? "chinese" : "english";
    const t = emailTextByLanguage[language];
    const itemsTableRows = data.items
      .map(
        (item, index) => `
        <tr style="${index % 2 === 0 ? 'background-color: #ffffff;' : 'background-color: #f9fafb;'}">
          <td style="padding: 14px 12px; text-align: left; font-size: 13px; color: #6b7280; font-family: 'Courier New', monospace; font-weight: 600;">${item.itemCode}</td>
          <td style="padding: 14px 12px; text-align: left; font-size: 14px; color: #111827; font-weight: 500;">${item.itemName}</td>
          <td style="padding: 14px 12px; text-align: right; font-size: 14px; color: #374151; font-weight: 600;">${item.requestedQty}</td>
          <td style="padding: 14px 12px; text-align: right; font-size: 14px; color: #1e3a8a; font-weight: 600;">${item.unitPrice}</td>
          <td style="padding: 14px 12px; text-align: right; font-size: 15px; color: #1e3a8a; font-weight: 700; background-color: ${index % 2 === 0 ? '#eff6ff' : '#dbeafe'};">${item.totalPrice}</td>
        </tr>
      `
      )
      .join("");

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${t.title} - ${data.srNumber}</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="650" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">

          <!-- Header Section -->
          <tr>
            <td style="background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); padding: 50px 40px; text-align: center;">
              <img src="cid:company-logo" alt="${COMPANY_NAME}" style="width: 100px; height: 100px; margin-bottom: 20px;" />
              <h1 style="margin: 0; color: #ffffff; font-size: 26px; font-weight: 600; letter-spacing: -0.5px;">${COMPANY_NAME}</h1>
              <div style="margin-top: 12px; padding: 8px 24px; background-color: rgba(255,255,255,0.2); border-radius: 20px; display: inline-block;">
                <p style="margin: 0; color: #ffffff; font-size: 14px; font-weight: 500;">${t.title}</p>
              </div>
            </td>
          </tr>

          <!-- SR Number Banner -->
          <tr>
            <td style="background-color: #fbbf24; padding: 16px 40px; text-align: center;">
              <p style="margin: 0; color: #78350f; font-size: 15px; font-weight: 600;">${t.srLabel}${data.srNumber}</p>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 40px;">

              <!-- Greeting -->
              <p style="margin: 0 0 20px 0; font-size: 16px; color: #1f2937; line-height: 1.6;">${t.greeting} <strong>${data.supplierName}</strong>${language === "chinese" ? "：" : ","}</p>
              <p style="margin: 0 0 30px 0; font-size: 15px; color: #4b5563; line-height: 1.6;">${t.intro}</p>

              <!-- Requisition Summary Card -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 30px; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
                <tr>
                  <td style="background-color: #f8fafc; padding: 20px; border-bottom: 3px solid #3b82f6;">
                    <h2 style="margin: 0; font-size: 17px; color: #1e3a8a; font-weight: 600;">${t.requisitionInformation}</h2>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 24px;">
                    <table width="100%" cellpadding="8" cellspacing="0">
                      ${
                        data.businessUnit
                          ? `
                      <tr>
                        <td width="40%" style="color: #6b7280; font-size: 14px; padding: 8px 0;">${t.businessUnit}</td>
                        <td style="color: #111827; font-size: 14px; font-weight: 600; padding: 8px 0;">${data.businessUnit}</td>
                      </tr>
                      `
                          : ""
                      }
                      <tr>
                        <td width="40%" style="color: #6b7280; font-size: 14px; padding: 8px 0;">${t.requisitionDate}</td>
                        <td style="color: #111827; font-size: 14px; font-weight: 600; padding: 8px 0;">${data.requisitionDate}</td>
                      </tr>
                      ${
                        data.requiredByDate
                          ? `
                      <tr>
                        <td style="color: #6b7280; font-size: 14px; padding: 8px 0;">${t.requiredByDate}</td>
                        <td style="color: #dc2626; font-size: 14px; font-weight: 700; padding: 8px 0;">⚠️ ${data.requiredByDate}</td>
                      </tr>
                      `
                          : ""
                      }
                      <tr>
                        <td style="color: #6b7280; font-size: 14px; padding: 8px 0;">${t.requestedBy}</td>
                        <td style="color: #111827; font-size: 14px; font-weight: 600; padding: 8px 0;">${data.createdBy}</td>
                      </tr>
                      <tr style="background-color: #fef9e7;">
                        <td style="color: #92400e; font-size: 15px; font-weight: 600; padding: 16px 0 8px 0;">${t.totalAmount}</td>
                        <td style="color: #1e3a8a; font-size: 24px; font-weight: 700; padding: 16px 0 8px 0;">${data.totalAmount}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Items Section -->
              <h2 style="margin: 0 0 16px 0; font-size: 17px; color: #1e3a8a; font-weight: 600;">${t.itemsRequested}</h2>
              <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
                <thead>
                  <tr style="background: linear-gradient(to bottom, #f8fafc 0%, #f1f5f9 100%);">
                    <th style="padding: 14px 12px; text-align: left; font-size: 12px; color: #475569; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #cbd5e1;">${t.code}</th>
                    <th style="padding: 14px 12px; text-align: left; font-size: 12px; color: #475569; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #cbd5e1;">${t.item}</th>
                    <th style="padding: 14px 12px; text-align: right; font-size: 12px; color: #475569; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #cbd5e1;">${t.qty}</th>
                    <th style="padding: 14px 12px; text-align: right; font-size: 12px; color: #475569; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #cbd5e1;">${t.unitPrice}</th>
                    <th style="padding: 14px 12px; text-align: right; font-size: 12px; color: #475569; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #cbd5e1;">${t.total}</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsTableRows}
                </tbody>
              </table>

              ${
                data.notes
                  ? `
              <!-- Notes Section -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 30px; border-left: 4px solid #f59e0b; background-color: #fffbeb; border-radius: 8px;">
                <tr>
                  <td style="padding: 20px;">
                    <h3 style="margin: 0 0 10px 0; font-size: 15px; color: #92400e; font-weight: 600;">📝 ${t.additionalNotes}</h3>
                    <p style="margin: 0; font-size: 14px; color: #78350f; line-height: 1.6; white-space: pre-wrap;">${data.notes}</p>
                  </td>
                </tr>
              </table>
              `
                  : ""
              }

              <!-- Action Required -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 40px; background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border-radius: 12px;">
                <tr>
                  <td style="padding: 30px; text-align: center;">
                    <p style="margin: 0 0 8px 0; font-size: 16px; color: #1e3a8a; font-weight: 600;">${t.actionRequired}</p>
                    <p style="margin: 0; font-size: 14px; color: #3b82f6; line-height: 1.6;">${t.actionBody}</p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 30px 40px; border-top: 1px solid #e5e7eb;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="text-align: center;">
                    <p style="margin: 0 0 8px 0; font-size: 13px; color: #64748b; line-height: 1.5;">${t.automated} <strong>${COMPANY_NAME}</strong></p>
                    <p style="margin: 0; font-size: 12px; color: #94a3b8;">${t.footerHelp}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    const result = await transporter.sendMail({
      from: `${COMPANY_NAME} <${GMAIL_USER}>`,
      to: data.supplierEmail,
      subject: `${t.subjectPrefix} ${data.srNumber} - ${COMPANY_NAME}`,
      html: htmlContent,
      attachments: [
        {
          filename: "achlers_circle.png",
          path: LOGO_PATH,
          cid: "company-logo", // CID reference for embedding in HTML
        },
      ],
    });

    console.log("Stock requisition email sent successfully:", result);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error("Failed to send stock requisition email:", error);
    throw new Error(
      `Failed to send email: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Send test email (for debugging)
 */
export async function sendTestEmail(to: string) {
  try {
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Email Test</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); padding: 50px 40px; text-align: center;">
              <img src="cid:company-logo" alt="${COMPANY_NAME}" style="width: 100px; height: 100px; margin-bottom: 20px;" />
              <h1 style="margin: 0; color: #ffffff; font-size: 26px; font-weight: 600; letter-spacing: -0.5px;">${COMPANY_NAME}</h1>
              <div style="margin-top: 12px; padding: 8px 24px; background-color: rgba(255,255,255,0.2); border-radius: 20px; display: inline-block;">
                <p style="margin: 0; color: #ffffff; font-size: 14px; font-weight: 500;">Email Configuration Test</p>
              </div>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 50px 40px; text-align: center;">
              <div style="display: inline-block; padding: 20px 30px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 12px; margin-bottom: 20px;">
                <p style="margin: 0; color: #ffffff; font-size: 48px;">✓</p>
              </div>
              <h2 style="margin: 0 0 16px 0; font-size: 24px; color: #1e3a8a; font-weight: 600;">Email Test Successful!</h2>
              <p style="margin: 0 0 12px 0; font-size: 16px; color: #4b5563; line-height: 1.6;">Your email configuration is working correctly.</p>
              <p style="margin: 0; font-size: 14px; color: #6b7280;">You can now send stock requisition emails to suppliers.</p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 30px 40px; border-top: 1px solid #e5e7eb; text-align: center;">
              <p style="margin: 0; font-size: 13px; color: #64748b;">This is a test email from <strong>${COMPANY_NAME}</strong></p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    const result = await transporter.sendMail({
      from: `${COMPANY_NAME} <${GMAIL_USER}>`,
      to,
      subject: "Test Email from Stock Requisition System",
      html: htmlContent,
      attachments: [
        {
          filename: "achlers_circle.png",
          path: LOGO_PATH,
          cid: "company-logo",
        },
      ],
    });

    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error("Failed to send test email:", error);
    throw error;
  }
}
