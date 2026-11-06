import { z } from "zod";

export const PASSWORD_MIN_LENGTH = 8;
// bcrypt, used by Supabase Auth, only reads the first 72 bytes of a password.
export const PASSWORD_MAX_LENGTH = 72;

export const passwordChangeRequestSchema = z
  .object({
    currentPassword: z.string().min(1).max(PASSWORD_MAX_LENGTH),
    newPassword: z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH),
  })
  .strict();

export type PasswordChangeRequest = z.infer<typeof passwordChangeRequestSchema>;

type PasswordChangeValidationMessages = {
  currentPasswordRequired: string;
  newPasswordTooShort: string;
  newPasswordTooLong: string;
  newPasswordSameAsCurrent: string;
  confirmPasswordMismatch: string;
};

export const createPasswordChangeFormSchema = (messages: PasswordChangeValidationMessages) =>
  z
    .object({
      currentPassword: z.string().min(1, messages.currentPasswordRequired),
      newPassword: z
        .string()
        .min(PASSWORD_MIN_LENGTH, messages.newPasswordTooShort)
        .max(PASSWORD_MAX_LENGTH, messages.newPasswordTooLong),
      confirmPassword: z.string(),
    })
    .refine((data) => data.newPassword !== data.currentPassword, {
      message: messages.newPasswordSameAsCurrent,
      path: ["newPassword"],
    })
    .refine((data) => data.confirmPassword === data.newPassword, {
      message: messages.confirmPasswordMismatch,
      path: ["confirmPassword"],
    });

export type PasswordChangeFormData = z.infer<ReturnType<typeof createPasswordChangeFormSchema>>;
