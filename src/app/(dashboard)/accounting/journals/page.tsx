"use client";

import { useState, useEffect, useCallback } from "react";
import { useLocale, useTranslations } from "next-intl";
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
import { Plus, Search, Eye, FileText } from "lucide-react";
import { MetricCard } from "@/components/shared/MetricCard";
import type {
  JournalEntryWithLines,
  JournalEntryStatus,
  JournalSourceModule,
} from "@/types/accounting";
import { JournalEntryFormDialog } from "@/components/accounting/JournalEntryFormDialog";
import { JournalEntryViewDialog } from "@/components/accounting/JournalEntryViewDialog";
import { DataTablePagination } from "@/components/shared/DataTablePagination";

export default function JournalsPage() {
  const t = useTranslations("journalsPage");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const [journals, setJournals] = useState<JournalEntryWithLines[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<JournalEntryStatus | "all">("all");
  const [sourceModuleFilter, setSourceModuleFilter] = useState<JournalSourceModule | "all">("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [showFormDialog, setShowFormDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [selectedJournal, setSelectedJournal] = useState<JournalEntryWithLines | null>(null);

  const fetchJournals = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append("page", String(currentPage));
      params.append("limit", String(pageSize));

      if (searchTerm.trim()) {
        params.append("search", searchTerm.trim());
      }

      if (statusFilter !== "all") {
        params.append("status", statusFilter);
      }

      if (sourceModuleFilter !== "all") {
        params.append("sourceModule", sourceModuleFilter);
      }

      const response = await fetch(`/api/accounting/journals?${params.toString()}`);

      if (!response.ok) {
        throw new Error("Failed to fetch journals");
      }

      const result = await response.json();
      setJournals(result.data || []);
      setCurrentPage(result.pagination?.page || 1);
      setTotalPages(Math.max(1, result.pagination?.totalPages || 1));
      setTotalItems(result.pagination?.total || 0);
    } catch {
    } finally {
      setLoading(false);
    }
  }, [searchTerm, statusFilter, sourceModuleFilter, currentPage, pageSize]);

  useEffect(() => {
    fetchJournals();
  }, [fetchJournals]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, sourceModuleFilter]);

  const getStatusBadge = (status: JournalEntryStatus) => {
    const colors: Record<JournalEntryStatus, string> = {
      draft: "bg-yellow-100 text-yellow-800",
      posted: "bg-green-100 text-green-800",
      cancelled: "bg-red-100 text-red-800",
    };

    return (
      <Badge className={colors[status]} variant="secondary">
        {(status === "posted" ? t("posted") : status === "draft" ? t("draft") : tCommon("cancelled")).toUpperCase()}
      </Badge>
    );
  };

  const getSourceModuleBadge = (module: JournalSourceModule) => {
    const colors: Record<JournalSourceModule, string> = {
      AR: "bg-blue-100 text-blue-800",
      AP: "bg-purple-100 text-purple-800",
      Inventory: "bg-orange-100 text-orange-800",
      Manual: "bg-gray-100 text-gray-800",
      COGS: "bg-yellow-100 text-yellow-800",
    };

    return (
      <Badge className={colors[module]} variant="secondary">
        {module === "AR" ? t("ar") : module === "AP" ? t("ap") : module === "Inventory" ? t("inventory") : module === "Manual" ? t("manual") : module}
      </Badge>
    );
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "PHP",
    }).format(amount);
  };

  const handleViewJournal = (journal: JournalEntryWithLines) => {
    setSelectedJournal(journal);
    setShowViewDialog(true);
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t("title")}</h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Button onClick={() => setShowFormDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {t("newJournalEntry")}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-muted-foreground" />
          <Input
            placeholder={t("searchPlaceholder")}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <Select
          value={statusFilter}
          onValueChange={(value) => setStatusFilter(value as JournalEntryStatus | "all")}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder={tCommon("status")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{tCommon("allStatuses")}</SelectItem>
            <SelectItem value="draft">{t("draft")}</SelectItem>
            <SelectItem value="posted">{t("posted")}</SelectItem>
            <SelectItem value="cancelled">{tCommon("cancelled")}</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={sourceModuleFilter}
          onValueChange={(value) => setSourceModuleFilter(value as JournalSourceModule | "all")}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder={t("source")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allSources")}</SelectItem>
            <SelectItem value="AR">{t("ar")}</SelectItem>
            <SelectItem value="AP">{t("ap")}</SelectItem>
            <SelectItem value="COGS">COGS</SelectItem>
            <SelectItem value="Inventory">{t("inventory")}</SelectItem>
            <SelectItem value="Manual">{t("manual")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <MetricCard title={t("totalEntries")} icon={FileText} value={String(totalItems)} />
        <MetricCard
          title={t("posted")}
          icon={FileText}
          iconClassName="h-4 w-4 text-green-600"
          value={String(journals.filter((j) => j.status === "posted").length)}
          valueClassName="text-2xl font-bold text-green-600"
        />
        <MetricCard
          title={t("draft")}
          icon={FileText}
          iconClassName="h-4 w-4 text-yellow-600"
          value={String(journals.filter((j) => j.status === "draft").length)}
          valueClassName="text-2xl font-bold text-yellow-600"
        />
        <MetricCard
          title={t("totalDebits")}
          icon={FileText}
          value={formatCurrency(journals.reduce((sum, j) => sum + Number(j.totalDebit), 0))}
        />
      </div>

      {/* Table */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("journalCode")}</TableHead>
              <TableHead>{t("date")}</TableHead>
              <TableHead>{t("source")}</TableHead>
              <TableHead>{t("reference")}</TableHead>
              <TableHead>{tCommon("description")}</TableHead>
              <TableHead className="text-right">{t("debit")}</TableHead>
              <TableHead className="text-right">{t("credit")}</TableHead>
              <TableHead>{tCommon("status")}</TableHead>
              <TableHead className="text-right">{tCommon("actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} className="py-8 text-center">
                  {t("loading")}
                </TableCell>
              </TableRow>
            ) : journals.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">
                  {t("empty")}
                </TableCell>
              </TableRow>
            ) : (
              journals.map((journal) => (
                <TableRow key={journal.id}>
                  <TableCell className="font-mono font-medium">{journal.journalCode}</TableCell>
                  <TableCell>{new Date(journal.postingDate).toLocaleDateString(locale, { year: "numeric", month: "short", day: "numeric" })}</TableCell>
                  <TableCell>{getSourceModuleBadge(journal.sourceModule)}</TableCell>
                  <TableCell className="font-mono text-sm">
                    {journal.referenceCode || "-"}
                  </TableCell>
                  <TableCell className="max-w-xs truncate">{journal.description || "-"}</TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrency(Number(journal.totalDebit))}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrency(Number(journal.totalCredit))}
                  </TableCell>
                  <TableCell>{getStatusBadge(journal.status)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewJournal(journal)}
                        title={t("viewJournalEntry")}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" title={t("printJournalEntry")}>
                        <FileText className="h-4 w-4" />
                      </Button>
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

      {/* Journal Entry Form Dialog */}
      <JournalEntryFormDialog
        open={showFormDialog}
        onOpenChange={setShowFormDialog}
        onSuccess={fetchJournals}
      />

      {/* Journal Entry View Dialog */}
      <JournalEntryViewDialog
        open={showViewDialog}
        onOpenChange={setShowViewDialog}
        journal={selectedJournal}
        onSuccess={fetchJournals}
      />
    </div>
  );
}
