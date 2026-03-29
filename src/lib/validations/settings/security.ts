import { z } from "zod";

export const createSecuritySettingsSchema = () =>
  z.object({
    session_timeout_minutes: z
      .number()
      .int("Session timeout must be a whole number")
      .min(5, "Session timeout must be at least 5 minutes")
      .max(1440, "Session timeout cannot exceed 24 hours"),
    password_min_length: z
      .number()
      .int("Password length must be a whole number")
      .min(6, "Minimum password length must be at least 6")
      .max(128, "Minimum password length cannot exceed 128"),
    password_require_uppercase: z.boolean().default(true),
    password_require_lowercase: z.boolean().default(true),
    password_require_numbers: z.boolean().default(true),
    password_require_special: z.boolean().default(false),
    require_mfa: z.boolean().default(false),
    max_login_attempts: z
      .number()
      .int("Max attempts must be a whole number")
      .min(1, "Max attempts must be at least 1")
      .max(20, "Max attempts cannot exceed 20"),
    lockout_duration_minutes: z
      .number()
      .int("Lockout duration must be a whole number")
      .min(1, "Lockout duration must be at least 1 minute")
      .max(1440, "Lockout duration cannot exceed 24 hours"),
    password_expiry_days: z
      .number()
      .int("Password expiry must be a whole number")
      .min(0, "Password expiry must be 0 or greater"),
  });

type SecuritySettingsSchema = ReturnType<typeof createSecuritySettingsSchema>;

export type SecuritySettingsFormInput = z.input<SecuritySettingsSchema>;
export type SecuritySettingsFormData = z.output<SecuritySettingsSchema>;
