"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useCreateItem, useUpdateItem } from "@/hooks/useItems";
import { useAuthStore } from "@/stores/authStore";
import { itemFormSchema, type ItemFormValues } from "@/lib/validations/item";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PackagingTab } from "@/components/items/packaging/PackagingTab";
import { PricesTab } from "@/components/items/prices/PricesTab";
import { ImageUpload } from "@/components/ui/image-upload";
import type { Item } from "@/types/item";

interface ItemFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: Item | null;
}

const ITEM_TYPES = [
  { value: "raw_material", label: "Raw Material" },
  { value: "finished_good", label: "Finished Good" },
  { value: "asset", label: "Asset" },
  { value: "service", label: "Service" },
] as const;

const UNITS_OF_MEASURE = [
  { value: "PCS", label: "Pieces (PCS)" },
  { value: "BOX", label: "Box" },
  { value: "KG", label: "Kilogram (KG)" },
  { value: "G", label: "Gram (G)" },
  { value: "L", label: "Liter (L)" },
  { value: "ML", label: "Milliliter (ML)" },
  { value: "SACK", label: "Sack" },
  { value: "CAVAN", label: "Cavan" },
  { value: "PACK", label: "Pack" },
  { value: "SET", label: "Set" },
];

const CATEGORIES = [
  "Food Products",
  "Beverages",
  "Electronics",
  "Clothing",
  "Home & Living",
  "Office Supplies",
  "Construction Materials",
  "Raw Materials",
];

export function ItemFormDialog({ open, onOpenChange, item }: ItemFormDialogProps) {
  const { user } = useAuthStore();
  const createItem = useCreateItem();
  const updateItem = useUpdateItem();
  const [activeTab, setActiveTab] = useState("general");
  const [createdItemId, setCreatedItemId] = useState<string | null>(null);
  const [isEditingExisting, setIsEditingExisting] = useState(false);

  const form = useForm<ItemFormValues>({
    resolver: zodResolver(itemFormSchema),
    defaultValues: {
      code: "",
      name: "",
      description: "",
      itemType: "raw_material",
      uom: "PCS",
      category: "",
      standardCost: 0,
      listPrice: 0,
      reorderLevel: 0,
      reorderQty: 0,
      isActive: true,
    },
  });

  useEffect(() => {
    if (item) {
      setIsEditingExisting(true);
      setCreatedItemId(item.id);
      form.reset({
        code: item.code,
        name: item.name,
        description: item.description,
        itemType: item.itemType,
        uom: item.uom,
        category: item.category,
        standardCost: item.standardCost,
        listPrice: item.listPrice,
        reorderLevel: item.reorderLevel,
        reorderQty: item.reorderQty,
        imageUrl: item.imageUrl,
        isActive: item.isActive,
      });
    } else {
      setIsEditingExisting(false);
      setCreatedItemId(null);
      form.reset({
        code: "",
        name: "",
        description: "",
        itemType: "raw_material",
        uom: "PCS",
        category: "",
        standardCost: 0,
        listPrice: 0,
        reorderLevel: 0,
        reorderQty: 0,
        imageUrl: undefined,
        isActive: true,
      });
      setActiveTab("general");
    }
  }, [item, form, open]);

  const onSubmit = async (values: ItemFormValues) => {
    try {
      if (item) {
        // Update existing item
        await updateItem.mutateAsync({
          id: item.id,
          data: values,
        });
        toast.success("Item updated successfully");
        handleClose();
      } else {
        // Create new item
        if (!user?.companyId) {
          toast.error("User company information not available");
          return;
        }

        const result = await createItem.mutateAsync({
          ...values,
          companyId: user.companyId,
        });

        const itemId = result?.data?.id;

        if (itemId) {
          setCreatedItemId(itemId);
          toast.success("Item created successfully!", {
            description: "You can now add variants, packaging, and price tiers",
          });
          // Switch to variants tab to continue adding details
          setActiveTab("variants");
        }
      }
    } catch (error) {
      toast.error(item ? "Failed to update item" : "Failed to create item");
    }
  };

  const handleClose = () => {
    form.reset();
    setCreatedItemId(null);
    setIsEditingExisting(false);
    setActiveTab("general");
    onOpenChange(false);
  };

  // Determine if we're in "view mode with tabs" (item exists or just created)
  const showTabs = isEditingExisting || createdItemId !== null;
  const currentItemId = item?.id || createdItemId;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="max-w-4xl max-h-[90vh] overflow-y-auto"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>
            {item ? "Edit Item" : createdItemId ? "Add Item Details" : "Create New Item"}
          </DialogTitle>
          <DialogDescription>
            {item
              ? "Update the item information and manage variants, packaging, and pricing"
              : createdItemId
              ? "Item created successfully. Now add variants, packaging, and price tiers."
              : "Fill in the item details below to create a new item"}
          </DialogDescription>
        </DialogHeader>

        {showTabs ? (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="packaging">Packaging</TabsTrigger>
              <TabsTrigger value="prices">Prices</TabsTrigger>
            </TabsList>

            {/* General Tab */}
            <TabsContent value="general" className="space-y-4 mt-4">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div className="space-y-6">
                    {/* Basic Information with Image */}
                    <div>
                      <h4 className="text-sm font-medium mb-4">Basic Information</h4>

                      {/* Two Column Layout: Form Fields | Image Upload */}
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Left Column - Form Fields (2/3 width) */}
                        <div className="lg:col-span-2 space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name="code"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Item Code *</FormLabel>
                                  <FormControl>
                                    <Input
                                      placeholder="ITEM-001"
                                      {...field}
                                      disabled={!!item || !!createdItemId}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name="itemType"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Item Type *</FormLabel>
                                  <Select
                                    onValueChange={field.onChange}
                                    value={field.value}
                                  >
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Select item type" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {ITEM_TYPES.map((type) => (
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
                                <FormLabel>Item Name *</FormLabel>
                                <FormControl>
                                  <Input placeholder="Enter item name" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

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
                        </div>

                        {/* Right Column - Image Upload (1/3 width) */}
                        <div className="lg:col-span-1">
                          <FormField
                            control={form.control}
                            name="imageUrl"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Item Image</FormLabel>
                                <FormControl>
                                  <ImageUpload
                                    value={field.value}
                                    onChange={field.onChange}
                                    itemId={currentItemId}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Divider */}
                    <div className="border-t pt-6">
                      <h4 className="text-sm font-medium mb-4">Classification & Pricing</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="category"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Category *</FormLabel>
                              <Select
                                onValueChange={field.onChange}
                                value={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select category" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {CATEGORIES.map((category) => (
                                    <SelectItem key={category} value={category}>
                                      {category}
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
                          name="uom"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Unit of Measure *</FormLabel>
                              <Select
                                onValueChange={field.onChange}
                                value={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select UOM" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {UNITS_OF_MEASURE.map((uom) => (
                                    <SelectItem key={uom.value} value={uom.value}>
                                      {uom.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    {/* Pricing */}
                    <div className="border-t pt-4">
                      <h4 className="text-sm font-medium mb-4">Pricing Information</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="standardCost"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Standard Cost</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  step="0.01"
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
                          name="listPrice"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>List Price *</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  step="0.01"
                                  placeholder="0.00"
                                  {...field}
                                  onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    {/* Inventory Management */}
                    <div className="border-t pt-4">
                      <h4 className="text-sm font-medium mb-4">Inventory Management</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="reorderLevel"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Reorder Level</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  placeholder="0"
                                  {...field}
                                  onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                />
                              </FormControl>
                              <FormDescription>
                                Alert when stock falls below this level
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="reorderQty"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Reorder Quantity</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  placeholder="0"
                                  {...field}
                                  onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                />
                              </FormControl>
                              <FormDescription>
                                Suggested quantity to reorder
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleClose}
                    >
                      {createdItemId ? "Close" : "Cancel"}
                    </Button>
                    <Button
                      type="submit"
                      disabled={createItem.isPending || updateItem.isPending}
                    >
                      {createItem.isPending || updateItem.isPending
                        ? "Saving..."
                        : item
                        ? "Update Item"
                        : "Save & Continue"}
                    </Button>
                  </div>
                </form>
              </Form>
            </TabsContent>

            {/* Packaging Tab */}
            <TabsContent value="packaging" className="mt-4">
              {currentItemId && <PackagingTab itemId={currentItemId} />}
            </TabsContent>

            {/* Prices Tab */}
            <TabsContent value="prices" className="mt-4">
              {currentItemId && <PricesTab itemId={currentItemId} />}
            </TabsContent>
          </Tabs>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Item Code *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="ITEM-001"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="itemType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Item Type *</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select item type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {ITEM_TYPES.map((type) => (
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
                    <FormLabel>Item Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter item name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

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

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category *</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {CATEGORIES.map((category) => (
                            <SelectItem key={category} value={category}>
                              {category}
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
                  name="uom"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Unit of Measure *</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select UOM" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {UNITS_OF_MEASURE.map((uom) => (
                            <SelectItem key={uom.value} value={uom.value}>
                              {uom.label}
                            </SelectItem>
                          ))}
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
                  name="standardCost"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Standard Cost</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
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
                  name="listPrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>List Price *</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="reorderLevel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Reorder Level</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="0"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormDescription>
                        Alert when stock falls below this level
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="reorderQty"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Reorder Quantity</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="0"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormDescription>
                        Suggested quantity to reorder
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createItem.isPending || updateItem.isPending}
                >
                  {createItem.isPending || updateItem.isPending
                    ? "Saving..."
                    : "Save & Continue"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
