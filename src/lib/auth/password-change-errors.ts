export const passwordChangeErrorCodes = [
  "PASSWORD_CHANGE_INVALID_INPUT",
  "PASSWORD_CHANGE_CURRENT_INCORRECT",
  "PASSWORD_CHANGE_SAME_PASSWORD",
  "PASSWORD_CHANGE_WEAK_PASSWORD",
  "PASSWORD_CHANGE_RATE_LIMITED",
  "PASSWORD_CHANGE_UNAVAILABLE",
] as const;

export type PasswordChangeErrorCode = (typeof passwordChangeErrorCodes)[number];
