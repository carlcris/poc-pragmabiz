export type QuotationStatus = "draft" | "sent" | "accepted" | "rejected" | "expired" | "ordered";

export type FrameServiceFeeMode = "per_frame" | "per_order" | "size_based" | "service_type" | "manual";

export type FrameInvoiceDisplayMode = "summary" | "components" | "both";

export type FrameComponentType = "molding" | "material" | "accessory";

export type FrameQuotationComponent = {
  id?: string;
  componentType: FrameComponentType;
  source: "auto" | "manual";
  itemId: string;
  itemCode?: string;
  itemName?: string;
  description: string;
  qtyPerFrame: number;
  totalQuantity: number;
  uomId: string;
  uomCode?: string;
  unitRate: number;
  totalAmount: number;
  roundingMode?: "none" | "ceil_per_order";
  sortOrder?: number;
};

export type FrameQuotationConfiguration = {
  id?: string;
  width: number;
  height: number;
  fixedAllowance: number;
  moldingItemId?: string;
  moldingItemCode?: string;
  moldingItemName?: string;
  moldingStickLength?: number;
  moldingSticksRequired?: number;
  serviceFeeMode: FrameServiceFeeMode;
  serviceType?: string;
  serviceFeeAmount: number;
  totalServiceFee: number;
  invoiceDisplayMode: FrameInvoiceDisplayMode;
};

export type QuotationLineItem = {
  id: string;
  itemId: string;
  itemCode?: string; // Joined from items table
  itemName?: string; // Joined from items table
  description: string;
  quantity: number;
  uomId: string;
  uomCode?: string;
  uomName?: string;
  unitPrice: number;
  discount: number; // Percentage
  discountAmount: number;
  taxRate: number; // Percentage
  taxAmount: number;
  lineTotal: number;
  sortOrder?: number;
  frameConfiguration?: FrameQuotationConfiguration | null;
  frameComponents?: FrameQuotationComponent[];
};

export type Quotation = {
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
  frameJobOrderId?: string;
  draftInvoiceId?: string;
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
};

export type CreateQuotationItemRequest = {
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
  frameConfiguration?: FrameQuotationConfiguration | null;
  frameComponents?: FrameQuotationComponent[];
};

export type CreateQuotationRequest = {
  quotationCode?: string;
  customerId: string;
  quotationDate: string;
  validUntil?: string;
  priceListId?: string;
  items: CreateQuotationItemRequest[];
  termsConditions?: string;
  notes?: string;
};

export type UpdateQuotationRequest = {
  quotationDate?: string;
  validUntil?: string;
  status?: QuotationStatus;
  items?: CreateQuotationItemRequest[];
  termsConditions?: string;
  notes?: string;
};

export type QuotationFilters = {
  search?: string;
  status?: QuotationStatus | "all";
  customerId?: string;
  dateFrom?: string;
  dateTo?: string;
  cursor?: string | null;
  limit?: number;
};
