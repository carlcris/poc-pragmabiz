import { z } from "zod";

export const supplierStatusEnum = z.enum(["active", "inactive", "blacklisted"]);
export const supplierLanguageEnum = z.enum(["english", "chinese"]);
export const paymentTermsEnum = z.enum([
  "cod",
  "net_7",
  "net_15",
  "net_30",
  "net_45",
  "net_60",
  "net_90",
]);

export const createSupplierFormSchema = (t: (key: string) => string) =>
  z.object({
    code: z.string().min(1, t("codeRequired")),
    name: z.string().min(1, t("nameRequired")),
    contactPerson: z.string().min(1, t("contactPersonRequired")),
    email: z.string().email(t("invalidEmail")),
    phone: z.string().min(1, t("phoneRequired")),
    mobile: z.string().optional(),
    website: z.string().optional(),
    taxId: z.string().optional(),
    billingAddress: z.string().min(1, t("billingAddressRequired")),
    billingCity: z.string().min(1, t("cityRequired")),
    billingState: z.string().min(1, t("stateRequired")),
    billingPostalCode: z.string().min(1, t("postalCodeRequired")),
    billingCountry: z.string().min(1, t("countryRequired")),
    shippingAddress: z.string().optional(),
    shippingCity: z.string().optional(),
    shippingState: z.string().optional(),
    shippingPostalCode: z.string().optional(),
    shippingCountry: z.string().optional(),
    paymentTerms: paymentTermsEnum,
    creditLimit: z.number().min(0, t("creditLimitMin")).optional(),
    bankName: z.string().optional(),
    bankAccountNumber: z.string().optional(),
    bankAccountName: z.string().optional(),
    lang: supplierLanguageEnum,
    status: supplierStatusEnum,
    notes: z.string().optional(),
  });

export const supplierFormSchema = createSupplierFormSchema((key) => key);

export type SupplierFormValues = z.infer<typeof supplierFormSchema>;
