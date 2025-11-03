import { z } from "zod";
import { MINDANAO_CITIES, MINDANAO_REGIONS } from "@/types/employee";

// Enums
export const timePeriodEnum = z.enum([
  "daily",
  "weekly",
  "monthly",
  "quarterly",
  "yearly",
]);

export const exportFormatEnum = z.enum(["excel", "pdf"]);

export const reportTypeEnum = z.enum([
  "overview",
  "by-employee",
  "by-location",
  "by-time",
  "all",
]);

// Sales analytics filter schema
export const salesAnalyticsFilterSchema = z.object({
  startDate: z.string().optional(), // ISO date string
  endDate: z.string().optional(), // ISO date string
  employeeId: z.string().uuid().optional(),
  employeeIds: z.array(z.string().uuid()).optional(),
  city: z.enum(MINDANAO_CITIES as unknown as [string, ...string[]]).optional(),
  cities: z
    .array(z.enum(MINDANAO_CITIES as unknown as [string, ...string[]]))
    .optional(),
  regionState: z
    .enum(MINDANAO_REGIONS as unknown as [string, ...string[]])
    .optional(),
  regions: z
    .array(z.enum(MINDANAO_REGIONS as unknown as [string, ...string[]]))
    .optional(),
  timePeriod: timePeriodEnum.optional().default("daily"),
});

export type SalesAnalyticsFilterValues = z.infer<
  typeof salesAnalyticsFilterSchema
>;

// Export options schema
export const exportOptionsSchema = z.object({
  format: exportFormatEnum,
  reportType: reportTypeEnum,
  filters: salesAnalyticsFilterSchema,
  includeCharts: z.boolean().default(false),
});

export type ExportOptionsValues = z.infer<typeof exportOptionsSchema>;

// Date range preset schema (for quick filters)
export const dateRangePresetEnum = z.enum([
  "today",
  "yesterday",
  "last_7_days",
  "last_30_days",
  "this_month",
  "last_month",
  "this_quarter",
  "last_quarter",
  "this_year",
  "last_year",
  "custom",
]);

export const dateRangeSchema = z.object({
  preset: dateRangePresetEnum.default("last_30_days"),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export type DateRangeValues = z.infer<typeof dateRangeSchema>;
