export type CustomerType = "individual" | "company" | "government";
export type PaymentTerms = "cash" | "net_30" | "net_60" | "net_90" | "due_on_receipt" | "cod";

export interface Customer {
  id: string;
  companyId: string;
  customerType: CustomerType;
  code: string;
  name: string;
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
  shippingAddress: string;
  shippingCity: string;
  shippingState: string;
  shippingPostalCode: string;
  shippingCountry: string;
  contactPersonName?: string;
  contactPersonEmail?: string;
  contactPersonPhone?: string;
  paymentTerms: PaymentTerms;
  creditLimit: number;
  currentBalance: number;
  notes: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCustomerRequest {
  companyId: string;
  customerType: CustomerType;
  code: string;
  name: string;
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
  shippingAddress: string;
  shippingCity: string;
  shippingState: string;
  shippingPostalCode: string;
  shippingCountry: string;
  contactPersonName?: string;
  contactPersonEmail?: string;
  contactPersonPhone?: string;
  paymentTerms: PaymentTerms;
  creditLimit: number;
  notes: string;
  isActive: boolean;
}

export interface UpdateCustomerRequest {
  customerType: CustomerType;
  name: string;
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
  shippingAddress: string;
  shippingCity: string;
  shippingState: string;
  shippingPostalCode: string;
  shippingCountry: string;
  contactPersonName?: string;
  contactPersonEmail?: string;
  contactPersonPhone?: string;
  paymentTerms: PaymentTerms;
  creditLimit: number;
  notes: string;
  isActive: boolean;
}

export interface CustomerFilters {
  search?: string;
  customerType?: CustomerType | "all";
  isActive?: boolean;
  page?: number;
  limit?: number;
}

export interface CustomerListResponse {
  data: Customer[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
