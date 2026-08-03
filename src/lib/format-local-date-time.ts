export type LocalDateTimeParts = {
  date: string;
  time: string;
};

export function formatLocalDateTimeParts(value: string | Date, locale: string): LocalDateTimeParts {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return { date: "-", time: "" };
  }

  const parts = new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).formatToParts(date);
  const getPart = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return {
    date: `${getPart("month")}/${getPart("day")}/${getPart("year")}`,
    time: `${getPart("hour")}:${getPart("minute")}:${getPart("second")} ${getPart("dayPeriod")}`.trim(),
  };
}

export function formatLocalDateTime(value: string | Date, locale: string): string {
  const parts = formatLocalDateTimeParts(value, locale);
  return [parts.date, parts.time].filter(Boolean).join(" ");
}
