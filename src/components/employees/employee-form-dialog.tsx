"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";
import { useCreateEmployee, useUpdateEmployee } from "@/hooks/useEmployees";
import { toast } from "sonner";
import type { Employee } from "@/types/employee";

const createEmployeeFormSchema = (t: (key: string) => string) =>
  z.object({
    employeeCode: z.string().min(1, t("employeeCodeRequired")),
    firstName: z.string().min(1, t("firstNameRequired")),
    lastName: z.string().min(1, t("lastNameRequired")),
    email: z.string().email(t("invalidEmail")),
    phone: z.string().optional(),
    role: z.enum(["sales_agent", "sales_manager", "territory_manager"]),
    commissionRate: z
      .string()
      .refine((val) => !isNaN(Number(val)) && Number(val) >= 0 && Number(val) <= 100, {
        message: t("commissionRateRange"),
      }),
    isActive: z.boolean().default(true),
  });

type EmployeeFormInput = z.input<ReturnType<typeof createEmployeeFormSchema>>;

interface EmployeeFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  employee?: Employee;
}

export function EmployeeFormDialog({
  open,
  onOpenChange,
  mode,
  employee,
}: EmployeeFormDialogProps) {
  const t = useTranslations("employeeForm");
  const tCommon = useTranslations("common");
  const tRoles = useTranslations("employeesPage");
  const createEmployee = useCreateEmployee();
  const updateEmployee = useUpdateEmployee();
  const employeeFormSchema = createEmployeeFormSchema(t);

  const form = useForm<EmployeeFormInput>({
    resolver: zodResolver(employeeFormSchema),
    defaultValues: {
      employeeCode: "",
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      role: "sales_agent",
      commissionRate: "5.00",
      isActive: true,
    },
  });

  useEffect(() => {
    if (mode === "edit" && employee) {
      form.reset({
        employeeCode: employee.employeeCode,
        firstName: employee.firstName,
        lastName: employee.lastName,
        email: employee.email,
        phone: employee.phone || "",
        role: employee.role as "sales_agent" | "sales_manager" | "territory_manager",
        commissionRate: String(employee.commissionRate),
        isActive: employee.isActive,
      });
    } else if (mode === "create") {
      form.reset({
        employeeCode: "",
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        role: "sales_agent",
        commissionRate: "5.00",
        isActive: true,
      });
    }
  }, [mode, employee, form, open]);

  const onSubmit = async (data: EmployeeFormInput) => {
    try {
      const parsed = employeeFormSchema.parse(data);
      const payload = {
        ...parsed,
        commissionRate: Number(parsed.commissionRate),
        hireDate: new Date().toISOString().split("T")[0], // Add current date as hire date
      };

      if (mode === "create") {
        await createEmployee.mutateAsync(payload);
        toast.success(t("creatingSuccess"));
      } else if (employee) {
        await updateEmployee.mutateAsync({ id: employee.id, ...payload });
        toast.success(t("updatingSuccess"));
      }

      onOpenChange(false);
      form.reset();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("saveError"));
    }
  };

  const isSubmitting = createEmployee.isPending || updateEmployee.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? t("createTitle") : t("editTitle")}</DialogTitle>
          <DialogDescription>
            {mode === "create" ? t("createDescription") : t("editDescription")}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="employeeCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("employeeCode")}</FormLabel>
                    <FormControl>
                      <Input placeholder={t("employeeCodePlaceholder")} {...field} disabled={mode === "edit"} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("role")}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t("selectRole")} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="sales_agent">{tRoles("salesAgent")}</SelectItem>
                        <SelectItem value="sales_manager">{tRoles("salesManager")}</SelectItem>
                        <SelectItem value="territory_manager">{tRoles("territoryManager")}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("firstName")}</FormLabel>
                    <FormControl>
                      <Input placeholder={t("firstNamePlaceholder")} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("lastName")}</FormLabel>
                    <FormControl>
                      <Input placeholder={t("lastNamePlaceholder")} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("email")}</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder={t("emailPlaceholder")} {...field} />
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
                      <Input placeholder={t("phonePlaceholder")} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="commissionRate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("commissionRate")}</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      placeholder={t("commissionRatePlaceholder")}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    {t("commissionRateDescription")}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">{t("activeStatus")}</FormLabel>
                    <FormDescription>
                      {t("activeStatusDescription")}
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
                {tCommon("cancel")}
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {mode === "create" ? t("createAction") : t("saveChanges")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
