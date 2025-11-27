"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Account, CreateJournalLineRequest } from "@/types/accounting";

interface JournalEntryFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface JournalLine extends CreateJournalLineRequest {
  tempId: string;
}

export function JournalEntryFormDialog({
  open,
  onOpenChange,
  onSuccess,
}: JournalEntryFormDialogProps) {
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [postingDate, setPostingDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [description, setDescription] = useState("");
  const [referenceCode, setReferenceCode] = useState("");
  const [lines, setLines] = useState<JournalLine[]>([
    {
      tempId: crypto.randomUUID(),
      accountId: "",
      debit: 0,
      credit: 0,
      description: "",
    },
    {
      tempId: crypto.randomUUID(),
      accountId: "",
      debit: 0,
      credit: 0,
      description: "",
    },
  ]);

  useEffect(() => {
    if (open) {
      fetchAccounts();
    }
  }, [open]);

  const fetchAccounts = async () => {
    try {
      const response = await fetch("/api/accounting/accounts");
      if (!response.ok) {
        throw new Error("Failed to fetch accounts");
      }
      const result = await response.json();
      setAccounts(result.data || []);
    } catch (error) {
      console.error("Error fetching accounts:", error);
      toast.error("Failed to load accounts");
    }
  };

  const addLine = () => {
    setLines([
      ...lines,
      {
        tempId: crypto.randomUUID(),
        accountId: "",
        debit: 0,
        credit: 0,
        description: "",
      },
    ]);
  };

  const removeLine = (tempId: string) => {
    if (lines.length <= 2) {
      toast.error("Journal entry must have at least 2 lines");
      return;
    }
    setLines(lines.filter((line) => line.tempId !== tempId));
  };

  const updateLine = (tempId: string, field: keyof JournalLine, value: any) => {
    setLines(
      lines.map((line) =>
        line.tempId === tempId ? { ...line, [field]: value } : line
      )
    );
  };

  const calculateTotals = () => {
    const totalDebit = lines.reduce((sum, line) => sum + Number(line.debit), 0);
    const totalCredit = lines.reduce((sum, line) => sum + Number(line.credit), 0);
    return { totalDebit, totalCredit, difference: totalDebit - totalCredit };
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);

      // Validation
      const { totalDebit, totalCredit, difference } = calculateTotals();

      if (Math.abs(difference) > 0.01) {
        toast.error("Journal entry is not balanced", {
          description: `Debits: ₱${totalDebit.toFixed(2)}, Credits: ₱${totalCredit.toFixed(2)}`,
        });
        return;
      }

      if (lines.some((line) => !line.accountId)) {
        toast.error("All lines must have an account selected");
        return;
      }

      if (totalDebit === 0 || totalCredit === 0) {
        toast.error("Journal entry must have both debits and credits");
        return;
      }

      // Prepare request
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
        throw new Error(error.error || "Failed to create journal entry");
      }

      const result = await response.json();

      toast.success("Journal entry created successfully", {
        description: `Journal Code: ${result.data.journalCode}`,
      });

      // Reset form
      setPostingDate(new Date().toISOString().split("T")[0]);
      setDescription("");
      setReferenceCode("");
      setLines([
        {
          tempId: crypto.randomUUID(),
          accountId: "",
          debit: 0,
          credit: 0,
          description: "",
        },
        {
          tempId: crypto.randomUUID(),
          accountId: "",
          debit: 0,
          credit: 0,
          description: "",
        },
      ]);

      onOpenChange(false);
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error("Error creating journal entry:", error);
      toast.error(error instanceof Error ? error.message : "Failed to create journal entry");
    } finally {
      setLoading(false);
    }
  };

  const totals = calculateTotals();
  const isBalanced = Math.abs(totals.difference) < 0.01;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Manual Journal Entry</DialogTitle>
          <DialogDescription>
            Create a manual journal entry with debit and credit lines
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Header Information */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="postingDate">Posting Date *</Label>
              <Input
                id="postingDate"
                type="date"
                value={postingDate}
                onChange={(e) => setPostingDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="referenceCode">Reference Code</Label>
              <Input
                id="referenceCode"
                placeholder="e.g., REF-001"
                value={referenceCode}
                onChange={(e) => setReferenceCode(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                placeholder="Enter description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>

          {/* Journal Lines */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label>Journal Lines *</Label>
              <Button type="button" variant="outline" size="sm" onClick={addLine}>
                <Plus className="mr-2 h-4 w-4" />
                Add Line
              </Button>
            </div>

            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[300px]">Account</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right w-[150px]">Debit</TableHead>
                    <TableHead className="text-right w-[150px]">Credit</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((line) => (
                    <TableRow key={line.tempId}>
                      <TableCell>
                        <Select
                          value={line.accountId}
                          onValueChange={(value) =>
                            updateLine(line.tempId, "accountId", value)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select account" />
                          </SelectTrigger>
                          <SelectContent>
                            {accounts
                              .filter((acc) => acc.isActive)
                              .map((account) => (
                                <SelectItem key={account.id} value={account.id}>
                                  {account.accountNumber} - {account.accountName}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          placeholder="Line description"
                          value={line.description}
                          onChange={(e) =>
                            updateLine(line.tempId, "description", e.target.value)
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
                            updateLine(
                              line.tempId,
                              "debit",
                              e.target.value === "" ? 0 : parseFloat(e.target.value)
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
                            updateLine(
                              line.tempId,
                              "credit",
                              e.target.value === "" ? 0 : parseFloat(e.target.value)
                            )
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeLine(line.tempId)}
                          disabled={lines.length <= 2}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {/* Totals Row */}
                  <TableRow className="font-bold bg-muted/50">
                    <TableCell colSpan={2} className="text-right">
                      TOTALS:
                    </TableCell>
                    <TableCell className="text-right">
                      ₱{totals.totalDebit.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      ₱{totals.totalCredit.toFixed(2)}
                    </TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                  {/* Balance Check Row */}
                  <TableRow className={isBalanced ? "bg-green-50 dark:bg-green-950" : "bg-red-50 dark:bg-red-950"}>
                    <TableCell colSpan={2} className="text-right font-semibold">
                      {isBalanced ? "✓ BALANCED" : "⚠ OUT OF BALANCE"}
                    </TableCell>
                    <TableCell colSpan={2} className="text-right font-semibold">
                      Difference: ₱{Math.abs(totals.difference).toFixed(2)}
                    </TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Instructions */}
          <div className="text-sm text-muted-foreground space-y-1">
            <p>• Journal entry will be created in DRAFT status</p>
            <p>• Total debits must equal total credits</p>
            <p>• Use the Post action to post the journal entry to the General Ledger</p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading || !isBalanced}>
            {loading ? "Creating..." : "Create Journal Entry"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
