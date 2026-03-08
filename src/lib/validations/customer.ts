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

export const createCustomerFormSchema = (t: (key: string) => string) =>
  z.object({
    customerType: customerTypeEnum,
    code: z
      .string()
      .min(1, t("customerCodeRequired"))
      .regex(/^[A-Z0-9-]+$/, t("customerCodeFormat")),
    name: z.string().min(1, t("customerNameRequired")),
    email: z.string().email(t("invalidEmail")),
    phone: z.string().min(1, t("phoneRequired")),
    mobile: z.string().optional(),
    website: z.string().optional(),
    taxId: z.string().optional(),
    billingAddress: z.string().min(1, t("billingAddressRequired")),
    billingCity: z.string().min(1, t("billingCityRequired")),
    billingState: z.string().min(1, t("billingStateRequired")),
    billingPostalCode: z.string().min(1, t("billingPostalCodeRequired")),
    billingCountry: z.string().min(1, t("billingCountryRequired")),
    shippingAddress: z.string().min(1, t("shippingAddressRequired")),
    shippingCity: z.string().min(1, t("shippingCityRequired")),
    shippingState: z.string().min(1, t("shippingStateRequired")),
    shippingPostalCode: z.string().min(1, t("shippingPostalCodeRequired")),
    shippingCountry: z.string().min(1, t("shippingCountryRequired")),
    contactPersonName: z.string().optional(),
    contactPersonEmail: z.string().email(t("invalidEmail")).optional().or(z.literal("")),
    contactPersonPhone: z.string().optional(),
    paymentTerms: paymentTermsEnum,
    creditLimit: z.number().min(0, t("creditLimitMin")),
    notes: z.string().default(""),
    isActive: z.boolean().default(true),
  });

export const customerFormSchema = createCustomerFormSchema((key) => key);

export type CustomerFormValues = z.infer<typeof customerFormSchema>;

export const createCustomerSchema = customerFormSchema.extend({
  companyId: z.string().uuid(),
});

export const updateCustomerSchema = customerFormSchema.partial().omit({ code: true });
