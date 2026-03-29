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
import { Switch } from "@/components/ui/switch";
import {
  createPOSSettingsSchema,
  type POSSettingsFormInput,
  type POSSettingsFormData,
} from "@/lib/validations/settings/pos";
import { useUpdateSettings } from "@/hooks/settings/useSettings";
import { Loader2 } from "lucide-react";

interface POSSettingsFormProps {
  initialData?: Partial<POSSettingsFormData>;
}

export function POSSettingsForm({ initialData }: POSSettingsFormProps) {
  const t = useTranslations("adminSettings.posForm");
  const commonT = useTranslations("adminSettings.common");
  const updateSettings = useUpdateSettings("pos");
  const schema = createPOSSettingsSchema();

  const form = useForm<POSSettingsFormInput, unknown, POSSettingsFormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      receipt_header: initialData?.receipt_header || "",
      receipt_footer: initialData?.receipt_footer || "Thank you for your business!",
      show_logo_on_receipt: initialData?.show_logo_on_receipt ?? true,
      allow_discounts: initialData?.allow_discounts ?? true,
      max_discount_percent: initialData?.max_discount_percent || 50,
      require_manager_approval_threshold: initialData?.require_manager_approval_threshold || 100,
      cash_drawer_enabled: initialData?.cash_drawer_enabled ?? true,
      print_receipt_auto: initialData?.print_receipt_auto ?? false,
      default_payment_method: initialData?.default_payment_method || "cash",
    },
  });

  const onSubmit = async (data: POSSettingsFormData) => {
    try {
      await updateSettings.mutateAsync(data);
      toast.success(t("saveSuccess"));
    } catch (error) {
      console.error("Error updating POS settings:", error);
      toast.error(error instanceof Error ? error.message : t("saveError"));
    }
  };

  const isLoading = updateSettings.isPending;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Receipt Settings */}
        <Card>
          <CardHeader>
            <CardTitle>{t("receiptSettingsTitle")}</CardTitle>
            <CardDescription>{t("receiptSettingsDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="receipt_header"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("receiptHeader")}</FormLabel>
                  <FormControl>
                    <Textarea {...field} placeholder={t("receiptHeaderPlaceholder")} rows={3} />
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

            <FormField
              control={form.control}
              name="show_logo_on_receipt"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">{t("showLogoOnReceipt")}</FormLabel>
                    <FormDescription>{t("showLogoOnReceiptDescription")}</FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="print_receipt_auto"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">{t("autoPrintReceipt")}</FormLabel>
                    <FormDescription>{t("autoPrintReceiptDescription")}</FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Discount Settings */}
        <Card>
          <CardHeader>
            <CardTitle>{t("discountSettingsTitle")}</CardTitle>
            <CardDescription>{t("discountSettingsDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="allow_discounts"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">{t("allowDiscounts")}</FormLabel>
                    <FormDescription>{t("allowDiscountsDescription")}</FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="max_discount_percent"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("maximumDiscount")}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormDescription>{t("maximumDiscountDescription")}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="require_manager_approval_threshold"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("managerApprovalThreshold")}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="number"
                        min="0"
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormDescription>{t("managerApprovalThresholdDescription")}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* Payment Settings */}
        <Card>
          <CardHeader>
            <CardTitle>{t("paymentSettingsTitle")}</CardTitle>
            <CardDescription>{t("paymentSettingsDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="cash_drawer_enabled"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">{t("cashDrawerEnabled")}</FormLabel>
                    <FormDescription>{t("cashDrawerEnabledDescription")}</FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="default_payment_method"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("defaultPaymentMethod")}</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder={t("defaultPaymentMethodPlaceholder")} />
                  </FormControl>
                  <FormDescription>{t("defaultPaymentMethodDescription")}</FormDescription>
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
