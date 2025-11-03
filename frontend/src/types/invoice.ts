export type InvoiceStatus = "draft" | "sent" | "paid" | "partially_paid" | "overdue" | "cancelled";

export interface InvoiceLineItem {
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

// Commission split for invoices with multiple sales agents
export interface InvoiceEmployeeCommission {
  employeeId: string;
  employeeName: string;
  commissionSplitPercentage: number; // e.g., 50.00 = 50%
  commissionAmount: number;
}

export interface Invoice {
  id: string;
  companyId: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  salesOrderId?: string; // Optional reference to sales order
  salesOrderNumber?: string;
  invoiceDate: string;
  dueDate: string;
  status: InvoiceStatus;
  lineItems: InvoiceLineItem[];
  subtotal: number;
  totalDiscount: number;
  totalTax: number;
  totalAmount: number;
  amountPaid: number;
  amountDue: number;
  billingAddress: string;
  billingCity: string;
  billingState: string;
  billingPostalCode: string;
  billingCountry: string;
  paymentTerms: string;
  notes: string;

  // Sales Analytics fields
  primaryEmployeeId?: string; // Main sales agent
  primaryEmployeeName?: string; // For display purposes
  commissionTotal: number; // Total commission for all agents
  commissionSplitCount: number; // Number of agents sharing commission
  commissionSplits?: InvoiceEmployeeCommission[]; // Details of commission split

  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateInvoiceRequest {
  companyId: string;
  customerId: string;
  salesOrderId?: string;
  invoiceDate: string;
  dueDate: string;
  lineItems: Omit<InvoiceLineItem, "id" | "lineTotal">[];
  billingAddress: string;
  billingCity: string;
  billingState: string;
  billingPostalCode: string;
  billingCountry: string;
  paymentTerms: string;
  notes: string;

  // Sales agent(s) assignment
  primaryEmployeeId?: string;
  commissionSplits?: Array<{
    employeeId: string;
    commissionSplitPercentage: number;
  }>;
}

export interface UpdateInvoiceRequest extends Partial<CreateInvoiceRequest> {
  status?: InvoiceStatus;
  amountPaid?: number;
}

export interface InvoiceFilters {
  search?: string;
  status?: InvoiceStatus | "all";
  customerId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

export interface RecordPaymentRequest {
  invoiceId: string;
  amount: number;
  paymentDate: string;
  paymentMethod: string;
  reference: string;
  notes: string;
}
