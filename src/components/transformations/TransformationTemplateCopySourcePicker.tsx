"use client";

import { useEffect, useRef, useState } from "react";
import { Copy, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { AsyncSearchCombobox } from "@/components/shared/AsyncSearchCombobox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import {
  useTransformationTemplateCopySource,
  useTransformationTemplateCopySources,
} from "@/hooks/useTransformationTemplates";
import type {
  TransformationTemplateCopySource,
  TransformationTemplateCopySourceScope,
  TransformationTemplateCopySourceSummary,
} from "@/types/transformation-template";

export type TransformationTemplateCreationMode = "blank" | TransformationTemplateCopySourceScope;

type TransformationTemplateCopySourcePickerProps = {
  templateKind: "recipe" | "sheet_layout";
  onSourceLoaded: (source: TransformationTemplateCopySource | null) => void;
  onModeChange?: (mode: TransformationTemplateCreationMode) => void;
  disabled?: boolean;
};

export function TransformationTemplateCopySourcePicker({
  templateKind,
  onSourceLoaded,
  onModeChange,
  disabled = false,
}: TransformationTemplateCopySourcePickerProps) {
  const t = useTranslations("transformation");
  const [mode, setMode] = useState<TransformationTemplateCreationMode>("blank");
  const [sourceId, setSourceId] = useState("");
  const [selectedSource, setSelectedSource] =
    useState<TransformationTemplateCopySourceSummary | null>(null);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search.trim(), 400);
  const loadedSourceIdRef = useRef<string | null>(null);
  const scope = mode === "blank" ? "current" : mode;

  const sourcesQuery = useTransformationTemplateCopySources(
    {
      scope,
      templateKind,
      search: debouncedSearch || undefined,
      page: 1,
      limit: 5,
    },
    mode !== "blank"
  );
  const sourceQuery = useTransformationTemplateCopySource(sourceId);

  useEffect(() => {
    const source = sourceQuery.data?.data;
    if (!source || loadedSourceIdRef.current === source.id) return;

    loadedSourceIdRef.current = source.id;
    onSourceLoaded(source);
  }, [onSourceLoaded, sourceQuery.data]);

  const handleModeChange = (value: TransformationTemplateCreationMode) => {
    setMode(value);
    setSourceId("");
    setSelectedSource(null);
    setSearch("");
    loadedSourceIdRef.current = null;
    onModeChange?.(value);
    onSourceLoaded(null);
  };

  const handleSourceChange = (value: string) => {
    const source = sourcesQuery.data?.data.find((candidate) => candidate.id === value) ?? null;
    setSelectedSource(source);
    setSourceId(value);
    loadedSourceIdRef.current = null;
  };

  return (
    <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
      <div className="flex items-center gap-2">
        <Copy className="h-4 w-4 text-muted-foreground" />
        <div>
          <p className="text-sm font-semibold">{t("createFromTemplate")}</p>
          <p className="text-xs text-muted-foreground">{t("createFromDescription")}</p>
        </div>
      </div>

      <Select
        value={mode}
        onValueChange={(value) => handleModeChange(value as TransformationTemplateCreationMode)}
        disabled={disabled}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="blank">{t("blankTemplate")}</SelectItem>
          <SelectItem value="current">{t("currentBusinessUnitTemplate")}</SelectItem>
          <SelectItem value="other">{t("otherBusinessUnitTemplate")}</SelectItem>
        </SelectContent>
      </Select>

      {mode !== "blank" ? (
        <AsyncSearchCombobox
          value={sourceId}
          onValueChange={handleSourceChange}
          searchValue={search}
          onSearchValueChange={setSearch}
          options={sourcesQuery.data?.data ?? []}
          selectedOption={selectedSource}
          getOptionValue={(source) => source.id}
          getOptionLabel={(source) => `${source.template_code} — ${source.template_name}`}
          getOptionSearchValue={(source) =>
            `${source.template_code} ${source.template_name} ${source.business_unit_code} ${source.business_unit_name}`
          }
          renderOption={(source) => (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {source.template_code} — {source.template_name}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {source.business_unit_code} — {source.business_unit_name}
              </p>
            </div>
          )}
          placeholder={t("selectCopySource")}
          searchPlaceholder={t("searchCopySources")}
          emptyMessage={
            sourcesQuery.isError ? t("copySourceListError") : t("noActiveCopySources")
          }
          loadingMessage={t("loadingCopySources")}
          isLoading={sourcesQuery.isLoading || sourcesQuery.isFetching}
          disabled={disabled}
        />
      ) : null}

      {sourceId && sourceQuery.isLoading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {t("loadingCopySource")}
        </div>
      ) : null}

      {sourceQuery.isError ? (
        <p className="text-xs text-destructive">{t("copySourceLoadError")}</p>
      ) : null}

      {sourceQuery.data?.data ? (
        <p className="text-xs text-muted-foreground">{t("copyIndependenceNotice")}</p>
      ) : null}
    </div>
  );
}
