"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Pencil, Trash2, Calculator } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { useCreateQuotation, useUpdateQuotation } from "@/hooks/useQuotations";
import { useCustomer, useCustomers } from "@/hooks/useCustomers";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { AsyncSearchCombobox } from "@/components/shared/AsyncSearchCombobox";
import { useCurrency } from "@/hooks/useCurrency";
import { useUnitsOfMeasure } from "@/hooks/useUnitsOfMeasure";
import type { Quotation, QuotationLineItem } from "@/types/quotation";
import type { CreateQuotationRequest } from "@/types/quotation";
import {
  QuotationInventoryLineItemDialog,
  type QuotationInventoryLineItemFormValues,
} from "./QuotationInventoryLineItemDialog";
import { type FrameConfigurationResult } from "@/components/framing/FrameConfigurationDialog";
import { FrameSizesDialog } from "@/components/framing/FrameSizesDialog";
import { formatCustomerAddress } from "@/lib/framing/customerAddress";
import { quotationLineEditValues } from "@/lib/quotations/quotation-line-edit-values";
import { quotationTotals } from "@/lib/quotations/quotation-totals";
import { discountRateOf, formatLineDiscount } from "@/lib/framing/invoicePresenter";
import { useAuthStore } from "@/stores/authStore";
import { frameSizesToLineItem } from "@/lib/framing/toLineItem";
import { frameLineToSizes } from "@/lib/framing/fromLineItem";
import { useFrameServiceItems } from "@/hooks/useFrameServiceItems";
import type { BillingMode } from "@/lib/framing/types";
import { getApiErrorCode } from "@/lib/api";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Same vocabulary as `customers.payment_terms`, so a quotation's terms can be
 * compared against — or defaulted from — the customer's own.
 */
const PAYMENT_TERMS = ["cash", "due_on_receipt", "net_30", "net_60", "net_90", "cod"] as const;

type LineItemFormValues = QuotationInventoryLineItemFormValues &
  Pick<QuotationLineItem, "frameConfiguration" | "frameComponents" | "matLayers" | "frameSizes"> & {
    discountAmount?: number;
    skipInventory?: boolean;
  };

const quotationFormSchema = z
  .object({
    companyId: z.string().optional(),
    customerId: z.string().min(1, "Customer is required"),
    quotationDate: z.string().min(1, "Quotation date is required"),
    validUntil: z.string().min(1, "Valid until date is required"),
    // When the artwork came in and when the finished work is promised back.
    dateReceived: z.string().min(1, "Date received is required"),
    dueDate: z.string().min(1, "Due date is required"),
    /** Whole-job custody record; framing lines only, so never required. */
    itemsReceived: z.string(),
    paymentTerms: z.string().min(1, "Payment terms are required"),
    terms: z.string(),
    notes: z.string(),
  })
  .refine((data) => new Date(data.dueDate) >= new Date(data.dateReceived), {
    // Mirrors chk_quotation_due_after_received, so the slip is caught at the
    // field rather than as a failed save. Same-day is legitimate.
    message: "Due date must be on or after the date received",
    path: ["dueDate"],
  });

type QuotationFormValues = z.infer<typeof quotationFormSchema>;

type QuotationFormProps = {
  quotation?: Quotation | null;
  onCancel?: () => void;
  onSuccess?: (quotation: Quotation) => void;
  submitLabel?: string;
};

export function QuotationForm({ quotation, onCancel, onSuccess, submitLabel }: QuotationFormProps) {
  const t = useTranslations("quotationForm");
  const tCommon = useTranslations("common");
  const isEditMode = !!quotation;
  const { formatCurrency } = useCurrency();
  const createMutation = useCreateQuotation();
  const updateMutation = useUpdateQuotation();
  const [customerSearch, setCustomerSearch] = useState("");
  const debouncedCustomerSearch = useDebouncedValue(customerSearch.trim());
  const [lineItems, setLineItems] = useState<LineItemFormValues[]>([]);
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<{
    index: number;
    item: LineItemFormValues;
  } | null>(null);
  const [frameDialog, setFrameDialog] = useState<{
    open: boolean;
    billingMode: BillingMode;
    /** Index being edited, or null when adding. */
    index: number | null;
    initial: FrameConfigurationResult[];
    initialDiscount: number;
  }>({
    open: false,
    billingMode: "chop_join",
    index: null,
    initial: [],
    initialDiscount: 0,
  });

  // A finished frame is sold in pieces. The moulding's own unit (STICK, FT)
  // describes how the raw material is stocked, not what the customer buys.
  const { data: unitsData } = useUnitsOfMeasure();
  const frameServiceItems = useFrameServiceItems();
  const frameUom = useMemo(() => {
    const pcs = unitsData?.data.find((unit) => unit.code === "PCS");
    return pcs ? { id: pcs.id, code: pcs.code } : undefined;
  }, [unitsData]);
  // Components are consumed as cuts, not in the unit their material is stocked
  // in — a moulding in STICK, a board in SHEET. Seeded by supabase/seed.sql.
  const cutUom = useMemo(() => {
    const cut = unitsData?.data.find((unit) => unit.code === "CUT");
    return cut ? { id: cut.id, code: cut.code } : undefined;
  }, [unitsData]);

  const { data: customersData, isLoading: isCustomersLoading } = useCustomers({
    search: debouncedCustomerSearch || undefined,
    limit: 5,
    isActive: true,
  });
  const customers = customersData?.data || [];

  const defaultValues = useMemo<QuotationFormValues>(
    () => ({
      companyId: "",
      customerId: "",
      quotationDate: new Date().toISOString().split("T")[0],
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      // Artwork is normally handed over the same day the quote is raised; the
      // promise defaults two weeks out, the shop's usual turnaround.
      dateReceived: new Date().toISOString().split("T")[0],
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      itemsReceived: "",
      // Walk-in trade: a framing customer collecting their work pays for it then.
      paymentTerms: "cash",
      terms: "Payment due within 30 days. Delivery within 2 weeks of order confirmation.",
      notes: "",
    }),
    []
  );

  const form = useForm<QuotationFormValues>({
    resolver: zodResolver(quotationFormSchema),
    defaultValues,
  });
  // Whoever is drawing up the quotation is who prepared the requisition.
  const preparedBy = useAuthStore((state) => state.user?.name) || undefined;

  const selectedCustomerId = form.watch("customerId");
  const { data: selectedCustomerData } = useCustomer(selectedCustomerId);
  const selectedCustomer =
    customers.find((customer) => customer.id === selectedCustomerId) ??
    selectedCustomerData ??
    null;

  const totals = useMemo(() => {
    return quotationTotals(lineItems);
  }, [lineItems]);

  useEffect(() => {
    if (quotation) {
      form.reset({
        companyId: quotation.companyId,
        customerId: quotation.customerId,
        quotationDate: quotation.quotationDate.split("T")[0],
        validUntil: quotation.validUntil.split("T")[0],
        dateReceived: quotation.dateReceived?.split("T")[0] ?? "",
        dueDate: quotation.dueDate?.split("T")[0] ?? "",
        itemsReceived: quotation.itemsReceived ?? "",
        paymentTerms: quotation.paymentTerms || "cash",
        terms: quotation.terms,
        notes: quotation.notes,
      });
      setLineItems(quotation.lineItems.map(quotationLineEditValues));
      return;
    }

    form.reset(defaultValues);
    setLineItems([]);
  }, [quotation, form, defaultValues]);

  const handleAddItem = () => {
    setEditingItem(null);
    setItemDialogOpen(true);
  };

  const handleEditItem = (index: number) => {
    const line = lineItems[index];

    // A configured frame must reopen in the dialog it was built in. The plain
    // item form cannot represent geometry, mats or components, so saving from
    // it would silently discard the whole configuration.
    const restored = frameLineToSizes(line, lineItems[0]?.uomId ?? "");
    if (restored.length > 0) {
      setFrameDialog({
        open: true,
        billingMode: restored[0].config.billingMode,
        index,
        initial: restored,
        // Reopening must not silently drop a discount the operator entered.
        initialDiscount: line.discountAmount ?? 0,
      });
      return;
    }

    setEditingItem({ index, item: lineItems[index] });
    setItemDialogOpen(true);
  };

  const handleDeleteItem = (index: number) => {
    setLineItems((items) => items.filter((_, itemIndex) => itemIndex !== index));
  };

  const handleAddConfiguredLine = (billingMode: BillingMode) => {
    setFrameDialog({ open: true, billingMode, index: null, initial: [], initialDiscount: 0 });
  };

  const handleApplyFrame = (sizes: FrameConfigurationResult[], discountAmount: number) => {
    if (sizes.length === 0) return;
    const fallbackUomId = lineItems[0]?.uomId ?? "";
    const billingMode = sizes[0].config.billingMode;
    const serviceItem = frameServiceItems.resolve(billingMode);
    if (!serviceItem) {
      toast.error(t("frameServiceItemMissing"));
      return;
    }
    const line = frameSizesToLineItem(
      sizes.map((size) => ({ config: size.config, selections: size.selections })),
      billingMode,
      serviceItem,
      fallbackUomId,
      frameUom,
      cutUom,
      discountAmount
    );
    setLineItems((items) =>
      frameDialog.index === null
        ? [...items, line as LineItemFormValues]
        : items.map((current, index) =>
            index === frameDialog.index ? (line as LineItemFormValues) : current
          )
    );
    setFrameDialog((current) => ({
      ...current,
      open: false,
      index: null,
      initial: [],
      initialDiscount: 0,
    }));
  };

  const handleSaveItem = (item: QuotationInventoryLineItemFormValues) => {
    if (editingItem !== null) {
      setLineItems((items) =>
        items.map((currentItem, itemIndex) =>
          itemIndex === editingItem.index ? item : currentItem
        )
      );
    } else {
      setLineItems((items) => [...items, item]);
    }
  };

  const onSubmit = async (data: QuotationFormValues) => {
    if (lineItems.length === 0) {
      alert(t("addLineItemRequired"));
      return;
    }

    try {
      const apiRequest: CreateQuotationRequest = {
        customerId: data.customerId,
        quotationDate: data.quotationDate,
        validUntil: data.validUntil,
        dateReceived: data.dateReceived,
        dueDate: data.dueDate,
        itemsReceived: data.itemsReceived,
        paymentTerms: data.paymentTerms,
        items: lineItems.map((item, index) => ({
          itemId: item.itemId,
          description: item.description,
          quantity: item.quantity,
          uomId: item.uomId,
          rate: item.unitPrice,
          // A configured frame's total is the sum of its printed component
          // amounts; quantity × rate is a rounded view of it and cannot
          // reproduce it exactly. Sending it explicitly keeps the invoice's own
          // rows adding up to its total.
          lineTotal: item.lineTotal,
          pricingTier: item.pricingTier,
          pricingTierName: item.pricingTierName,
          discountPercent: item.discount,
          // A fixed sum off the line. The RPC prefers it over the derived
          // percentage, and `lineTotal` above already has it subtracted.
          discountAmount: item.discountAmount || undefined,
          taxPercent: item.taxRate,
          sortOrder: index,
          frameConfiguration: item.frameConfiguration,
          frameComponents: item.frameComponents,
          matLayers: item.matLayers,
          frameSizes: item.frameSizes,
        })),
        termsConditions: data.terms,
        notes: data.notes,
      };

      const result =
        isEditMode && quotation
          ? await updateMutation.mutateAsync({
              id: quotation.id,
              data: {
                quotationDate: apiRequest.quotationDate,
                validUntil: apiRequest.validUntil,
                dateReceived: apiRequest.dateReceived,
                dueDate: apiRequest.dueDate,
                itemsReceived: apiRequest.itemsReceived,
                paymentTerms: apiRequest.paymentTerms,
                items: apiRequest.items,
                termsConditions: apiRequest.termsConditions,
                notes: apiRequest.notes,
              },
            })
          : await createMutation.mutateAsync(apiRequest);

      toast.success(
        isEditMode
          ? quotation?.status === "sent"
            ? t("updatedAndReturnedToDraft")
            : t("updated")
          : t("created")
      );
      onSuccess?.(result);
    } catch (error) {
      const errorCode = getApiErrorCode(error, ["QUOTATION_NOT_EDITABLE"] as const);
      toast.error(
        errorCode === "QUOTATION_NOT_EDITABLE"
          ? t("notEditable")
          : error instanceof Error
            ? error.message
            : t("saveError")
      );
    }
  };

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <section className="space-y-4 rounded-lg border bg-card p-6">
            <div>
              <h3 className="text-lg font-semibold">{t("generalTab")}</h3>
            </div>
            <FormField
              control={form.control}
              name="customerId"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>{t("customer")} *</FormLabel>
                  <FormControl>
                    <AsyncSearchCombobox
                      value={field.value}
                      onValueChange={field.onChange}
                      searchValue={customerSearch}
                      onSearchValueChange={setCustomerSearch}
                      options={customers}
                      selectedOption={selectedCustomer}
                      getOptionValue={(customer) => customer.id}
                      getOptionLabel={(customer) => customer.name}
                      getOptionSearchValue={(customer) => `${customer.code} ${customer.name}`}
                      placeholder={t("selectCustomer")}
                      searchPlaceholder="Search customer"
                      emptyMessage="No customer found."
                      isLoading={isCustomersLoading}
                      renderOption={(customer, selected) => (
                        <div className="flex items-start py-2">
                          <div
                            className={`mr-2 mt-1 h-4 w-4 flex-shrink-0 ${selected ? "opacity-100" : "opacity-0"}`}
                          >
                            ✓
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-medium">{customer.name}</div>
                            <div className="mt-0.5 text-xs text-muted-foreground">
                              {customer.code}
                            </div>
                          </div>
                        </div>
                      )}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Quotation date is not shown: it is the day the quote was raised,
                which is always today for a new quote and must not drift when an
                existing one is edited. It stays in form state, defaulted below. */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="validUntil"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("validUntil")} *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Commercial, like Valid until — the job dates below are the
                  shop-floor pair. */}
              <FormField
                control={form.control}
                name="paymentTerms"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("paymentTerms")} *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PAYMENT_TERMS.map((term) => (
                          <SelectItem key={term} value={term}>
                            {t(`paymentTerm.${term}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Job dates sit apart from the commercial pair above: these are
                shop-floor dates — artwork in, finished work out — and mixing
                them into the same row invites reading "valid until" as a
                promise date. */}
            <div className="grid grid-cols-1 gap-4 border-t pt-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="dateReceived"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("dateReceived")} *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="dueDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("dueDate")} *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </section>

          <section className="space-y-4 rounded-lg border bg-card p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium">{t("lineItemsTitle")}</h3>
                <p className="text-sm text-muted-foreground">{t("lineItemsDescription")}</p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    {t("addItem")}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-72">
                  <DropdownMenuItem
                    onSelect={handleAddItem}
                    className="flex-col items-start gap-0.5"
                  >
                    <span className="font-medium">{t("lineTypeRawMaterial")}</span>
                    <span className="text-xs text-muted-foreground">
                      {t("lineTypeRawMaterialHint")}
                    </span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => handleAddConfiguredLine("chop_join")}
                    className="flex-col items-start gap-0.5"
                  >
                    <span className="font-medium">{t("lineTypeChopJoin")}</span>
                    <span className="text-xs text-muted-foreground">
                      {t("lineTypeChopJoinHint")}
                    </span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => handleAddConfiguredLine("framing")}
                    className="flex-col items-start gap-0.5"
                  >
                    <span className="font-medium">{t("lineTypeFraming")}</span>
                    <span className="text-xs text-muted-foreground">
                      {t("lineTypeFramingHint")}
                    </span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {lineItems.length === 0 ? (
              <div className="rounded-lg border-2 border-dashed py-12 text-center text-muted-foreground">
                <p>{t("noItems")}</p>
                <p className="text-sm">{t("noItemsDescription")}</p>
              </div>
            ) : (
              <>
                <div className="rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{tCommon("item")}</TableHead>
                        <TableHead className="text-right">{t("qty")}</TableHead>
                        <TableHead className="text-center">{t("unit")}</TableHead>
                        <TableHead className="text-right">{t("price")}</TableHead>
                        <TableHead className="text-right">{t("discountPct")}</TableHead>
                        <TableHead className="text-right">{t("taxPct")}</TableHead>
                        <TableHead className="text-right">{t("total")}</TableHead>
                        <TableHead className="w-[100px]">{tCommon("actions")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lineItems.map((item, index) => {
                        const lineTotal = item.lineTotal ?? item.quantity * item.unitPrice;
                        // A configured frame is billed for every part it consumes,
                        // but the row carries the moulding's name — without this it
                        // reads as a plain moulding purchase at the frame's price.
                        const frameMode = item.frameConfiguration?.billingMode;

                        return (
                          <TableRow key={index}>
                            <TableCell>
                              <div>
                                <div className="font-medium">{item.itemName}</div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-sm text-muted-foreground">
                                    {item.itemCode}
                                  </span>
                                  {frameMode ? (
                                    <Badge
                                      variant="secondary"
                                      className="whitespace-nowrap font-normal"
                                    >
                                      {frameMode === "chop_join"
                                        ? t("chopJoinLine")
                                        : t("framingLine")}
                                    </Badge>
                                  ) : null}
                                </div>
                                {frameMode && item.description ? (
                                  <div className="mt-0.5 text-xs text-muted-foreground">
                                    {item.description}
                                  </div>
                                ) : null}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">{item.quantity}</TableCell>
                            <TableCell className="text-center">
                              <span className="text-muted-foreground">
                                {item.uomCode || item.uomName || "-"}
                              </span>
                            </TableCell>
                            {/* A configured frame has no meaningful per-unit
                                price: the line covers several parts, and with
                                more than one size the "unit" differs per size.
                                Discount and tax are settled per item on the
                                sales invoice, not here. */}
                            <TableCell className="text-right">
                              {frameMode ? (
                                <span className="text-muted-foreground">—</span>
                              ) : (
                                formatCurrency(item.unitPrice)
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              {/* Both fixed and percentage discounts show money and rate. */}
                              {frameMode && !item.discountAmount ? (
                                <span className="text-muted-foreground">—</span>
                              ) : item.discountAmount ? (
                                formatLineDiscount(
                                  item.discountAmount,
                                  frameMode
                                    ? discountRateOf(item.discountAmount, item.lineTotal ?? 0)
                                    : item.discount,
                                  formatCurrency
                                )
                              ) : (
                                formatLineDiscount(
                                  (item.quantity * item.unitPrice * item.discount) / 100,
                                  item.discount,
                                  formatCurrency
                                )
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              {frameMode ? (
                                <span className="text-muted-foreground">—</span>
                              ) : (
                                `${item.taxRate}%`
                              )}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {formatCurrency(lineTotal)}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEditItem(index)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteItem(index)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                <div className="rounded-lg bg-muted p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <Calculator className="h-5 w-5" />
                    <h4 className="font-semibold">{t("totals")}</h4>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>{t("subtotal")}:</span>
                      <span className="font-medium">{formatCurrency(totals.subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-red-600">
                      <span>{t("discount")}:</span>
                      <span className="font-medium">-{formatCurrency(totals.totalDiscount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{t("tax")}:</span>
                      <span className="font-medium">{formatCurrency(totals.totalTax)}</span>
                    </div>
                    <div className="flex justify-between border-t pt-2 text-lg font-bold">
                      <span>{t("total")}:</span>
                      <span>{formatCurrency(totals.totalAmount)}</span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </section>

          <section className="space-y-4 rounded-lg border bg-card p-6">
            <div>
              <h3 className="text-lg font-semibold">{t("termsTab")}</h3>
            </div>
            <FormField
              control={form.control}
              name="terms"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("termsConditions")}</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={4} />
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
                  <FormLabel>{t("internalNotes")}</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={4} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </section>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            {onCancel ? (
              <Button type="button" variant="outline" onClick={onCancel}>
                {tCommon("cancel")}
              </Button>
            ) : null}
            <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
              {createMutation.isPending || updateMutation.isPending
                ? t("saving")
                : submitLabel || (isEditMode ? t("updateQuotation") : t("createQuotation"))}
            </Button>
          </div>
        </form>
      </Form>

      <FrameSizesDialog
        open={frameDialog.open}
        onOpenChange={(open) => setFrameDialog((current) => ({ ...current, open }))}
        billingMode={frameDialog.billingMode}
        initial={frameDialog.initial}
        initialDiscount={frameDialog.initialDiscount}
        mode={frameDialog.index === null ? "add" : "edit"}
        itemsReceived={form.watch("itemsReceived")}
        onItemsReceivedChange={(value) => form.setValue("itemsReceived", value)}
        onApply={handleApplyFrame}
        customerName={selectedCustomer?.name}
        customerAddress={formatCustomerAddress(selectedCustomerData)}
        preparedBy={preparedBy}
      />

      <QuotationInventoryLineItemDialog
        open={itemDialogOpen}
        onOpenChange={setItemDialogOpen}
        onSave={handleSaveItem}
        item={editingItem?.item || null}
        mode={editingItem ? "edit" : "add"}
        customerId={selectedCustomerId}
      />
    </>
  );
}
