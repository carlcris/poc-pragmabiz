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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createIntegrationSettingsSchema,
  type IntegrationSettingsFormInput,
  type IntegrationSettingsFormData,
} from "@/lib/validations/settings/integration";
import { useUpdateSettings } from "@/hooks/settings/useSettings";
import { ACCOUNTING_INTEGRATIONS } from "@/types/settings";
import { Loader2 } from "lucide-react";

interface IntegrationSettingsFormProps {
  initialData?: Partial<IntegrationSettingsFormData>;
}

export function IntegrationSettingsForm({ initialData }: IntegrationSettingsFormProps) {
  const t = useTranslations("adminSettings.integrationForm");
  const commonT = useTranslations("adminSettings.common");
  const updateSettings = useUpdateSettings("integration");
  const schema = createIntegrationSettingsSchema();

  const form = useForm<IntegrationSettingsFormInput, unknown, IntegrationSettingsFormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      api_enabled: initialData?.api_enabled ?? false,
      webhook_url: initialData?.webhook_url || "",
      webhook_secret: initialData?.webhook_secret || "",
      accounting_integration: initialData?.accounting_integration || "none",
      accounting_sync_enabled: initialData?.accounting_sync_enabled ?? false,
      ecommerce_integration: initialData?.ecommerce_integration || "",
    },
  });

  const onSubmit = async (data: IntegrationSettingsFormData) => {
    try {
      await updateSettings.mutateAsync(data);
      toast.success(t("saveSuccess"));
    } catch (error) {
      console.error("Error updating integration settings:", error);
      toast.error(error instanceof Error ? error.message : t("saveError"));
    }
  };

  const isLoading = updateSettings.isPending;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* API Settings */}
        <Card>
          <CardHeader>
            <CardTitle>{t("apiSettingsTitle")}</CardTitle>
            <CardDescription>{t("apiSettingsDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name="api_enabled"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">{t("enableApi")}</FormLabel>
                    <FormDescription>{t("enableApiDescription")}</FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Webhook Settings */}
        <Card>
          <CardHeader>
            <CardTitle>{t("webhookSettingsTitle")}</CardTitle>
            <CardDescription>{t("webhookSettingsDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="webhook_url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("webhookUrl")}</FormLabel>
                  <FormControl>
                    <Input {...field} type="url" placeholder={t("webhookUrlPlaceholder")} />
                  </FormControl>
                  <FormDescription>{t("webhookUrlDescription")}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="webhook_secret"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("webhookSecret")}</FormLabel>
                  <FormControl>
                    <Input {...field} type="password" placeholder={t("webhookSecretPlaceholder")} />
                  </FormControl>
                  <FormDescription>{t("webhookSecretDescription")}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Accounting Integration */}
        <Card>
          <CardHeader>
            <CardTitle>{t("accountingIntegrationTitle")}</CardTitle>
            <CardDescription>{t("accountingIntegrationDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="accounting_integration"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("accountingSoftware")}</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t("accountingSoftwarePlaceholder")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {ACCOUNTING_INTEGRATIONS.map((integration) => (
                        <SelectItem key={integration.value} value={integration.value}>
                          {integration.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>{t("accountingSoftwareDescription")}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="accounting_sync_enabled"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">{t("enableSync")}</FormLabel>
                    <FormDescription>{t("enableSyncDescription")}</FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* E-commerce Integration */}
        <Card>
          <CardHeader>
            <CardTitle>{t("ecommerceIntegrationTitle")}</CardTitle>
            <CardDescription>{t("ecommerceIntegrationDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name="ecommerce_integration"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("ecommercePlatform")}</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder={t("ecommercePlatformPlaceholder")} />
                  </FormControl>
                  <FormDescription>{t("ecommercePlatformDescription")}</FormDescription>
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
