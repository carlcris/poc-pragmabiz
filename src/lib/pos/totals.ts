export const POS_VAT_RATE_PERCENT = 12;
export const POS_VAT_RATE = POS_VAT_RATE_PERCENT / 100;

export type POSTotalItem = {
  quantity: number;
  unitPrice: number;
  discount?: number;
};

export type POSTotals = {
  subtotal: number;
  totalDiscount: number;
  taxableAmount: number;
  totalTax: number;
  totalAmount: number;
};

export const roundCurrency = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export const calculateInclusiveVat = (grossAmount: number, rate = POS_VAT_RATE) => {
  if (!Number.isFinite(grossAmount) || grossAmount <= 0) return 0;
  return roundCurrency(grossAmount - grossAmount / (1 + rate));
};

export const calculatePOSLineTotal = (item: POSTotalItem) => {
  const lineSubtotal =
    Math.max(0, Number(item.quantity) || 0) * Math.max(0, Number(item.unitPrice) || 0);
  const discount = Math.min(Math.max(0, Number(item.discount || 0)), lineSubtotal);

  return roundCurrency(lineSubtotal - discount);
};

export const calculatePOSTotals = (items: POSTotalItem[]): POSTotals => {
  const subtotal = roundCurrency(
    items.reduce(
      (sum, item) =>
        sum + Math.max(0, Number(item.quantity) || 0) * Math.max(0, Number(item.unitPrice) || 0),
      0
    )
  );
  const totalDiscount = roundCurrency(
    items.reduce((sum, item) => {
      const lineSubtotal =
        Math.max(0, Number(item.quantity) || 0) * Math.max(0, Number(item.unitPrice) || 0);
      return sum + Math.min(Math.max(0, Number(item.discount || 0)), lineSubtotal);
    }, 0)
  );
  const taxableAmount = roundCurrency(Math.max(0, subtotal - totalDiscount));
  const totalTax = calculateInclusiveVat(taxableAmount);

  return {
    subtotal,
    totalDiscount,
    taxableAmount,
    totalTax,
    totalAmount: taxableAmount,
  };
};
