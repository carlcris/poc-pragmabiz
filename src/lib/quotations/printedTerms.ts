/**
 * Whether the printed quotation shows its terms and conditions block.
 *
 * Cash leaves nothing to state: the customer pays on collection, so a credit
 * terms paragraph is noise on the quote — and worse, the seeded default reads
 * "Payment due within 30 days", which directly contradicts a cash sale.
 *
 * A pure helper rather than a branch inside the PDF component so the rule can be
 * tested without rendering a document, and so any other printed surface (a job
 * order, an emailed copy) applies the same rule instead of restating it.
 */
export function showsPrintedTerms(quotation: {
  terms?: string | null;
  paymentTerms?: string | null;
}): boolean {
  if (!quotation.terms?.trim()) return false;
  return quotation.paymentTerms !== "cash";
}
