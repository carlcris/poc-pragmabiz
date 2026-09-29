/**
 * One-line customer address for the job requisition.
 *
 * The requisition follows the frame to the bench and then back to the customer,
 * so the shipping address is preferred; billing stands in when no shipping
 * address was captured, which is common for walk-in work.
 *
 * Returns undefined rather than an empty string when nothing is on file, so the
 * form prints its own "no address" placeholder instead of a bare rule that
 * looks like a rendering fault.
 */
export function formatCustomerAddress(customer?: {
  shippingAddress?: string;
  shippingCity?: string;
  shippingState?: string;
  shippingPostalCode?: string;
  billingAddress?: string;
  billingCity?: string;
  billingState?: string;
  billingPostalCode?: string;
}): string | undefined {
  if (!customer) return undefined;

  // A city alone is not somewhere to deliver to, so the street line decides
  // which set is used rather than whether any shipping field is filled.
  const parts = customer.shippingAddress?.trim()
    ? [
        customer.shippingAddress,
        customer.shippingCity,
        customer.shippingState,
        customer.shippingPostalCode,
      ]
    : [
        customer.billingAddress,
        customer.billingCity,
        customer.billingState,
        customer.billingPostalCode,
      ];

  const line = parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(", ");

  return line || undefined;
}
