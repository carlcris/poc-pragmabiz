"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useItems } from "@/hooks/useItems";

const transformationItemSchema = z.object({
  itemId: z.string().min(1, "Item is required"),
  itemCode: z.string().optional(),
  itemName: z.string().optional(),
  quantity: z.number().min(0.001, "Quantity must be greater than 0"),
  uomId: z.string().min(1, "Unit of measure is required"),
  uom: z.string().optional(),
  sequence: z.number().int().min(1).optional(),
  isScrap: z.boolean().optional(),
  notes: z.string().optional(),
});

export type TransformationItemFormValues = z.infer<typeof transformationItemSchema>;

interface TransformationItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (item: TransformationItemFormValues) => void;
  item?: TransformationItemFormValues | null;
  mode?: "add" | "edit";
  type: "input" | "output";
}

export function TransformationItemDialog({
  open,
  onOpenChange,
  onSave,
  item,
  mode = "add",
  type,
}: TransformationItemDialogProps) {
  // Fetch items
  const { data: itemsData, isLoading: isLoadingItems } = useItems({ limit: 50 });
  const items = itemsData?.data || [];

  // Item combobox state
  const [itemOpen, setItemOpen] = useState(false);

  const form = useForm<TransformationItemFormValues>({
    resolver: zodResolver(transformationItemSchema),
    defaultValues: {
      itemId: "",
      itemCode: "",
      itemName: "",
      quantity: 1,
      uomId: "",
      uom: "",
      sequence: 1,
      isScrap: false,
      notes: "",
    },
  });

  // Reset form when dialog opens/closes or item changes
  useEffect(() => {
    if (open && item) {
      form.reset(item);
    } else if (open) {
      form.reset({
        itemId: "",
        itemCode: "",
        itemName: "",
        quantity: 1,
        uomId: "",
        uom: "",
        sequence: 1,
        isScrap: false,
        notes: "",
      });
    }
  }, [open, item, form]);

  const handleItemSelect = (itemId: string) => {
    const selectedItem = items.find((i) => i.id === itemId);

    if (selectedItem) {
      form.setValue("itemId", selectedItem.id);
      form.setValue("itemCode", selectedItem.code);
      form.setValue("itemName", selectedItem.name);
      form.setValue("uomId", selectedItem.uomId);
      form.setValue("uom", selectedItem.uom);
    }
  };

  const onSubmit = (data: TransformationItemFormValues) => {
    onSave(data);
    onOpenChange(false);
  };

  const selectedItemId = form.watch("itemId");
  const selectedItem = items.find((i) => i.id === selectedItemId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {mode === "edit" ? "Edit" : "Add"} {type === "input" ? "Input" : "Output"} Item
          </DialogTitle>
          <DialogDescription>
            {type === "input"
              ? "Select a material to be consumed in this transformation"
              : "Select a product to be produced by this transformation"}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Item Selection */}
            <FormField
              control={form.control}
              name="itemId"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Item *</FormLabel>
                  <Popover open={itemOpen} onOpenChange={setItemOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          role="combobox"
                          className={cn("justify-between", !field.value && "text-muted-foreground")}
                        >
                          {field.value
                            ? `${selectedItem?.code} - ${selectedItem?.name}`
                            : "Select item..."}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-[500px] p-0">
                      <Command>
                        <CommandInput placeholder="Search items..." />
                        <CommandList>
                          <CommandEmpty>
                            {isLoadingItems ? "Loading items..." : "No items found."}
                          </CommandEmpty>
                          <CommandGroup>
                            {items.map((item) => (
                              <CommandItem
                                key={item.id}
                                value={`${item.code} ${item.name}`}
                                onSelect={() => {
                                  handleItemSelect(item.id);
                                  setItemOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    item.id === field.value ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                {item.code} - {item.name}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Quantity and UOM Row */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantity *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.001"
                        placeholder="0.00"
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
                name="uom"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit of Measure</FormLabel>
                    <FormControl>
                      <Input {...field} disabled placeholder="Auto-filled" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Output-specific: Is Scrap checkbox */}
            {type === "output" && (
              <FormField
                control={form.control}
                name="isScrap"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Mark as Scrap/Byproduct</FormLabel>
                      <p className="text-sm text-muted-foreground">
                        This item is a waste product or byproduct of the transformation
                      </p>
                    </div>
                  </FormItem>
                )}
              />
            )}

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea {...field} placeholder="Optional notes..." rows={3} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit">{mode === "edit" ? "Update" : "Add"} Item</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
