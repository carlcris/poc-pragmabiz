"use client";

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface DataTablePaginationProps {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
}

export function DataTablePagination({
  currentPage,
  totalPages,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 30, 50, 100],
}: DataTablePaginationProps) {
  const t = useTranslations("pagination");
  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxPagesToShow = 7;

    if (totalPages <= maxPagesToShow) {
      // Show all pages
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);

      if (currentPage > 3) {
        pages.push("...");
      }

      // Show pages around current page
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (currentPage < totalPages - 2) {
        pages.push("...");
      }

      // Always show last page
      pages.push(totalPages);
    }

    return pages;
  };

  const pageSizeSelect = onPageSizeChange ? (
    <Select
      value={`${pageSize}`}
      onValueChange={(value) => {
        onPageSizeChange(Number(value));
        onPageChange(1); // Reset to first page when changing page size
      }}
    >
      <SelectTrigger className="h-8 w-[70px]" aria-label={t("rowsPerPage")}>
        <SelectValue placeholder={pageSize} />
      </SelectTrigger>
      <SelectContent side="top">
        {pageSizeOptions.map((size) => (
          <SelectItem key={size} value={`${size}`}>
            {size}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  ) : null;

  return (
    <>
      {/* Phones: labelled 44px Previous/Next instead of a numbered strip that cannot fit,
          and no rows-per-page control; the page size stays as last chosen. */}
      <div className="flex flex-col gap-3 md:hidden">
        <p className="text-center text-xs text-muted-foreground">
          {t("showing", { startItem, endItem, totalItems })}
        </p>
        <div className="flex items-center justify-between gap-2">
          <Button
            variant="outline"
            className="h-11 pl-2.5 pr-3.5"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="h-4 w-4" />
            {t("previous")}
          </Button>
          <span className="text-sm font-medium tabular-nums">
            {t("pageOf", { currentPage, totalPages })}
          </span>
          <Button
            variant="outline"
            className="h-11 pl-3.5 pr-2.5"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
          >
            {t("next")}
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      {/* The two groups wrap onto separate lines when the content column (not the
          viewport) is too narrow for both, so the bar never widens the page. */}
      <div className="hidden px-2 md:flex md:flex-wrap md:items-center md:justify-between md:gap-x-6 md:gap-y-2">
        <div className="flex items-center space-x-6 lg:space-x-8">
          {pageSizeSelect ? (
            <div className="flex items-center space-x-2">
              <p className="text-sm font-medium">{t("rowsPerPage")}</p>
              {pageSizeSelect}
            </div>
          ) : null}
          <div className="flex w-[100px] items-center justify-center text-sm font-medium">
            {t("pageOf", { currentPage, totalPages })}
          </div>
          <div className="text-sm text-muted-foreground">
            {t("showing", { startItem, endItem, totalItems })}
          </div>
        </div>
        <div className="flex items-center justify-center space-x-2">
          <Button
            variant="outline"
            className="hidden h-8 w-8 p-0 lg:flex"
            onClick={() => onPageChange(1)}
            disabled={currentPage === 1}
          >
            <span className="sr-only">{t("goToFirstPage")}</span>
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            className="h-8 w-8 p-0"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
          >
            <span className="sr-only">{t("goToPreviousPage")}</span>
            <ChevronLeft className="h-4 w-4" />
          </Button>

          {/* Page Numbers */}
          <div className="flex items-center space-x-1">
            {getPageNumbers().map((pageNum, idx) => {
              if (pageNum === "...") {
                return (
                  <span key={`ellipsis-${idx}`} className="px-2 text-sm text-muted-foreground">
                    ...
                  </span>
                );
              }
              return (
                <Button
                  key={pageNum}
                  variant={currentPage === pageNum ? "default" : "outline"}
                  className="h-8 w-8 p-0 text-sm"
                  onClick={() => onPageChange(pageNum as number)}
                >
                  {pageNum}
                </Button>
              );
            })}
          </div>

          <Button
            variant="outline"
            className="h-8 w-8 p-0"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
          >
            <span className="sr-only">{t("goToNextPage")}</span>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            className="hidden h-8 w-8 p-0 lg:flex"
            onClick={() => onPageChange(totalPages)}
            disabled={currentPage === totalPages}
          >
            <span className="sr-only">{t("goToLastPage")}</span>
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </>
  );
}
