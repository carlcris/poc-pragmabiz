"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { AlertCircle, Banknote, CreditCard, Search, Smartphone, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { useItems } from "@/hooks/useItems";
import { useWarehouses } from "@/hooks/useWarehouses";
import { useCustomer, useCustomers } from "@/hooks/useCustomers";
import { useCreatePOSTransaction } from "@/hooks/usePos";
import { useCurrency } from "@/hooks/useCurrency";
import { useBusinessUnitStore } from "@/stores/businessUnitStore";
import { AsyncSearchCombobox } from "@/components/shared/AsyncSearchCombobox";
import { calculatePOSLineTotal, calculatePOSTotals } from "@/lib/pos/totals";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { ItemWithStock } from "@/app/api/items/route";
import type { Customer } from "@/types/customer";
import type { POSCartItem, POSPayment, PaymentMethod } from "@/types/pos";

const LOOKUP_PAGE_SIZE = 5;
const SEARCH_DEBOUNCE_MS = 250;

type POSCartLine = POSCartItem & {
  availableStock: number;
};

export default function POSPage() {
  const t = useTranslations("posPage");
  const walkInCustomerOption = useMemo<Customer>(
    () => ({
      id: "walk-in",
      companyId: "",
      customerType: "individual",
      code: "WALK-IN",
      name: t("walkInCustomer"),
      email: "",
      phone: "",
      billingAddress: "",
      billingCity: "",
      billingState: "",
      billingPostalCode: "",
      billingCountry: "",
      shippingAddress: "",
      shippingCity: "",
      shippingState: "",
      shippingPostalCode: "",
      shippingCountry: "",
      paymentTerms: "cash",
      creditLimit: 0,
      currentBalance: 0,
      notes: "",
      isActive: true,
      createdAt: "",
      updatedAt: "",
    }),
    [t]
  );
  const [itemSearchInput, setItemSearchInput] = useState("");
  const [debouncedItemSearch, setDebouncedItemSearch] = useState("");
  const [customerSearchInput, setCustomerSearchInput] = useState("");
  const [debouncedCustomerSearch, setDebouncedCustomerSearch] = useState("");
  const [cart, setCart] = useState<POSCartLine[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("walk-in");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [amountReceived, setAmountReceived] = useState("");
  const [showCheckout, setShowCheckout] = useState(false);
  const [itemSearchOpen, setItemSearchOpen] = useState(false);

  const { formatCurrency } = useCurrency();
  const currentBusinessUnit = useBusinessUnitStore((state) => state.currentBusinessUnit);
  const hasBusinessUnitHydrated = useBusinessUnitStore((state) => state.hasHydrated);
  const isBusinessUnitLoading = useBusinessUnitStore((state) => state.isLoading);
  const { data: warehousesData, isLoading: isWarehousesLoading } = useWarehouses({ limit: 50 });
  const warehouses = useMemo(
    () => warehousesData?.data?.filter((warehouse) => warehouse.isActive) || [],
    [warehousesData?.data]
  );
  const currentBusinessUnitWarehouseId = useMemo(() => {
    if (!currentBusinessUnit?.id) return undefined;
    return warehouses.find((warehouse) => warehouse.businessUnitId === currentBusinessUnit.id)?.id;
  }, [currentBusinessUnit?.id, warehouses]);
  const isBusinessUnitScopeReady = hasBusinessUnitHydrated && !isBusinessUnitLoading;
  const isWarehouseScopeReady =
    !currentBusinessUnit?.id || (!!currentBusinessUnitWarehouseId && !isWarehousesLoading);
  const areItemQueriesEnabled = isBusinessUnitScopeReady && isWarehouseScopeReady;
  const {
    data: itemsData,
    isLoading: itemsLoading,
    isFetching: itemsFetching,
  } = useItems({
    search: debouncedItemSearch || undefined,
    page: 1,
    limit: LOOKUP_PAGE_SIZE,
    warehouseId: currentBusinessUnitWarehouseId,
    includeStock: true,
    enabled: areItemQueriesEnabled,
  });
  const {
    data: customersData,
    isLoading: customersLoading,
    isFetching: customersFetching,
  } = useCustomers({
    search: debouncedCustomerSearch || undefined,
    page: 1,
    limit: LOOKUP_PAGE_SIZE,
  });
  const { data: selectedCustomer } = useCustomer(
    selectedCustomerId !== "walk-in" ? selectedCustomerId : ""
  );
  const createTransaction = useCreatePOSTransaction({
    success: t("transactionSuccess"),
    error: t("transactionError"),
  });

  const items = useMemo(() => (itemsData?.data || []) as ItemWithStock[], [itemsData]);
  const customers = useMemo(() => customersData?.data || [], [customersData]);
  const customerOptions = useMemo(
    () => [
      walkInCustomerOption,
      ...customers.filter(
        (customer) => customer.id !== "walk-in" && customer.code.toUpperCase() !== "WALK-IN"
      ),
    ],
    [customers, walkInCustomerOption]
  );
  const selectedCustomerOption =
    selectedCustomerId === "walk-in" ? null : (selectedCustomer ?? null);

  const itemStockMap = useMemo(() => {
    const map = new Map<string, number>(cart.map((item) => [item.itemId, item.availableStock]));
    items.forEach((item) => map.set(item.id, item.available));
    return map;
  }, [cart, items]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedItemSearch(itemSearchInput.trim());
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timeoutId);
  }, [itemSearchInput]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedCustomerSearch(customerSearchInput.trim());
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timeoutId);
  }, [customerSearchInput]);

  const { subtotal, totalDiscount, totalTax, totalAmount } = calculatePOSTotals(cart);
  const received = parseFloat(amountReceived) || 0;
  const changeAmount = received - totalAmount;

  useEffect(() => {
    const cartData = cart.map((item) => ({
      id: item.id,
      name: item.itemName,
      quantity: item.quantity,
      price: item.unitPrice,
      total: item.lineTotal,
    }));
    localStorage.setItem("pos_cart", JSON.stringify(cartData));
    window.dispatchEvent(new CustomEvent("pos_update", { detail: { cart: cartData } }));
  }, [cart]);

  useEffect(() => {
    const totals = {
      subtotal,
      discount: totalDiscount,
      tax: totalTax,
      total: totalAmount,
      paid: received,
      change: changeAmount,
    };
    localStorage.setItem("pos_totals", JSON.stringify(totals));
    window.dispatchEvent(new CustomEvent("pos_update", { detail: { totals } }));
  }, [subtotal, totalDiscount, totalTax, totalAmount, received, changeAmount]);

  const addToCart = (item: ItemWithStock) => {
    if (item.available <= 0) {
      toast.error(t("outOfStockError", { name: item.name }), {
        description: t("outOfStockDescription"),
        icon: <AlertCircle className="h-4 w-4" />,
      });
      return;
    }

    const existingItemIndex = cart.findIndex((entry) => entry.itemId === item.id);
    if (existingItemIndex >= 0) {
      const currentQty = cart[existingItemIndex].quantity;
      const newQty = currentQty + 1;
      if (newQty > item.available) {
        toast.error(t("insufficientStockError", { name: item.name }), {
          description: t("insufficientStockDescription", {
            available: item.available,
            current: currentQty,
          }),
          icon: <AlertCircle className="h-4 w-4" />,
        });
        return;
      }

      const newCart = [...cart];
      newCart[existingItemIndex] = {
        ...newCart[existingItemIndex],
        availableStock: item.available,
        quantity: newQty,
        lineTotal: calculatePOSLineTotal({
          quantity: newQty,
          unitPrice: newCart[existingItemIndex].unitPrice,
          discount: newCart[existingItemIndex].discount,
        }),
      };
      setCart(newCart);
    } else {
      setCart([
        ...cart,
        {
          id: `cart-${Date.now()}`,
          itemId: item.id,
          itemCode: item.code,
          itemName: item.name,
          quantity: 1,
          uom: item.uom || "",
          unitPrice: item.listPrice,
          discount: 0,
          lineTotal: item.listPrice,
          availableStock: item.available,
        },
      ]);
    }

    setItemSearchOpen(false);
    setItemSearchInput("");
    setDebouncedItemSearch("");
  };

  const removeFromCart = (index: number) =>
    setCart(cart.filter((_, itemIndex) => itemIndex !== index));

  const updateQuantity = (index: number, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeFromCart(index);
      return;
    }

    const cartItem = cart[index];
    const availableStock = itemStockMap.get(cartItem.itemId) || 0;
    if (newQuantity > availableStock) {
      toast.error(t("insufficientStockError", { name: cartItem.itemName }), {
        description: t("insufficientStockDescription", {
          available: availableStock,
          current: cartItem.quantity,
        }),
        icon: <AlertCircle className="h-4 w-4" />,
      });
      return;
    }

    const newCart = [...cart];
    newCart[index] = {
      ...newCart[index],
      quantity: newQuantity,
      lineTotal: calculatePOSLineTotal({
        quantity: newQuantity,
        unitPrice: newCart[index].unitPrice,
        discount: newCart[index].discount,
      }),
    };
    setCart(newCart);
  };

  const updateDiscount = (index: number, discount: number) => {
    const newCart = [...cart];
    newCart[index] = {
      ...newCart[index],
      discount,
      lineTotal: calculatePOSLineTotal({
        quantity: newCart[index].quantity,
        unitPrice: newCart[index].unitPrice,
        discount,
      }),
    };
    setCart(newCart);
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;

    if (!currentBusinessUnitWarehouseId) {
      toast.error("POS warehouse is not available for the current business unit");
      return;
    }

    const stockIssues: string[] = [];
    for (const cartItem of cart) {
      const availableStock = itemStockMap.get(cartItem.itemId) || 0;
      if (cartItem.quantity > availableStock) {
        stockIssues.push(`${cartItem.itemName}: ${cartItem.quantity}/${availableStock}`);
      }
    }

    if (stockIssues.length > 0) {
      toast.error(t("checkoutStockError"), {
        description: stockIssues.join("; "),
        icon: <AlertCircle className="h-4 w-4" />,
        duration: 5000,
      });
      return;
    }

    const payment: POSPayment = {
      method: paymentMethod,
      amount: paymentMethod === "cash" ? received : totalAmount,
    };

    await createTransaction.mutateAsync({
      customerId: selectedCustomerId !== "walk-in" ? selectedCustomerId : undefined,
      warehouseId: currentBusinessUnitWarehouseId,
      items: cart.map(({ id, availableStock, ...item }) => {
        void id;
        void availableStock;
        return item;
      }),
      payments: [payment],
    });

    setCart([]);
    setSelectedCustomerId("walk-in");
    setAmountReceived("");
    setShowCheckout(false);
    localStorage.removeItem("pos_cart");
    localStorage.removeItem("pos_totals");
  };

  const getPaymentIcon = (method: PaymentMethod) => {
    switch (method) {
      case "cash":
        return <Banknote className="h-4 w-4" />;
      case "credit_card":
      case "debit_card":
        return <CreditCard className="h-4 w-4" />;
      case "gcash":
      case "paymaya":
        return <Smartphone className="h-4 w-4" />;
    }
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] gap-4">
      <div className="flex flex-1 flex-col space-y-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>

        <div className="flex gap-2">
          <Popover
            open={itemSearchOpen}
            onOpenChange={(open) => {
              setItemSearchOpen(open);
              if (!open) {
                setItemSearchInput("");
                setDebouncedItemSearch("");
              }
            }}
          >
            <PopoverTrigger asChild>
              <Button variant="outline" className="flex-1 justify-start">
                <Search className="mr-2 h-4 w-4" />
                {t("searchAndAddItems")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[600px] p-0" align="start">
              <Command shouldFilter={false}>
                <CommandInput
                  placeholder={t("searchItems")}
                  value={itemSearchInput}
                  onValueChange={setItemSearchInput}
                />
                <CommandList>
                  {itemsLoading || itemsFetching ? (
                    <CommandGroup>
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="px-2 py-3">
                          <div className="flex w-full items-center justify-between">
                            <div className="flex-1">
                              <Skeleton className="mb-2 h-4 w-48" />
                              <Skeleton className="h-3 w-32" />
                            </div>
                            <Skeleton className="h-4 w-20" />
                          </div>
                        </div>
                      ))}
                    </CommandGroup>
                  ) : (
                    <>
                      <CommandEmpty>{t("noItemsFound")}</CommandEmpty>
                      <CommandGroup>
                        {items
                          .filter((item) => item.isActive)
                          .map((item) => {
                            const isOutOfStock = item.available <= 0;
                            const isLowStock =
                              item.available > 0 && item.available <= item.reorderPoint;

                            return (
                              <CommandItem
                                key={item.id}
                                value={item.id}
                                onSelect={() => addToCart(item)}
                                disabled={isOutOfStock}
                                className={
                                  isOutOfStock ? "cursor-not-allowed opacity-50" : "cursor-pointer"
                                }
                              >
                                <div className="flex w-full items-center justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium">{item.name}</span>
                                      {isOutOfStock && (
                                        <span className="rounded bg-red-100 px-2 py-0.5 text-xs text-red-700">
                                          {t("outOfStock")}
                                        </span>
                                      )}
                                      {isLowStock && (
                                        <span className="rounded bg-orange-100 px-2 py-0.5 text-xs text-orange-700">
                                          {t("lowStock")}
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                      {item.code} • {item.uom} •{" "}
                                      {t("stockLabel", { count: item.available })}
                                    </div>
                                  </div>
                                  <div className="text-sm font-medium">
                                    {formatCurrency(item.listPrice)}
                                  </div>
                                </div>
                              </CommandItem>
                            );
                          })}
                      </CommandGroup>
                    </>
                  )}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          {cart.length > 0 && (
            <Button variant="outline" onClick={() => setCart([])}>
              <X className="mr-2 h-4 w-4" />
              {t("clear")}
            </Button>
          )}
        </div>

        <div className="flex-1 overflow-hidden rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">{t("itemNumber")}</TableHead>
                <TableHead className="w-[200px]">{t("item")}</TableHead>
                <TableHead className="w-[250px]">{t("unit")}</TableHead>
                <TableHead className="w-[120px]">{t("price")}</TableHead>
                <TableHead className="w-[50px]">{t("qty")}</TableHead>
                <TableHead className="w-[80px]">{t("discount")}</TableHead>
                <TableHead className="w-[120px] text-right">{t("total")}</TableHead>
                <TableHead className="w-[50px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {cart.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-12 text-center text-muted-foreground">
                    <div>{t("noItemsInCart")}</div>
                    <div className="text-sm">{t("noItemsInCartDescription")}</div>
                  </TableCell>
                </TableRow>
              ) : (
                cart.map((item, index) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{index + 1}</TableCell>
                    <TableCell>
                      <div className="font-medium">{item.itemName}</div>
                      <div className="text-xs text-muted-foreground">{item.itemCode}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{item.uom || t("unit")}</div>
                    </TableCell>
                    <TableCell>{formatCurrency(item.unitPrice)}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => updateQuantity(index, parseInt(e.target.value) || 1)}
                        className="w-20"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min="0"
                        value={item.discount}
                        onChange={(e) => updateDiscount(index, parseFloat(e.target.value) || 0)}
                        className="w-24"
                      />
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(item.lineTotal)}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => removeFromCart(index)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="flex w-[400px] flex-col space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t("customer")}</CardTitle>
          </CardHeader>
          <CardContent>
            {customersLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <AsyncSearchCombobox<Customer>
                value={selectedCustomerId}
                onValueChange={setSelectedCustomerId}
                searchValue={customerSearchInput}
                onSearchValueChange={setCustomerSearchInput}
                options={customerOptions}
                selectedOption={
                  selectedCustomerId === "walk-in" ? walkInCustomerOption : selectedCustomerOption
                }
                getOptionValue={(customer) => customer.id}
                getOptionLabel={(customer) => customer.name}
                getOptionSearchValue={(customer) => `${customer.code} ${customer.name}`.trim()}
                renderOption={(customer, selected) => (
                  <div className="flex w-full items-start gap-2">
                    <div className="flex-1">
                      <div className="font-medium">{customer.name}</div>
                      {customer.id !== "walk-in" ? (
                        <div className="text-xs text-muted-foreground">
                          {customer.code}
                          {customer.email ? ` • ${customer.email}` : ""}
                        </div>
                      ) : null}
                    </div>
                    {selected ? <span className="text-xs text-primary">Selected</span> : null}
                  </div>
                )}
                placeholder={t("walkInCustomer")}
                searchPlaceholder={t("searchPlaceholder")}
                emptyMessage={t("noCustomersFound")}
                isLoading={customersFetching}
              />
            )}
          </CardContent>
        </Card>

        <Card className="flex-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t("billSummary")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t("items")}:</span>
                <span className="font-medium">{cart.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t("subtotal")}:</span>
                <span className="font-medium">{formatCurrency(subtotal)}</span>
              </div>
              {totalDiscount > 0 && (
                <div className="flex justify-between text-sm text-red-600">
                  <span>{t("discount")}:</span>
                  <span>-{formatCurrency(totalDiscount)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t("vat")}:</span>
                <span className="font-medium">{formatCurrency(totalTax)}</span>
              </div>
              <div className="flex justify-between border-t pt-2 text-xl font-bold">
                <span>{t("total")}:</span>
                <span>{formatCurrency(totalAmount)}</span>
              </div>
            </div>

            {!showCheckout ? (
              <Button
                size="lg"
                className="w-full"
                disabled={cart.length === 0}
                onClick={() => setShowCheckout(true)}
              >
                {t("proceedToPayment")}
              </Button>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium">{t("paymentMethod")}</label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant={paymentMethod === "cash" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setPaymentMethod("cash")}
                    >
                      {getPaymentIcon("cash")}
                      <span className="ml-2">{t("cash")}</span>
                    </Button>
                    <Button
                      variant={paymentMethod === "credit_card" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setPaymentMethod("credit_card")}
                    >
                      {getPaymentIcon("credit_card")}
                      <span className="ml-2">{t("card")}</span>
                    </Button>
                    <Button
                      variant={paymentMethod === "gcash" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setPaymentMethod("gcash")}
                    >
                      {getPaymentIcon("gcash")}
                      <span className="ml-2">{t("gcash")}</span>
                    </Button>
                    <Button
                      variant={paymentMethod === "paymaya" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setPaymentMethod("paymaya")}
                    >
                      {getPaymentIcon("paymaya")}
                      <span className="ml-2">{t("maya")}</span>
                    </Button>
                  </div>
                </div>

                {paymentMethod === "cash" && (
                  <>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">{t("amountReceived")}</label>
                      <Input
                        type="number"
                        placeholder="0.00"
                        value={amountReceived}
                        onChange={(e) => setAmountReceived(e.target.value)}
                        autoFocus
                      />
                    </div>

                    {received > 0 && (
                      <div className="flex justify-between text-lg font-bold">
                        <span>{t("change")}:</span>
                        <span className={changeAmount < 0 ? "text-red-600" : "text-green-600"}>
                          {formatCurrency(Math.abs(changeAmount))}
                        </span>
                      </div>
                    )}
                  </>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" onClick={() => setShowCheckout(false)}>
                    {t("cancel")}
                  </Button>
                  <Button
                    onClick={handleCheckout}
                    disabled={
                      createTransaction.isPending ||
                      (paymentMethod === "cash" && (received < totalAmount || received === 0))
                    }
                  >
                    {t("completeSale")}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
