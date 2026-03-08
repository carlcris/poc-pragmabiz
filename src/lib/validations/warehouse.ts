import * as z from "zod";

type WarehouseValidationKey =
  | "codeRequired"
  | "codeMax"
  | "codeFormat"
  | "nameRequired"
  | "nameMax"
  | "descriptionMax"
  | "addressMax"
  | "cityMax"
  | "stateMax"
  | "postalCodeMax"
  | "countryMax"
  | "phoneMax"
  | "emailInvalid"
  | "emailMax";

type WarehouseValidationTranslator = (key: WarehouseValidationKey) => string;

export const createWarehouseFormSchema = (t: WarehouseValidationTranslator) =>
  z.object({
    code: z
      .string()
      .min(1, t("codeRequired"))
      .max(50, t("codeMax"))
      .regex(/^[A-Z0-9-]+$/, t("codeFormat")),
    name: z.string().min(1, t("nameRequired")).max(200, t("nameMax")),
    description: z.string().max(1000, t("descriptionMax")).optional().default(""),
    address: z.string().max(500, t("addressMax")).optional().default(""),
    city: z.string().max(100, t("cityMax")).optional().default(""),
    state: z.string().max(100, t("stateMax")).optional().default(""),
    postalCode: z.string().max(20, t("postalCodeMax")).optional().default(""),
    country: z.string().max(100, t("countryMax")).optional().default(""),
    phone: z.string().max(50, t("phoneMax")).optional().default(""),
    email: z
      .string()
      .email(t("emailInvalid"))
      .max(255, t("emailMax"))
      .optional()
      .or(z.literal(""))
      .default(""),
    managerId: z.string().uuid().optional(),
    isActive: z.boolean().default(true),
  });

export type WarehouseFormSchema = ReturnType<typeof createWarehouseFormSchema>;
export type WarehouseFormValues = z.infer<WarehouseFormSchema>;

export const createCreateWarehouseSchema = (t: WarehouseValidationTranslator) =>
  createWarehouseFormSchema(t).extend({
    companyId: z.string().uuid(),
  });

export const createUpdateWarehouseSchema = (t: WarehouseValidationTranslator) =>
  createWarehouseFormSchema(t).partial().omit({ code: true });
