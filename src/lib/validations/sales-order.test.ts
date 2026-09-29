import { describe, expect, it } from "vitest";
import { salesOrderMutationSchema } from "./sales-order";
import { frameSizeSelectionPayload } from "@/lib/sales-orders/frame-size-selection-payload";

const request = {
  customerId: "42c9030a-2696-4f9d-89c0-9b22291a693e",
  orderDate: "2026-09-05",
  expectedDeliveryDate: "2026-09-12",
  lineItems: [
    {
      itemId: "c64a5556-8f5a-4d80-bdcf-d302d70ff378",
      quotationId: "5b824718-ca78-4af5-a535-34d6cbad0883",
      quotationItemId: "d2473c69-506d-4882-aa68-e1867112d4e1",
      description: "Quoted frame",
      quantity: 5,
      uomId: "3c85b916-e9bd-492a-b770-b9af41c9c1f3",
      unitPrice: 648.67,
      discount: 0,
      taxRate: 0,
      frameSizeSelections: [
        {
          quotationConfigurationId: "85bbdba4-efb4-40b2-b9ec-df84e7c5b904",
          quantity: 5,
        },
      ],
    },
  ],
  shippingAddress: "",
  shippingCity: "",
  shippingState: "",
  shippingPostalCode: "",
  shippingCountry: "",
  paymentTerms: "Cash",
  notes: "",
};

describe("salesOrderMutationSchema", () => {
  it("accepts an edited order with configured frames, an existing ordinary item, and a new item", () => {
    const ordinary = {
      ...request.lineItems[0],
      quotationId: null,
      quotationItemId: null,
      frameSizeSelections: frameSizeSelectionPayload([]),
    };
    const added = { ...ordinary, frameSizeSelections: frameSizeSelectionPayload(undefined) };
    const payload = JSON.parse(
      JSON.stringify({
        ...request,
        lineItems: [request.lineItems[0], ordinary, added],
      })
    );
    expect(payload.lineItems[1]).not.toHaveProperty("frameSizeSelections");
    expect(payload.lineItems[2]).not.toHaveProperty("frameSizeSelections");
    expect(salesOrderMutationSchema.safeParse(payload).success).toBe(true);
  });

  it("preserves valid frame selections and rejects malformed ones rather than omitting them", () => {
    const configuration = {
      quotationConfigurationId:
        request.lineItems[0].frameSizeSelections[0].quotationConfigurationId,
      frameQuantity: 5,
    };
    expect(frameSizeSelectionPayload([{ frameConfiguration: configuration }])).toEqual(
      request.lineItems[0].frameSizeSelections
    );
    for (const frameConfiguration of [
      { ...configuration, quotationConfigurationId: undefined },
      { ...configuration, frameQuantity: 0 },
      { ...configuration, frameQuantity: 2.5 },
    ]) {
      const payload = {
        ...request,
        lineItems: [
          {
            ...request.lineItems[0],
            frameSizeSelections: frameSizeSelectionPayload([{ frameConfiguration }]),
          },
        ],
      };
      expect(salesOrderMutationSchema.safeParse(payload).success).toBe(false);
    }
  });

  it("accepts quotation source ids with partial frame quantities", () => {
    expect(salesOrderMutationSchema.safeParse(request).success).toBe(true);
  });

  it("omits a deselected size while preserving the selected size", () => {
    const selected = {
      quotationConfigurationId:
        request.lineItems[0].frameSizeSelections[0].quotationConfigurationId,
      frameQuantity: 1,
    };
    const selections = frameSizeSelectionPayload([
      { frameConfiguration: selected },
      {
        frameConfiguration: {
          quotationConfigurationId: "77993c30-a628-4a90-a87e-a4dd5e976f0d",
          frameQuantity: 0,
        },
      },
    ]);
    expect(selections).toEqual([
      { quotationConfigurationId: selected.quotationConfigurationId, quantity: 1 },
    ]);
    expect(
      salesOrderMutationSchema.safeParse({
        ...request,
        lineItems: [{ ...request.lineItems[0], quantity: 1, frameSizeSelections: selections }],
      }).success
    ).toBe(true);
  });

  it.each([undefined, -1, 1.5])("does not hide an invalid size quantity %s", (frameQuantity) => {
    const selections = frameSizeSelectionPayload([
      {
        frameConfiguration: {
          quotationConfigurationId:
            request.lineItems[0].frameSizeSelections[0].quotationConfigurationId,
          frameQuantity,
        },
      },
    ]);
    expect(selections).toHaveLength(1);
    expect(
      salesOrderMutationSchema.safeParse({
        ...request,
        lineItems: [{ ...request.lineItems[0], frameSizeSelections: selections }],
      }).success
    ).toBe(false);
  });

  it("rejects the removed client-owned frame configuration payload", () => {
    const legacyRequest = {
      ...request,
      lineItems: [{ ...request.lineItems[0], frameConfiguration: { width: 20, height: 16 } }],
    };

    expect(salesOrderMutationSchema.safeParse(legacyRequest).success).toBe(false);
  });

  it("rejects fractional frame counts", () => {
    const fractionalRequest = {
      ...request,
      lineItems: [
        {
          ...request.lineItems[0],
          quantity: 2.5,
          frameSizeSelections: [
            {
              quotationConfigurationId: "85bbdba4-efb4-40b2-b9ec-df84e7c5b904",
              quantity: 2.5,
            },
          ],
        },
      ],
    };

    expect(salesOrderMutationSchema.safeParse(fractionalRequest).success).toBe(false);
  });
});
