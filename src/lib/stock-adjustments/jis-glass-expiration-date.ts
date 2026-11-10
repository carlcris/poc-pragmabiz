import { addMonths, format, parseISO } from "date-fns";
import type { Item } from "@/types/item";
import { batchReceivedDateSchema } from "./batch-received-date";

type ExpirationItem = Pick<Item, "category" | "description" | "name" | "customFields">;

export const getJisGlassExpirationDate = (
  item: ExpirationItem | null,
  receivedDate: string
): string => {
  if (
    !item ||
    item.category.trim().toUpperCase() !== "GLASS" ||
    !/\bJIS\b/i.test(item.description) ||
    /\bacrylic\b/i.test(`${item.name} ${item.description}`) ||
    String(item.customFields?.production ?? "")
      .trim()
      .toUpperCase() === "IMPORTED/LOCAL" ||
    !batchReceivedDateSchema.safeParse(receivedDate).success
  ) {
    return "";
  }
  const expiration = format(addMonths(parseISO(receivedDate), 3), "yyyy-MM-dd");
  return batchReceivedDateSchema.safeParse(expiration).success ? expiration : "";
};
