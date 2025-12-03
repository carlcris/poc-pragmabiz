"use client";

import { useState } from "react";
import { MobileHeader } from "@/components/mobile/MobileHeader";
import { CustomerSearchDialog } from "@/components/mobile/CustomerSearchDialog";
import { QuickCustomerForm } from "@/components/mobile/QuickCustomerForm";
import { MobileItemCard } from "@/components/mobile/MobileItemCard";
import { MobileAlert } from "@/components/mobile/MobileAlert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  AlertCircle,
  UserPlus,
  DollarSign,
  User,
  Phone,
  ChevronRight,
  Percent
} from "lucide-react";
import { useUserVanWarehouse, useVanItems } from "@/hooks/useVanWarehouse";
import { Customer } from "@/types/customer";
import { useQueryClient } from "@tanstack/react-query";

interface CartItem {
  itemId: string;
  itemCode: string;
  itemName: string;
  unitPrice: number;
  quantity: number;
  uomId: string;
  uomName: string;
  availableStock: number;
  discount: number; // Discount percentage
}

export default function SellPage() {
  const queryClient = useQueryClient();
  const { data: vanData, isLoading: vanLoading } = useUserVanWarehouse();
  const { data: itemsData, isLoading: itemsLoading } = useVanItems(vanData?.vanWarehouseId);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showCustomerDialog, setShowCustomerDialog] = useState(false);
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [alertState, setAlertState] = useState<{
    open: boolean;
    title: string;
    description: string;
    variant: "default" | "destructive" | "warning" | "success";
  }>({
    open: false,
    title: "",
    description: "",
    variant: "default",
  });

  const vanName = vanData?.vanWarehouse?.name || "No Van Assigned";
  const driverName = vanData?.fullName || "Driver";

  const items = (itemsData as any)?.inventory || [];
  const filteredItems = searchTerm
    ? items.filter((item: any) => {
        const matchesSearch = item.itemName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.itemCode.toLowerCase().includes(searchTerm.toLowerCase());
        const hasStock = item.availableStock > 0;
        return matchesSearch && hasStock;
      })
    : [];

  // Calculate totals with discount
  const subtotal = cart.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
  const totalDiscount = cart.reduce((sum, item) => {
    const itemSubtotal = item.unitPrice * item.quantity;
    return sum + (itemSubtotal * item.discount / 100);
  }, 0);
  const taxableAmount = subtotal - totalDiscount;
  const tax = taxableAmount * 0.12; // 12% VAT
  const total = taxableAmount + tax;

  const addToCart = (item: any) => {
    // Check if item has stock available
    if (!item.availableStock || item.availableStock <= 0) {
      setAlertState({
        open: true,
        title: "Out of Stock",
        description: `${item.itemName} is currently out of stock`,
        variant: "warning",
      });
      return;
    }

    const existingItem = cart.find(ci => ci.itemId === item.itemId);
    if (existingItem) {
      // Check if we can add one more
      if (existingItem.quantity + 1 > item.availableStock) {
        setAlertState({
          open: true,
          title: "Insufficient Stock",
          description: `Only ${item.availableStock} ${item.uomName} available in stock`,
          variant: "warning",
        });
        return;
      }
      updateQuantity(item.itemId, existingItem.quantity + 1);
    } else {
      setCart([...cart, {
        itemId: item.itemId,
        itemCode: item.itemCode,
        itemName: item.itemName,
        unitPrice: item.unitPrice || 0,
        quantity: 1,
        uomId: item.uomId,
        uomName: item.uomName,
        availableStock: item.availableStock || 0,
        discount: 0,
      }]);
    }
    // Clear search box after adding item
    setSearchTerm("");
  };

  const updateQuantity = (itemId: string, newQuantity: number) => {
    const item = cart.find(ci => ci.itemId === itemId);
    if (!item) return;

    if (newQuantity > item.availableStock) {
      setAlertState({
        open: true,
        title: "Insufficient Stock",
        description: `Only ${item.availableStock} ${item.uomName} available in stock`,
        variant: "warning",
      });
      return;
    }

    if (newQuantity <= 0) {
      removeFromCart(itemId);
    } else {
      setCart(cart.map(ci =>
        ci.itemId === itemId ? { ...ci, quantity: newQuantity } : ci
      ));
    }
  };

  const removeFromCart = (itemId: string) => {
    setCart(cart.filter(ci => ci.itemId !== itemId));
  };

  const updateDiscount = (itemId: string, discount: number) => {
    const validDiscount = Math.max(0, Math.min(100, discount)); // Clamp between 0-100
    setCart(cart.map(ci =>
      ci.itemId === itemId ? { ...ci, discount: validDiscount } : ci
    ));
  };

  const handleCheckout = async () => {
    if (!selectedCustomer) {
      setAlertState({
        open: true,
        title: "Customer Required",
        description: "Please select a customer before checking out",
        variant: "warning",
      });
      return;
    }
    if (cart.length === 0) {
      setAlertState({
        open: true,
        title: "Empty Cart",
        description: "Please add items to cart before checking out",
        variant: "warning",
      });
      return;
    }
    if (!vanData?.vanWarehouseId) {
      setAlertState({
        open: true,
        title: "No Van Assigned",
        description: "No van warehouse assigned to your account",
        variant: "destructive",
      });
      return;
    }

    try {
      // Prepare payment data for complete workflow
      const paymentData = {
        customerId: selectedCustomer.id,
        warehouseId: vanData.vanWarehouseId,
        lineItems: cart.map((item) => ({
          itemId: item.itemId,
          description: item.itemName,
          quantity: item.quantity,
          uomId: item.uomId,
          unitPrice: item.unitPrice,
          discount: item.discount,
        })),
        paymentMethod: "cash" as const,
        paymentReference: `Van Sales - ${new Date().toISOString()}`,
        notes: "Van sales transaction",
      };

      const response = await fetch("/api/van-sales/process-payment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(paymentData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to process payment");
      }

      const result = await response.json();

      // Invalidate sales stats to refresh dashboard
      queryClient.invalidateQueries({ queryKey: ["vanSalesStats"] });
      queryClient.invalidateQueries({ queryKey: ["vanInventory"] });

      // Clear cart and customer after successful payment
      setCart([]);
      setSelectedCustomer(null);
      setSearchTerm("");

      setAlertState({
        open: true,
        title: "Payment Successful!",
        description: `Order: ${result.data.orderNumber}\nInvoice: ${result.data.invoiceNumber}\nPayment: ${result.data.paymentCode}\nAmount: ₱${result.data.totalAmount.toFixed(2)}`,
        variant: "success",
      });
    } catch (error) {
      console.error("Error processing payment:", error);
      setAlertState({
        open: true,
        title: "Payment Failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    }
  };

  if (!vanLoading && !vanData?.vanWarehouseId) {
    return (
      <div className="min-h-screen bg-gray-50">
        <MobileHeader title="Quick Sell" />
        <div className="p-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              You have not been assigned to a van warehouse. Please contact your supervisor.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <MobileHeader
        title="Quick Sell"
        subtitle="Add items to cart"
        vanName={vanName}
        driverName={driverName}
        showLogout={true}
      />

      <div className="p-4 space-y-4">
        {/* Customer Selection - Redesigned */}
        <Card
          className={`cursor-pointer transition-all duration-200 ${
            selectedCustomer
              ? 'border-primary bg-primary/5'
              : 'border-dashed border-2 hover:border-primary hover:bg-primary/5'
          }`}
          onClick={() => setShowCustomerDialog(true)}
        >
          <CardContent className="p-4">
            {selectedCustomer ? (
              <div className="flex items-center gap-4">
                <div className="flex-shrink-0 h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-7 w-7 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-primary uppercase tracking-wide">
                      Customer
                    </span>
                  </div>
                  <h3 className="font-semibold text-lg truncate">{selectedCustomer.name}</h3>
                  {selectedCustomer.phone && (
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1">
                      <Phone className="h-3.5 w-3.5" />
                      <span>{selectedCustomer.phone}</span>
                    </div>
                  )}
                  {(selectedCustomer as any).address && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                      {(selectedCustomer as any).address}
                    </p>
                  )}
                </div>
                <div className="flex-shrink-0">
                  <div className="flex flex-col items-center gap-1">
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    <span className="text-xs text-primary font-medium">Change</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-4 py-3">
                <div className="flex-shrink-0 h-14 w-14 rounded-full bg-gray-100 flex items-center justify-center">
                  <UserPlus className="h-7 w-7 text-gray-400" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg text-gray-700">Select Customer</h3>
                  <p className="text-sm text-muted-foreground">Tap to choose or create customer</p>
                </div>
                <div className="flex-shrink-0">
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Item Search */}
        <Card>
          <CardContent className="pt-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search items..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </CardContent>
        </Card>

        {/* Item List */}
        {itemsLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Skeleton className="h-12 w-12 rounded-lg" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                      <Skeleton className="h-8 w-24" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredItems.length > 0 ? (
          <div className="space-y-3">
            {filteredItems.map((item: any) => (
              <MobileItemCard
                key={item.itemId}
                item={item}
                onAddToCart={addToCart}
                inCart={cart.some((ci) => ci.itemId === item.itemId)}
              />
            ))}
          </div>
        ) : null}

        {/* Cart Summary */}
        {cart.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Cart ({cart.length} items)</CardTitle>
                <ShoppingCart className="h-5 w-5 text-gray-400" />
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {cart.map((item) => {
                const itemSubtotal = item.unitPrice * item.quantity;
                const discountAmount = (itemSubtotal * item.discount) / 100;
                const itemTotal = itemSubtotal - discountAmount;

                return (
                  <div key={item.itemId} className="p-3 bg-gray-50 rounded-lg space-y-2">
                    {/* Item Header */}
                    <div className="flex items-start gap-3">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{item.itemName}</p>
                        <p className="text-xs text-gray-500">₱{item.unitPrice.toFixed(2)} / {item.uomName}</p>
                        <p className="text-xs text-gray-600 mt-1">
                          Stock: {item.availableStock} {item.uomName}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-red-500 flex-shrink-0"
                        onClick={() => removeFromCart(item.itemId)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Quantity and Discount Controls */}
                    <div className="flex items-center gap-2">
                      {/* Quantity Controls */}
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 w-8 p-0"
                          onClick={() => updateQuantity(item.itemId, item.quantity - 1)}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <Input
                          type="number"
                          min="1"
                          max={item.availableStock}
                          value={item.quantity}
                          onChange={(e) => updateQuantity(item.itemId, parseInt(e.target.value) || 0)}
                          className="w-16 text-center font-medium h-8 p-0"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 w-8 p-0"
                          onClick={() => updateQuantity(item.itemId, item.quantity + 1)}
                          disabled={item.quantity >= item.availableStock}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>

                      {/* Discount Input */}
                      <div className="flex items-center gap-1 flex-1">
                        <Percent className="h-4 w-4 text-gray-400" />
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          value={item.discount || ""}
                          onChange={(e) => updateDiscount(item.itemId, parseFloat(e.target.value) || 0)}
                          placeholder="0"
                          className="h-8 text-center"
                        />
                      </div>

                      {/* Line Total */}
                      <div className="text-right flex-shrink-0">
                        {item.discount > 0 ? (
                          <div>
                            <p className="text-xs text-gray-500 line-through">₱{itemSubtotal.toFixed(2)}</p>
                            <p className="font-bold text-sm text-green-600">₱{itemTotal.toFixed(2)}</p>
                          </div>
                        ) : (
                          <p className="font-bold text-sm">₱{itemTotal.toFixed(2)}</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Totals */}
              <div className="border-t pt-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Subtotal</span>
                  <span>₱{subtotal.toFixed(2)}</span>
                </div>
                {totalDiscount > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Discount</span>
                    <span>-₱{totalDiscount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span>Tax (12%)</span>
                  <span>₱{tax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold border-t pt-2">
                  <span>Total</span>
                  <span>₱{total.toFixed(2)}</span>
                </div>
              </div>

              {/* Payment Button */}
              <Button
                className="w-full"
                size="lg"
                onClick={handleCheckout}
                disabled={!selectedCustomer || cart.length === 0}
              >
                <DollarSign className="h-5 w-5 mr-2" />
                Process Payment
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Empty State */}
        {cart.length === 0 && filteredItems.length === 0 && !itemsLoading && (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center space-y-3">
                <ShoppingCart className="h-16 w-16 mx-auto text-gray-300" />
                <h3 className="font-semibold text-lg text-gray-700">
                  {searchTerm ? "No Items Found" : "Search for Items"}
                </h3>
                <p className="text-sm text-gray-500">
                  {searchTerm ? "No items match your search" : "Use the search box above to find items"}
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Dialogs */}
      <CustomerSearchDialog
        open={showCustomerDialog}
        onOpenChange={setShowCustomerDialog}
        onSelectCustomer={(customer) => {
          setSelectedCustomer(customer);
          setShowCustomerDialog(false);
        }}
        onCreateNew={() => {
          setShowCustomerDialog(false);
          setShowCustomerForm(true);
        }}
      />

      <QuickCustomerForm
        open={showCustomerForm}
        onOpenChange={setShowCustomerForm}
        onCustomerCreated={(customer) => {
          setSelectedCustomer(customer);
          setShowCustomerForm(false);
        }}
      />

      <MobileAlert
        open={alertState.open}
        onOpenChange={(open) => setAlertState({ ...alertState, open })}
        title={alertState.title}
        description={alertState.description}
        variant={alertState.variant}
        duration={alertState.variant === "success" ? 5000 : 4000}
      />
    </div>
  );
}
