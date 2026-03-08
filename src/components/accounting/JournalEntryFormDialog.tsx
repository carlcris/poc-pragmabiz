"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import type { Account, CreateJournalLineRequest } from "@/types/accounting";

type JournalEntryFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
};

type JournalLine = CreateJournalLineRequest & {
  tempId: string;
};

const createEmptyLine = (): JournalLine => ({
  tempId: crypto.randomUUID(),
  accountId: "",
  debit: 0,
  credit: 0,
  description: "",
});

export function JournalEntryFormDialog({
  open,
  onOpenChange,
  onSuccess,
}: JournalEntryFormDialogProps) {
  const t = useTranslations("journalEntryFormDialog");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [postingDate, setPostingDate] = useState(new Date().toISOString().split("T")[0]);
  const [description, setDescription] = useState("");
  const [referenceCode, setReferenceCode] = useState("");
  const [lines, setLines] = useState<JournalLine[]>([createEmptyLine(), createEmptyLine()]);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat(locale, { style: "currency", currency: "PHP" }).format(amount);

  useEffect(() => {
    if (!open) return;

    const fetchAccounts = async () => {
      try {
        const response = await fetch("/api/accounting/accounts?isActive=true&page=1&limit=100");
        if (!response.ok) {
          throw new Error();
        }
        const result = await response.json();
        setAccounts(result.data || []);
      } catch {
        toast.error(t("loadAccountsError"));
      }
    };

    void fetchAccounts();
  }, [open, t]);

  const calculateTotals = () => {
    const totalDebit = lines.reduce((sum, line) => sum + Number(line.debit), 0);
    const totalCredit = lines.reduce((sum, line) => sum + Number(line.credit), 0);
    return { totalDebit, totalCredit, difference: totalDebit - totalCredit };
  };

  const totals = calculateTotals();
  const isBalanced = Math.abs(totals.difference) < 0.01;

  const handleSubmit = async () => {
    try {
      setLoading(true);

      if (!isBalanced) {
        toast.error(t("unbalancedError"), {
          description: t("unbalancedDescription", {
            debits: formatCurrency(totals.totalDebit),
            credits: formatCurrency(totals.totalCredit),
          }),
        });
        return;
      }

      if (lines.some((line) => !line.accountId)) {
        toast.error(t("accountRequiredError"));
        return;
      }

      if (totals.totalDebit === 0 || totals.totalCredit === 0) {
        toast.error(t("debitCreditRequiredError"));
        return;
      }

      const payload = {
        postingDate,
        description: description || undefined,
        referenceCode: referenceCode || undefined,
        sourceModule: "Manual" as const,
        lines: lines.map((line) => ({
          accountId: line.accountId,
          debit: Number(line.debit),
          credit: Number(line.credit),
          description: line.description || undefined,
        })),
      };

      const response = await fetch("/api/accounting/journals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || t("createError"));
      }

      const result = await response.json();
      toast.success(t("createSuccess"), {
        description: t("createSuccessDescription", { journalCode: result.data.journalCode }),
      });

      setPostingDate(new Date().toISOString().split("T")[0]);
      setDescription("");
      setReferenceCode("");
      setLines([createEmptyLine(), createEmptyLine()]);
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("createError"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-6xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="postingDate">{t("postingDate")} *</Label>
              <Input id="postingDate" type="date" value={postingDate} onChange={(e) => setPostingDate(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="referenceCode">{t("referenceCode")}</Label>
              <Input id="referenceCode" placeholder={t("referencePlaceholder")} value={referenceCode} onChange={(e) => setReferenceCode(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">{t("descriptionLabel")}</Label>
              <Input id="description" placeholder={t("descriptionPlaceholder")} value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>{t("journalLines")} *</Label>
              <Button type="button" variant="outline" size="sm" onClick={() => setLines((current) => [...current, createEmptyLine()])}>
                <Plus className="mr-2 h-4 w-4" />
                {t("addLine")}
              </Button>
            </div>

            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[300px]">{t("account")}</TableHead>
                    <TableHead>{t("descriptionLabel")}</TableHead>
                    <TableHead className="w-[150px] text-right">{t("debit")}</TableHead>
                    <TableHead className="w-[150px] text-right">{t("credit")}</TableHead>
                    <TableHead className="w-[50px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((line) => (
                    <TableRow key={line.tempId}>
                      <TableCell>
                        <Select
                          value={line.accountId}
                          onValueChange={(value) =>
                            setLines((current) =>
                              current.map((entry) =>
                                entry.tempId === line.tempId ? { ...entry, accountId: value } : entry
                              )
                            )
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={t("selectAccount")} />
                          </SelectTrigger>
                          <SelectContent>
                            {accounts.filter((account) => account.isActive).map((account) => (
                              <SelectItem key={account.id} value={account.id}>
                                {account.accountNumber} - {account.accountName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          placeholder={t("lineDescriptionPlaceholder")}
                          value={line.description}
                          onChange={(e) =>
                            setLines((current) =>
                              current.map((entry) =>
                                entry.tempId === line.tempId
                                  ? { ...entry, description: e.target.value }
                                  : entry
                              )
                            )
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          className="text-right"
                          value={line.debit}
                          onChange={(e) =>
                            setLines((current) =>
                              current.map((entry) =>
                                entry.tempId === line.tempId
                                  ? {
                                      ...entry,
                                      debit: e.target.value === "" ? 0 : parseFloat(e.target.value),
                                    }
                                  : entry
                              )
                            )
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          className="text-right"
                          value={line.credit}
                          onChange={(e) =>
                            setLines((current) =>
                              current.map((entry) =>
                                entry.tempId === line.tempId
                                  ? {
                                      ...entry,
                                      credit: e.target.value === "" ? 0 : parseFloat(e.target.value),
                                    }
                                  : entry
                              )
                            )
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (lines.length <= 2) {
                              toast.error(t("minLinesError"));
                              return;
                            }
                            setLines((current) => current.filter((entry) => entry.tempId !== line.tempId));
                          }}
                          disabled={lines.length <= 2}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/50 font-bold">
                    <TableCell colSpan={2} className="text-right">{t("totals")}</TableCell>
                    <TableCell className="text-right">{formatCurrency(totals.totalDebit)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(totals.totalCredit)}</TableCell>
                    <TableCell />
                  </TableRow>
                  <TableRow className={isBalanced ? "bg-green-50 dark:bg-green-950" : "bg-red-50 dark:bg-red-950"}>
                    <TableCell colSpan={2} className="text-right font-semibold">
                      {isBalanced ? `✓ ${t("balanced").toUpperCase()}` : `⚠ ${t("notBalanced").toUpperCase()}`}
                    </TableCell>
                    <TableCell colSpan={2} className="text-right font-semibold">
                      {t("difference")}: {formatCurrency(Math.abs(totals.difference))}
                    </TableCell>
                    <TableCell />
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            {tCommon("cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={loading || !isBalanced}>
            {loading ? t("creating") : t("createAction")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
