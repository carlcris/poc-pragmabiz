export const parseFloorNumber = (value: unknown): number | null => {
  if (typeof value !== "string" || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 2_147_483_647 ? parsed : null;
};
