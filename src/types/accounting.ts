/**
 * Accounting Module Types
 * Type definitions for Chart of Accounts, Journal Entries, and General Ledger
 */

// ============================================================================
// Chart of Accounts Types
// ============================================================================

export type AccountType = "asset" | "liability" | "equity" | "revenue" | "expense" | "cogs";

export type Account = {
  id: string;
  companyId: string;
  accountNumber: string; // Alphanumeric: A-1000, L-2100, etc.
  accountName: string;
  accountType: AccountType;
  parentAccountId: string | null;
  isSystemAccount: boolean;
  isActive: boolean;
  level: number;
  sortOrder: number;
  description: string | null;
  createdAt: string;
  createdBy: string | null;
  updatedAt: string;
  updatedBy: string | null;
  deletedAt: string | null;
  version: number;
};

export type CreateAccountRequest = {
  accountNumber: string;
  accountName: string;
  accountType: AccountType;
  parentAccountId?: string;
  description?: string;
  level?: number;
  sortOrder?: number;
};

export type UpdateAccountRequest = {
  accountName?: string;
  accountType?: AccountType;
  parentAccountId?: string;
  description?: string;
  isActive?: boolean;
  sortOrder?: number;
};

// ============================================================================
// Journal Entry Types
// ============================================================================

export type JournalEntryStatus = "draft" | "posted" | "cancelled";

export type JournalSourceModule = "AR" | "AP" | "Inventory" | "Manual" | "COGS";

export type JournalReferenceType =
  | "sales_invoice"
  | "purchase_receipt"
  | "stock_adjustment"
  | "stock_transfer"
  | "invoice_payment"
  | "manual";

export type JournalEntry = {
  id: string;
  companyId: string;
  journalCode: string;
  postingDate: string; // ISO date string
  referenceType: JournalReferenceType | null;
  referenceId: string | null;
  referenceCode: string | null;
  description: string | null;
  status: JournalEntryStatus;
  sourceModule: JournalSourceModule;
  totalDebit: number;
  totalCredit: number;
  postedAt: string | null;
  postedBy: string | null;
  createdAt: string;
  createdBy: string | null;
  updatedAt: string;
  updatedBy: string | null;
  deletedAt: string | null;
  version: number;
};

export type JournalLine = {
  id: string;
  companyId: string;
  journalEntryId: string;
  accountId: string;
  debit: number;
  credit: number;
  description: string | null;
  lineNumber: number;
  costCenterId: string | null;
  projectId: string | null;
  createdAt: string;
  createdBy: string | null;
};

export type JournalEntryWithLines = JournalEntry & {
  lines: (JournalLine & {
    account?: Account;
  })[];
};

export type CreateJournalLineRequest = {
  accountId: string;
  accountNumber?: string; // Alternative to accountId
  debit: number;
  credit: number;
  description?: string;
};

export type CreateJournalEntryRequest = {
  postingDate: string; // ISO date string
  description?: string;
  referenceType?: JournalReferenceType;
  referenceId?: string;
  referenceCode?: string;
  sourceModule?: JournalSourceModule;
  lines: CreateJournalLineRequest[];
};

export type PostJournalEntryRequest = {
  journalEntryId: string;
};

// ============================================================================
// Ledger Types
// ============================================================================

export type LedgerEntry = {
  id: string;
  journalEntryId: string;
  journalCode: string;
  postingDate: string;
  accountId: string;
  accountNumber: string;
  accountName: string;
  debit: number;
  credit: number;
  balance: number; // Running balance
  description: string | null;
  referenceType: JournalReferenceType | null;
  referenceCode: string | null;
  sourceModule: JournalSourceModule;
};

export type AccountLedger = {
  account: Account;
  openingBalance: number;
  closingBalance: number;
  totalDebits: number;
  totalCredits: number;
  entries: LedgerEntry[];
};

// ============================================================================
// Report Types
// ============================================================================

export type TrialBalanceRow = {
  accountNumber: string;
  accountName: string;
  accountType: AccountType;
  debit: number;
  credit: number;
  balance: number;
};

export type TrialBalance = {
  asOfDate: string;
  accounts: TrialBalanceRow[];
  totalDebits: number;
  totalCredits: number;
  isBalanced: boolean;
};

// ============================================================================
// AR/AP Types
// ============================================================================

export type ARAgingRow = {
  customerId: string;
  customerName: string;
  invoiceId: string;
  invoiceCode: string;
  invoiceDate: string;
  dueDate: string;
  totalAmount: number;
  amountPaid: number;
  balance: number;
  daysOverdue: number;
  current: number; // 0-30 days
  days30: number; // 31-60 days
  days60: number; // 61-90 days
  days90Plus: number; // 90+ days
};

export type ARAgingReport = {
  asOfDate: string;
  customers: ARAgingRow[];
  totalCurrent: number;
  totalDays30: number;
  totalDays60: number;
  totalDays90Plus: number;
  totalBalance: number;
};

export type APAgingRow = {
  supplierId: string;
  supplierName: string;
  billId: string;
  billCode: string;
  billDate: string;
  dueDate: string;
  totalAmount: number;
  amountPaid: number;
  balance: number;
  daysOverdue: number;
  current: number;
  days30: number;
  days60: number;
  days90Plus: number;
};

export type APAgingReport = {
  asOfDate: string;
  suppliers: APAgingRow[];
  totalCurrent: number;
  totalDays30: number;
  totalDays60: number;
  totalDays90Plus: number;
  totalBalance: number;
};

// ============================================================================
// Filter Types
// ============================================================================

export type AccountFilters = {
  search?: string;
  accountType?: AccountType | "all";
  isActive?: boolean;
  isSystemAccount?: boolean;
};

export type JournalEntryFilters = {
  search?: string;
  status?: JournalEntryStatus | "all";
  sourceModule?: JournalSourceModule | "all";
  referenceType?: JournalReferenceType | "all";
  dateFrom?: string;
  dateTo?: string;
  accountId?: string;
};

export type LedgerFilters = {
  dateFrom: string;
  dateTo: string;
  accountId?: string;
  accountNumber?: string;
};

// ============================================================================
// API Response Types
// ============================================================================

export type AccountsResponse = {
  data: Account[];
  pagination?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
};

export type JournalEntriesResponse = {
  data: JournalEntryWithLines[];
  pagination?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
};

export type LedgerResponse = {
  data: AccountLedger;
};
