// Calendar anniversaries use UTC, matching the timestamp instants used for total
// elapsed days. Clamp month-end receipts to the last day of shorter months.
export function calculateStockAge(receivedAt: string | null, asOf: Date) {
  const received = receivedAt ? new Date(receivedAt) : null;
  if (!received || !Number.isFinite(received.getTime())) {
    return { ageDays: 0, duration: null };
  }
  const elapsed = Math.max(0, asOf.getTime() - received.getTime());
  const ageDays = Math.floor(elapsed / 86400000);
  if (received >= asOf) return { ageDays, duration: { years: 0, months: 0, days: 0 } };

  const anniversary = (months: number) => {
    const result = new Date(received);
    result.setUTCDate(1);
    result.setUTCMonth(received.getUTCMonth() + months);
    const monthEnd = new Date(result);
    monthEnd.setUTCMonth(monthEnd.getUTCMonth() + 1, 0);
    result.setUTCDate(Math.min(received.getUTCDate(), monthEnd.getUTCDate()));
    return result;
  };
  let months =
    (asOf.getUTCFullYear() - received.getUTCFullYear()) * 12 +
    asOf.getUTCMonth() -
    received.getUTCMonth();
  if (anniversary(months) > asOf) months -= 1;
  const days = Math.floor((asOf.getTime() - anniversary(months).getTime()) / 86400000);
  return { ageDays, duration: { years: Math.floor(months / 12), months: months % 12, days } };
}
