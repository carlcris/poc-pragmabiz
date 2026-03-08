"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { z } from "zod";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { useItems } from "@/hooks/useItems";

const createLineItemSchema = (
  tValidation: (key: "itemRequired" | "uomRequired" | "requestedQtyMin") => string
) => z.object({
  itemId: z.string().min(1, tValidation("itemRequired")),
  itemCode: z.string().optional(),
  itemName: z.string().optional(),
  uomId: z.string().min(1, tValidation("uomRequired")),
  requestedQty: z.number().min(0.01, tValidation("requestedQtyMin")),
  notes: z.string().optional(),
});

type StockRequestLineItemSchema = ReturnType<typeof createLineItemSchema>;
export type StockRequestLineItemFormValues = z.infer<StockRequestLineItemSchema>;
export type StockRequestLineItemPayload = StockRequestLineItemFormValues & {
  uomLabel?: string;
};

interface StockRequestLineItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (item: StockRequestLineItemPayload) => void;
  item?: StockRequestLineItemPayload | null;
  mode?: "add" | "edit";
}

export function StockRequestLineItemDialog({
  open,
  onOpenChange,
  onSave,
  item,
  mode = "add",
}: StockRequestLineItemDialogProps) {
  const t = useTranslations("stockRequestLineItemDialog");
  const tValidation = useTranslations("stockRequestLineItemValidation");
  const locale = useLocale();
  const [itemOpen, setItemOpen] = useState(false);
  const [itemSearchInput, setItemSearchInput] = useState("");
  const [itemSearch, setItemSearch] = useState("");
  const { data: itemsData, isLoading: isItemsLoading, isFetching: isItemsFetching } = useItems({
    limit: 5,
    includeStock: true,
    search: itemSearch || undefined,
    enabled: open && itemOpen,
  });
  const items = itemsData?.data || [];
  const lineItemSchema = createLineItemSchema((key) => tValidation(key));

  const form = useForm<StockRequestLineItemFormValues>({
    resolver: zodResolver(lineItemSchema),
    defaultValues: {
      itemId: "",
      itemCode: "",
      itemName: "",
      uomId: "",
      requestedQty: 1,
      notes: "",
    },
  });

  // Reset form when dialog opens/closes or item changes
  useEffect(() => {
    if (open && item) {
      const formItem = { ...item };
      form.reset(formItem);
    } else if (open) {
      form.reset({
        itemId: "",
        itemCode: "",
        itemName: "",
        uomId: "",
        requestedQty: 1,
        notes: "",
      });
    }
  }, [open, item, form]);

  useEffect(() => {
    const trimmed = itemSearchInput.trim();

    if (trimmed.length === 0) {
      setItemSearch("");
      return;
    }

    if (trimmed.length < 3) {
      setItemSearch("");
      return;
    }

    const timer = setTimeout(() => {
      setItemSearch(trimmed);
    }, 400);

    return () => clearTimeout(timer);
  }, [itemSearchInput]);

  useEffect(() => {
    if (!itemOpen) {
      setItemSearchInput("");
      setItemSearch("");
    }
  }, [itemOpen]);

  const handleItemSelect = (itemId: string) => {
    const selectedItem = items.find((i) => i.id === itemId);
    if (selectedItem) {
      form.setValue("itemId", selectedItem.id);
      form.setValue("itemCode", selectedItem.code);
      form.setValue("itemName", selectedItem.name);
      form.setValue("uomId", selectedItem.uomId);
    }
  };

  const onSubmit = (data: StockRequestLineItemFormValues) => {
    const selectedItem = items.find((i) => i.id === data.itemId);
    const uomLabel = selectedItem?.uom || item?.uomLabel || "";

    onSave({
      ...data,
      uomLabel,
    });
    onOpenChange(false);
  };

  const requestedQty = form.watch("requestedQty") || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{mode === "edit" ? t("editTitle") : t("createTitle")}</DialogTitle>
          <DialogDescription>
            {mode === "edit"
              ? t("editDescription")
              : t("createDescription")}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="itemId"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>{t("itemLabel")} *</FormLabel>
                  <Popover open={itemOpen} onOpenChange={setItemOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={itemOpen}
                          className={cn(
                            "w-full justify-between",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value
                            ? (() => {
                                const selectedItem = items.find((i) => i.id === field.value);
                                if (selectedItem) {
                                  return `${selectedItem.code} - ${selectedItem.name}`;
                                }
                                const currentCode = form.getValues("itemCode");
                                const currentName = form.getValues("itemName");
                                return currentCode && currentName
                                  ? `${currentCode} - ${currentName}`
                                  : t("selectItem");
                              })()
                            : t("searchItem")}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-[min(95vw,520px)] p-0" align="start">
                      <Command>
                        <CommandInput
                          placeholder={t("searchItem")}
                          value={itemSearchInput}
                          onValueChange={setItemSearchInput}
                        />
                        <CommandList className="max-h-[260px] overflow-y-auto">
                          {isItemsLoading || isItemsFetching ? (
                            <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              <span>{t("loadingItems")}</span>
                            </div>
                          ) : (
                            <>
                              <CommandEmpty>{t("noItemFound")}</CommandEmpty>
                              <CommandGroup>
                                {items
                                  .filter((i) => i.isActive)
                                  .map((item) => (
                                    <CommandItem
                                      key={item.id}
                                      value={`${item.code} ${item.name}`}
                                      onSelect={() => {
                                        field.onChange(item.id);
                                        handleItemSelect(item.id);
                                        setItemOpen(false);
                                      }}
                                      className="flex items-start gap-2 py-2"
                                    >
                                      <Check
                                        className={cn(
                                          "mt-0.5 h-4 w-4 shrink-0",
                                          field.value === item.id ? "opacity-100" : "opacity-0"
                                        )}
                                      />
                                      <div className="min-w-0 flex-1">
                                        <div className="text-sm font-semibold break-words">
                                          {item.code}
                                        </div>
                                        <div className="text-sm text-muted-foreground break-words">
                                          {item.name}
                                        </div>
                                        <div className="mt-1 text-xs text-muted-foreground break-words">
                                          {t("onHand")}:{" "}
                                          {("onHand" in item ? item.onHand : 0).toFixed(2)}{" "}
                                          {"uom" in item ? item.uom : ""} • {t("available")}:{" "}
                                          {("available" in item ? item.available : 0).toFixed(2)}{" "}
                                          {"uom" in item ? item.uom : ""}
                                        </div>
                                      </div>
                                    </CommandItem>
                                  ))}
                              </CommandGroup>
                            </>
                          )}
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="requestedQty"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("requestedQuantityLabel")} *</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      min="0.01"
                      {...field}
                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      placeholder={t("requestedQuantityPlaceholder")}
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
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Summary Display */}
            <div className="rounded-md border-2 border-primary/20 bg-primary/5 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{t("quantityToRequest")}:</span>
                <span className="text-2xl font-bold">{requestedQty.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {t("cancel")}
              </Button>
              <Button type="submit">{mode === "edit" ? t("updateAction") : t("addAction")}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
