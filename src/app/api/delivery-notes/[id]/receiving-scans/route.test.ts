import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { POST as recordScan } from "./route";
import { POST as resolveItem } from "../resolve-receiving-item/route";

const mocks = vi.hoisted(() => ({
  access: vi.fn(),
  header: vi.fn(),
  detail: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
  lookupError: null as { message: string } | null,
  items: [] as { id: string }[],
  units: [] as { id: string; item_id: string }[],
  limits: [] as number[],
}));
vi.mock("@/lib/activity-logging/route-activity-logger", () => ({
  withActivityLogging: (handler: unknown) => handler,
}));
vi.mock("@/lib/delivery-notes/permissions", () => ({
  requireDeliveryNoteReceivingAccess: mocks.access,
}));
vi.mock("../../_lib", () => ({
  getAuthContext: async () => ({
    companyId: "company",
    currentBusinessUnitId: "receiving-bu",
    userId: "actor",
    supabase: { from: mocks.from, rpc: mocks.rpc },
  }),
  fetchDeliveryNoteHeader: mocks.header,
  fetchDeliveryNote: mocks.detail,
  isReceivingBusinessUnit: (current: string, receiving: string) => current === receiving,
  toNumber: (value: number | null | undefined) => value ?? 0,
}));

const itemId = "11111111-1111-4111-8111-111111111111";
const unitId = "22222222-2222-4222-8222-222222222222";
const scan = { boxId: "0286131636", qrCode: "0286131636", qty: 1 };
const post = (handler: typeof recordScan, body: unknown, locale?: string) =>
  handler(
    new NextRequest("http://localhost/api/delivery-notes/dn/receiving-scans", {
      method: "POST",
      body: JSON.stringify(body),
      headers: locale ? { cookie: `preferredLanguage=${locale}` } : undefined,
    }),
    { params: Promise.resolve({ id: "dn" }) }
  );

beforeEach(() => {
  vi.clearAllMocks();
  mocks.lookupError = null;
  mocks.items = [];
  mocks.units = [];
  mocks.limits = [];
  mocks.access.mockResolvedValue(null);
  mocks.header.mockResolvedValue({
    requesting_business_unit_id: "receiving-bu",
    status: "dispatched",
    receiving_started_at: "2026-10-29T00:00:00Z",
    requesting_warehouse_id: "warehouse",
  });
  mocks.detail.mockResolvedValue({ id: "dn", delivery_note_items: [] });
  mocks.rpc.mockResolvedValue({
    data: { type: "exception", exceptionId: "exception", isUnexpected: true },
    error: null,
  });
  mocks.from.mockImplementation((table: string) => {
    const query = {
      select: () => query,
      eq: () => query,
      in: () => query,
      is: () => query,
      limit: async (limit: number) => {
        mocks.limits.push(limit);
        return { data: table === "items" ? mocks.items : mocks.units, error: mocks.lookupError };
      },
    };
    return query;
  });
});

const endpoints = [
  ["resolve", resolveItem],
  ["record", recordScan],
] as const;

describe.each(endpoints)("%s receiving item", (_name, handler) => {
  it("asks for the full QR when a box ID cannot identify an item, without writing", async () => {
    const response = await post(handler, scan);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      code: "DELIVERY_NOTE_RECEIVING_FULL_QR_REQUIRED",
      error:
        "This box ID could not be matched to an item. Scan the full QR code on the box to read its item details.",
    });
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.limits.every((limit) => limit <= 2)).toBe(true);
  });

  it("translates the scan-full-QR guidance", async () => {
    const response = await post(handler, scan, "zh");
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      code: "DELIVERY_NOTE_RECEIVING_FULL_QR_REQUIRED",
      error: "无法通过此箱号匹配商品。请扫描箱子上的完整二维码以读取商品详情。",
    });
  });

  it.each([
    { qty: 0 },
    { qty: "1" },
    { boxId: " " },
    { itemId: "invalid-uuid" },
    { qrCode: "x".repeat(8193) },
    { confirmUnexpected: true },
    { unexpectedField: true },
  ])("rejects invalid payloads and the removed unidentified-item flag: %j", async (patch) => {
    const response = await post(handler, { ...scan, ...patch });
    expect(response.status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it.each(["null", "123", "[]"])("does not record an unresolved opaque code %s", async (qrCode) => {
    const response = await post(handler, { ...scan, qrCode });
    expect(response.status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("enforces receiving business-unit scope before looking up the item", async () => {
    mocks.header.mockResolvedValue({ requesting_business_unit_id: "other-bu" });
    const response = await post(handler, scan);
    expect(response.status).toBe(403);
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("enforces receiving permissions", async () => {
    mocks.access.mockResolvedValue(NextResponse.json({ error: "Forbidden" }, { status: 403 }));
    const response = await post(handler, scan);
    expect(response.status).toBe(403);
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("requires receiving to have started", async () => {
    mocks.header.mockResolvedValue({
      requesting_business_unit_id: "receiving-bu",
      status: "dispatched",
    });
    const response = await post(handler, scan);
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: "DELIVERY_NOTE_RECEIVING_NOT_STARTED" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("keeps catalog lookup failures distinct from unrecognized box IDs", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.lookupError = { message: "private lookup failure" };
    const response = await post(handler, scan);
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      code: "DELIVERY_NOTE_RECEIVING_LOOKUP_FAILED",
      error: "Could not identify the item. Try scanning again.",
    });
    expect(mocks.rpc).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });
});

describe("identify before unexpected-item confirmation", () => {
  it("identifies a full QR without recording it, then records the confirmed known item for review", async () => {
    mocks.items = [{ id: itemId }];
    const payload = {
      ...scan,
      qrCode: JSON.stringify({ boxId: scan.boxId, itemId, qty: 12 }),
      qty: 12,
    };
    const lookup = await post(resolveItem, payload);
    expect(lookup.status).toBe(200);
    const identity = (await lookup.json()).data;
    expect(identity).toEqual({
      itemId,
      itemUnitOptionId: null,
      batchNumber: null,
      locationId: null,
    });
    expect(mocks.rpc).not.toHaveBeenCalled();
    const saved = await post(recordScan, { ...payload, ...identity });
    expect(saved.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith(
      "record_delivery_note_receiving_scan",
      expect.objectContaining({ p_item_id: itemId, p_qr_code: payload.qrCode, p_qr_qty: 12 })
    );
    expect(mocks.rpc.mock.calls[0][1]).not.toHaveProperty("p_confirm_unexpected");
    expect(await saved.json()).toEqual({
      result: { type: "exception", exceptionId: "exception", isUnexpected: true },
      deliveryNote: { id: "dn", delivery_note_items: [] },
    });
  });

  it("identifies a system barcode or item code before asking for confirmation", async () => {
    mocks.units = [{ id: unitId, item_id: itemId }];
    mocks.items = [{ id: itemId }];
    const response = await post(resolveItem, scan);
    expect(response.status).toBe(200);
    expect((await response.json()).data).toMatchObject({ itemId, itemUnitOptionId: unitId });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("reads the item code and metadata from the printed box QR format", async () => {
    mocks.items = [{ id: itemId }];
    const response = await post(resolveItem, {
      ...scan,
      qrCode: JSON.stringify({
        id: scan.boxId,
        itemId: null,
        item: "ITEM-1",
        box: 1,
        qty: 12,
        batchNumber: "BATCH-1",
      }),
    });
    expect(response.status).toBe(200);
    expect((await response.json()).data).toMatchObject({ itemId, batchNumber: "BATCH-1" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("rejects a full QR whose catalog item is unavailable", async () => {
    const response = await post(resolveItem, {
      ...scan,
      qrCode: JSON.stringify({ itemId, boxId: scan.boxId }),
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "DELIVERY_NOTE_RECEIVING_ITEM_NOT_FOUND" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("rejects ambiguous unit barcodes without recording", async () => {
    mocks.units = [
      { id: unitId, item_id: itemId },
      { id: itemId, item_id: itemId },
    ];
    const response = await post(resolveItem, scan);
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "DELIVERY_NOTE_RECEIVING_AMBIGUOUS_ITEM" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("preserves the fast path for an item already matched to the delivery note", async () => {
    const response = await post(recordScan, { ...scan, itemId });
    expect(response.status).toBe(200);
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.rpc).toHaveBeenCalledOnce();
  });

  it("handles an item becoming unavailable between identification and confirmation", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.rpc.mockResolvedValue({ error: { message: "Item not found" } });
    const response = await post(recordScan, { ...scan, itemId });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "DELIVERY_NOTE_RECEIVING_ITEM_NOT_FOUND" });
    vi.restoreAllMocks();
  });

  it("keeps unexpected database errors server-side", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.rpc.mockResolvedValue({ error: { message: "private constraint details" } });
    const response = await post(recordScan, { ...scan, itemId });
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      code: "DELIVERY_NOTE_RECEIVING_SCAN_FAILED",
      error: "Failed to record receiving scan",
    });
    expect(log).toHaveBeenCalled();
    vi.restoreAllMocks();
  });
});
