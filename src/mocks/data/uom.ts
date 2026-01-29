import type { UnitOfMeasure } from "@/types/uom";

// Temporary mock UoM data with fixed IDs
// These will be replaced with real database data later
export const mockUoM: UnitOfMeasure[] = [
  {
    id: "uom-pc",
    companyId: "company-1",
    code: "PC",
    name: "Pieces",
    symbol: "pcs",
    isBaseUnit: true,
    isActive: true,
  },
  {
    id: "uom-box",
    companyId: "company-1",
    code: "BOX",
    name: "Box",
    symbol: "box",
    isBaseUnit: false,
    isActive: true,
  },
  {
    id: "uom-license",
    companyId: "company-1",
    code: "LICENSE",
    name: "License",
    symbol: "lic",
    isBaseUnit: true,
    isActive: true,
  },
  {
    id: "uom-sqm",
    companyId: "company-1",
    code: "SQM",
    name: "Square Meter",
    symbol: "m²",
    isBaseUnit: true,
    isActive: true,
  },
  {
    id: "uom-m",
    companyId: "company-1",
    code: "M",
    name: "Meter",
    symbol: "m",
    isBaseUnit: true,
    isActive: true,
  },
  {
    id: "uom-kg",
    companyId: "company-1",
    code: "KG",
    name: "Kilogram",
    symbol: "kg",
    isBaseUnit: true,
    isActive: true,
  },
];

// Helper to get UoM ID by code
export function getUomIdByCode(code: string): string {
  const uom = mockUoM.find((u) => u.code === code);
  return uom?.id || "uom-pc"; // Default to PC if not found
}
