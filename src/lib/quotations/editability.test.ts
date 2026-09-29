import { describe, expect, it } from "vitest";
import type { QuotationStatus } from "@/types/quotation";
import { canEditQuotation } from "./editability";

describe("canEditQuotation", () => {
  it.each<QuotationStatus>(["draft", "sent"])("allows %s quotations", (status) => {
    expect(canEditQuotation(status)).toBe(true);
  });

  it.each<QuotationStatus>(["accepted", "partially_ordered", "rejected", "expired", "ordered"])(
    "blocks %s quotations",
    (status) => {
      expect(canEditQuotation(status)).toBe(false);
    }
  );
});
