import { describe, expect, it } from "vitest";

import { formatCustomerAddress } from "./customerAddress";

describe("formatCustomerAddress", () => {
  it("prefers the shipping address — the frame goes there", () => {
    expect(
      formatCustomerAddress({
        shippingAddress: "12 Bench Row",
        shippingCity: "Davao",
        billingAddress: "99 Finance St",
        billingCity: "Manila" })
    ).toBe("12 Bench Row, Davao");
  });

  it("falls back to billing when no shipping street is on file", () => {
    expect(
      formatCustomerAddress({
        shippingCity: "Davao",
        billingAddress: "99 Finance St",
        billingCity: "Manila" })
    ).toBe("99 Finance St, Manila");
  });

  it("does not treat a lone shipping city as an address", () => {
    // A city with no street cannot be delivered to, so billing should win.
    const line = formatCustomerAddress({
      shippingCity: "Davao",
      billingAddress: "99 Finance St" });
    expect(line).toBe("99 Finance St");
  });

  it("joins whatever parts exist, skipping the blanks", () => {
    expect(
      formatCustomerAddress({
        billingAddress: "99 Finance St",
        billingCity: "",
        billingState: "NCR",
        billingPostalCode: "1000" })
    ).toBe("99 Finance St, NCR, 1000");
  });

  it("returns undefined when nothing is on file", () => {
    // Undefined, not "", so the form prints its own placeholder rather than a
    // bare rule that reads as a rendering fault.
    expect(formatCustomerAddress({})).toBeUndefined();
    expect(formatCustomerAddress(undefined)).toBeUndefined();
    expect(formatCustomerAddress({ billingAddress: "   " })).toBeUndefined();
  });
});
