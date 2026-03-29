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
  createInventorySettingsSchema,
  type InventorySettingsFormInput,
  type InventorySettingsFormData,
} from "@/lib/validations/settings/inventory";
import { useUpdateSettings } from "@/hooks/settings/useSettings";
import { VALUATION_METHODS } from "@/types/settings";
import { Loader2 } from "lucide-react";

interface InventorySettingsFormProps {
  initialData?: Partial<InventorySettingsFormData>;
}

export function InventorySettingsForm({ initialData }: InventorySettingsFormProps) {
  const t = useTranslations("adminSettings.inventoryForm");
  const commonT = useTranslations("adminSettings.common");
  const updateSettings = useUpdateSettings("inventory");
  const schema = createInventorySettingsSchema();

  const form = useForm<InventorySettingsFormInput, unknown, InventorySettingsFormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      default_uom: initialData?.default_uom || "pcs",
      low_stock_threshold: initialData?.low_stock_threshold || 10,
      critical_stock_threshold: initialData?.critical_stock_threshold || 5,
      valuation_method: initialData?.valuation_method || "FIFO",
      auto_allocation_enabled: initialData?.auto_allocation_enabled ?? false,
      negative_stock_allowed: initialData?.negative_stock_allowed ?? false,
      track_lot_numbers: initialData?.track_lot_numbers ?? false,
      track_serial_numbers: initialData?.track_serial_numbers ?? false,
      barcode_format: initialData?.barcode_format || "",
    },
  });

  const onSubmit = async (data: InventorySettingsFormData) => {
    try {
      await updateSettings.mutateAsync(data);
      toast.success(t("saveSuccess"));
    } catch (error) {
      console.error("Error updating inventory settings:", error);
      toast.error(error instanceof Error ? error.message : t("saveError"));
    }
  };

  const isLoading = updateSettings.isPending;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Unit Settings */}
        <Card>
          <CardHeader>
            <CardTitle>{t("unitSettingsTitle")}</CardTitle>
            <CardDescription>{t("unitSettingsDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name="default_uom"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("defaultUnitOfMeasure")}</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder={t("defaultUnitOfMeasurePlaceholder")} />
                  </FormControl>
                  <FormDescription>{t("defaultUnitOfMeasureDescription")}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Stock Threshold Settings */}
        <Card>
          <CardHeader>
            <CardTitle>{t("stockThresholdTitle")}</CardTitle>
            <CardDescription>{t("stockThresholdDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="low_stock_threshold"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("lowStockThreshold")}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="number"
                        min="0"
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormDescription>{t("lowStockThresholdDescription")}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="critical_stock_threshold"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("criticalStockThreshold")}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="number"
                        min="0"
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormDescription>{t("criticalStockThresholdDescription")}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* Valuation Settings */}
        <Card>
          <CardHeader>
            <CardTitle>{t("valuationTitle")}</CardTitle>
            <CardDescription>{t("valuationDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name="valuation_method"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("valuationMethod")}</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t("valuationMethodPlaceholder")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {VALUATION_METHODS.map((method) => (
                        <SelectItem key={method.value} value={method.value}>
                          {method.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>{t("valuationMethodDescription")}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Allocation & Stock Settings */}
        <Card>
          <CardHeader>
            <CardTitle>{t("allocationTitle")}</CardTitle>
            <CardDescription>{t("allocationDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="auto_allocation_enabled"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">{t("autoAllocation")}</FormLabel>
                    <FormDescription>{t("autoAllocationDescription")}</FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="negative_stock_allowed"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">{t("allowNegativeStock")}</FormLabel>
                    <FormDescription>{t("allowNegativeStockDescription")}</FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Tracking Settings */}
        <Card>
          <CardHeader>
            <CardTitle>{t("trackingTitle")}</CardTitle>
            <CardDescription>{t("trackingDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="track_lot_numbers"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">{t("trackLotNumbers")}</FormLabel>
                    <FormDescription>{t("trackLotNumbersDescription")}</FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="track_serial_numbers"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">{t("trackSerialNumbers")}</FormLabel>
                    <FormDescription>{t("trackSerialNumbersDescription")}</FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="barcode_format"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("barcodeFormat")}</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder={t("barcodeFormatPlaceholder")} />
                  </FormControl>
                  <FormDescription>{t("barcodeFormatDescription")}</FormDescription>
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
