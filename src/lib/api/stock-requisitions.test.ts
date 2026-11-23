import { afterEach, describe, expect, it, vi } from "vitest";
import { getApiErrorCode } from "@/lib/api";
import { STOCK_REQUISITION_SAVE_ERROR_CODES } from "@/types/stock-requisition";
import { stockRequisitionsApi } from "./stock-requisitions";

afterEach(() => vi.unstubAllGlobals());

describe("stock requisition save client errors", () => {
  it.each(["create", "update"] as const)(
    "preserves the duplicate-pack code for %s",
    async (operation) => {
      vi.stubGlobal(
        "fetch",
        vi
          .fn()
          .mockResolvedValue(
            Response.json(
              { error: "Pack already listed", code: "STOCK_REQUISITION_DUPLICATE_PACK" },
              { status: 400 }
            )
          )
      );
      const data = { supplierId: "supplier", items: [] };
      try {
        await (operation === "create"
          ? stockRequisitionsApi.createStockRequisition(data)
          : stockRequisitionsApi.updateStockRequisition("requisition", data));
        expect.fail("The save should have failed");
      } catch (error) {
        expect(getApiErrorCode(error, STOCK_REQUISITION_SAVE_ERROR_CODES)).toBe(
          "STOCK_REQUISITION_DUPLICATE_PACK"
        );
      }
    }
  );
});
