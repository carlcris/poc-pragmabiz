"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, CalendarIcon } from "lucide-react";
import Link from "next/link";
import { useAuthStore } from "@/stores/authStore";
import { useCreateTransformationOrder } from "@/hooks/useTransformationOrders";
import { useTransformationTemplates } from "@/hooks/useTransformationTemplates";
import { useWarehouses } from "@/hooks/useWarehouses";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

const createOrderSchema = z.object({
  templateId: z.string().min(1, "Template is required"),
  warehouseId: z.string().min(1, "Warehouse is required"),
  plannedQuantity: z.coerce.number().min(0.0001, "Planned quantity must be greater than 0"),
  orderDate: z.date(),
  plannedDate: z.date().optional(),
  notes: z.string().optional(),
});

type CreateOrderFormValues = z.infer<typeof createOrderSchema>;

export default function NewTransformationOrderPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { t } = useLanguage();
  const companyId = user?.companyId;

  const createOrder = useCreateTransformationOrder();

  const { data: templatesData } = useTransformationTemplates({
    isActive: true,
    limit: 1000,
  });

  const { data: warehousesData } = useWarehouses({ limit: 1000 });

  const form = useForm<CreateOrderFormValues>({
    resolver: zodResolver(createOrderSchema),
    defaultValues: {
      templateId: "",
      warehouseId: "",
      plannedQuantity: 1,
      orderDate: new Date(),
      notes: "",
    },
  });

  const onSubmit = async (data: CreateOrderFormValues) => {
    if (!companyId) {
      form.setError("root", {
        type: "manual",
        message: "Company ID is missing. Please try logging in again.",
      });
      return;
    }

    try {
      await createOrder.mutateAsync({
        companyId,
        templateId: data.templateId,
        warehouseId: data.warehouseId,
        plannedQuantity: data.plannedQuantity,
        orderDate: data.orderDate.toISOString(),
        plannedDate: data.plannedDate?.toISOString(),
        notes: data.notes,
      });

      router.push("/inventory/transformations");
    } catch (error: any) {
      form.setError("root", {
        type: "manual",
        message: error.message || "Failed to create transformation order",
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/inventory/transformations">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold">{t.transformation.newTransformation}</h1>
          <p className="text-muted-foreground">
            {t.transformation.createNewOrder}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t.transformation.orderDetails}</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Template Selection */}
              <FormField
                control={form.control}
                name="templateId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t.transformation.transformationTemplate} *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t.transformation.selectTemplate} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {templatesData?.data.map((template) => (
                          <SelectItem key={template.id} value={template.id}>
                            {template.template_code} - {template.template_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Warehouse Selection */}
              <FormField
                control={form.control}
                name="warehouseId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t.common.warehouse} *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t.transformation.selectWarehouse} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {warehousesData?.data.map((warehouse) => (
                          <SelectItem key={warehouse.id} value={warehouse.id}>
                            {warehouse.code} - {warehouse.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Quantity and Dates */}
              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="plannedQuantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t.transformation.plannedQuantity} *</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.0001"
                          placeholder="1"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="orderDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t.transformation.orderDate} *</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value ? (
                                format(field.value, "PPP")
                              ) : (
                                <span>{t.transformation.pickDate}</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="plannedDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t.transformation.plannedExecutionDate}</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value ? (
                                format(field.value, "PPP")
                              ) : (
                                <span>{t.transformation.pickDate}</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Notes */}
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t.common.notes}</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={`${t.common.notes}...`}
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {form.formState.errors.root && (
                <p className="text-sm text-red-500">
                  {form.formState.errors.root.message}
                </p>
              )}

              <div className="flex gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push("/inventory/transformations")}
                >
                  {t.common.cancel}
                </Button>
                <Button type="submit" disabled={createOrder.isPending}>
                  {createOrder.isPending ? `${t.common.create}...` : t.transformation.createFromTemplate}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
