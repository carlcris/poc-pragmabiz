"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { z } from "zod";
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
import { createRecordPaymentSchema } from "@/lib/validations/invoice";
import { useCurrency } from "@/hooks/useCurrency";
import type { Invoice } from "@/types/invoice";

interface RecordPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: Invoice | null;
}

export function RecordPaymentDialog({ open, onOpenChange, invoice }: RecordPaymentDialogProps) {
  const t = useTranslations("recordPaymentDialog");
  const { formatCurrency } = useCurrency();
  const recordPaymentSchema = createRecordPaymentSchema((key) => t(key));
  type RecordPaymentInput = z.input<typeof recordPaymentSchema>;
  const recordPayment = useRecordPayment({
    success: t("recordSuccess"),
    error: t("recordError"),
  });

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
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description", { invoiceNumber: invoice.invoiceNumber })}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-4">
            <div className="space-y-2 rounded-md bg-muted p-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t("totalAmount")}:</span>
                <span className="font-medium">{formatCurrency(invoice.totalAmount)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t("amountPaid")}:</span>
                <span className="font-medium text-green-600">{formatCurrency(invoice.amountPaid)}</span>
              </div>
              <div className="flex justify-between border-t pt-2 text-sm">
                <span className="text-muted-foreground">{t("amountDue")}:</span>
                <span className="font-bold text-orange-600">{formatCurrency(invoice.amountDue)}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">{t("paymentAmount")} <span className="text-red-500">*</span></Label>
              <Input id="amount" type="number" step="0.01" {...register("amount", { valueAsNumber: true })} placeholder="0.00" />
              {errors.amount && <p className="text-sm text-red-500">{errors.amount.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="paymentDate">{t("paymentDate")} <span className="text-red-500">*</span></Label>
              <Input id="paymentDate" type="date" {...register("paymentDate")} />
              {errors.paymentDate && <p className="text-sm text-red-500">{errors.paymentDate.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="paymentMethod">{t("paymentMethod")} <span className="text-red-500">*</span></Label>
              <Select value={watch("paymentMethod")} onValueChange={(value) => setValue("paymentMethod", value)}>
                <SelectTrigger>
                  <SelectValue placeholder={t("selectPaymentMethod")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank_transfer">{t("bankTransfer")}</SelectItem>
                  <SelectItem value="check">{t("check")}</SelectItem>
                  <SelectItem value="cash">{t("cash")}</SelectItem>
                  <SelectItem value="credit_card">{t("creditCard")}</SelectItem>
                  <SelectItem value="wire_transfer">{t("wireTransfer")}</SelectItem>
                  <SelectItem value="other">{t("other")}</SelectItem>
                </SelectContent>
              </Select>
              {errors.paymentMethod && <p className="text-sm text-red-500">{errors.paymentMethod.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="reference">{t("referenceNumber")}</Label>
              <Input id="reference" {...register("reference")} placeholder={t("referencePlaceholder")} />
              {errors.reference && <p className="text-sm text-red-500">{errors.reference.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">{t("notes")}</Label>
              <Input id="notes" {...register("notes")} placeholder={t("notesPlaceholder")} />
              {errors.notes && <p className="text-sm text-red-500">{errors.notes.message}</p>}
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t("cancel")}</Button>
            <Button type="submit" disabled={recordPayment.isPending}>
              {recordPayment.isPending ? t("recording") : t("recordPayment")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
