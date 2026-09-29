import { describe, expect, it } from "vitest";

import { showsPrintedTerms } from "./printedTerms";

const terms = "Payment due within 30 days. Delivery within 2 weeks.";

describe("showsPrintedTerms", () => {
  it("hides the block on a cash sale", () => {
    // The seeded default says "Payment due within 30 days", which contradicts a
    // cash sale outright — printing both is worse than printing neither.
    expect(showsPrintedTerms({ terms, paymentTerms: "cash" })).toBe(false);
  });

  it("prints on every other term", () => {
    ["due_on_receipt", "net_30", "net_60", "net_90", "cod"].forEach((paymentTerms) => {
      expect(showsPrintedTerms({ terms, paymentTerms })).toBe(true);
    });
  });

  it("hides an empty block regardless of terms", () => {
    expect(showsPrintedTerms({ terms: "", paymentTerms: "net_30" })).toBe(false);
    expect(showsPrintedTerms({ terms: "   ", paymentTerms: "net_30" })).toBe(false);
    expect(showsPrintedTerms({ paymentTerms: "net_30" })).toBe(false);
  });

  it("prints when payment terms are unknown", () => {
    // Only cash is a reason to suppress; a missing value must not silently
    // strip terms from a credit quote.
    expect(showsPrintedTerms({ terms })).toBe(true);
    expect(showsPrintedTerms({ terms, paymentTerms: null })).toBe(true);
  });
});
