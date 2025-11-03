export type SupplierStatus = "active" | "inactive" | "blacklisted";
export type PaymentTerms = "cod" | "net_7" | "net_15" | "net_30" | "net_45" | "net_60" | "net_90";

export interface Supplier {
  id: string;
  companyId: string;
  code: string;
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  mobile?: string;
  website?: string;
  taxId?: string;

  // Address
  billingAddress: string;
  billingCity: string;
  billingState: string;
  billingPostalCode: string;
  billingCountry: string;

  // Shipping address (if different)
  shippingAddress?: string;
  shippingCity?: string;
  shippingState?: string;
  shippingPostalCode?: string;
  shippingCountry?: string;

  // Payment info
  paymentTerms: PaymentTerms;
  creditLimit?: number;
  currentBalance: number;

  // Bank details
  bankName?: string;
  bankAccountNumber?: string;
  bankAccountName?: string;

  // Status
  status: SupplierStatus;
  notes?: string;

  // Metadata
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSupplierRequest {
  companyId: string;
  code: string;
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  mobile?: string;
  website?: string;
  taxId?: string;
  billingAddress: string;
  billingCity: string;
  billingState: string;
  billingPostalCode: string;
  billingCountry: string;
  shippingAddress?: string;
  shippingCity?: string;
  shippingState?: string;
  shippingPostalCode?: string;
  shippingCountry?: string;
  paymentTerms: PaymentTerms;
  creditLimit?: number;
  bankName?: string;
  bankAccountNumber?: string;
  bankAccountName?: string;
  status: SupplierStatus;
  notes?: string;
  createdBy: string;
}

export interface UpdateSupplierRequest {
  code?: string;
  name?: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  website?: string;
  taxId?: string;
  billingAddress?: string;
  billingCity?: string;
  billingState?: string;
  billingPostalCode?: string;
  billingCountry?: string;
  shippingAddress?: string;
  shippingCity?: string;
  shippingState?: string;
  shippingPostalCode?: string;
  shippingCountry?: string;
  paymentTerms?: PaymentTerms;
  creditLimit?: number;
  bankName?: string;
  bankAccountNumber?: string;
  bankAccountName?: string;
  status?: SupplierStatus;
  notes?: string;
}

export interface SupplierFilters {
  search?: string;
  status?: SupplierStatus | "all";
  page?: number;
  limit?: number;
}

export interface SuppliersResponse {
  data: Supplier[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
