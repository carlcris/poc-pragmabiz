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
  | "standardCostMin"
  | "listPriceMin"
  | "reorderLevelMin"
  | "reorderQtyMin";

type ItemValidationTranslator = (key: ItemValidationKey) => string;

export const createItemFormSchema = (t: ItemValidationTranslator) =>
  z.object({
    code: z
      .string()
      .min(1, t("codeRequired"))
      .max(50, t("codeMax"))
      .regex(/^[A-Z0-9 -]+$/, t("codeFormat")),
    name: z.string().min(1, t("nameRequired")).max(200, t("nameMax")),
    chineseName: z.string().max(200, t("chineseNameMax")).optional(),
    description: z.string().max(1000, t("descriptionMax")).optional(),
    itemType: itemTypeEnum,
    uom: z.string().min(1, t("uomRequired")),
    category: z.string().min(1, t("categoryRequired")),
    standardCost: z.number().min(0, t("standardCostMin")).optional(),
    listPrice: z.number().min(0, t("listPriceMin")),
    reorderLevel: z.number().int().min(0, t("reorderLevelMin")).optional(),
    reorderQty: z.number().int().min(0, t("reorderQtyMin")).optional(),
    imageUrl: z.string().optional(),
    isActive: z.boolean().default(true),
  });

export type ItemFormSchema = ReturnType<typeof createItemFormSchema>;
export type ItemFormValues = z.infer<ItemFormSchema>;

export const createCreateItemSchema = (t: ItemValidationTranslator) =>
  createItemFormSchema(t).extend({
    companyId: z.string().uuid(),
  });

export const createUpdateItemSchema = (t: ItemValidationTranslator) =>
  createItemFormSchema(t).partial().omit({ code: true });
