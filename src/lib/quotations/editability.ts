import type { QuotationStatus } from "@/types/quotation";

export const canEditQuotation = (status: QuotationStatus): boolean =>
  status === "draft" || status === "sent";
