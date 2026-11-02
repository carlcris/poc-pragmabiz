import { describe, expect, it } from "vitest";
import { translations } from "@/lib/i18n/translations";
import { createLoadListFormSchema } from "./load-list";

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
