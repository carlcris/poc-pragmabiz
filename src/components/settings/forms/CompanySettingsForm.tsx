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
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  createCompanySettingsSchema,
  type CompanySettingsFormInput,
  type CompanySettingsFormData,
} from "@/lib/validations/settings/company";
import { useUpdateSettings } from "@/hooks/settings/useSettings";
import { Loader2 } from "lucide-react";

interface CompanySettingsFormProps {
  initialData?: Partial<CompanySettingsFormData>;
}

export function CompanySettingsForm({ initialData }: CompanySettingsFormProps) {
  const t = useTranslations("adminSettings.companyForm");
  const commonT = useTranslations("adminSettings.common");
  const updateSettings = useUpdateSettings("company");
  const schema = createCompanySettingsSchema();

  const form = useForm<CompanySettingsFormInput, unknown, CompanySettingsFormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      code: initialData?.code || "",
      name: initialData?.name || "",
      legal_name: initialData?.legal_name || "",
      tax_id: initialData?.tax_id || "",
      email: initialData?.email || "",
      phone: initialData?.phone || "",
      address_line1: initialData?.address_line1 || "",
      address_line2: initialData?.address_line2 || "",
      city: initialData?.city || "",
      state: initialData?.state || "",
      postal_code: initialData?.postal_code || "",
      country: initialData?.country || "",
      currency_code: initialData?.currency_code || "",
      is_active: initialData?.is_active ?? true,
    },
  });

  const onSubmit = async (data: CompanySettingsFormData) => {
    try {
      await updateSettings.mutateAsync(data);
      toast.success(t("saveSuccess"));
    } catch (error) {
      console.error("Error updating company settings:", error);
      toast.error(error instanceof Error ? error.message : t("saveError"));
    }
  };

  const isLoading = updateSettings.isPending;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle>{t("basicInformationTitle")}</CardTitle>
            <CardDescription>{t("basicInformationDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("companyCode")}</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder={t("companyCodePlaceholder")} disabled />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("companyName")}</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder={t("companyNamePlaceholder")} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="legal_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("legalName")}</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder={t("legalNamePlaceholder")} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="tax_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("taxId")}</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder={t("taxIdPlaceholder")} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* Contact Information */}
        <Card>
          <CardHeader>
            <CardTitle>{t("contactInformationTitle")}</CardTitle>
            <CardDescription>{t("contactInformationDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("email")}</FormLabel>
                    <FormControl>
                      <Input {...field} type="email" placeholder={t("emailPlaceholder")} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("phone")}</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder={t("phonePlaceholder")} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* Address */}
        <Card>
          <CardHeader>
            <CardTitle>{t("addressTitle")}</CardTitle>
            <CardDescription>{t("addressDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="address_line1"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("addressLine1")}</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder={t("addressLine1Placeholder")} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="address_line2"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("addressLine2")}</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder={t("addressLine2Placeholder")} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("city")}</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder={t("cityPlaceholder")} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="state"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("state")}</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder={t("statePlaceholder")} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="postal_code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("postalCode")}</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder={t("postalCodePlaceholder")} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="country"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("country")}</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder={t("countryPlaceholder")} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* Preferences */}
        <Card>
          <CardHeader>
            <CardTitle>{t("preferencesTitle")}</CardTitle>
            <CardDescription>{t("preferencesDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="currency_code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("currencyCode")}</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder={t("currencyCodePlaceholder")} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="is_active"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">{t("activeStatus")}</FormLabel>
                      <CardDescription>{t("activeStatusDescription")}</CardDescription>
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
