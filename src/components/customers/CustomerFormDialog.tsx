"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useCreateCustomer, useUpdateCustomer } from "@/hooks/useCustomers";
import { useAuthStore } from "@/stores/authStore";
import { createCustomerFormSchema } from "@/lib/validations/customer";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import type { Customer } from "@/types/customer";

interface CustomerFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer?: Customer | null;
}

const COUNTRIES = ["USA", "Canada", "Mexico", "United Kingdom"];

export function CustomerFormDialog({ open, onOpenChange, customer }: CustomerFormDialogProps) {
  const t = useTranslations("customerForm");
  const tCommon = useTranslations("common");
  const tValidation = useTranslations("customerValidation");
  const { user } = useAuthStore();
  const createCustomer = useCreateCustomer();
  const updateCustomer = useUpdateCustomer();
  const [sameAsBilling, setSameAsBilling] = useState(false);
  const customerFormSchema = createCustomerFormSchema(tValidation);
  const customerTypes = [
    { value: "individual", label: t("typeIndividual") },
    { value: "company", label: t("typeCompany") },
    { value: "government", label: t("typeGovernment") },
  ] as const;
  const paymentTerms = [
    { value: "cash", label: t("paymentCash") },
    { value: "due_on_receipt", label: t("paymentDueOnReceipt") },
    { value: "net_30", label: t("paymentNet30") },
    { value: "net_60", label: t("paymentNet60") },
    { value: "net_90", label: t("paymentNet90") },
    { value: "cod", label: t("paymentCod") },
  ] as const;
  type CustomerFormInput = z.input<typeof customerFormSchema>;

  const form = useForm<CustomerFormInput>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: {
      customerType: "company",
      code: "",
      name: "",
      email: "",
      phone: "",
      mobile: "",
      website: "",
      taxId: "",
      billingAddress: "",
      billingCity: "",
      billingState: "",
      billingPostalCode: "",
      billingCountry: "USA",
      shippingAddress: "",
      shippingCity: "",
      shippingState: "",
      shippingPostalCode: "",
      shippingCountry: "USA",
      contactPersonName: "",
      contactPersonEmail: "",
      contactPersonPhone: "",
      paymentTerms: "net_30",
      creditLimit: 0,
      notes: "",
      isActive: true,
    },
  });

  useEffect(() => {
    if (customer) {
      form.reset({
        customerType: customer.customerType,
        code: customer.code,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        mobile: customer.mobile || "",
        website: customer.website || "",
        taxId: customer.taxId || "",
        billingAddress: customer.billingAddress,
        billingCity: customer.billingCity,
        billingState: customer.billingState,
        billingPostalCode: customer.billingPostalCode,
        billingCountry: customer.billingCountry,
        shippingAddress: customer.shippingAddress,
        shippingCity: customer.shippingCity,
        shippingState: customer.shippingState,
        shippingPostalCode: customer.shippingPostalCode,
        shippingCountry: customer.shippingCountry,
        contactPersonName: customer.contactPersonName || "",
        contactPersonEmail: customer.contactPersonEmail || "",
        contactPersonPhone: customer.contactPersonPhone || "",
        paymentTerms: customer.paymentTerms,
        creditLimit: customer.creditLimit,
        notes: customer.notes,
        isActive: customer.isActive,
      });
    } else {
      form.reset({
        customerType: "company",
        code: "",
        name: "",
        email: "",
        phone: "",
        mobile: "",
        website: "",
        taxId: "",
        billingAddress: "",
        billingCity: "",
        billingState: "",
        billingPostalCode: "",
        billingCountry: "USA",
        shippingAddress: "",
        shippingCity: "",
        shippingState: "",
        shippingPostalCode: "",
        shippingCountry: "USA",
        contactPersonName: "",
        contactPersonEmail: "",
        contactPersonPhone: "",
        paymentTerms: "net_30",
        creditLimit: 0,
        notes: "",
        isActive: true,
      });
    }
  }, [customer, form]);

  const handleSameAsBillingChange = (checked: boolean) => {
    setSameAsBilling(checked);
    if (checked) {
      const billing = form.getValues();
      form.setValue("shippingAddress", billing.billingAddress);
      form.setValue("shippingCity", billing.billingCity);
      form.setValue("shippingState", billing.billingState);
      form.setValue("shippingPostalCode", billing.billingPostalCode);
      form.setValue("shippingCountry", billing.billingCountry);
    }
  };

  const onSubmit = async (values: CustomerFormInput) => {
    try {
      const parsed = customerFormSchema.parse(values);
      if (customer) {
        await updateCustomer.mutateAsync({
          id: customer.id,
          data: parsed,
        });
        toast.success(t("updateSuccess"));
      } else {
        // Create new customer - requires companyId
        if (!user?.companyId) {
          toast.error(t("missingCompany"));
          return;
        }

        await createCustomer.mutateAsync({
          ...parsed,
          companyId: user.companyId,
        });
        toast.success(t("createSuccess"));
      }
      onOpenChange(false);
      form.reset();
      setSameAsBilling(false);
    } catch {
      toast.error(customer ? t("updateError") : t("createError"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[90vh] max-w-4xl overflow-y-auto"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{customer ? t("editTitle") : t("createTitle")}</DialogTitle>
          <DialogDescription>{customer ? t("editDescription") : t("createDescription")}</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <Tabs defaultValue="general" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="general">{t("generalTab")}</TabsTrigger>
                <TabsTrigger value="billing">{t("billingTab")}</TabsTrigger>
                <TabsTrigger value="shipping">{t("shippingTab")}</TabsTrigger>
                <TabsTrigger value="payment">{t("paymentTab")}</TabsTrigger>
              </TabsList>

              <TabsContent value="general" className="mt-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("customerCode")} *</FormLabel>
                        <FormControl>
                          <Input placeholder={t("customerCodePlaceholder")} {...field} disabled={!!customer} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="customerType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("customerType")} *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={t("selectType")} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {customerTypes.map((type) => (
                              <SelectItem key={type.value} value={type.value}>
                                {type.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                        <FormLabel>{t("customerName")} *</FormLabel>
                        <FormControl>
                          <Input placeholder={t("customerNamePlaceholder")} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("email")} *</FormLabel>
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
                        <FormLabel>{t("phone")} *</FormLabel>
                        <FormControl>
                          <Input placeholder={t("phonePlaceholder")} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="mobile"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("mobile")}</FormLabel>
                        <FormControl>
                          <Input placeholder={t("mobilePlaceholder")} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="website"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("website")}</FormLabel>
                        <FormControl>
                          <Input placeholder={t("websitePlaceholder")} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="taxId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("taxId")}</FormLabel>
                      <FormControl>
                        <Input placeholder={t("taxIdPlaceholder")} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="border-t pt-4">
                  <h4 className="mb-4 text-sm font-medium">{t("contactPersonOptional")}</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="contactPersonName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("name")}</FormLabel>
                          <FormControl>
                            <Input placeholder={t("contactNamePlaceholder")} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="contactPersonEmail"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("email")}</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder={t("contactEmailPlaceholder")} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="contactPersonPhone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("phone")}</FormLabel>
                          <FormControl>
                            <Input placeholder={t("contactPhonePlaceholder")} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="billing" className="mt-4 space-y-4">
                <FormField
                  control={form.control}
                  name="billingAddress"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("address")} *</FormLabel>
                      <FormControl>
                        <Input placeholder={t("addressPlaceholder")} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="billingCity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("city")} *</FormLabel>
                        <FormControl>
                          <Input placeholder={t("cityPlaceholder")} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="billingState"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("state")} *</FormLabel>
                        <FormControl>
                          <Input placeholder={t("statePlaceholder")} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="billingPostalCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("postalCode")} *</FormLabel>
                        <FormControl>
                          <Input placeholder={t("postalCodePlaceholder")} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="billingCountry"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("country")} *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t("selectCountry")} />
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
              </TabsContent>

              <TabsContent value="shipping" className="mt-4 space-y-4">
                <div className="mb-4 flex items-center space-x-2">
                  <Checkbox
                    id="sameAsBilling"
                    checked={sameAsBilling}
                    onCheckedChange={handleSameAsBillingChange}
                  />
                  <label
                    htmlFor="sameAsBilling"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    {t("sameAsBilling")}
                  </label>
                </div>

                <FormField
                  control={form.control}
                  name="shippingAddress"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("address")} *</FormLabel>
                      <FormControl>
                        <Input placeholder={t("addressPlaceholder")} {...field} disabled={sameAsBilling} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="shippingCity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("city")} *</FormLabel>
                        <FormControl>
                          <Input placeholder={t("cityPlaceholder")} {...field} disabled={sameAsBilling} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="shippingState"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("state")} *</FormLabel>
                        <FormControl>
                          <Input placeholder={t("statePlaceholder")} {...field} disabled={sameAsBilling} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="shippingPostalCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("postalCode")} *</FormLabel>
                        <FormControl>
                          <Input placeholder={t("postalCodePlaceholder")} {...field} disabled={sameAsBilling} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="shippingCountry"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("country")} *</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        disabled={sameAsBilling}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t("selectCountry")} />
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
              </TabsContent>

              <TabsContent value="payment" className="mt-4 space-y-4">
                <FormField
                  control={form.control}
                  name="paymentTerms"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("paymentTerms")} *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t("selectPaymentTerms")} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {paymentTerms.map((term) => (
                            <SelectItem key={term.value} value={term.value}>
                              {term.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="creditLimit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("creditLimit")} *</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder={t("creditLimitPlaceholder")}
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("notes")}</FormLabel>
                      <FormControl>
                        <Input placeholder={t("notesPlaceholder")} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>{t("activeCustomer")}</FormLabel>
                      </div>
                    </FormItem>
                  )}
                />
              </TabsContent>
            </Tabs>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {tCommon("cancel")}
              </Button>
              <Button type="submit" disabled={createCustomer.isPending || updateCustomer.isPending}>
                {createCustomer.isPending || updateCustomer.isPending
                  ? t("saving")
                  : customer
                    ? t("updateCustomer")
                    : t("createCustomer")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
