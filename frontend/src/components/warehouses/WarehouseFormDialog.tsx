"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useCreateWarehouse, useUpdateWarehouse } from "@/hooks/useWarehouses";
import { warehouseFormSchema, type WarehouseFormValues } from "@/lib/validations/warehouse";
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Warehouse } from "@/types/warehouse";

interface WarehouseFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  warehouse?: Warehouse | null;
}

const COUNTRIES = [
  "USA",
  "Canada",
  "Mexico",
  "United Kingdom",
  "Germany",
  "France",
  "Australia",
  "Japan",
  "China",
  "India",
];

export function WarehouseFormDialog({ open, onOpenChange, warehouse }: WarehouseFormDialogProps) {
  const createWarehouse = useCreateWarehouse();
  const updateWarehouse = useUpdateWarehouse();

  const form = useForm<WarehouseFormValues>({
    resolver: zodResolver(warehouseFormSchema),
    defaultValues: {
      code: "",
      name: "",
      description: "",
      address: "",
      city: "",
      state: "",
      postalCode: "",
      country: "USA",
      phone: "",
      email: "",
      managerId: "",
      isActive: true,
    },
  });

  useEffect(() => {
    if (warehouse) {
      form.reset({
        code: warehouse.code,
        name: warehouse.name,
        description: warehouse.description,
        address: warehouse.address,
        city: warehouse.city,
        state: warehouse.state,
        postalCode: warehouse.postalCode,
        country: warehouse.country,
        phone: warehouse.phone,
        email: warehouse.email,
        managerId: warehouse.managerId || "",
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
        country: "USA",
        phone: "",
        email: "",
        managerId: "",
        isActive: true,
      });
    }
  }, [warehouse, form]);

  const onSubmit = async (values: WarehouseFormValues) => {
    try {
      if (warehouse) {
        // Update existing warehouse
        await updateWarehouse.mutateAsync({
          id: warehouse.id,
          data: values,
        });
        toast.success("Warehouse updated successfully");
      } else {
        // Create new warehouse
        await createWarehouse.mutateAsync({
          ...values,
          companyId: "company-1", // TODO: Get from auth context
        });
        toast.success("Warehouse created successfully");
      }
      onOpenChange(false);
      form.reset();
    } catch (error) {
      toast.error(warehouse ? "Failed to update warehouse" : "Failed to create warehouse");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
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
                      <Input
                        placeholder="WH-001"
                        {...field}
                        disabled={!!warehouse}
                      />
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

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address *</FormLabel>
                  <FormControl>
                    <Input placeholder="Street address" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>City *</FormLabel>
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
                    <FormLabel>State *</FormLabel>
                    <FormControl>
                      <Input placeholder="State" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="postalCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Postal Code *</FormLabel>
                    <FormControl>
                      <Input placeholder="Postal code" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="country"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Country *</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select country" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {COUNTRIES.map((country) => (
                        <SelectItem key={country} value={country}>
                          {country}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone *</FormLabel>
                    <FormControl>
                      <Input placeholder="+1-555-0100" {...field} />
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
                    <FormLabel>Email *</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="warehouse@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
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
