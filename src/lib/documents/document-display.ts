export const formatDocumentAmount = (amount: number, currencyCode: string, locale: string) => {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currencyCode,
      currencyDisplay: "narrowSymbol",
    }).format(amount);
  } catch {
    return `${currencyCode} ${amount.toLocaleString(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
};

export const getDocumentCurrencySymbol = (currencyCode: string, locale: string) =>
  formatDocumentAmount(0, currencyCode, locale).replace(/[\d\s.,]/g, "") || currencyCode;

export const formatDocumentQuantity = (value: number, locale: string) =>
  value.toLocaleString(locale, { maximumFractionDigits: 4 });

export const formatDocumentDate = (value: string, locale: string) =>
  new Intl.DateTimeFormat(locale, { year: "numeric", month: "short", day: "2-digit" }).format(
    new Date(value)
  );

export const formatDocumentPerson = (
  person: { firstName?: string; lastName?: string; email?: string } | null | undefined
) =>
  person ? [person.firstName, person.lastName].filter(Boolean).join(" ") || person.email : null;
