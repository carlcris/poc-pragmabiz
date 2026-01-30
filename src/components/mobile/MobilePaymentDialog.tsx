"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Banknote, CreditCard, Smartphone, Plus, Trash2, DollarSign } from "lucide-react";

interface Payment {
  id: string;
  method: "cash" | "credit_card" | "gcash" | "paymaya" | "bank_transfer" | "check" | "other";
  amount: number;
  reference: string;
}

interface MobilePaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  totalAmount: number;
  onConfirm: (payments: Omit<Payment, "id">[]) => void;
  isProcessing?: boolean;
}

const PAYMENT_METHODS = [
  { value: "cash", label: "Cash", icon: Banknote },
  { value: "credit_card", label: "Credit Card", icon: CreditCard },
  { value: "gcash", label: "GCash", icon: Smartphone },
  { value: "paymaya", label: "PayMaya", icon: Smartphone },
  { value: "bank_transfer", label: "Bank Transfer", icon: CreditCard },
  { value: "check", label: "Check", icon: CreditCard },
  { value: "other", label: "Other", icon: DollarSign },
] as const;

// Generate a UUID v4
const generateId = () => {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

export function MobilePaymentDialog({
  open,
  onOpenChange,
  totalAmount,
  onConfirm,
  isProcessing = false,
}: MobilePaymentDialogProps) {
  const [payments, setPayments] = useState<Payment[]>([
    {
      id: generateId(),
      method: "cash",
      amount: totalAmount,
      reference: "",
    },
  ]);

  // Reset payments when dialog opens with a new total
  useEffect(() => {
    if (open) {
      setPayments([
        {
          id: generateId(),
          method: "cash",
          amount: totalAmount,
          reference: "",
        },
      ]);
    }
  }, [open, totalAmount]);

  const totalPayments = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
  const remaining = totalAmount - totalPayments;
  const isValid = Math.abs(remaining) < 0.01 && payments.every((p) => p.amount > 0);

  const addPayment = () => {
    const remainingAmount = Math.max(0, totalAmount - totalPayments);
    setPayments([
      ...payments,
      {
        id: generateId(),
        method: "cash",
        amount: remainingAmount,
        reference: "",
      },
    ]);
  };

  const removePayment = (id: string) => {
    if (payments.length > 1) {
      setPayments(payments.filter((p) => p.id !== id));
    }
  };

  const updatePayment = <K extends keyof Payment>(id: string, field: K, value: Payment[K]) => {
    setPayments(payments.map((p) => (p.id === id ? { ...p, [field]: value } : p)));
  };

  const handleConfirm = () => {
    if (isValid) {
      onConfirm(
        payments.map(({ id, ...rest }) => {
          void id;
          return rest;
        })
      );
    }
  };

  const getPaymentMethodIcon = (method: Payment["method"]) => {
    const methodConfig = PAYMENT_METHODS.find((m) => m.value === method);
    const Icon = methodConfig?.icon || DollarSign;
    return <Icon className="h-4 w-4" />;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Process Payment</DialogTitle>
          <DialogDescription>Total: ₱{totalAmount.toFixed(2)}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Payment Summary */}
          <Card className="bg-gray-50 p-3">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Total Amount:</span>
                <span className="font-semibold">₱{totalAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Total Payments:</span>
                <span
                  className={
                    totalPayments > totalAmount ? "font-semibold text-red-600" : "font-semibold"
                  }
                >
                  ₱{totalPayments.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between border-t pt-2">
                <span>Remaining:</span>
                <span
                  className={`font-bold ${remaining > 0.01 ? "text-orange-600" : remaining < -0.01 ? "text-red-600" : "text-green-600"}`}
                >
                  ₱{remaining.toFixed(2)}
                </span>
              </div>
            </div>
          </Card>

          {/* Payment Methods */}
          {payments.map((payment, index) => (
            <Card key={payment.id} className="space-y-3 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getPaymentMethodIcon(payment.method)}
                  <span className="text-sm font-medium">Payment {index + 1}</span>
                </div>
                {payments.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removePayment(payment.id)}
                    className="h-8 w-8 p-0 text-red-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Payment Method</Label>
                <Select
                  value={payment.method}
                  onValueChange={(value) =>
                    updatePayment(payment.id, "method", value as Payment["method"])
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((method) => (
                      <SelectItem key={method.value} value={method.value}>
                        <div className="flex items-center gap-2">
                          <method.icon className="h-4 w-4" />
                          {method.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Amount</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={payment.amount || ""}
                  onChange={(e) =>
                    updatePayment(payment.id, "amount", parseFloat(e.target.value) || 0)
                  }
                  placeholder="0.00"
                  className="text-lg font-semibold"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Reference (optional)</Label>
                <Input
                  type="text"
                  value={payment.reference}
                  onChange={(e) => updatePayment(payment.id, "reference", e.target.value)}
                  placeholder="Transaction ID, Check #, etc."
                />
              </div>
            </Card>
          ))}

          {/* Add Payment Button */}
          <Button
            variant="outline"
            className="w-full"
            onClick={addPayment}
            disabled={payments.length >= 5}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Another Payment Method
          </Button>

          {/* Validation Messages */}
          {!isValid && (
            <div className="text-center text-sm">
              {remaining > 0.01 && (
                <Badge variant="destructive" className="w-full py-2">
                  Payment incomplete. ₱{remaining.toFixed(2)} remaining
                </Badge>
              )}
              {remaining < -0.01 && (
                <Badge variant="destructive" className="w-full py-2">
                  Payment exceeds total by ₱{Math.abs(remaining).toFixed(2)}
                </Badge>
              )}
              {payments.some((p) => p.amount <= 0) && (
                <Badge variant="destructive" className="mt-2 w-full py-2">
                  All payment amounts must be greater than 0
                </Badge>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isProcessing}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!isValid || isProcessing} className="flex-1">
            {isProcessing ? "Processing..." : `Confirm ₱${totalAmount.toFixed(2)}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
