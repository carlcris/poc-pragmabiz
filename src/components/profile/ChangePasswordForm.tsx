"use client";

import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useChangePassword } from "@/hooks/useChangePassword";
import { getApiErrorCode } from "@/lib/api";
import {
  passwordChangeErrorCodes,
  type PasswordChangeErrorCode,
} from "@/lib/auth/password-change-errors";
import {
  createPasswordChangeFormSchema,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  type PasswordChangeFormData,
} from "@/lib/validations/password-change";

const errorMessageKeys = {
  PASSWORD_CHANGE_INVALID_INPUT: "errorInvalidInput",
  PASSWORD_CHANGE_CURRENT_INCORRECT: "errorCurrentIncorrect",
  PASSWORD_CHANGE_SAME_PASSWORD: "errorSamePassword",
  PASSWORD_CHANGE_WEAK_PASSWORD: "errorWeakPassword",
  PASSWORD_CHANGE_RATE_LIMITED: "errorRateLimited",
  PASSWORD_CHANGE_UNAVAILABLE: "errorUnavailable",
} as const satisfies Record<PasswordChangeErrorCode, string>;

export function ChangePasswordForm() {
  const t = useTranslations("changePasswordPage");
  const changePassword = useChangePassword();

  const form = useForm<PasswordChangeFormData>({
    resolver: zodResolver(
      createPasswordChangeFormSchema({
        currentPasswordRequired: t("currentPasswordRequired"),
        newPasswordTooShort: t("newPasswordTooShort", { min: PASSWORD_MIN_LENGTH }),
        newPasswordTooLong: t("newPasswordTooLong", { max: PASSWORD_MAX_LENGTH }),
        newPasswordSameAsCurrent: t("errorSamePassword"),
        confirmPasswordMismatch: t("confirmPasswordMismatch"),
      })
    ),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  const onSubmit = async ({ currentPassword, newPassword }: PasswordChangeFormData) => {
    try {
      await changePassword.mutateAsync({ currentPassword, newPassword });
      form.reset();
      toast.success(t("saveSuccess"));
    } catch (error) {
      const code =
        getApiErrorCode(error, passwordChangeErrorCodes) ?? "PASSWORD_CHANGE_UNAVAILABLE";
      const message = t(errorMessageKeys[code]);

      if (code === "PASSWORD_CHANGE_CURRENT_INCORRECT") {
        form.setError("currentPassword", { message });
      } else if (
        code === "PASSWORD_CHANGE_SAME_PASSWORD" ||
        code === "PASSWORD_CHANGE_WEAK_PASSWORD"
      ) {
        form.setError("newPassword", { message });
      } else {
        toast.error(message);
      }
    }
  };

  const isSaving = changePassword.isPending;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("formTitle")}</CardTitle>
        <CardDescription>{t("formDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="max-w-md space-y-4">
            <FormField
              control={form.control}
              name="currentPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("currentPassword")}</FormLabel>
                  <FormControl>
                    <Input {...field} type="password" autoComplete="current-password" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="newPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("newPassword")}</FormLabel>
                  <FormControl>
                    <Input {...field} type="password" autoComplete="new-password" />
                  </FormControl>
                  <FormDescription>
                    {t("newPasswordHint", { min: PASSWORD_MIN_LENGTH })}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("confirmPassword")}</FormLabel>
                  <FormControl>
                    <Input {...field} type="password" autoComplete="new-password" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("submit")}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
