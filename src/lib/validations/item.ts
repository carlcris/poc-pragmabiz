import * as z from "zod";

export const itemTypeEnum = z.enum(["raw_material", "finished_good", "asset", "service"]);

type ItemValidationKey =
  | "codeRequired"
  | "codeMax"
  | "codeFormat"
  | "nameRequired"
  | "nameMax"
  | "chineseNameMax"
  | "descriptionMax"
  | "uomRequired"
  | "categoryRequired"
  | "purchasePriceMin"
  | "importCostMin"
  | "importCurrencyRequired"
  | "listPriceMin"
  | "dimensionMin"
  | "reorderLevelMin"
  | "reorderQtyMin";

type ItemValidationTranslator = (key: ItemValidationKey) => string;

const createItemFormObjectSchema = (t: ItemValidationTranslator) =>
  z.object({
    code: z
      .string()
      .min(1, t("codeRequired"))
      .max(50, t("codeMax"))
      .regex(/^[A-Z0-9 -]+$/, t("codeFormat")),
    name: z.string().min(1, t("nameRequired")).max(200, t("nameMax")),
    chineseName: z.string().max(200, t("chineseNameMax")).optional(),
    description: z.string().max(1000, t("descriptionMax")).optional(),
    dimensions: z
      .object({
        length: z.number().min(0, t("dimensionMin")).optional(),
        width: z.number().min(0, t("dimensionMin")).optional(),
        height: z.number().min(0, t("dimensionMin")).optional(),
        unit: z.string().max(20).optional(),
      })
      .optional(),
    itemType: itemTypeEnum,
    uom: z.string().min(1, t("uomRequired")),
    category: z.string().min(1, t("categoryRequired")),
    purchasePrice: z.number().min(0, t("purchasePriceMin")).optional(),
    importCost: z.number().min(0, t("importCostMin")).optional().nullable(),
    importCurrency: z.string().trim().length(3).optional().nullable(),
    listPrice: z.number().min(0, t("listPriceMin")),
    reorderLevel: z.number().int().min(0, t("reorderLevelMin")).optional(),
    reorderQty: z.number().int().min(0, t("reorderQtyMin")).optional(),
    imageUrl: z.string().optional(),
    isActive: z.boolean().default(true),
  });

const addImportCostRefinement = <T extends z.ZodTypeAny>(schema: T, t: ItemValidationTranslator) =>
  schema.superRefine((value, context) => {
    const itemValue = value as { importCost?: number | null; importCurrency?: string | null };
    if (itemValue.importCost != null && !itemValue.importCurrency) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: t("importCurrencyRequired"),
        path: ["importCurrency"],
      });
    }
  });

export const createItemFormSchema = (t: ItemValidationTranslator) =>
  addImportCostRefinement(createItemFormObjectSchema(t), t);

export type ItemFormSchema = ReturnType<typeof createItemFormSchema>;
export type ItemFormValues = z.infer<ItemFormSchema>;

export const createCreateItemSchema = (t: ItemValidationTranslator) =>
  addImportCostRefinement(createItemFormObjectSchema(t).extend({ companyId: z.string().uuid() }), t);

export const createUpdateItemSchema = (t: ItemValidationTranslator) =>
  addImportCostRefinement(createItemFormObjectSchema(t).partial().omit({ code: true }), t);
