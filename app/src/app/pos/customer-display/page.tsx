"use client";

import { useEffect, useState } from "react";
import { useCurrency } from "@/hooks/useCurrency";

type CartItem = {
  id: string;
  name: string;
  quantity: number;
  price: number;
  total: number;
};

type POSUpdateTotals = {
  subtotal?: number;
  discount?: number;
  tax?: number;
  total?: number;
  paid?: number;
  change?: number;
};

type POSUpdateDetail = {
  cart?: CartItem[];
  totals?: POSUpdateTotals;
};

export default function CustomerDisplayPage() {
  const { formatCurrency } = useCurrency();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [subtotal, setSubtotal] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [tax, setTax] = useState(0);
  const [total, setTotal] = useState(0);
  const [paid, setPaid] = useState(0);
  const [change, setChange] = useState(0);
  const [storeName] = useState("PragmaBiz");
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [transactionNo, setTransactionNo] = useState<number | null>(null);

  // Initialize client-side only values
  useEffect(() => {
    setCurrentTime(new Date());
    setTransactionNo(Math.floor(Math.random() * 10000));
  }, []);

  // Update time every second
  useEffect(() => {
    if (!currentTime) return;
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, [currentTime]);

  // Listen for cart updates from the main POS system
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "pos_cart") {
        const cartData = e.newValue ? JSON.parse(e.newValue) : [];
        setCart(cartData);
      }
      if (e.key === "pos_totals") {
        const totalsData = e.newValue ? JSON.parse(e.newValue) : {};
        setSubtotal(totalsData.subtotal || 0);
        setDiscount(totalsData.discount || 0);
        setTax(totalsData.tax || 0);
        setTotal(totalsData.total || 0);
        setPaid(totalsData.paid || 0);
        setChange(totalsData.change || 0);
      }
    };

    // Initial load
    const storedCart = localStorage.getItem("pos_cart");
    const storedTotals = localStorage.getItem("pos_totals");

    if (storedCart) {
      setCart(JSON.parse(storedCart));
    }
    if (storedTotals) {
      const totalsData = JSON.parse(storedTotals);
      setSubtotal(totalsData.subtotal || 0);
      setDiscount(totalsData.discount || 0);
      setTax(totalsData.tax || 0);
      setTotal(totalsData.total || 0);
      setPaid(totalsData.paid || 0);
      setChange(totalsData.change || 0);
    }

    window.addEventListener("storage", handleStorageChange);

    // Also listen for custom events from same window
    const handleCustomEvent = (event: Event) => {
      const customEvent = event as CustomEvent<POSUpdateDetail>;
      const { cart: updatedCart, totals } = customEvent.detail || {};

      if (updatedCart) {
        setCart(updatedCart);
      }
      if (totals) {
        setSubtotal(totals.subtotal || 0);
        setDiscount(totals.discount || 0);
        setTax(totals.tax || 0);
        setTotal(totals.total || 0);
        setPaid(totals.paid || 0);
        setChange(totals.change || 0);
      }
    };

    window.addEventListener("pos_update", handleCustomEvent);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("pos_update", handleCustomEvent);
    };
  }, []);

  return (
    <div className="h-screen w-screen overflow-hidden bg-background flex">
      {/* Left Side - Receipt/Cart (2/3 of screen) */}
      <div className="w-2/3 h-full flex flex-col bg-background border-r-4 border-border">
        {/* Header */}
        <div className="bg-gradient-to-r from-primary to-primary/90 text-primary-foreground p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 bg-background rounded-lg flex items-center justify-center">
                <span className="text-4xl">🏪</span>
              </div>
              <div>
                <h1 className="text-4xl font-bold">{storeName}</h1>
                <p className="text-lg opacity-90">
                  {currentTime ? (
                    <>
                      {currentTime.toLocaleDateString("en-US", {
                        month: "2-digit",
                        day: "2-digit",
                        year: "numeric",
                      })}{" "}
                      {currentTime.toLocaleTimeString("en-US", {
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: true,
                      })}
                    </>
                  ) : (
                    <span>&nbsp;</span>
                  )}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm opacity-75">Trans No</p>
              <p className="text-2xl font-bold">{transactionNo ?? "----"}</p>
            </div>
          </div>
        </div>

        {/* Cart Items Table */}
        <div className="flex-1 overflow-hidden flex flex-col p-6">
          {cart.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="text-9xl mb-6">🛒</div>
                <p className="text-4xl text-muted-foreground font-medium">
                  Waiting for items...
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Table Header */}
              <div className="grid grid-cols-12 gap-4 pb-3 border-b-2 border-border text-muted-foreground font-semibold text-lg mb-4">
                <div className="col-span-1">Type</div>
                <div className="col-span-5">Description</div>
                <div className="col-span-2 text-center">Qty</div>
                <div className="col-span-2 text-right">Price</div>
                <div className="col-span-2 text-right">Total</div>
              </div>

              {/* Items List */}
              <div className="flex-1 overflow-y-auto space-y-2">
                {cart.map((item, index) => (
                  <div
                    key={item.id + index}
                    className="grid grid-cols-12 gap-4 items-center py-3 border-b border-border"
                  >
                    <div className="col-span-1">
                      <span className="bg-primary/10 text-primary px-2 py-1 rounded text-sm font-medium">
                        Sale
                      </span>
                    </div>
                    <div className="col-span-5">
                      <p className="text-2xl font-medium text-foreground">
                        {item.name}
                      </p>
                    </div>
                    <div className="col-span-2 text-center">
                      <span className="text-2xl font-bold text-primary">
                        {item.quantity}
                      </span>
                    </div>
                    <div className="col-span-2 text-right">
                      <p className="text-xl text-muted-foreground">
                        {formatCurrency(item.price)}
                      </p>
                    </div>
                    <div className="col-span-2 text-right">
                      <p className="text-2xl font-bold text-foreground">
                        {formatCurrency(item.total)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Totals Section */}
        {cart.length > 0 && (
          <div className="border-t-4 border-border bg-muted/50 p-8">
            <div className="max-w-md ml-auto space-y-3">
              <div className="flex justify-between items-center text-2xl">
                <span className="text-muted-foreground">Sub Total</span>
                <span className="font-bold text-foreground">
                  {formatCurrency(subtotal)}
                </span>
              </div>

              {discount > 0 && (
                <div className="flex justify-between items-center text-2xl text-destructive">
                  <span>Discount</span>
                  <span className="font-bold">{formatCurrency(discount)}</span>
                </div>
              )}

              <div className="flex justify-between items-center text-2xl">
                <span className="text-muted-foreground">Net Total</span>
                <span className="font-bold text-foreground">
                  {formatCurrency(subtotal - discount)}
                </span>
              </div>

              <div className="flex justify-between items-center text-2xl">
                <span className="text-muted-foreground">VAT (12%)</span>
                <span className="font-bold text-foreground">
                  {formatCurrency(tax)}
                </span>
              </div>

              <div className="border-t-2 border-border pt-3 flex justify-between items-center">
                <span className="text-3xl font-bold text-foreground">Total</span>
                <span className="text-4xl font-bold text-primary">
                  {formatCurrency(total)}
                </span>
              </div>

              <div className="flex justify-between items-center text-2xl">
                <span className="text-muted-foreground">Paid</span>
                <span className="font-bold text-green-600 dark:text-green-400">
                  {formatCurrency(paid)}
                </span>
              </div>

              <div className="flex justify-between items-center text-2xl border-t-2 border-border pt-3">
                <span className="font-bold text-destructive">Balance</span>
                <span className="text-3xl font-bold text-destructive">
                  {formatCurrency(Math.max(0, total - paid))}
                </span>
              </div>

              <div className="flex justify-between items-center text-2xl">
                <span className="font-bold text-foreground">Change</span>
                <span className="text-3xl font-bold text-foreground">
                  {formatCurrency(Math.max(0, change))}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Right Side - Ads (1/3 of screen) */}
      <div className="w-1/3 h-full bg-gradient-to-br from-primary/10 via-background to-accent/10 flex flex-col justify-evenly p-8 overflow-hidden">
        {/* Ad 1 - Gift Card */}
        <div className="w-full text-center py-6">
          <div className="text-7xl mb-4">🎁</div>
          <h2 className="text-4xl font-black text-primary mb-3 tracking-tight">Gift Cards</h2>
          <p className="text-xl text-muted-foreground mb-6">Perfect for any occasion</p>
          <div className="inline-block">
            <p className="text-lg text-muted-foreground mb-1">Starting from</p>
            <p className="text-6xl font-black text-primary">₱ 100</p>
          </div>
        </div>

        {/* Divider */}
        <div className="w-full h-px bg-gradient-to-r from-transparent via-border to-transparent"></div>

        {/* Ad 2 - Fresh Produce */}
        <div className="w-full text-center py-6">
          <div className="text-7xl mb-4">🥬</div>
          <h3 className="text-4xl font-black bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent mb-3 tracking-tight">
            Fresh Daily
          </h3>
          <p className="text-xl text-muted-foreground">Quality produce delivered fresh</p>
        </div>

        {/* Divider */}
        <div className="w-full h-px bg-gradient-to-r from-transparent via-border to-transparent"></div>

        {/* Ad 3 - Rewards Program */}
        <div className="w-full text-center py-6">
          <div className="text-7xl mb-4">⭐</div>
          <h3 className="text-4xl font-black text-foreground mb-3 tracking-tight">Rewards Program</h3>
          <p className="text-xl text-muted-foreground">Earn points with every purchase</p>
        </div>
      </div>
    </div>
  );
}
