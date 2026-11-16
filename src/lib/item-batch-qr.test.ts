import { describe, expect, it } from "vitest";
import { parseItemBatchQr, serializeItemBatchQr } from "./item-batch-qr";
import { generateQRCode } from "./barcode";

const identity = { itemId: "11111111-1111-4111-8111-111111111111", batchNumber: "BATCH-A" };
describe("location-independent item-batch QR", () => {
  it("serializes exactly item and batch and parses the printed identity", () => {
    const encoded = serializeItemBatchQr(identity);
    expect(JSON.parse(encoded)).toEqual(identity);
    expect(parseItemBatchQr(encoded)).toEqual(identity);
  });
  it.each([
    "1234567890",
    "null",
    "[]",
    "{}",
    JSON.stringify({ itemId: identity.itemId }),
    JSON.stringify({ ...identity, batchNumber: "" }),
    JSON.stringify({ ...identity, itemId: "ITEM-A" }),
    JSON.stringify({ ...identity, location: "location-1" }),
    JSON.stringify({ ...identity, batchLocationSku: "1234567890" }),
  ])("rejects incomplete and old location-specific identities: %s", (raw) => {
    expect(parseItemBatchQr(raw)).toBeNull();
  });
  it("prints identical QR images regardless of label quantity or item display name", async () => {
    const label = { ...identity, itemCode: "ITEM-A", itemName: "Item A", qtyPerBox: 1 };
    expect(await generateQRCode(label)).toBe(
      await generateQRCode({ ...label, itemName: "Updated name", qtyPerBox: 12 })
    );
  });
});
