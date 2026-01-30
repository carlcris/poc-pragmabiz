"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRecordPayment } from "@/hooks/useInvoices";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { recordPaymentSchema, type RecordPaymentValues } from "@/lib/validations/invoice";
import type { z } from "zod";
import { useCurrency } from "@/hooks/useCurrency";
import type { Invoice } from "@/types/invoice";

interface RecordPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: Invoice | null;
}

export function RecordPaymentDialog({ open, onOpenChange, invoice }: RecordPaymentDialogProps) {
  const { formatCurrency } = useCurrency();
  const recordPayment = useRecordPayment();
  type RecordPaymentInput = z.input<typeof recordPaymentSchema>;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<RecordPaymentInput>({
    resolver: zodResolver(recordPaymentSchema),
    defaultValues: {
      invoiceId: "",
      amount: 0,
      paymentDate: new Date().toISOString().split("T")[0],
      paymentMethod: "bank_transfer",
      reference: "",
      notes: "",
    },
  });

  useEffect(() => {
    if (invoice && open) {
      reset({
        invoiceId: invoice.id,
        amount: invoice.amountDue,
        paymentDate: new Date().toISOString().split("T")[0],
        paymentMethod: "bank_transfer",
        reference: "",
        notes: "",
      });
    }
  }, [invoice, open, reset]);

  const onSubmit = async (data: RecordPaymentInput) => {
    try {
      const parsed = recordPaymentSchema.parse(data);
      await recordPayment.mutateAsync(parsed);
      onOpenChange(false);
    } catch {}
  };

  if (!invoice) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
          <DialogDescription>
            Record a payment for invoice {invoice.invoiceNumber}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-4">
            <div className="space-y-2 rounded-md bg-muted p-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Amount:</span>
                <span className="font-medium">{formatCurrency(invoice.totalAmount)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Amount Paid:</span>
                <span className="font-medium text-green-600">
                  {formatCurrency(invoice.amountPaid)}
                </span>
              </div>
              <div className="flex justify-between border-t pt-2 text-sm">
                <span className="text-muted-foreground">Amount Due:</span>
                <span className="font-bold text-orange-600">
                  {formatCurrency(invoice.amountDue)}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">
                Payment Amount <span className="text-red-500">*</span>
              </Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                {...register("amount", { valueAsNumber: true })}
                placeholder="0.00"
              />
              {errors.amount && <p className="text-sm text-red-500">{errors.amount.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="paymentDate">
                Payment Date <span className="text-red-500">*</span>
              </Label>
              <Input id="paymentDate" type="date" {...register("paymentDate")} />
              {errors.paymentDate && (
                <p className="text-sm text-red-500">{errors.paymentDate.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="paymentMethod">
                Payment Method <span className="text-red-500">*</span>
              </Label>
              <Select
                value={watch("paymentMethod")}
                onValueChange={(value) => setValue("paymentMethod", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select payment method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="check">Check</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="credit_card">Credit Card</SelectItem>
                  <SelectItem value="wire_transfer">Wire Transfer</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
              {errors.paymentMethod && (
                <p className="text-sm text-red-500">{errors.paymentMethod.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="reference">Reference Number</Label>
              <Input
                id="reference"
                {...register("reference")}
                placeholder="Check number, transaction ID, etc."
              />
              {errors.reference && (
                <p className="text-sm text-red-500">{errors.reference.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Input
                id="notes"
                {...register("notes")}
                placeholder="Additional payment details..."
              />
              {errors.notes && <p className="text-sm text-red-500">{errors.notes.message}</p>}
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={recordPayment.isPending}>
              {recordPayment.isPending ? "Recording..." : "Record Payment"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
