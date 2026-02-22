"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Search, Download, Printer } from "lucide-react";
import type { Account, AccountLedger } from "@/types/accounting";
import { format } from "date-fns";

export default function GeneralLedgerPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [ledger, setLedger] = useState<AccountLedger | null>(null);
  const [loading, setLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState(() => {
    const date = new Date();
    date.setDate(1); // First day of current month
    return date.toISOString().split("T")[0];
  });
  const [dateTo, setDateTo] = useState(() => {
    return new Date().toISOString().split("T")[0];
  });

  const fetchAccounts = useCallback(async () => {
    try {
      const response = await fetch("/api/accounting/accounts?isActive=true&page=1&limit=50");

      if (!response.ok) {
        throw new Error("Failed to fetch accounts");
      }

      const result = await response.json();
      setAccounts(result.data || []);
    } catch {}
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const fetchLedger = async () => {
    if (!selectedAccountId || !dateFrom || !dateTo) {
      return;
    }

    try {
      setLoading(true);
      const params = new URLSearchParams({
        accountId: selectedAccountId,
        dateFrom,
        dateTo,
      });

      const response = await fetch(`/api/accounting/ledger?${params.toString()}`);

      if (!response.ok) {
        throw new Error("Failed to fetch ledger");
      }

      const result = await response.json();
      setLedger(result.data);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
    }).format(amount);
  };

  const getBalanceColor = (balance: number) => {
    if (balance > 0) return "text-green-600";
    if (balance < 0) return "text-red-600";
    return "text-gray-600";
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">General Ledger</h1>
          <p className="text-muted-foreground">View detailed account transactions</p>
        </div>
        {ledger && (
          <div className="flex gap-2">
            <Button variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
            <Button variant="outline">
              <Printer className="mr-2 h-4 w-4" />
              Print
            </Button>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="space-y-4 rounded-lg border p-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="space-y-2">
            <Label>Account</Label>
            <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
              <SelectTrigger>
                <SelectValue placeholder="Select account..." />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.accountNumber} - {account.accountName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>From Date</Label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>To Date</Label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>

          <div className="flex items-end">
            <Button
              onClick={fetchLedger}
              disabled={!selectedAccountId || !dateFrom || !dateTo || loading}
              className="w-full"
            >
              <Search className="mr-2 h-4 w-4" />
              {loading ? "Loading..." : "View Ledger"}
            </Button>
          </div>
        </div>
      </div>

      {/* Ledger Report */}
      {ledger && (
        <div className="space-y-4">
          {/* Account Info */}
          <div className="rounded-lg border p-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <div className="text-sm text-muted-foreground">Account</div>
                <div className="text-lg font-semibold">
                  {ledger.account.accountNumber} - {ledger.account.accountName}
                </div>
                <Badge className="mt-1">{ledger.account.accountType.toUpperCase()}</Badge>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">Opening Balance</div>
                  <div
                    className={`text-lg font-semibold ${getBalanceColor(ledger.openingBalance)}`}
                  >
                    {formatCurrency(ledger.openingBalance)}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Closing Balance</div>
                  <div
                    className={`text-lg font-semibold ${getBalanceColor(ledger.closingBalance)}`}
                  >
                    {formatCurrency(ledger.closingBalance)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-lg border p-4">
              <div className="text-sm text-muted-foreground">Total Debits</div>
              <div className="text-2xl font-bold text-blue-600">
                {formatCurrency(ledger.totalDebits)}
              </div>
            </div>
            <div className="rounded-lg border p-4">
              <div className="text-sm text-muted-foreground">Total Credits</div>
              <div className="text-2xl font-bold text-purple-600">
                {formatCurrency(ledger.totalCredits)}
              </div>
            </div>
            <div className="rounded-lg border p-4">
              <div className="text-sm text-muted-foreground">Net Change</div>
              <div
                className={`text-2xl font-bold ${getBalanceColor(ledger.closingBalance - ledger.openingBalance)}`}
              >
                {formatCurrency(ledger.closingBalance - ledger.openingBalance)}
              </div>
            </div>
          </div>

          {/* Transactions Table */}
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Journal Code</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead className="text-right">Debit</TableHead>
                  <TableHead className="text-right">Credit</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* Opening Balance Row */}
                <TableRow className="bg-muted/50">
                  <TableCell colSpan={7} className="font-medium">
                    Opening Balance
                  </TableCell>
                  <TableCell
                    className={`text-right font-mono font-semibold ${getBalanceColor(ledger.openingBalance)}`}
                  >
                    {formatCurrency(ledger.openingBalance)}
                  </TableCell>
                </TableRow>

                {/* Ledger Entries */}
                {ledger.entries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                      No transactions found for the selected period
                    </TableCell>
                  </TableRow>
                ) : (
                  ledger.entries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>{format(new Date(entry.postingDate), "MMM dd, yyyy")}</TableCell>
                      <TableCell className="font-mono">{entry.journalCode}</TableCell>
                      <TableCell className="max-w-xs truncate">
                        {entry.description || "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{entry.sourceModule}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {entry.referenceCode || "-"}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {entry.debit > 0 ? formatCurrency(entry.debit) : "-"}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {entry.credit > 0 ? formatCurrency(entry.credit) : "-"}
                      </TableCell>
                      <TableCell
                        className={`text-right font-mono font-semibold ${getBalanceColor(entry.balance)}`}
                      >
                        {formatCurrency(entry.balance)}
                      </TableCell>
                    </TableRow>
                  ))
                )}

                {/* Closing Balance Row */}
                <TableRow className="bg-muted/50 font-bold">
                  <TableCell colSpan={5}>Closing Balance</TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrency(ledger.totalDebits)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrency(ledger.totalCredits)}
                  </TableCell>
                  <TableCell
                    className={`text-right font-mono font-semibold ${getBalanceColor(ledger.closingBalance)}`}
                  >
                    {formatCurrency(ledger.closingBalance)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
