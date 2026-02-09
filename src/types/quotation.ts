export type QuotationStatus = "draft" | "sent" | "accepted" | "rejected" | "expired" | "ordered";

export interface QuotationLineItem {
  id: string;
  itemId: string;
  itemCode?: string; // Joined from items table
  itemName?: string; // Joined from items table
  description: string;
  quantity: number;
  uomId: string;
  unitPrice: number;
  discount: number; // Percentage
  discountAmount: number;
  taxRate: number; // Percentage
  taxAmount: number;
  lineTotal: number;
  sortOrder?: number;
}

export interface Quotation {
  id: string;
  companyId: string;
  quotationNumber: string; // Maps to quotation_code in DB
  customerId: string;
  customerName?: string; // Joined from customers table
  customerEmail?: string; // Joined from customers table
  quotationDate: string;
  validUntil: string;
  status: QuotationStatus;
  salesOrderId?: string; // Reference to converted sales order
  lineItems: QuotationLineItem[];
  subtotal: number;
  totalDiscount: number; // Maps to discount_amount in DB
  totalTax: number; // Maps to tax_amount in DB
  totalAmount: number; // Maps to total_amount in DB
  terms: string; // Maps to terms_conditions in DB
  notes: string;
  billingAddress?: string;
  billingCity?: string;
  billingState?: string;
  billingPostalCode?: string;
  billingCountry?: string;
  createdBy: string;
  createdByName?: string; // Joined from users table
  createdAt: string;
  updatedAt: string;
}

export interface CreateQuotationItemRequest {
  itemId: string;
  description?: string;
  quantity: number;
  uomId: string;
  rate: number;
  discountPercent?: number;
  discountAmount?: number;
  taxPercent?: number;
  taxAmount?: number;
  sortOrder?: number;
  notes?: string;
}

export interface CreateQuotationRequest {
  quotationCode: string;
  customerId: string;
  quotationDate: string;
  validUntil?: string;
  priceListId?: string;
  items: CreateQuotationItemRequest[];
  termsConditions?: string;
  notes?: string;
}

export interface UpdateQuotationRequest {
  quotationDate?: string;
  validUntil?: string;
  status?: QuotationStatus;
  items?: CreateQuotationItemRequest[];
  termsConditions?: string;
  notes?: string;
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
