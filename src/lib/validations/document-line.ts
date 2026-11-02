export const isValidDocumentLineQuantity = (value: string) =>
  /^\d*(\.\d{0,2})?$/.test(value) && Number.isFinite(Number(value)) && Number(value) > 0;
