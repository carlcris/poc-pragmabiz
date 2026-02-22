export type PaymentMethod = "cash" | "credit_card" | "debit_card" | "gcash" | "paymaya";
export type POSTransactionStatus = "completed" | "voided" | "refunded";

export interface POSCartItem {
  id: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  quantity: number;
  uom?: string;
  unitPrice: number;
  discount: number;
  lineTotal: number;
}

export interface POSPayment {
  method: PaymentMethod;
  amount: number;
  reference?: string;
}

export interface POSTransaction {
  id: string;
  companyId: string;
  transactionNumber: string;
  transactionDate: string;
  customerId?: string;
  customerName?: string;
  items: POSCartItem[];
  subtotal: number;
  totalDiscount: number;
  taxRate: number;
  totalTax: number;
  totalAmount: number;
  payments: POSPayment[];
  amountPaid: number;
  changeAmount: number;
  status: POSTransactionStatus;
  cashierId: string;
  cashierName: string;
  itemCount?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface POSTransactionCreate {
  customerId?: string;
  items: Omit<POSCartItem, "id">[];
  payments: POSPayment[];
  notes?: string;
}

export interface POSSessionSummary {
  sessionId: string;
  cashierId: string;
  cashierName: string;
  startDate: string;
  endDate?: string;
  totalTransactions: number;
  totalSales: number;
  totalCash: number;
  totalCard: number;
  totalEWallet: number;
  status: "open" | "closed";
}
