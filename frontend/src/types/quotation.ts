export type QuotationStatus = "draft" | "sent" | "accepted" | "rejected" | "expired";

export interface QuotationLineItem {
  id: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number; // Percentage
  taxRate: number; // Percentage
  lineTotal: number;
}

export interface Quotation {
  id: string;
  companyId: string;
  quotationNumber: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  quotationDate: string;
  validUntil: string;
  status: QuotationStatus;
  lineItems: QuotationLineItem[];
  subtotal: number;
  totalDiscount: number;
  totalTax: number;
  totalAmount: number;
  terms: string;
  notes: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateQuotationRequest {
  companyId: string;
  customerId: string;
  quotationDate: string;
  validUntil: string;
  lineItems: Omit<QuotationLineItem, "id" | "lineTotal">[];
  terms: string;
  notes: string;
}

export interface UpdateQuotationRequest extends Partial<CreateQuotationRequest> {
  status?: QuotationStatus;
}

export interface QuotationFilters {
  search?: string;
  status?: QuotationStatus | "all";
  customerId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}
