import { describe, expect, it } from "vitest";
import { translations } from "@/lib/i18n/translations";
import { createLoadListFormSchema, isValidLoadListQuantity } from "./load-list";

describe("load list quantity validation", () => {
  it.each(["1", "0.01", "1.23", ".5", "100.00", "1."])(
    "accepts positive quantities with at most two decimal places: %s",
    (quantity) => {
      expect(isValidLoadListQuantity(quantity)).toBe(true);
    }
  );

  it.each(["", "0", "-1", ".", "1.234", "0.001", "1e2", "NaN", "Infinity", "9".repeat(400)])(
    "rejects missing, nonpositive, malformed, or overprecision quantities: %s",
    (quantity) => {
      expect(isValidLoadListQuantity(quantity)).toBe(false);
    }
  );
});

describe("load list date validation", () => {
  const values = {
    supplierId: "supplier",
    destinationBusinessUnitId: "destination",
    loadDate: "2026-10-27",
  };

  it("allows a valid load date and an intentionally cleared load date", () => {
    const schema = createLoadListFormSchema(
      (key) => key,
      () => false
    );
    expect(schema.safeParse(values).success).toBe(true);
    expect(schema.safeParse({ ...values, loadDate: "" }).success).toBe(true);
  });

  it("rejects an incomplete native load date until corrected or cleared", () => {
    let isLoadDateInvalid = true;
    const schema = createLoadListFormSchema(
      (key) => key,
      () => isLoadDateInvalid
    );
    // Native date inputs report an empty value for a partially entered date.
    const incompleteValues = { ...values, loadDate: "" };
    const result = schema.safeParse(incompleteValues);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual([
        expect.objectContaining({ path: ["loadDate"], message: "dateInvalid" }),
      ]);
    }

    isLoadDateInvalid = false;
    expect(schema.safeParse(values).success).toBe(true);
    expect(schema.safeParse(incompleteValues).success).toBe(true);
  });

  it.each(["en", "zh"] as const)("uses translated date errors in %s", (locale) => {
    const schema = createLoadListFormSchema(
      (key) => translations[locale].loadListValidation[key],
      () => true
    );
    const result = schema.safeParse({ ...values, loadDate: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.message)).toEqual([
        translations[locale].loadListValidation.dateInvalid,
      ]);
    }
  });
});
