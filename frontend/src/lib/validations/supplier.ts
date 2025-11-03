import { z } from "zod";

export const supplierStatusEnum = z.enum(["active", "inactive", "blacklisted"]);
export const paymentTermsEnum = z.enum(["cod", "net_7", "net_15", "net_30", "net_45", "net_60", "net_90"]);

export const supplierFormSchema = z.object({
  code: z.string().min(1, "Supplier code is required"),
  name: z.string().min(1, "Supplier name is required"),
  contactPerson: z.string().min(1, "Contact person is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(1, "Phone number is required"),
  mobile: z.string().optional(),
  website: z.string().optional(),
  taxId: z.string().optional(),

  // Billing address
  billingAddress: z.string().min(1, "Billing address is required"),
  billingCity: z.string().min(1, "City is required"),
  billingState: z.string().min(1, "State is required"),
  billingPostalCode: z.string().min(1, "Postal code is required"),
  billingCountry: z.string().min(1, "Country is required"),

  // Shipping address
  shippingAddress: z.string().optional(),
  shippingCity: z.string().optional(),
  shippingState: z.string().optional(),
  shippingPostalCode: z.string().optional(),
  shippingCountry: z.string().optional(),

  // Payment info
  paymentTerms: paymentTermsEnum,
  creditLimit: z.number().min(0).optional(),

  // Bank details
  bankName: z.string().optional(),
  bankAccountNumber: z.string().optional(),
  bankAccountName: z.string().optional(),

  // Status
  status: supplierStatusEnum,
  notes: z.string().optional(),
});

export type SupplierFormValues = z.infer<typeof supplierFormSchema>;
