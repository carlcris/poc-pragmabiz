"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Activity, Search } from "lucide-react";
import {
  useActivityLogs,
  type ActivityLogOutcome,
  type ActivityLogSource,
} from "@/hooks/useActivityLogs";
import { ProtectedRoute } from "@/components/permissions/ProtectedRoute";
import { EmptyStatePanel } from "@/components/shared/EmptyStatePanel";
import { DataTablePagination } from "@/components/shared/DataTablePagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
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
import { RESOURCES } from "@/constants/resources";

const PAGE_SIZE_OPTIONS = [10, 25, 50];
const ACTIVITY_LOG_TIME_ZONE = "Asia/Manila";

type TimeRangePreset = "today" | "yesterday" | "last7Days" | "last30Days" | "custom";
type AppliedActivityLogFilters = {
  search: string;
  startDate: string;
  endDate: string;
  outcome: ActivityLogOutcome | "all";
  source: ActivityLogSource | "all";
};

const toDateInputValue = (year: number, month: number, day: number) =>
  `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

const toTimeZoneDateInputValue = (date: Date, timeZone: string) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);

  if (!year || !month || !day) return toDateInputValue(1970, 1, 1);
  return toDateInputValue(year, month, day);
};

const shiftDateInputValue = (value: string, days: number) => {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return toDateInputValue(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
};

const isDateInputAfter = (left: string, right: string) => left > right;

const getDateRangeForPreset = (preset: Exclude<TimeRangePreset, "custom">) => {
  const today = toTimeZoneDateInputValue(new Date(), ACTIVITY_LOG_TIME_ZONE);
  let startDate = today;

  if (preset === "yesterday") {
    startDate = shiftDateInputValue(today, -1);
  } else if (preset === "last7Days") {
    startDate = shiftDateInputValue(today, -6);
  } else if (preset === "last30Days") {
    startDate = shiftDateInputValue(today, -29);
  }

  return {
    startDate,
    endDate: preset === "yesterday" ? startDate : today,
  };
};

function ActivityLogsContent() {
  const t = useTranslations("adminActivityLogsPage");
  const locale = useLocale();
  const defaultRange = useMemo(() => getDateRangeForPreset("last30Days"), []);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [searchInput, setSearchInput] = useState("");
  const [timeRangePreset, setTimeRangePreset] = useState<TimeRangePreset>("last30Days");
  const [startDate, setStartDate] = useState(defaultRange.startDate);
  const [endDate, setEndDate] = useState(defaultRange.endDate);
  const [outcome, setOutcome] = useState<ActivityLogOutcome | "all">("all");
  const [source, setSource] = useState<ActivityLogSource | "all">("all");
  const [appliedFilters, setAppliedFilters] = useState<AppliedActivityLogFilters>({
    search: "",
    startDate: defaultRange.startDate,
    endDate: defaultRange.endDate,
    outcome: "all",
    source: "all",
  });

  const filters = useMemo(
    () => ({
      page,
      limit: pageSize,
      startDate: appliedFilters.startDate || undefined,
      endDate: appliedFilters.endDate || undefined,
      timeZone: ACTIVITY_LOG_TIME_ZONE,
      search: appliedFilters.search || undefined,
      outcome: appliedFilters.outcome,
      source: appliedFilters.source,
    }),
    [appliedFilters, page, pageSize]
  );

  const { data, isLoading, error } = useActivityLogs(filters);
  const logs = data?.data || [];
  const pagination = data?.pagination || { page, limit: pageSize, total: 0, totalPages: 1 };

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        timeStyle: "short",
      }),
    [locale]
  );

  const applyFilters = () => {
    setAppliedFilters({
      search: searchInput.trim(),
      startDate,
      endDate,
      outcome,
      source,
    });
    setPage(1);
  };

  const applyTimeRangePreset = (preset: Exclude<TimeRangePreset, "custom">) => {
    const range = getDateRangeForPreset(preset);
    setTimeRangePreset(preset);
    setStartDate(range.startDate);
    setEndDate(range.endDate);
    setAppliedFilters((currentFilters) => ({
      ...currentFilters,
      startDate: range.startDate,
      endDate: range.endDate,
    }));
    setPage(1);
  };

  const handleCustomStartDateChange = (value: string) => {
    setTimeRangePreset("custom");
    setStartDate(value);
    if (value && endDate && isDateInputAfter(value, endDate)) {
      setEndDate(value);
    }
  };

  const handleCustomEndDateChange = (value: string) => {
    setTimeRangePreset("custom");
    setEndDate(value);
    if (value && startDate && isDateInputAfter(startDate, value)) {
      setStartDate(value);
    }
  };

  const resetFilters = () => {
    const range = getDateRangeForPreset("last30Days");
    setSearchInput("");
    setTimeRangePreset("last30Days");
    setStartDate(range.startDate);
    setEndDate(range.endDate);
    setOutcome("all");
    setSource("all");
    setAppliedFilters({
      search: "",
      startDate: range.startDate,
      endDate: range.endDate,
      outcome: "all",
      source: "all",
    });
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="whitespace-nowrap text-lg font-semibold tracking-tight sm:text-xl">
            {t("title")}
          </h1>
          <p className="whitespace-nowrap text-xs text-muted-foreground sm:text-sm">
            {t("subtitle")}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex flex-col gap-2">
          <div className="text-xs font-medium text-muted-foreground">{t("timeRange")}</div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <Button
              type="button"
              size="sm"
              variant={timeRangePreset === "today" ? "default" : "outline"}
              onClick={() => applyTimeRangePreset("today")}
            >
              {t("today")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={timeRangePreset === "yesterday" ? "default" : "outline"}
              onClick={() => applyTimeRangePreset("yesterday")}
            >
              {t("yesterday")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={timeRangePreset === "last7Days" ? "default" : "outline"}
              onClick={() => applyTimeRangePreset("last7Days")}
            >
              {t("last7Days")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={timeRangePreset === "last30Days" ? "default" : "outline"}
              onClick={() => applyTimeRangePreset("last30Days")}
            >
              {t("last30Days")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={timeRangePreset === "custom" ? "default" : "outline"}
              onClick={() => setTimeRangePreset("custom")}
            >
              {t("customRange")}
            </Button>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_160px_160px_150px_150px_auto_auto]">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder={t("searchPlaceholder")}
              className="pl-8"
            />
          </div>
          <Input
            type="date"
            value={startDate}
            onChange={(event) => handleCustomStartDateChange(event.target.value)}
            max={endDate || undefined}
            aria-label={t("startDate")}
          />
          <Input
            type="date"
            value={endDate}
            onChange={(event) => handleCustomEndDateChange(event.target.value)}
            min={startDate || undefined}
            aria-label={t("endDate")}
          />
          <Select
            value={outcome}
            onValueChange={(value) => setOutcome(value as ActivityLogOutcome | "all")}
          >
            <SelectTrigger>
              <SelectValue placeholder={t("outcome")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("allOutcomes")}</SelectItem>
              <SelectItem value="succeeded">{t("succeeded")}</SelectItem>
              <SelectItem value="failed">{t("failed")}</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={source}
            onValueChange={(value) => setSource(value as ActivityLogSource | "all")}
          >
            <SelectTrigger>
              <SelectValue placeholder={t("source")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("allSources")}</SelectItem>
              <SelectItem value="web">{t("web")}</SelectItem>
              <SelectItem value="mobile">{t("mobile")}</SelectItem>
              <SelectItem value="tablet">{t("tablet")}</SelectItem>
              <SelectItem value="api">{t("api")}</SelectItem>
              <SelectItem value="system">{t("system")}</SelectItem>
            </SelectContent>
          </Select>
          <Button type="button" onClick={applyFilters}>
            {t("applyFilters")}
          </Button>
          <Button type="button" variant="outline" onClick={resetFilters}>
            {t("resetFilters")}
          </Button>
        </div>

        {isLoading ? (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("time")}</TableHead>
                  <TableHead>{t("activity")}</TableHead>
                  <TableHead>{t("actor")}</TableHead>
                  <TableHead>{t("resource")}</TableHead>
                  <TableHead>{t("outcome")}</TableHead>
                  <TableHead>{t("source")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...Array(5)].map((_, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <Skeleton className="h-4 w-32" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-80 max-w-full" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-28" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-24" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-20" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-16" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : error ? (
          <div className="py-8 text-center text-sm text-destructive">{t("loadError")}</div>
        ) : logs.length === 0 ? (
          <EmptyStatePanel
            icon={Activity}
            title={t("emptyTitle")}
            description={t("emptyDescription")}
          />
        ) : (
          <div className="space-y-4">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[170px]">{t("time")}</TableHead>
                    <TableHead>{t("activity")}</TableHead>
                    <TableHead className="w-[170px]">{t("actor")}</TableHead>
                    <TableHead className="w-[150px]">{t("resource")}</TableHead>
                    <TableHead className="w-[110px]">{t("outcome")}</TableHead>
                    <TableHead className="w-[90px]">{t("source")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="align-top text-xs text-muted-foreground">
                        {dateFormatter.format(new Date(log.occurred_at))}
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="space-y-1">
                          <p className="text-sm">{log.display_message}</p>
                          <p className="text-xs text-muted-foreground">
                            {log.http_method ? `${log.http_method} ` : ""}
                            {log.http_status ? `${log.http_status}` : t("noStatus")}
                            {log.duration_ms != null ? ` - ${log.duration_ms}ms` : ""}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="align-top text-sm">
                        {log.actor_label || t("unknownActor")}
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="space-y-1">
                          <Badge variant="outline">{log.resource_type}</Badge>
                          <p className="text-xs text-muted-foreground">{log.action}</p>
                        </div>
                      </TableCell>
                      <TableCell className="align-top">
                        <Badge variant={log.outcome === "failed" ? "destructive" : "secondary"}>
                          {log.outcome === "failed" ? t("failed") : t("succeeded")}
                        </Badge>
                      </TableCell>
                      <TableCell className="align-top">
                        <Badge variant="outline">{log.source}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <DataTablePagination
              currentPage={pagination.page}
              totalPages={pagination.totalPages}
              pageSize={pagination.limit}
              totalItems={pagination.total}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              pageSizeOptions={PAGE_SIZE_OPTIONS}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default function ActivityLogsPage() {
  return (
    <ProtectedRoute resource={RESOURCES.ACTIVITY_LOGS} allowRenderWhileLoading>
      <ActivityLogsContent />
    </ProtectedRoute>
  );
}
