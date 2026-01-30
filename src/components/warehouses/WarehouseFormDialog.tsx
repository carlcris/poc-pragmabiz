"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useCreateWarehouse, useUpdateWarehouse } from "@/hooks/useWarehouses";
import { useAuthStore } from "@/stores/authStore";
import { warehouseFormSchema, type WarehouseFormValues } from "@/lib/validations/warehouse";
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
  const { user } = useAuthStore();
  const createWarehouse = useCreateWarehouse();
  const updateWarehouse = useUpdateWarehouse();
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
        toast.success("Warehouse updated successfully");
      } else {
        // Create new warehouse - requires companyId
        if (!user?.companyId) {
          toast.error("User company information not available");
          return;
        }

        await createWarehouse.mutateAsync({
          ...parsed,
          companyId: user.companyId,
        });
        toast.success("Warehouse created successfully");
      }
      onOpenChange(false);
      form.reset();
    } catch {
      toast.error(warehouse ? "Failed to update warehouse" : "Failed to create warehouse");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[90vh] max-w-3xl overflow-y-auto"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{warehouse ? "Edit Warehouse" : "Create New Warehouse"}</DialogTitle>
          <DialogDescription>
            {warehouse
              ? "Update the warehouse information below"
              : "Fill in the warehouse details below to create a new warehouse"}
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
                    <FormLabel>Warehouse Code *</FormLabel>
                    <FormControl>
                      <Input placeholder="WH-001" {...field} disabled={!!warehouse} />
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
                    <FormLabel>Warehouse Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter warehouse name" {...field} />
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
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter description" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-3">
              <h3 className="text-sm font-medium">Location Information</h3>

              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address</FormLabel>
                    <FormControl>
                      <Input placeholder="Street address" {...field} />
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
                      <FormLabel>City</FormLabel>
                      <FormControl>
                        <Input placeholder="City" {...field} />
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
                      <FormLabel>State/Province</FormLabel>
                      <FormControl>
                        <Input placeholder="State or Province" {...field} />
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
                      <FormLabel>Postal Code</FormLabel>
                      <FormControl>
                        <Input placeholder="Postal code" {...field} />
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
                      <FormLabel>Country</FormLabel>
                      <FormControl>
                        <Input placeholder="Country" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-medium">Contact Information</h3>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <Input placeholder="+1 234 567 8900" {...field} />
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
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="warehouse@example.com" {...field} />
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
                    <FormLabel className="text-base">Active Status</FormLabel>
                    <FormDescription>
                      Set whether this warehouse is active and available for use
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createWarehouse.isPending || updateWarehouse.isPending}
              >
                {createWarehouse.isPending || updateWarehouse.isPending
                  ? "Saving..."
                  : warehouse
                    ? "Update Warehouse"
                    : "Create Warehouse"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
