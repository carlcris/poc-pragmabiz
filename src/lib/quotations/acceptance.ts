/**
 * The record required when a quotation is accepted.
 *
 * Acceptance is the moment the shop commits materials and bench time, so it has
 * to be evidenced: who on the customer's side agreed, through which channel,
 * and the document proving it. Months later, when a job is disputed, this is
 * what the shop produces.
 */

/**
 * A fixed vocabulary, not free text. "viber", "Viber" and "viber msg" are the
 * same channel and would defeat any report that tried to count them.
 *
 * `other` exists so an unforeseen channel does not force an operator to
 * mislabel one; the accepting person's name carries the detail.
 */
export const ACCEPTANCE_CHANNELS = [
  "messenger",
  "viber",
  "sms",
  "email",
  "phone",
  "in_person",
  "other",
] as const;

export type AcceptanceChannel = (typeof ACCEPTANCE_CHANNELS)[number];

export type AcceptanceRecord = {
  /** Free text: reality is "the owner's wife" as often as a registered contact. */
  acceptedByName: string;
  acceptedChannel: AcceptanceChannel;
  /** Storage paths of the uploaded waiver files. At least one is required. */
  waiverPaths: string[];
};

export function isAcceptanceChannel(value: unknown): value is AcceptanceChannel {
  return (
    typeof value === "string" && (ACCEPTANCE_CHANNELS as readonly string[]).includes(value)
  );
}

/**
 * Validates an acceptance record, returning the reasons it cannot be saved.
 *
 * Enforced on the SERVER as well as in the dialog: a client-only check leaves
 * the endpoint able to accept a quotation with no record at all, which is the
 * one thing this feature exists to prevent.
 */
export function validateAcceptance(record: Partial<AcceptanceRecord>): string[] {
  const errors: string[] = [];

  if (!record.acceptedByName?.trim()) {
    errors.push("Enter who accepted the quotation.");
  }
  if (!isAcceptanceChannel(record.acceptedChannel)) {
    errors.push("Choose the channel it was accepted through.");
  }
  if (!record.waiverPaths?.length) {
    errors.push("Attach the signed waiver.");
  }

  return errors;
}
