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
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Edit, Archive } from "lucide-react";
import type { Account, AccountType } from "@/types/accounting";
import { DataTablePagination } from "@/components/shared/DataTablePagination";

export default function ChartOfAccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [accountTypeFilter, setAccountTypeFilter] = useState<AccountType | "all">("all");
  const [activeFilter, setActiveFilter] = useState<"all" | "active" | "inactive">("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const fetchAccounts = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append("page", String(currentPage));
      params.append("limit", String(pageSize));

      if (searchTerm.trim()) {
        params.append("search", searchTerm.trim());
      }

      if (accountTypeFilter !== "all") {
        params.append("accountType", accountTypeFilter);
      }

      if (activeFilter === "active") {
        params.append("isActive", "true");
      } else if (activeFilter === "inactive") {
        params.append("isActive", "false");
      }

      const response = await fetch(`/api/accounting/accounts?${params.toString()}`);

      if (!response.ok) {
        throw new Error("Failed to fetch accounts");
      }

      const result = await response.json();
      setAccounts(result.data || []);
      setCurrentPage(result.pagination?.page || 1);
      setTotalPages(Math.max(1, result.pagination?.totalPages || 1));
      setTotalItems(result.pagination?.total || 0);
    } catch {
    } finally {
      setLoading(false);
    }
  }, [searchTerm, accountTypeFilter, activeFilter, currentPage, pageSize]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, accountTypeFilter, activeFilter]);

  const getAccountTypeBadge = (type: AccountType | undefined) => {
    if (!type) return <Badge variant="secondary">UNKNOWN</Badge>;

    const colors: Record<AccountType, string> = {
      asset: "bg-blue-100 text-blue-800",
      liability: "bg-red-100 text-red-800",
      equity: "bg-purple-100 text-purple-800",
      revenue: "bg-green-100 text-green-800",
      expense: "bg-orange-100 text-orange-800",
      cogs: "bg-yellow-100 text-yellow-800",
    };

    return (
      <Badge className={colors[type]} variant="secondary">
        {type.toUpperCase()}
      </Badge>
    );
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Chart of Accounts</h1>
          <p className="text-muted-foreground">Manage your general ledger accounts</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          New Account
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-muted-foreground" />
          <Input
            placeholder="Search by account number or name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <Select
          value={accountTypeFilter}
          onValueChange={(value) => setAccountTypeFilter(value as AccountType | "all")}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Account Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="asset">Asset</SelectItem>
            <SelectItem value="liability">Liability</SelectItem>
            <SelectItem value="equity">Equity</SelectItem>
            <SelectItem value="revenue">Revenue</SelectItem>
            <SelectItem value="expense">Expense</SelectItem>
            <SelectItem value="cogs">COGS</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={activeFilter}
          onValueChange={(value) => setActiveFilter(value as "all" | "active" | "inactive")}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-lg border p-4">
          <div className="text-sm text-muted-foreground">Total Accounts</div>
          <div className="text-2xl font-bold">{totalItems}</div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-sm text-muted-foreground">Assets</div>
          <div className="text-2xl font-bold">
            {accounts.filter((a) => a.accountType === "asset").length}
          </div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-sm text-muted-foreground">Liabilities</div>
          <div className="text-2xl font-bold">
            {accounts.filter((a) => a.accountType === "liability").length}
          </div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-sm text-muted-foreground">Revenue</div>
          <div className="text-2xl font-bold">
            {accounts.filter((a) => a.accountType === "revenue").length}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Account Number</TableHead>
              <TableHead>Account Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Level</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>System</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center">
                  Loading accounts...
                </TableCell>
              </TableRow>
            ) : accounts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  No accounts found
                </TableCell>
              </TableRow>
            ) : (
              accounts.map((account) => (
                <TableRow key={account.id}>
                  <TableCell className="font-mono">{account.accountNumber}</TableCell>
                  <TableCell className="font-medium">
                    <div style={{ paddingLeft: `${(account.level - 1) * 20}px` }}>
                      {account.accountName}
                    </div>
                  </TableCell>
                  <TableCell>{getAccountTypeBadge(account.accountType)}</TableCell>
                  <TableCell>{account.level}</TableCell>
                  <TableCell>
                    {account.isActive ? (
                      <Badge variant="default">Active</Badge>
                    ) : (
                      <Badge variant="secondary">Inactive</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {account.isSystemAccount && <Badge variant="outline">System</Badge>}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm">
                        <Edit className="h-4 w-4" />
                      </Button>
                      {!account.isSystemAccount && (
                        <Button variant="ghost" size="sm">
                          <Archive className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        {!loading && totalItems > 0 && (
          <div className="border-t px-4 py-3">
            <DataTablePagination
              currentPage={currentPage}
              totalPages={totalPages}
              pageSize={pageSize}
              totalItems={totalItems}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
            />
          </div>
        )}
      </div>
    </div>
  );
}
