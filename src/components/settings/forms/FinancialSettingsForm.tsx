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
  createFinancialSettingsSchema,
  type FinancialSettingsFormInput,
  type FinancialSettingsFormData,
} from "@/lib/validations/settings/financial";
import { useUpdateSettings } from "@/hooks/settings/useSettings";
import { Loader2 } from "lucide-react";

interface FinancialSettingsFormProps {
  initialData?: Partial<FinancialSettingsFormData>;
}

export function FinancialSettingsForm({ initialData }: FinancialSettingsFormProps) {
  const t = useTranslations("adminSettings.financialForm");
  const commonT = useTranslations("adminSettings.common");
  const updateSettings = useUpdateSettings("financial");
  const schema = createFinancialSettingsSchema();

  const form = useForm<FinancialSettingsFormInput, unknown, FinancialSettingsFormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      default_tax_rate: initialData?.default_tax_rate || 0,
      default_payment_terms: initialData?.default_payment_terms || 30,
      fiscal_year_start: initialData?.fiscal_year_start || "01-01",
      invoice_prefix: initialData?.invoice_prefix || "INV-",
      invoice_start_number: initialData?.invoice_start_number || 1,
      quote_prefix: initialData?.quote_prefix || "QT-",
      quote_start_number: initialData?.quote_start_number || 1,
      credit_note_prefix: initialData?.credit_note_prefix || "CN-",
      auto_calculate_tax: initialData?.auto_calculate_tax ?? true,
    },
  });

  const onSubmit = async (data: FinancialSettingsFormData) => {
    try {
      await updateSettings.mutateAsync(data);
      toast.success(t("saveSuccess"));
    } catch (error) {
      console.error("Error updating financial settings:", error);
      toast.error(error instanceof Error ? error.message : t("saveError"));
    }
  };

  const isLoading = updateSettings.isPending;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Tax Settings */}
        <Card>
          <CardHeader>
            <CardTitle>{t("taxSettingsTitle")}</CardTitle>
            <CardDescription>{t("taxSettingsDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="default_tax_rate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("defaultTaxRate")}</FormLabel>
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
                    <FormDescription>{t("defaultTaxRateDescription")}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="auto_calculate_tax"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">{t("autoCalculateTax")}</FormLabel>
                      <FormDescription>{t("autoCalculateTaxDescription")}</FormDescription>
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

        {/* Payment Terms & Fiscal Year */}
        <Card>
          <CardHeader>
            <CardTitle>{t("paymentTermsTitle")}</CardTitle>
            <CardDescription>{t("paymentTermsDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="default_payment_terms"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("defaultPaymentTerms")}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="number"
                        min="0"
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormDescription>{t("defaultPaymentTermsDescription")}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="fiscal_year_start"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("fiscalYearStart")}</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder={t("fiscalYearStartPlaceholder")} />
                    </FormControl>
                    <FormDescription>{t("fiscalYearStartDescription")}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* Invoice Settings */}
        <Card>
          <CardHeader>
            <CardTitle>{t("invoiceSettingsTitle")}</CardTitle>
            <CardDescription>{t("invoiceSettingsDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="invoice_prefix"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("invoicePrefix")}</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder={t("invoicePrefixPlaceholder")} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="invoice_start_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("invoiceStartNumber")}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="number"
                        min="1"
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* Quote Settings */}
        <Card>
          <CardHeader>
            <CardTitle>{t("quoteSettingsTitle")}</CardTitle>
            <CardDescription>{t("quoteSettingsDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="quote_prefix"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("quotePrefix")}</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder={t("quotePrefixPlaceholder")} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="quote_start_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("quoteStartNumber")}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="number"
                        min="1"
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* Credit Note Settings */}
        <Card>
          <CardHeader>
            <CardTitle>{t("creditNoteSettingsTitle")}</CardTitle>
            <CardDescription>{t("creditNoteSettingsDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name="credit_note_prefix"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("creditNotePrefix")}</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder={t("creditNotePrefixPlaceholder")} />
                  </FormControl>
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
