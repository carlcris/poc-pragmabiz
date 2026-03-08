"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useCreateSupplier, useUpdateSupplier } from "@/hooks/useSuppliers";
import { createSupplierFormSchema, type SupplierFormValues } from "@/lib/validations/supplier";
import { useAuthStore } from "@/stores/authStore";
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
import { Textarea } from "@/components/ui/textarea";
import type { Supplier } from "@/types/supplier";

interface SupplierFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplier?: Supplier | null;
}

export function SupplierFormDialog({ open, onOpenChange, supplier }: SupplierFormDialogProps) {
  const t = useTranslations("supplierForm");
  const tValidation = useTranslations("supplierValidation");
  const { user } = useAuthStore();
  const createSupplier = useCreateSupplier();
  const updateSupplier = useUpdateSupplier();
  const [sameAsBilling, setSameAsBilling] = useState(false);
  const supplierFormSchema = useMemo(
    () => createSupplierFormSchema((key) => tValidation(key)),
    [tValidation]
  );
  const supplierStatusOptions = useMemo(
    () => [
      { value: "active", label: t("statusActive") },
      { value: "inactive", label: t("statusInactive") },
      { value: "blacklisted", label: t("statusBlacklisted") },
    ],
    [t]
  );
  const supplierLanguageOptions = useMemo(
    () => [
      { value: "english", label: t("languageEnglish") },
      { value: "chinese", label: t("languageChinese") },
    ],
    [t]
  );
  const paymentTermsOptions = useMemo(
    () => [
      { value: "cod", label: t("paymentCod") },
      { value: "net_7", label: t("paymentNet7") },
      { value: "net_15", label: t("paymentNet15") },
      { value: "net_30", label: t("paymentNet30") },
      { value: "net_45", label: t("paymentNet45") },
      { value: "net_60", label: t("paymentNet60") },
      { value: "net_90", label: t("paymentNet90") },
    ],
    [t]
  );
  const countries = useMemo(
    () => [
      { value: "Philippines", label: t("countryPhilippines") },
      { value: "USA", label: t("countryUsa") },
      { value: "China", label: t("countryChina") },
      { value: "Japan", label: t("countryJapan") },
      { value: "Singapore", label: t("countrySingapore") },
      { value: "Malaysia", label: t("countryMalaysia") },
      { value: "Thailand", label: t("countryThailand") },
    ],
    [t]
  );

  const form = useForm<SupplierFormValues>({
    resolver: zodResolver(supplierFormSchema),
    defaultValues: {
      code: "",
      name: "",
      contactPerson: "",
      email: "",
      phone: "",
      mobile: "",
      website: "",
      taxId: "",
      billingAddress: "",
      billingCity: "",
      billingState: "",
      billingPostalCode: "",
      billingCountry: "Philippines",
      shippingAddress: "",
      shippingCity: "",
      shippingState: "",
      shippingPostalCode: "",
      shippingCountry: "Philippines",
      paymentTerms: "net_30",
      creditLimit: 0,
      bankName: "",
      bankAccountNumber: "",
      bankAccountName: "",
      lang: "english",
      status: "active",
      notes: "",
    },
  });

  useEffect(() => {
    if (supplier) {
      form.reset({
        code: supplier.code,
        name: supplier.name,
        contactPerson: supplier.contactPerson,
        email: supplier.email,
        phone: supplier.phone,
        mobile: supplier.mobile || "",
        website: supplier.website || "",
        taxId: supplier.taxId || "",
        billingAddress: supplier.billingAddress,
        billingCity: supplier.billingCity,
        billingState: supplier.billingState,
        billingPostalCode: supplier.billingPostalCode,
        billingCountry: supplier.billingCountry,
        shippingAddress: supplier.shippingAddress || "",
        shippingCity: supplier.shippingCity || "",
        shippingState: supplier.shippingState || "",
        shippingPostalCode: supplier.shippingPostalCode || "",
        shippingCountry: supplier.shippingCountry || "Philippines",
        paymentTerms: supplier.paymentTerms,
        creditLimit: supplier.creditLimit || 0,
        bankName: supplier.bankName || "",
        bankAccountNumber: supplier.bankAccountNumber || "",
        bankAccountName: supplier.bankAccountName || "",
        lang: supplier.lang || "english",
        status: supplier.status,
        notes: supplier.notes || "",
      });
    } else {
      form.reset({
        code: "",
        name: "",
        contactPerson: "",
        email: "",
        phone: "",
        mobile: "",
        website: "",
        taxId: "",
        billingAddress: "",
        billingCity: "",
        billingState: "",
        billingPostalCode: "",
        billingCountry: "Philippines",
        shippingAddress: "",
        shippingCity: "",
        shippingState: "",
        shippingPostalCode: "",
        shippingCountry: "Philippines",
        paymentTerms: "net_30",
        creditLimit: 0,
        bankName: "",
        bankAccountNumber: "",
        bankAccountName: "",
        lang: "english",
        status: "active",
        notes: "",
      });
    }
  }, [supplier, form]);

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

  const onSubmit = async (values: SupplierFormValues) => {
    try {
      if (supplier) {
        await updateSupplier.mutateAsync({
          id: supplier.id,
          data: values,
        });
        toast.success(t("updateSuccess"));
      } else {
        if (!user?.companyId || !user?.id) {
          toast.error(t("missingCompanyInfo"));
          return;
        }
        await createSupplier.mutateAsync({
          ...values,
          companyId: user.companyId,
          createdBy: user.id,
        });
        toast.success(t("createSuccess"));
      }
      onOpenChange(false);
      form.reset();
      setSameAsBilling(false);
    } catch {
      toast.error(supplier ? t("updateError") : t("createError"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{supplier ? t("editTitle") : t("createTitle")}</DialogTitle>
          <DialogDescription>
            {supplier
              ? t("editDescription")
              : t("createDescription")}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <Tabs defaultValue="general" className="w-full">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="general">{t("generalTab")}</TabsTrigger>
                <TabsTrigger value="billing">{t("billingTab")}</TabsTrigger>
                <TabsTrigger value="shipping">{t("shippingTab")}</TabsTrigger>
                <TabsTrigger value="payment">{t("paymentTab")}</TabsTrigger>
                <TabsTrigger value="bank">{t("bankTab")}</TabsTrigger>
              </TabsList>

              <TabsContent value="general" className="mt-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("supplierCodeLabel")}</FormLabel>
                        <FormControl>
                          <Input placeholder={t("supplierCodePlaceholder")} {...field} disabled={!!supplier} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="lang"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("languageLabel")}</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={t("selectLanguage")} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {supplierLanguageOptions.map((lang) => (
                              <SelectItem key={lang.value} value={lang.value}>
                                {lang.label}
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
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("statusLabel")}</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={t("selectStatus")} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {supplierStatusOptions.map((status) => (
                              <SelectItem key={status.value} value={status.value}>
                                {status.label}
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
                      <FormLabel>{t("supplierNameLabel")}</FormLabel>
                      <FormControl>
                        <Input placeholder={t("supplierNamePlaceholder")} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="contactPerson"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("contactPersonLabel")}</FormLabel>
                      <FormControl>
                        <Input placeholder={t("contactPersonPlaceholder")} {...field} />
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
                        <FormLabel>{t("emailLabel")}</FormLabel>
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
                        <FormLabel>{t("phoneLabel")}</FormLabel>
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
                        <FormLabel>{t("mobileLabel")}</FormLabel>
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
                        <FormLabel>{t("websiteLabel")}</FormLabel>
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
                      <FormLabel>{t("taxIdLabel")}</FormLabel>
                      <FormControl>
                        <Input placeholder={t("taxIdPlaceholder")} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>

              <TabsContent value="billing" className="mt-4 space-y-4">
                <FormField
                  control={form.control}
                  name="billingAddress"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("billingAddressLabel")}</FormLabel>
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
                    name="billingState"
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

                  <FormField
                    control={form.control}
                    name="billingPostalCode"
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
                </div>

                <FormField
                  control={form.control}
                  name="billingCountry"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("countryLabel")}</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t("selectCountry")} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {countries.map((country) => (
                            <SelectItem key={country.value} value={country.value}>
                              {country.label}
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
                      <FormLabel>{t("shippingAddressLabel")}</FormLabel>
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
                        <FormLabel>{t("cityLabel")}</FormLabel>
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
                        <FormLabel>{t("stateLabel")}</FormLabel>
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
                        <FormLabel>{t("postalCodeLabel")}</FormLabel>
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
                      <FormLabel>{t("countryLabel")}</FormLabel>
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
                          {countries.map((country) => (
                            <SelectItem key={country.value} value={country.value}>
                              {country.label}
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
                      <FormLabel>{t("paymentTermsLabel")}</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t("selectPaymentTerms")} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {paymentTermsOptions.map((term) => (
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
                      <FormLabel>{t("creditLimitLabel")}</FormLabel>
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
                      <FormLabel>{t("notesLabel")}</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder={t("notesPlaceholder")}
                          className="resize-none"
                          rows={4}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>

              <TabsContent value="bank" className="mt-4 space-y-4">
                <FormField
                  control={form.control}
                  name="bankName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("bankNameLabel")}</FormLabel>
                      <FormControl>
                        <Input placeholder={t("bankNamePlaceholder")} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="bankAccountName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("bankAccountNameLabel")}</FormLabel>
                      <FormControl>
                        <Input placeholder={t("bankAccountNamePlaceholder")} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="bankAccountNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("bankAccountNumberLabel")}</FormLabel>
                      <FormControl>
                        <Input placeholder={t("bankAccountNumberPlaceholder")} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>
            </Tabs>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {t("cancel")}
              </Button>
              <Button type="submit" disabled={createSupplier.isPending || updateSupplier.isPending}>
                {createSupplier.isPending || updateSupplier.isPending
                  ? t("saving")
                  : supplier
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
