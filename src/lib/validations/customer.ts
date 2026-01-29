import * as z from "zod";

export const customerTypeEnum = z.enum(["individual", "company", "government"]);
export const paymentTermsEnum = z.enum([
  "cash",
  "net_30",
  "net_60",
  "net_90",
  "due_on_receipt",
  "cod",
]);

export const customerFormSchema = z.object({
  customerType: customerTypeEnum,
  code: z
    .string()
    .min(1, "Customer code is required")
    .regex(/^[A-Z0-9-]+$/, "Code must contain only uppercase letters, numbers, and hyphens"),
  name: z.string().min(1, "Customer name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(1, "Phone is required"),
  mobile: z.string().optional(),
  website: z.string().optional(),
  taxId: z.string().optional(),
  billingAddress: z.string().min(1, "Billing address is required"),
  billingCity: z.string().min(1, "Billing city is required"),
  billingState: z.string().min(1, "Billing state is required"),
  billingPostalCode: z.string().min(1, "Billing postal code is required"),
  billingCountry: z.string().min(1, "Billing country is required"),
  shippingAddress: z.string().min(1, "Shipping address is required"),
  shippingCity: z.string().min(1, "Shipping city is required"),
  shippingState: z.string().min(1, "Shipping state is required"),
  shippingPostalCode: z.string().min(1, "Shipping postal code is required"),
  shippingCountry: z.string().min(1, "Shipping country is required"),
  contactPersonName: z.string().optional(),
  contactPersonEmail: z.string().email("Invalid email address").optional().or(z.literal("")),
  contactPersonPhone: z.string().optional(),
  paymentTerms: paymentTermsEnum,
  creditLimit: z.number().min(0, "Credit limit must be 0 or greater"),
  notes: z.string().default(""),
  isActive: z.boolean().default(true),
});

export type CustomerFormValues = z.infer<typeof customerFormSchema>;

export const createCustomerSchema = customerFormSchema.extend({
  companyId: z.string().uuid(),
});

export const updateCustomerSchema = customerFormSchema.partial().omit({ code: true });
