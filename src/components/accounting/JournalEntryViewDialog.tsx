"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { JournalEntryStatus, JournalEntryWithLines } from "@/types/accounting";

interface JournalEntryViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  journal: JournalEntryWithLines | null;
  onSuccess?: () => void;
}

export function JournalEntryViewDialog({
  open,
  onOpenChange,
  journal,
  onSuccess,
}: JournalEntryViewDialogProps) {
  const t = useTranslations("journalEntryViewDialog");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const [posting, setPosting] = useState(false);

  if (!journal) return null;

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat(locale, { style: "currency", currency: "PHP" }).format(amount);
  const formatDate = (value: string) =>
    new Date(value).toLocaleDateString(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: value.includes("T") ? "2-digit" : undefined,
      minute: value.includes("T") ? "2-digit" : undefined,
    });

  const getStatusBadge = (status: JournalEntryStatus) => {
    const colors: Record<JournalEntryStatus, string> = {
      draft: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
      posted: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
      cancelled: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
    };

    return (
      <Badge className={colors[status]} variant="secondary">
        {tCommon(status).toUpperCase()}
      </Badge>
    );
  };

  const isBalanced = Math.abs(journal.totalDebit - journal.totalCredit) < 0.01;

  const handlePost = async () => {
    try {
      setPosting(true);
      const response = await fetch(`/api/accounting/journals/${journal.id}/post`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || t("postError"));
      }

      toast.success(t("postSuccess"), {
        description: t("postSuccessDescription", { journalCode: journal.journalCode }),
      });
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("postError"));
    } finally {
      setPosting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span>{t("title", { journalCode: journal.journalCode })}</span>
            {getStatusBadge(journal.status)}
          </DialogTitle>
          <DialogDescription>{journal.description || t("noDescription")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-4 rounded-lg bg-muted/50 p-4">
            <div>
              <div className="text-sm text-muted-foreground">{t("postingDate")}</div>
              <div className="font-semibold">{formatDate(journal.postingDate)}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">{t("sourceModule")}</div>
              <div className="font-semibold">{journal.sourceModule}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">{t("referenceCode")}</div>
              <div className="font-mono font-semibold">{journal.referenceCode || tCommon("no")}</div>
            </div>
            {journal.postedAt && (
              <div>
                <div className="text-sm text-muted-foreground">{t("postedAt")}</div>
                <div className="font-semibold">{formatDate(journal.postedAt)}</div>
              </div>
            )}
          </div>

          <div>
            <h4 className="mb-3 text-sm font-medium">{t("journalLines")}</h4>
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">{t("lineNumber")}</TableHead>
                    <TableHead>{t("account")}</TableHead>
                    <TableHead>{t("descriptionLabel")}</TableHead>
                    <TableHead className="w-[150px] text-right">{t("debit")}</TableHead>
                    <TableHead className="w-[150px] text-right">{t("credit")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {journal.lines.map((line) => (
                    <TableRow key={line.id}>
                      <TableCell className="text-center font-mono">{line.lineNumber}</TableCell>
                      <TableCell>
                        <div className="font-medium">{line.account?.accountName}</div>
                        <div className="font-mono text-sm text-muted-foreground">{line.account?.accountNumber}</div>
                      </TableCell>
                      <TableCell className="text-sm">{line.description || tCommon("no")}</TableCell>
                      <TableCell className="text-right font-mono">
                        {line.debit > 0 ? formatCurrency(line.debit) : "-"}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {line.credit > 0 ? formatCurrency(line.credit) : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/50 font-bold">
                    <TableCell colSpan={3} className="text-right">{t("totals")}</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(journal.totalDebit)}</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(journal.totalCredit)}</TableCell>
                  </TableRow>
                  <TableRow className={isBalanced ? "bg-green-50 dark:bg-green-950" : "bg-red-50 dark:bg-red-950"}>
                    <TableCell colSpan={3} className="text-right font-semibold">
                      {isBalanced ? (
                        <span className="flex items-center justify-end gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                          {t("balanced").toUpperCase()}
                        </span>
                      ) : (
                        `⚠ ${t("outOfBalance").toUpperCase()}`
                      )}
                    </TableCell>
                    <TableCell colSpan={2} className="text-right font-semibold">
                      {t("difference", { amount: formatCurrency(Math.abs(journal.totalDebit - journal.totalCredit)) })}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 rounded-lg bg-muted/50 p-4 text-sm">
            <div>
              <div className="text-muted-foreground">{t("createdAt")}</div>
              <div>{formatDate(journal.createdAt)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">{t("lastUpdated")}</div>
              <div>{formatDate(journal.updatedAt)}</div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={posting}>
            {tCommon("close")}
          </Button>
          {journal.status === "draft" && (
            <Button onClick={handlePost} disabled={posting || !isBalanced}>
              {posting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("posting")}
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  {t("postToGl")}
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
