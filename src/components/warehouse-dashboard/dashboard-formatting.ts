// Date-only values ("2026-11-13") parse as UTC midnight with `new Date`, which shifts
// them a day back west of UTC. Treat them as local calendar dates instead.
const CALENDAR_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export const parseDashboardDate = (value: string): Date => {
  const match = CALENDAR_DATE_PATTERN.exec(value);
  if (match) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }
  return new Date(value);
};

const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

export type DueState = "late" | "today" | "upcoming";

export const getDueState = (date: Date, now: Date = new Date()): DueState => {
  const day = startOfDay(date);
  const today = startOfDay(now);
  if (day < today) return "late";
  if (day === today) return "today";
  return "upcoming";
};

export const formatShortDate = (date: Date, locale: string) =>
  date.toLocaleDateString(locale, { day: "numeric", month: "short" });

export const formatQuantity = (value: number, locale: string) =>
  new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value);
