"use client";

import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  createSecuritySettingsSchema,
  type SecuritySettingsFormInput,
  type SecuritySettingsFormData,
} from "@/lib/validations/settings/security";
import { useUpdateSettings } from "@/hooks/settings/useSettings";
import { Loader2 } from "lucide-react";

interface SecuritySettingsFormProps {
  initialData?: Partial<SecuritySettingsFormData>;
}

export function SecuritySettingsForm({ initialData }: SecuritySettingsFormProps) {
  const t = useTranslations("adminSettings.securityForm");
  const commonT = useTranslations("adminSettings.common");
  const updateSettings = useUpdateSettings("security");
  const schema = createSecuritySettingsSchema();

  const form = useForm<SecuritySettingsFormInput, unknown, SecuritySettingsFormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      session_timeout_minutes: initialData?.session_timeout_minutes || 30,
      password_min_length: initialData?.password_min_length || 8,
      password_require_uppercase: initialData?.password_require_uppercase ?? true,
      password_require_lowercase: initialData?.password_require_lowercase ?? true,
      password_require_numbers: initialData?.password_require_numbers ?? true,
      password_require_special: initialData?.password_require_special ?? false,
      require_mfa: initialData?.require_mfa ?? false,
      max_login_attempts: initialData?.max_login_attempts || 5,
      lockout_duration_minutes: initialData?.lockout_duration_minutes || 15,
      password_expiry_days: initialData?.password_expiry_days || 90,
    },
  });

  const onSubmit = async (data: SecuritySettingsFormData) => {
    try {
      await updateSettings.mutateAsync(data);
      toast.success(t("saveSuccess"));
    } catch (error) {
      console.error("Error updating security settings:", error);
      toast.error(error instanceof Error ? error.message : t("saveError"));
    }
  };

  const isLoading = updateSettings.isPending;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Session Settings */}
        <Card>
          <CardHeader>
            <CardTitle>{t("sessionSettingsTitle")}</CardTitle>
            <CardDescription>{t("sessionSettingsDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name="session_timeout_minutes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("sessionTimeout")}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="number"
                      min="5"
                      max="1440"
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 30)}
                    />
                  </FormControl>
                  <FormDescription>{t("sessionTimeoutDescription")}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Password Policy */}
        <Card>
          <CardHeader>
            <CardTitle>{t("passwordPolicyTitle")}</CardTitle>
            <CardDescription>{t("passwordPolicyDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="password_min_length"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("minimumPasswordLength")}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="number"
                      min="6"
                      max="128"
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 8)}
                    />
                  </FormControl>
                  <FormDescription>{t("minimumPasswordLengthDescription")}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-2">
              <FormField
                control={form.control}
                name="password_require_uppercase"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">{t("requireUppercase")}</FormLabel>
                      <FormDescription>{t("requireUppercaseDescription")}</FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password_require_lowercase"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">{t("requireLowercase")}</FormLabel>
                      <FormDescription>{t("requireLowercaseDescription")}</FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password_require_numbers"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">{t("requireNumbers")}</FormLabel>
                      <FormDescription>{t("requireNumbersDescription")}</FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password_require_special"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">{t("requireSpecialCharacters")}</FormLabel>
                      <FormDescription>{t("requireSpecialCharactersDescription")}</FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* Authentication Settings */}
        <Card>
          <CardHeader>
            <CardTitle>{t("authenticationSettingsTitle")}</CardTitle>
            <CardDescription>{t("authenticationSettingsDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name="require_mfa"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">{t("requireMfa")}</FormLabel>
                    <FormDescription>{t("requireMfaDescription")}</FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Login Security */}
        <Card>
          <CardHeader>
            <CardTitle>{t("loginSecurityTitle")}</CardTitle>
            <CardDescription>{t("loginSecurityDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="max_login_attempts"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("maxLoginAttempts")}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="number"
                        min="1"
                        max="20"
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 5)}
                      />
                    </FormControl>
                    <FormDescription>{t("maxLoginAttemptsDescription")}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="lockout_duration_minutes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("lockoutDuration")}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="number"
                        min="1"
                        max="1440"
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 15)}
                      />
                    </FormControl>
                    <FormDescription>{t("lockoutDurationDescription")}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* Password Expiry */}
        <Card>
          <CardHeader>
            <CardTitle>{t("passwordExpiryTitle")}</CardTitle>
            <CardDescription>{t("passwordExpiryDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name="password_expiry_days"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("passwordExpiryDays")}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="number"
                      min="0"
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                    />
                  </FormControl>
                  <FormDescription>{t("passwordExpiryDaysDescription")}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Submit Button */}
        <div className="flex justify-end gap-4">
          <Button type="submit" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {commonT("saveChanges")}
          </Button>
        </div>
      </form>
    </Form>
  );
}
