import { describe, expect, it } from "vitest";
import { isValidDocumentLineQuantity } from "./document-line";

describe("document line quantity validation", () => {
  it.each(["1", "0.01", "1.23", ".5", "100.00", "1."])(
    "accepts positive quantities with at most two decimal places: %s",
    (quantity) => {
      expect(isValidDocumentLineQuantity(quantity)).toBe(true);
    }
  );

  it.each(["", "0", "-1", ".", "1.234", "0.001", "1e2", "NaN", "Infinity", "9".repeat(400)])(
    "rejects missing, nonpositive, malformed, or overprecision quantities: %s",
    (quantity) => {
      expect(isValidDocumentLineQuantity(quantity)).toBe(false);
    }
  );
});
