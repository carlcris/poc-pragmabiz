"use client";

import { Fragment, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MoreVertical, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useLinkSRsToLoadList,
  useEligibleLoadListRequisitionItems,
  useLoadListSRLinks,
  useRemoveLoadListSRLink,
} from "@/hooks/useLoadLists";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { LOAD_LISTS_QUERY_KEY } from "@/hooks/queryKeys";
import { getApiErrorCode } from "@/lib/api";
import { formatDocumentDate, formatDocumentQuantity } from "@/lib/documents/document-display";
import { cn } from "@/lib/utils";
import { LOAD_LIST_LINK_ERROR_CODES, type LoadList, type LoadListItem } from "@/types/load-list";

type LinkStockRequisitionsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loadList: LoadList;
};

// A pending link snapshots the requisition line's outstanding quantity when it is ticked so
// links on load list items that are not currently selected can still be validated before submit.
type PendingLink = {
  loadListItemId: string;
  srItemId: string;
  srNumber: string;
  packLabel: string;
  outstandingQty: number;
  quantity: string;
};

type LoadListItemSummary = {
  item: LoadListItem;
  packLabel: string;
  linkedQty: number;
  pendingQty: number;
  remainingQty: number;
  pendingCount: number;
  hasPendingError: boolean;
};

const REQUISITION_PAGE_SIZE = 20;

const toPairKey = (loadListItemId: string, srItemId: string) => `${loadListItemId}:${srItemId}`;

const roundQuantity = (value: number) => Number(value.toFixed(2));

const parseQuantity = (value: string) => {
  const trimmed = value.trim();
  if (trimmed === "") return Number.NaN;
  return Number(trimmed);
};

const sumPendingQuantity = (
  links: PendingLink[],
  matches: (link: PendingLink) => boolean,
  excludeKey?: string
) =>
  links.reduce((total, link) => {
    if (!matches(link) || toPairKey(link.loadListItemId, link.srItemId) === excludeKey) {
      return total;
    }
    const quantity = parseQuantity(link.quantity);
    return Number.isFinite(quantity) && quantity > 0 ? total + quantity : total;
  }, 0);

export function LinkStockRequisitionsDialog({
  open,
  onOpenChange,
  loadList,
}: LinkStockRequisitionsDialogProps) {
  const t = useTranslations("linkStockRequisitionsDialog");
  const locale = useLocale();
  const queryClient = useQueryClient();
  const linkMutation = useLinkSRsToLoadList();
  const removeLinkMutation = useRemoveLoadListSRLink();
  const { data: existingLinksData } = useLoadListSRLinks(loadList.id);

  const [pendingLinks, setPendingLinks] = useState<PendingLink[]>([]);
  const [quantityDrafts, setQuantityDrafts] = useState<Record<string, string>>({});
  const [pickedItemId, setPickedItemId] = useState("");
  const [removingLinkId, setRemovingLinkId] = useState<string | null>(null);
  const [requisitionSearch, setRequisitionSearch] = useState("");
  const [requisitionPage, setRequisitionPage] = useState(1);
  const debouncedRequisitionSearch = useDebouncedValue(requisitionSearch.trim());

  const formatQuantity = (value: number) => formatDocumentQuantity(value, locale);
  const formatPackLabel = (unitName?: string | null, qtyPerUnit?: number | null) =>
    unitName && qtyPerUnit != null && qtyPerUnit !== 1
      ? t("packUnitLabel", { unit: unitName, qty: formatQuantity(qtyPerUnit) })
      : (unitName ?? "");

  const loadListItems = loadList.items ?? [];
  const canModifyLinks =
    loadList.isSourceBusinessUnit &&
    (loadList.status === "draft" || loadList.status === "confirmed");
  const canAddLinks =
    canModifyLinks || (loadList.isSourceBusinessUnit && loadList.status === "in_transit");

  const existingLinks = existingLinksData?.data ?? [];
  const existingLinkPairs = new Set(
    existingLinks
      .filter((link) => link.loadListItem?.id && link.srItem?.id)
      .map((link) => toPairKey(link.loadListItem.id, link.srItem.id))
  );
  const existingLinkedQtyByItem = existingLinks.reduce((totals, link) => {
    const loadListItemId = link.loadListItem?.id;
    if (!loadListItemId) return totals;
    totals.set(loadListItemId, (totals.get(loadListItemId) ?? 0) + link.fulfilledQty);
    return totals;
  }, new Map<string, number>());

  const getLoadListAvailableQty = (item: LoadListItem, excludeKey?: string) =>
    roundQuantity(
      item.loadListQty -
        (existingLinkedQtyByItem.get(item.id) ?? 0) -
        sumPendingQuantity(pendingLinks, (link) => link.loadListItemId === item.id, excludeKey)
    );

  const getRequisitionAvailableQty = (
    srItemId: string,
    outstandingQty: number,
    excludeKey?: string
  ) =>
    roundQuantity(
      outstandingQty -
        sumPendingQuantity(pendingLinks, (link) => link.srItemId === srItemId, excludeKey)
    );

  const pendingErrors = new Map<string, string>();
  for (const link of pendingLinks) {
    const key = toPairKey(link.loadListItemId, link.srItemId);
    const item = loadListItems.find((candidate) => candidate.id === link.loadListItemId);
    const quantity = parseQuantity(link.quantity);
    if (!item) continue;
    if (!Number.isFinite(quantity) || quantity <= 0) {
      pendingErrors.set(key, t("quantityRequired"));
      continue;
    }
    const requisitionLimit = getRequisitionAvailableQty(link.srItemId, link.outstandingQty, key);
    if (quantity > requisitionLimit) {
      pendingErrors.set(
        key,
        t("exceedOutstanding", {
          reference: link.srNumber,
          limit: formatQuantity(Math.max(0, requisitionLimit)),
          pack: link.packLabel,
        })
      );
      continue;
    }
    const loadListLimit = getLoadListAvailableQty(item, key);
    if (quantity > loadListLimit) {
      pendingErrors.set(
        key,
        t("exceedAvailableLoadListQty", {
          limit: formatQuantity(Math.max(0, loadListLimit)),
          pack: link.packLabel,
        })
      );
    }
  }

  const itemSummaries: LoadListItemSummary[] = loadListItems.map((item) => {
    const itemPendingLinks = pendingLinks.filter((link) => link.loadListItemId === item.id);
    const linkedQty = existingLinkedQtyByItem.get(item.id) ?? 0;
    const pendingQty = sumPendingQuantity(itemPendingLinks, () => true);
    return {
      item,
      packLabel: formatPackLabel(item.unitName, item.qtyPerUnit),
      linkedQty,
      pendingQty,
      remainingQty: Math.max(0, roundQuantity(item.loadListQty - linkedQty - pendingQty)),
      pendingCount: itemPendingLinks.length,
      hasPendingError: itemPendingLinks.some((link) =>
        pendingErrors.has(toPairKey(link.loadListItemId, link.srItemId))
      ),
    };
  });
  // Until the user picks an item (or if the picked item disappears after a refresh), select the
  // first item that can be matched by pack.
  const selectedSummary =
    itemSummaries.find((summary) => summary.item.id === pickedItemId) ??
    itemSummaries.find((summary) => summary.item.itemUnitOptionId) ??
    itemSummaries[0];
  const selectedItem = selectedSummary?.item;
  const selectedItemId = selectedItem?.id ?? "";

  const eligibleRequisitionItemsQuery = useEligibleLoadListRequisitionItems(
    loadList.id,
    {
      loadListItemId: selectedItem?.id,
      search: debouncedRequisitionSearch || undefined,
      page: requisitionPage,
      limit: REQUISITION_PAGE_SIZE,
    },
    open && loadList.isSourceBusinessUnit && !!selectedItem?.itemUnitOptionId
  );
  const requisitionLines = eligibleRequisitionItemsQuery.data?.data ?? [];
  const requisitionPagination = eligibleRequisitionItemsQuery.data?.pagination;
  const selectedItemLinks = existingLinks.filter(
    (link) => link.loadListItem?.id === selectedItemId
  );

  useEffect(() => {
    if (!open) return;
    setPendingLinks([]);
    setQuantityDrafts({});
    setRequisitionSearch("");
    setRequisitionPage(1);
    setPickedItemId("");
  }, [open]);

  useEffect(() => {
    setRequisitionPage(1);
  }, [debouncedRequisitionSearch]);

  const selectItem = (itemId: string) => {
    setPickedItemId(itemId);
    setRequisitionSearch("");
    setRequisitionPage(1);
  };

  const setLinePending = (link: PendingLink, selected: boolean) => {
    const key = toPairKey(link.loadListItemId, link.srItemId);
    if (selected) {
      setPendingLinks((current) => [...current, link]);
      setQuantityDrafts((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
      return;
    }
    setPendingLinks((current) =>
      current.filter((candidate) => toPairKey(candidate.loadListItemId, candidate.srItemId) !== key)
    );
    setQuantityDrafts((current) => ({ ...current, [key]: link.quantity }));
  };

  const changeLineQuantity = (link: PendingLink, isPending: boolean) => {
    if (!isPending) {
      setLinePending(link, true);
      return;
    }
    const key = toPairKey(link.loadListItemId, link.srItemId);
    setPendingLinks((current) =>
      current.map((candidate) =>
        toPairKey(candidate.loadListItemId, candidate.srItemId) === key
          ? { ...candidate, quantity: link.quantity }
          : candidate
      )
    );
  };

  const handleRemoveExistingLink = async (linkId: string) => {
    setRemovingLinkId(linkId);
    try {
      await removeLinkMutation.mutateAsync({ id: loadList.id, linkId });
      toast.success(t("removeLinkSuccess"));
    } catch {
      toast.error(t("removeLinkError"));
    } finally {
      setRemovingLinkId(null);
    }
  };

  const handleSubmit = async () => {
    if (linkMutation.isPending || pendingLinks.length === 0 || pendingErrors.size > 0) return;
    if (!canAddLinks) {
      toast.error(t("loadListNotModifiable"));
      return;
    }

    try {
      await linkMutation.mutateAsync({
        id: loadList.id,
        data: {
          links: pendingLinks.map((link) => ({
            loadListItemId: link.loadListItemId,
            srItemId: link.srItemId,
            fulfilledQty: parseQuantity(link.quantity),
          })),
        },
      });

      toast.success(t("linkSuccess", { count: pendingLinks.length }));
      onOpenChange(false);
    } catch (error) {
      const errorCode = getApiErrorCode(error, LOAD_LIST_LINK_ERROR_CODES);

      if (errorCode === "LOAD_LIST_LINK_STATUS_CONFLICT") {
        toast.error(t("loadListNotModifiable"));
        return;
      }
      if (errorCode === "LOAD_LIST_ITEMS_NOT_FOUND") {
        setPendingLinks([]);
        await queryClient.invalidateQueries({ queryKey: [LOAD_LISTS_QUERY_KEY, loadList.id] });
        toast.error(t("staleLoadListItems"));
        return;
      }
      if (errorCode === "LOAD_LIST_LINK_PACK_MISMATCH") {
        await queryClient.invalidateQueries({ queryKey: [LOAD_LISTS_QUERY_KEY, loadList.id] });
        toast.error(t("packMismatch"));
        return;
      }
      toast.error(t("linkError"));
    }
  };

  const pendingItemCount = new Set(pendingLinks.map((link) => link.loadListItemId)).size;

  const renderItemStatus = (summary: LoadListItemSummary) => {
    const linkedTotal = formatQuantity(summary.linkedQty + summary.pendingQty);
    const total = formatQuantity(summary.item.loadListQty);
    if (!summary.item.itemUnitOptionId) {
      return <span className="text-muted-foreground">{t("packOptionMissing")}</span>;
    }
    if (summary.hasPendingError) {
      return <span className="text-destructive">{t("checkQuantities")}</span>;
    }
    if (summary.pendingCount > 0) {
      return (
        <span className="text-primary">
          {t("itemPendingStatus", { linked: linkedTotal, total, count: summary.pendingCount })}
        </span>
      );
    }
    if (summary.remainingQty === 0) {
      return <span className="text-emerald-700">{t("fullyLinked")}</span>;
    }
    return (
      <span className="text-muted-foreground">
        {t("itemLinkedStatus", { linked: linkedTotal, total })}
      </span>
    );
  };

  const renderRequisitionLines = () => {
    if (!selectedItem) {
      return <p className="py-10 text-center text-sm text-muted-foreground">{t("noItems")}</p>;
    }
    if (!selectedItem.itemUnitOptionId) {
      return (
        <p className="py-10 text-center text-sm text-muted-foreground">
          {t("packOptionMissingDescription")}
        </p>
      );
    }
    if (eligibleRequisitionItemsQuery.isLoading) {
      return (
        <div className="space-y-3 py-4" aria-label={t("loading")}>
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      );
    }
    if (eligibleRequisitionItemsQuery.isError) {
      return (
        <p role="alert" className="py-10 text-center text-sm text-destructive">
          {t("eligibleLoadError")}
        </p>
      );
    }
    if (requisitionLines.length === 0) {
      return (
        <div className="py-10 text-center text-sm text-muted-foreground">
          <p>{t(debouncedRequisitionSearch ? "noSearchResults" : "noRequisitionsForPack")}</p>
          <p className="mt-1">
            {t("noRequisitionsSupplier", { supplier: loadList.supplier?.name ?? "" })}
          </p>
        </div>
      );
    }

    return (
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-12">
                <span className="sr-only">{t("selectColumn")}</span>
              </TableHead>
              <TableHead>{t("requisition")}</TableHead>
              <TableHead className="text-right">{t("requested")}</TableHead>
              <TableHead className="text-right">{t("outstanding")}</TableHead>
              <TableHead className="w-40 text-right">{t("linkQty")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {requisitionLines.map((line) => {
              const key = toPairKey(selectedItem.id, line.id);
              const isLinked = existingLinkPairs.has(key);
              const pendingLink = pendingLinks.find(
                (link) => toPairKey(link.loadListItemId, link.srItemId) === key
              );
              const limit = Math.max(
                0,
                Math.min(
                  getRequisitionAvailableQty(line.id, line.outstandingQty, key),
                  getLoadListAvailableQty(selectedItem, key)
                )
              );
              const quantity =
                pendingLink?.quantity ?? quantityDrafts[key] ?? (limit > 0 ? String(limit) : "");
              const lineLink: PendingLink = {
                loadListItemId: selectedItem.id,
                srItemId: line.id,
                srNumber: line.stockRequisitionNumber,
                packLabel: formatPackLabel(line.unitName, line.qtyPerUnit),
                outstandingQty: line.outstandingQty,
                quantity,
              };
              const canSelect = canAddLinks && !isLinked && (!!pendingLink || limit > 0);
              const error = pendingErrors.get(key);
              const checkboxId = `link-line-${line.id}`;
              const errorId = `${checkboxId}-error`;

              return (
                <Fragment key={line.id}>
                  <TableRow
                    data-state={pendingLink ? "selected" : undefined}
                    className={cn(error && "border-b-0")}
                  >
                    {/* Each cell's first line sits in an h-9 row so text centers on the
                        Link Qty input's line. */}
                    <TableCell className="align-top">
                      <div className="flex h-9 items-center">
                        <Checkbox
                          id={checkboxId}
                          checked={!!pendingLink || isLinked}
                          disabled={!canSelect}
                          onCheckedChange={(checked) => setLinePending(lineLink, checked === true)}
                          aria-label={t("selectLine", { reference: line.stockRequisitionNumber })}
                          className="h-5 w-5"
                        />
                      </div>
                    </TableCell>
                    <TableCell className="align-top">
                      <label htmlFor={checkboxId} className="flex h-9 items-center font-medium">
                        {line.stockRequisitionNumber}
                      </label>
                      <span className="text-xs text-muted-foreground">
                        {t("requestedOn", {
                          date: formatDocumentDate(line.requisitionDate, locale),
                        })}
                      </span>
                    </TableCell>
                    <TableCell className="align-top">
                      <span className="flex h-9 items-center justify-end tabular-nums">
                        {formatQuantity(line.requestedQty)}
                      </span>
                    </TableCell>
                    <TableCell className="align-top">
                      <span className="flex h-9 items-center justify-end tabular-nums">
                        {formatQuantity(line.outstandingQty)}
                      </span>
                    </TableCell>
                    <TableCell className="align-top">
                      {isLinked ? (
                        <p className="flex h-9 items-center justify-end text-sm text-emerald-700">
                          {t("alreadyLinkedLabel")}
                        </p>
                      ) : !pendingLink && limit === 0 ? (
                        <p className="flex h-9 items-center justify-end text-sm text-muted-foreground">
                          {t("nothingLeftToLink")}
                        </p>
                      ) : (
                        <Input
                          type="number"
                          inputMode="decimal"
                          min={0}
                          step="0.01"
                          value={quantity}
                          disabled={!canSelect}
                          onChange={(event) =>
                            changeLineQuantity(
                              { ...lineLink, quantity: event.target.value },
                              !!pendingLink
                            )
                          }
                          aria-label={t("linkQtyFor", { reference: line.stockRequisitionNumber })}
                          aria-invalid={!!error}
                          aria-describedby={error ? errorId : undefined}
                          className={cn(
                            "h-9 text-right tabular-nums",
                            pendingLink && !error && "border-primary",
                            error && "border-destructive"
                          )}
                        />
                      )}
                    </TableCell>
                  </TableRow>
                  {error ? (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={5} className="pt-0 text-right">
                        <p id={errorId} role="alert" className="text-xs text-destructive">
                          {error}
                        </p>
                      </TableCell>
                    </TableRow>
                  ) : null}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* 85vh keeps a fixed dialog height so both panes scroll independently; the preset
          height scale stops at full-screen values. */}
      <DialogContent className="flex h-[85vh] max-w-6xl flex-col gap-0 overflow-hidden p-0">
        <div className="shrink-0 border-b px-6 py-5 pr-12">
          <DialogTitle className="text-xl font-semibold">{t("title")}</DialogTitle>
          <DialogDescription className="mt-1">
            {t("description", { supplier: loadList.supplier?.name ?? "" })}
          </DialogDescription>
        </div>

        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <nav
            aria-label={t("loadListItems")}
            className="max-h-56 shrink-0 overflow-y-auto border-b bg-muted/40 p-4 lg:max-h-none lg:w-80 lg:border-b-0 lg:border-r"
          >
            <div className="mb-2 flex items-baseline justify-between px-2">
              <h3 className="text-sm font-semibold text-muted-foreground">{t("loadListItems")}</h3>
              <span className="text-xs text-muted-foreground">
                {t("itemCount", { count: loadListItems.length })}
              </span>
            </div>
            <ul className="space-y-2">
              {itemSummaries.map((summary) => {
                const isSelected = summary.item.id === selectedItemId;
                const total = summary.item.loadListQty || 1;
                return (
                  <li key={summary.item.id}>
                    <button
                      type="button"
                      onClick={() => selectItem(summary.item.id)}
                      aria-current={isSelected ? "true" : undefined}
                      className={cn(
                        "w-full space-y-2 rounded-lg border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        isSelected
                          ? "border-primary bg-background shadow-sm"
                          : "border-transparent hover:border-border hover:bg-background"
                      )}
                    >
                      <span className="block text-sm font-semibold leading-snug">
                        {summary.item.item?.name ?? t("unknownItem")}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {summary.item.item?.code ? `${summary.item.item.code} · ` : ""}
                        {summary.packLabel}
                      </span>
                      <span className="flex h-1.5 overflow-hidden rounded-full bg-border">
                        <span
                          className="bg-primary"
                          style={{ width: `${Math.min(100, (summary.linkedQty / total) * 100)}%` }}
                        />
                        <span
                          className="bg-primary/40"
                          style={{
                            width: `${Math.min(100, (summary.pendingQty / total) * 100)}%`,
                          }}
                        />
                      </span>
                      <span className="block text-xs font-medium">{renderItemStatus(summary)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          <section className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
            {selectedSummary ? (
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="text-lg font-semibold">
                    {selectedSummary.item.item?.name ?? t("unknownItem")}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {selectedSummary.item.item?.code ? `${selectedSummary.item.item.code} · ` : ""}
                    {selectedSummary.packLabel}
                  </p>
                </div>
                <p className="text-sm text-muted-foreground">
                  <span className="mr-1 text-2xl font-semibold tabular-nums text-foreground">
                    {formatQuantity(selectedSummary.remainingQty)}
                  </span>
                  {t("leftToLink", {
                    total: formatQuantity(selectedSummary.item.loadListQty),
                    unit: selectedSummary.item.unitName,
                  })}
                </p>
              </div>
            ) : null}

            {!canAddLinks ? (
              <p role="status" className="rounded-lg bg-muted px-4 py-3 text-sm">
                {t("loadListNotModifiable")}
              </p>
            ) : selectedSummary?.item.itemUnitOptionId ? (
              <p className="rounded-lg bg-primary/10 px-4 py-3 text-sm">
                {t("packMatchNote", { pack: selectedSummary.packLabel })}
              </p>
            ) : null}

            {selectedItem?.itemUnitOptionId ? (
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  value={requisitionSearch}
                  onChange={(event) => setRequisitionSearch(event.target.value)}
                  placeholder={t("searchPlaceholder")}
                  aria-label={t("searchPlaceholder")}
                  className="pl-9"
                />
              </div>
            ) : null}

            {renderRequisitionLines()}

            {requisitionPagination && requisitionPagination.totalPages > 1 ? (
              <div className="flex items-center justify-between gap-3 border-t pt-4">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setRequisitionPage(Math.max(1, requisitionPagination.page - 1))}
                  disabled={
                    requisitionPagination.page <= 1 || eligibleRequisitionItemsQuery.isFetching
                  }
                >
                  {t("previous")}
                </Button>
                <span className="text-xs text-muted-foreground">
                  {t("pageOfTotal", {
                    page: requisitionPagination.page,
                    totalPages: requisitionPagination.totalPages,
                    total: requisitionPagination.total,
                  })}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setRequisitionPage(
                      Math.min(requisitionPagination.totalPages, requisitionPagination.page + 1)
                    )
                  }
                  disabled={
                    requisitionPagination.page >= requisitionPagination.totalPages ||
                    eligibleRequisitionItemsQuery.isFetching
                  }
                >
                  {t("next")}
                </Button>
              </div>
            ) : null}

            {selectedItemLinks.length > 0 ? (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold">
                  {t("currentLinks")} ({selectedItemLinks.length})
                </h4>
                <ul className="divide-y rounded-lg border">
                  {selectedItemLinks.map((link) => (
                    <li key={link.id} className="flex items-center justify-between gap-3 px-4 py-2">
                      <span className="min-w-0">
                        <span className="block text-sm font-medium">
                          {link.srItem?.sr?.srNumber ?? t("unknownReference")}
                        </span>
                        <span className="text-xs text-emerald-700">{t("linkedStatus")}</span>
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="text-sm font-semibold tabular-nums">
                          {formatQuantity(link.fulfilledQty)}
                        </span>
                        {canModifyLinks ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                disabled={removingLinkId === link.id}
                                aria-label={t("linkActions", {
                                  reference: link.srItem?.sr?.srNumber ?? t("unknownReference"),
                                })}
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onSelect={() => handleRemoveExistingLink(link.id)}
                              >
                                {t("removeLink")}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : null}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t bg-muted/40 px-6 py-4">
          <div className="min-w-0 text-sm">
            {pendingLinks.length > 0 ? (
              <>
                <p className="font-semibold">
                  {t("linksReady", { count: pendingLinks.length, itemCount: pendingItemCount })}
                </p>
                <p
                  className={cn(
                    "text-muted-foreground",
                    pendingErrors.size > 0 && "text-destructive"
                  )}
                >
                  {pendingErrors.size > 0
                    ? t("fixQuantities", { count: pendingErrors.size })
                    : t("nothingSavedYet")}
                </p>
              </>
            ) : (
              <p className="text-muted-foreground">{t("noPendingLinks")}</p>
            )}
          </div>
          <div className="flex gap-3">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("cancel")}
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={
                !canAddLinks ||
                linkMutation.isPending ||
                pendingLinks.length === 0 ||
                pendingErrors.size > 0
              }
            >
              {linkMutation.isPending
                ? t("submitting")
                : pendingLinks.length > 0
                  ? t("submitCount", { count: pendingLinks.length })
                  : t("submit")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
