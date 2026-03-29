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
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  createBusinessUnitSettingsSchema,
  type BusinessUnitSettingsFormInput,
  type BusinessUnitSettingsFormData,
} from "@/lib/validations/settings/business-unit";
import { useUpdateSettings } from "@/hooks/settings/useSettings";
import { Loader2 } from "lucide-react";

interface BusinessUnitSettingsFormProps {
  initialData?: Partial<BusinessUnitSettingsFormData>;
}

export function BusinessUnitSettingsForm({ initialData }: BusinessUnitSettingsFormProps) {
  const t = useTranslations("adminSettings.businessUnitForm");
  const commonT = useTranslations("adminSettings.common");
  const updateSettings = useUpdateSettings("business_unit");
  const schema = createBusinessUnitSettingsSchema();
  const daysOfWeek = [
    { id: "mon", label: t("monday") },
    { id: "tue", label: t("tuesday") },
    { id: "wed", label: t("wednesday") },
    { id: "thu", label: t("thursday") },
    { id: "fri", label: t("friday") },
    { id: "sat", label: t("saturday") },
    { id: "sun", label: t("sunday") },
  ];

  const form = useForm<BusinessUnitSettingsFormInput, unknown, BusinessUnitSettingsFormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      display_name: initialData?.display_name || "",
      short_code: initialData?.short_code || "",
      local_email: initialData?.local_email || "",
      local_phone: initialData?.local_phone || "",
      manager_name: initialData?.manager_name || "",
      address_line1: initialData?.address_line1 || "",
      address_line2: initialData?.address_line2 || "",
      city: initialData?.city || "",
      state: initialData?.state || "",
      postal_code: initialData?.postal_code || "",
      country: initialData?.country || "",
      timezone: initialData?.timezone || "",
      operating_hours_start: initialData?.operating_hours_start || "09:00",
      operating_hours_end: initialData?.operating_hours_end || "17:00",
      days_open: initialData?.days_open || ["mon", "tue", "wed", "thu", "fri"],
      receipt_header: initialData?.receipt_header || "",
      receipt_footer: initialData?.receipt_footer || "",
    },
  });

  const onSubmit = async (data: BusinessUnitSettingsFormData) => {
    try {
      await updateSettings.mutateAsync(data);
      toast.success(t("saveSuccess"));
    } catch (error) {
      console.error("Error updating business unit settings:", error);
      toast.error(error instanceof Error ? error.message : t("saveError"));
    }
  };

  const isLoading = updateSettings.isPending;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Business Unit Identity */}
        <Card>
          <CardHeader>
            <CardTitle>{t("identityTitle")}</CardTitle>
            <CardDescription>{t("identityDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="display_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("displayName")}</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder={t("displayNamePlaceholder")} />
                    </FormControl>
                    <FormDescription>{t("displayNameDescription")}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="short_code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("shortCode")}</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder={t("shortCodePlaceholder")} />
                    </FormControl>
                    <FormDescription>{t("shortCodeDescription")}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* Local Contact Information */}
        <Card>
          <CardHeader>
            <CardTitle>{t("localContactTitle")}</CardTitle>
            <CardDescription>{t("localContactDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="local_email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("localEmail")}</FormLabel>
                    <FormControl>
                      <Input {...field} type="email" placeholder={t("localEmailPlaceholder")} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="local_phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("localPhone")}</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder={t("localPhonePlaceholder")} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="manager_name"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>{t("managerName")}</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder={t("managerNamePlaceholder")} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* Physical Location */}
        <Card>
          <CardHeader>
            <CardTitle>{t("physicalLocationTitle")}</CardTitle>
            <CardDescription>{t("physicalLocationDescription")}</CardDescription>
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

        {/* Operating Hours */}
        <Card>
          <CardHeader>
            <CardTitle>{t("operatingHoursTitle")}</CardTitle>
            <CardDescription>{t("operatingHoursDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="operating_hours_start"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("openingTime")}</FormLabel>
                    <FormControl>
                      <Input {...field} type="time" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="operating_hours_end"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("closingTime")}</FormLabel>
                    <FormControl>
                      <Input {...field} type="time" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="days_open"
              render={() => (
                <FormItem>
                  <FormLabel>{t("daysOpen")}</FormLabel>
                  <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                    {daysOfWeek.map((day) => (
                      <FormField
                        key={day.id}
                        control={form.control}
                        name="days_open"
                        render={({ field }) => {
                          return (
                            <FormItem
                              key={day.id}
                              className="flex flex-row items-start space-x-3 space-y-0"
                            >
                              <FormControl>
                                <Checkbox
                                  checked={field.value?.includes(day.id)}
                                  onCheckedChange={(checked) => {
                                    return checked
                                      ? field.onChange([...(field.value || []), day.id])
                                      : field.onChange(
                                          field.value?.filter((value) => value !== day.id)
                                        );
                                  }}
                                />
                              </FormControl>
                              <FormLabel className="font-normal">{day.label}</FormLabel>
                            </FormItem>
                          );
                        }}
                      />
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="timezone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("timezone")}</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder={t("timezonePlaceholder")} />
                  </FormControl>
                  <FormDescription>{t("timezoneDescription")}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Receipt Customization */}
        <Card>
          <CardHeader>
            <CardTitle>{t("receiptCustomizationTitle")}</CardTitle>
            <CardDescription>{t("receiptCustomizationDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="receipt_header"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("receiptHeader")}</FormLabel>
                  <FormControl>
                    <Textarea {...field} placeholder={t("receiptHeaderPlaceholder")} rows={4} />
                  </FormControl>
                  <FormDescription>{t("receiptHeaderDescription")}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="receipt_footer"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("receiptFooter")}</FormLabel>
                  <FormControl>
                    <Textarea {...field} placeholder={t("receiptFooterPlaceholder")} rows={2} />
                  </FormControl>
                  <FormDescription>{t("receiptFooterDescription")}</FormDescription>
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
