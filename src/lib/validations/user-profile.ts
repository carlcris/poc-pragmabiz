import { z } from "zod";

type UserProfileValidationMessages = {
  firstNameRequired: string;
  firstNameTooLong: string;
  lastNameTooLong: string;
  phoneTooLong: string;
};

export const createUserProfileSchema = (messages: UserProfileValidationMessages) =>
  z.object({
    firstName: z
      .string()
      .trim()
      .min(1, messages.firstNameRequired)
      .max(100, messages.firstNameTooLong),
    lastName: z.string().trim().max(100, messages.lastNameTooLong),
    phone: z.string().trim().max(50, messages.phoneTooLong),
  });

export type UserProfileFormData = z.infer<ReturnType<typeof createUserProfileSchema>>;
