"use client";

import { useState } from "react";
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
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import type { JournalEntryWithLines, JournalEntryStatus } from "@/types/accounting";

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
  const [posting, setPosting] = useState(false);

  if (!journal) return null;

  const handlePost = async () => {
    try {
      setPosting(true);

      const response = await fetch(`/api/accounting/journals/${journal.id}/post`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to post journal entry");
      }

      toast.success("Journal entry posted successfully", {
        description: `${journal.journalCode} has been posted to the General Ledger`,
      });

      onOpenChange(false);
      if (onSuccess) onSuccess();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to post journal entry");
    } finally {
      setPosting(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
    }).format(amount);
  };

  const getStatusBadge = (status: JournalEntryStatus) => {
    const colors: Record<JournalEntryStatus, string> = {
      draft: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
      posted: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
      cancelled: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
    };

    return (
      <Badge className={colors[status]} variant="secondary">
        {status.toUpperCase()}
      </Badge>
    );
  };

  const isBalanced = Math.abs(journal.totalDebit - journal.totalCredit) < 0.01;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span>Journal Entry: {journal.journalCode}</span>
            {getStatusBadge(journal.status)}
          </DialogTitle>
          <DialogDescription>{journal.description || "No description"}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Header Information */}
          <div className="grid grid-cols-3 gap-4 rounded-lg bg-muted/50 p-4">
            <div>
              <div className="text-sm text-muted-foreground">Posting Date</div>
              <div className="font-semibold">
                {format(new Date(journal.postingDate), "MMM dd, yyyy")}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Source Module</div>
              <div className="font-semibold">{journal.sourceModule}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Reference Code</div>
              <div className="font-mono font-semibold">{journal.referenceCode || "-"}</div>
            </div>
            {journal.postedAt && (
              <>
                <div>
                  <div className="text-sm text-muted-foreground">Posted At</div>
                  <div className="font-semibold">
                    {format(new Date(journal.postedAt), "MMM dd, yyyy HH:mm")}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Journal Lines */}
          <div>
            <h4 className="mb-3 text-sm font-medium">Journal Lines</h4>
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Line #</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="w-[150px] text-right">Debit</TableHead>
                    <TableHead className="w-[150px] text-right">Credit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {journal.lines.map((line) => (
                    <TableRow key={line.id}>
                      <TableCell className="text-center font-mono">{line.lineNumber}</TableCell>
                      <TableCell>
                        <div className="font-medium">{line.account?.accountName}</div>
                        <div className="font-mono text-sm text-muted-foreground">
                          {line.account?.accountNumber}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{line.description || "-"}</TableCell>
                      <TableCell className="text-right font-mono">
                        {line.debit > 0 ? formatCurrency(line.debit) : "-"}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {line.credit > 0 ? formatCurrency(line.credit) : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                  {/* Totals Row */}
                  <TableRow className="bg-muted/50 font-bold">
                    <TableCell colSpan={3} className="text-right">
                      TOTALS:
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(journal.totalDebit)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(journal.totalCredit)}
                    </TableCell>
                  </TableRow>
                  {/* Balance Check Row */}
                  <TableRow
                    className={
                      isBalanced ? "bg-green-50 dark:bg-green-950" : "bg-red-50 dark:bg-red-950"
                    }
                  >
                    <TableCell colSpan={3} className="text-right font-semibold">
                      {isBalanced ? (
                        <span className="flex items-center justify-end gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                          BALANCED
                        </span>
                      ) : (
                        "⚠ OUT OF BALANCE"
                      )}
                    </TableCell>
                    <TableCell colSpan={2} className="text-right font-semibold">
                      Difference:{" "}
                      {formatCurrency(Math.abs(journal.totalDebit - journal.totalCredit))}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Additional Information */}
          <div className="grid grid-cols-2 gap-4 rounded-lg bg-muted/50 p-4 text-sm">
            <div>
              <div className="text-muted-foreground">Created At</div>
              <div>{format(new Date(journal.createdAt), "MMM dd, yyyy HH:mm")}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Last Updated</div>
              <div>{format(new Date(journal.updatedAt), "MMM dd, yyyy HH:mm")}</div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={posting}>
            Close
          </Button>
          {journal.status === "draft" && (
            <Button onClick={handlePost} disabled={posting || !isBalanced}>
              {posting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Posting...
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Post to GL
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
