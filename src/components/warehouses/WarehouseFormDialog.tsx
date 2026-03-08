"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useCreateWarehouse, useUpdateWarehouse } from "@/hooks/useWarehouses";
import { useAuthStore } from "@/stores/authStore";
import { createWarehouseFormSchema } from "@/lib/validations/warehouse";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Switch } from "@/components/ui/switch";
import type { Warehouse } from "@/types/warehouse";

interface WarehouseFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  warehouse?: Warehouse | null;
}

export function WarehouseFormDialog({ open, onOpenChange, warehouse }: WarehouseFormDialogProps) {
  const t = useTranslations("warehouseForm");
  const tCommon = useTranslations("common");
  const tValidation = useTranslations("warehouseValidation");
  const { user } = useAuthStore();
  const createWarehouse = useCreateWarehouse();
  const updateWarehouse = useUpdateWarehouse();
  const warehouseFormSchema = createWarehouseFormSchema((key) => tValidation(key));
  type WarehouseFormInput = z.input<typeof warehouseFormSchema>;

  const form = useForm<WarehouseFormInput>({
    resolver: zodResolver(warehouseFormSchema),
    defaultValues: {
      code: "",
      name: "",
      description: "",
      address: "",
      city: "",
      state: "",
      postalCode: "",
      country: "",
      phone: "",
      email: "",
      managerId: undefined,
      isActive: true,
    },
  });

  useEffect(() => {
    if (warehouse) {
      form.reset({
        code: warehouse.code,
        name: warehouse.name,
        description: warehouse.description || "",
        address: warehouse.address || "",
        city: warehouse.city || "",
        state: warehouse.state || "",
        postalCode: warehouse.postalCode || "",
        country: warehouse.country || "",
        phone: warehouse.phone || "",
        email: warehouse.email || "",
        managerId: warehouse.managerId,
        isActive: warehouse.isActive,
      });
    } else {
      form.reset({
        code: "",
        name: "",
        description: "",
        address: "",
        city: "",
        state: "",
        postalCode: "",
        country: "",
        phone: "",
        email: "",
        managerId: undefined,
        isActive: true,
      });
    }
  }, [warehouse, form]);

  const onSubmit = async (values: WarehouseFormInput) => {
    try {
      const parsed = warehouseFormSchema.parse(values);
      if (warehouse) {
        // Update existing warehouse
        await updateWarehouse.mutateAsync({
          id: warehouse.id,
          data: parsed,
        });
        toast.success(t("updateSuccess"));
      } else {
        // Create new warehouse - requires companyId
        if (!user?.companyId) {
          toast.error(t("missingCompany"));
          return;
        }

        await createWarehouse.mutateAsync({
          ...parsed,
          companyId: user.companyId,
        });
        toast.success(t("createSuccess"));
      }
      onOpenChange(false);
      form.reset();
    } catch {
      toast.error(warehouse ? t("updateError") : t("createError"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[90vh] max-w-3xl overflow-y-auto"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{warehouse ? t("editTitle") : t("createTitle")}</DialogTitle>
          <DialogDescription>
            {warehouse ? t("editDescription") : t("createDescription")}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("codeLabel")}</FormLabel>
                    <FormControl>
                      <Input placeholder={t("codePlaceholder")} {...field} disabled={!!warehouse} />
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
                    <FormLabel>{t("nameLabel")}</FormLabel>
                    <FormControl>
                      <Input placeholder={t("namePlaceholder")} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("descriptionLabel")}</FormLabel>
                  <FormControl>
                    <Input placeholder={t("descriptionPlaceholder")} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-3">
              <h3 className="text-sm font-medium">{t("locationInformation")}</h3>

              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("addressLabel")}</FormLabel>
                    <FormControl>
                      <Input placeholder={t("addressPlaceholder")} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("cityLabel")}</FormLabel>
                      <FormControl>
                        <Input placeholder={t("cityPlaceholder")} {...field} />
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
                      <FormLabel>{t("stateLabel")}</FormLabel>
                      <FormControl>
                        <Input placeholder={t("statePlaceholder")} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="postalCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("postalCodeLabel")}</FormLabel>
                      <FormControl>
                        <Input placeholder={t("postalCodePlaceholder")} {...field} />
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
                      <FormLabel>{t("countryLabel")}</FormLabel>
                      <FormControl>
                        <Input placeholder={t("countryPlaceholder")} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-medium">{t("contactInformation")}</h3>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("phoneLabel")}</FormLabel>
                      <FormControl>
                        <Input placeholder={t("phonePlaceholder")} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("emailLabel")}</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder={t("emailPlaceholder")} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">{t("activeStatusLabel")}</FormLabel>
                    <FormDescription>{t("activeStatusDescription")}</FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {tCommon("cancel")}
              </Button>
              <Button
                type="submit"
                disabled={createWarehouse.isPending || updateWarehouse.isPending}
              >
                {createWarehouse.isPending || updateWarehouse.isPending
                  ? t("saving")
                  : warehouse
                    ? t("updateAction")
                    : t("createAction")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
