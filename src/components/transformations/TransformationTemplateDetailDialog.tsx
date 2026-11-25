"use client";

import { useMemo, useRef, useState } from "react";
import { Pencil } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import type {
  SheetLayoutSection,
  TransformationTemplateApi,
  TransformationTemplateUomApi,
} from "@/types/transformation-template";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusText } from "@/components/shared/StatusText";
import { cn } from "@/lib/utils";
import { useTransformationTemplate } from "@/hooks/useTransformationTemplates";
import { TransformationAdditionalOutputImagePreview } from "./TransformationAdditionalOutputImagePreview";
import { TransformationSheetLayoutDiagram } from "./TransformationSheetLayoutDiagram";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template?: TransformationTemplateApi;
  /** Provided only when the template may still be edited. */
  onEdit?: () => void;
};

const getUomLabel = (uom?: TransformationTemplateUomApi | null) =>
  uom?.uom_name || uom?.name || uom?.code || "";

/**
 * Collapses an item's pieces into label ranges ("P1–P12, P15") by walking
 * their layout order, so long cut lists stay one short line.
 */
const getPieceRanges = (sections: SheetLayoutSection[]) => {
  const ordered = [...sections].sort((a, b) => a.order - b.order);
  const ranges: string[] = [];
  let start = ordered[0];
  let previous = ordered[0];

  for (const section of ordered.slice(1)) {
    if (section.order === previous.order + 1) {
      previous = section;
      continue;
    }
    ranges.push(start === previous ? start.label : `${start.label}–${previous.label}`);
    start = section;
    previous = section;
  }
  if (start) ranges.push(start === previous ? start.label : `${start.label}–${previous.label}`);

  return ranges.join(", ");
};

export function TransformationTemplateDetailDialog({
  open,
  onOpenChange,
  template,
  onEdit,
}: Props) {
  const t = useTranslations("transformationTemplateDetail");
  const tTransformation = useTranslations("transformation");
  const tCommon = useTranslations("common");
  const format = useFormatter();
  const contentRef = useRef<HTMLDivElement>(null);
  const [imagePreviewOpen, setImagePreviewOpen] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const detailId = open && template?.additional_outputs?.length ? template.id : "";
  const {
    data: detail,
    isPending: isLoadingImages,
    isFetching: isFetchingImages,
    isError: imagesLoadFailed,
    refetch,
  } = useTransformationTemplate(detailId);

  const layoutSections = useMemo(() => template?.layout_json?.sections ?? [], [template]);
  const outputs = useMemo(() => template?.outputs ?? [], [template]);

  const sectionsByItemId = useMemo(() => {
    const grouped = new Map<string, SheetLayoutSection[]>();
    for (const section of layoutSections) {
      if (section.type !== "piece" || !section.mappedItem) continue;
      const itemSections = grouped.get(section.mappedItem.itemId) ?? [];
      itemSections.push(section);
      grouped.set(section.mappedItem.itemId, itemSections);
    }
    return grouped;
  }, [layoutSections]);

  const alternateItemIds = useMemo(
    () =>
      new Set(
        outputs
          .map((output) => output.item_id ?? output.items?.id)
          .filter((itemId, index): itemId is string => !!itemId && index % 2 === 1)
      ),
    [outputs]
  );

  if (!template) return null;

  const inputs = template.inputs ?? [];
  const additionalOutputs = detail?.data.additional_outputs ?? template.additional_outputs ?? [];
  const isSheetLayout = template.template_kind === "sheet_layout";
  const sheetWidth = template.sheet_width ?? 0;
  const sheetHeight = template.sheet_height ?? 0;
  const sheetUnit = template.sheet_unit ?? "";
  const hasLayout = isSheetLayout && sheetWidth > 0 && sheetHeight > 0 && layoutSections.length > 0;
  const showsSidePanel = isSheetLayout || !!template.image_url;

  const formatValue = (value: number) => format.number(value, { maximumFractionDigits: 2 });
  const formatSize = (width: number, height: number) =>
    t("cutSizeValue", { width: formatValue(width), height: formatValue(height), unit: sheetUnit });
  const formatQuantity = (quantity: number, uom: string) =>
    t("quantityWithUnit", { quantity: formatValue(Number(quantity)), unit: uom });

  const pieceSections = layoutSections.filter((section) => section.type === "piece");
  const leftoverCount = layoutSections.length - pieceSections.length;
  const pieceArea = pieceSections.reduce(
    (total, section) => total + section.width * section.height,
    0
  );
  const sheetUsedRatio = sheetWidth && sheetHeight ? pieceArea / (sheetWidth * sheetHeight) : 0;

  const selectedSection = selectedSectionId
    ? (layoutSections.find((section) => section.id === selectedSectionId) ?? null)
    : null;

  const isSectionHighlighted = (section: SheetLayoutSection) =>
    selectedSectionId
      ? section.id === selectedSectionId
      : !!selectedItemId && section.mappedItem?.itemId === selectedItemId;

  const handleSectionSelect = (section: SheetLayoutSection) => {
    const isDeselecting = section.id === selectedSectionId;
    setSelectedSectionId(isDeselecting ? null : section.id);
    setSelectedItemId(isDeselecting ? null : (section.mappedItem?.itemId ?? null));
  };

  const handleItemSelect = (itemId: string) => {
    setSelectedSectionId(null);
    setSelectedItemId((current) => (current === itemId ? null : itemId));
  };

  const usageText =
    template.usage_count > 0 ? t("usedInOrders", { count: template.usage_count }) : t("notUsedYet");

  const sectionHeadingClassName = "text-sm font-semibold text-muted-foreground";

  const renderSidePanel = () => {
    if (isSheetLayout) {
      if (!hasLayout) {
        return (
          <div className="flex h-64 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
            {t("noLayoutPreview")}
          </div>
        );
      }

      return (
        <>
          <TransformationSheetLayoutDiagram
            sheetWidth={sheetWidth}
            sheetHeight={sheetHeight}
            sheetUnit={sheetUnit}
            sections={layoutSections}
            alternateItemIds={alternateItemIds}
            isSectionHighlighted={isSectionHighlighted}
            selectedSectionId={selectedSectionId}
            onSectionSelect={handleSectionSelect}
          />
          <dl className="flex flex-wrap justify-center gap-x-5 gap-y-1 text-sm tabular-nums">
            <div className="flex gap-1">
              <dt className="sr-only">{t("piecesLabel", { count: pieceSections.length })}</dt>
              <dd className="font-semibold">{format.number(pieceSections.length)}</dd>
              <dd aria-hidden="true" className="text-muted-foreground">
                {t("piecesLabel", { count: pieceSections.length })}
              </dd>
            </div>
            <div className="flex gap-1">
              <dt className="sr-only">{t("sheetUsedLabel")}</dt>
              <dd className="font-semibold">
                {format.number(sheetUsedRatio, { style: "percent", maximumFractionDigits: 0 })}
              </dd>
              <dd aria-hidden="true" className="text-muted-foreground">
                {t("sheetUsedLabel")}
              </dd>
            </div>
            <div className="flex gap-1">
              <dt className="sr-only">{t("leftoversLabel", { count: leftoverCount })}</dt>
              <dd className="font-semibold">{format.number(leftoverCount)}</dd>
              <dd aria-hidden="true" className="text-muted-foreground">
                {t("leftoversLabel", { count: leftoverCount })}
              </dd>
            </div>
          </dl>
        </>
      );
    }

    if (!template.image_url) return null;

    return (
      <button
        type="button"
        aria-label={t("viewTemplateImage")}
        className="block w-full cursor-zoom-in overflow-hidden rounded-md border bg-background transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        onClick={() => setImagePreviewOpen(true)}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={template.image_url}
          alt={t("templateImageAlt", { name: template.template_name })}
          className="h-72 w-full object-contain"
        />
      </button>
    );
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        {/* 90vh keeps the backdrop visible around a tall workbench; the preset
            max-h-screen would let the dialog touch both viewport edges. */}
        <DialogContent
          ref={contentRef}
          className="flex max-h-[90vh] max-w-6xl flex-col gap-0 overflow-hidden p-0 focus:outline-none"
          // Focus the dialog itself rather than the first sheet piece, so the
          // diagram does not open with a selection-like focus ring on P1.
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            contentRef.current?.focus();
          }}
        >
          <DialogHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0 border-b px-6 py-4 pr-14 text-left">
            <div className="min-w-0 space-y-1">
              <DialogTitle className="text-xl font-semibold">{template.template_name}</DialogTitle>
              <DialogDescription className="flex flex-wrap items-center gap-x-2 gap-y-1 tabular-nums">
                <span>{template.template_code}</span>
                <span aria-hidden="true">·</span>
                <span>{isSheetLayout ? t("sheetLayoutKind") : t("recipeKind")}</span>
                <span aria-hidden="true">·</span>
                <StatusText tone={template.is_active ? "green" : "muted"}>
                  {template.is_active ? tCommon("active") : tCommon("inactive")}
                </StatusText>
                <span aria-hidden="true">·</span>
                <span>{usageText}</span>
                {template.usage_count > 0 && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{t("locked")}</span>
                  </>
                )}
              </DialogDescription>
            </div>
            {onEdit && (
              <Button type="button" variant="outline" onClick={onEdit}>
                <Pencil className="mr-2 h-4 w-4" />
                {tCommon("edit")}
              </Button>
            )}
          </DialogHeader>

          <div
            className={cn(
              "grid min-h-0 flex-1 overflow-y-auto",
              showsSidePanel && "lg:grid-cols-5"
            )}
          >
            {showsSidePanel && (
              <section
                aria-label={isSheetLayout ? t("sheetLayoutRegion") : t("templateImageRegion")}
                className="flex flex-col gap-4 border-b bg-muted/40 px-6 py-6 lg:col-span-2 lg:border-b-0 lg:border-r"
              >
                {renderSidePanel()}
              </section>
            )}

            <div
              className={cn("flex min-w-0 flex-col gap-6 p-6", showsSidePanel && "lg:col-span-3")}
            >
              <section aria-labelledby="template-detail-consumes" className="space-y-2">
                <h3 id="template-detail-consumes" className={sectionHeadingClassName}>
                  {t("consumes")}
                </h3>
                {inputs.length === 0 ? (
                  <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                    {t("noInputs")}
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {inputs.map((input) => (
                      <li
                        key={input.id}
                        className="flex items-start justify-between gap-4 rounded-md border px-4 py-3"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-semibold tabular-nums">
                            {input.items?.item_code}
                            {hasLayout && (
                              <span className="font-normal text-muted-foreground">
                                {" · "}
                                {t("parentSheetSize", {
                                  size: formatSize(sheetWidth, sheetHeight),
                                })}
                              </span>
                            )}
                          </p>
                          <p className="break-words text-sm">{input.items?.item_name}</p>
                          {input.notes && (
                            <p className="break-words text-sm text-muted-foreground">
                              {input.notes}
                            </p>
                          )}
                        </div>
                        <span className="whitespace-nowrap text-base font-semibold tabular-nums">
                          {formatQuantity(input.quantity, getUomLabel(input.uom))}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section aria-labelledby="template-detail-produces" className="space-y-2">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <h3 id="template-detail-produces" className={sectionHeadingClassName}>
                    {t("produces")}
                  </h3>
                  {hasLayout && outputs.length > 0 && (
                    <p className="text-xs text-muted-foreground">{t("selectItemHint")}</p>
                  )}
                </div>
                {outputs.length === 0 ? (
                  <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                    {t("noOutputs")}
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {outputs.map((output) => {
                      const itemId = output.item_id ?? output.items?.id ?? "";
                      const itemSections = sectionsByItemId.get(itemId) ?? [];
                      const cutSizes = Array.from(
                        new Set(
                          itemSections.map((section) => formatSize(section.width, section.height))
                        )
                      ).join(", ");
                      const isSelected = !!itemId && selectedItemId === itemId;
                      const content = (
                        <>
                          {hasLayout && (
                            <span
                              aria-hidden="true"
                              className={cn(
                                "mt-1 size-3 shrink-0 border border-muted-foreground/50",
                                alternateItemIds.has(itemId) ? "bg-muted" : "bg-background"
                              )}
                            />
                          )}
                          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                            <span className="flex flex-wrap items-center gap-2 text-sm font-semibold tabular-nums">
                              <span>
                                {output.items?.item_code}
                                {cutSizes && (
                                  <span className="font-normal text-muted-foreground">
                                    {" · "}
                                    {t("cutSizes", { sizes: cutSizes })}
                                  </span>
                                )}
                              </span>
                              {output.is_scrap && (
                                <Badge variant="outline">{tTransformation("scrap")}</Badge>
                              )}
                            </span>
                            <span className="break-words text-sm">{output.items?.item_name}</span>
                            {hasLayout && (
                              <span className="text-xs tabular-nums text-muted-foreground">
                                {itemSections.length
                                  ? t("pieceRanges", { ranges: getPieceRanges(itemSections) })
                                  : t("noMappedPieces")}
                              </span>
                            )}
                            {output.notes && (
                              <span className="break-words text-sm text-muted-foreground">
                                {output.notes}
                              </span>
                            )}
                          </span>
                          <span className="whitespace-nowrap text-base font-semibold tabular-nums">
                            {formatQuantity(output.quantity, getUomLabel(output.uom))}
                          </span>
                        </>
                      );

                      return (
                        <li key={output.id}>
                          {hasLayout && itemSections.length > 0 ? (
                            <button
                              type="button"
                              aria-pressed={isSelected}
                              onClick={() => handleItemSelect(itemId)}
                              className={cn(
                                "flex w-full items-start gap-3 rounded-md border px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                                isSelected ? "border-primary bg-secondary/40" : "hover:bg-muted/60"
                              )}
                            >
                              {content}
                            </button>
                          ) : (
                            <div className="flex items-start gap-3 rounded-md border px-4 py-3">
                              {content}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              <section aria-labelledby="template-detail-additional" className="space-y-2">
                <h3 id="template-detail-additional" className={sectionHeadingClassName}>
                  {t("alsoProduces")}
                  {isSheetLayout && (
                    <span className="font-normal">
                      {" · "}
                      {t("notCutFromSheet")}
                    </span>
                  )}
                </h3>
                {detailId && isLoadingImages && (
                  <p role="status" className="text-sm text-muted-foreground">
                    {tTransformation("additionalOutputImagesLoading")}
                  </p>
                )}
                {detailId && imagesLoadFailed && (
                  <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <p role="alert">{tTransformation("additionalOutputImagesLoadError")}</p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={isFetchingImages}
                      onClick={() => void refetch()}
                    >
                      {tTransformation("additionalOutputImagesRetry")}
                    </Button>
                  </div>
                )}
                {additionalOutputs.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {tTransformation("noPlannedAdditionalOutputs")}
                  </p>
                ) : (
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {additionalOutputs.map((output) => {
                      const itemName =
                        output.items?.item_name ??
                        output.items?.item_code ??
                        tTransformation("additionalOutput");

                      return (
                        <li
                          key={output.id}
                          className="flex min-w-0 items-center gap-3 rounded-md border p-2"
                        >
                          {output.image_path && (
                            <TransformationAdditionalOutputImagePreview
                              itemName={itemName}
                              imageUrl={output.image_url}
                              thumbnailUrl={output.image_thumbnail_url}
                              isRefreshing={isFetchingImages}
                              onRefresh={async () => (await refetch()).isSuccess}
                            />
                          )}
                          <div className="min-w-0">
                            <p className="text-xs font-semibold tabular-nums">
                              {output.items?.item_code}
                              {" · "}
                              {formatQuantity(
                                output.quantity,
                                getUomLabel(output.uom) || getUomLabel(output.items?.uom)
                              )}
                            </p>
                            <p className="break-words text-xs text-muted-foreground">
                              {output.items?.item_name}
                            </p>
                            {output.notes && (
                              <p className="break-words text-xs text-muted-foreground">
                                {output.notes}
                              </p>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              {template.description?.trim() && (
                <section aria-labelledby="template-detail-description" className="space-y-2">
                  <h3 id="template-detail-description" className={sectionHeadingClassName}>
                    {t("description")}
                  </h3>
                  <p className="whitespace-pre-line break-words text-sm">
                    {template.description.trim()}
                  </p>
                </section>
              )}

              {hasLayout && (
                <section
                  aria-live="polite"
                  aria-label={t("pieceInspectorRegion")}
                  className="mt-auto rounded-md bg-muted/60 px-4 py-3"
                >
                  {selectedSection ? (
                    <>
                      <p className="text-sm tabular-nums">
                        <span className="font-semibold">
                          {selectedSection.type === "leftover"
                            ? t("leftover")
                            : selectedSection.label}
                        </span>
                        {" · "}
                        {formatSize(selectedSection.width, selectedSection.height)}
                        {selectedSection.mappedItem && (
                          <>
                            {" · "}
                            {selectedSection.mappedItem.itemCode}
                          </>
                        )}
                        {" · "}
                        {t("piecePosition", {
                          x: formatValue(selectedSection.x),
                          y: formatValue(selectedSection.y),
                          unit: sheetUnit,
                        })}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {selectedSection.type === "leftover"
                          ? t("leftoverDescription")
                          : (selectedSection.mappedItem?.itemName ?? t("unmappedPiece"))}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">{t("pieceInspectorHint")}</p>
                  )}
                </section>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {!isSheetLayout && template.image_url && (
        <Dialog open={imagePreviewOpen} onOpenChange={setImagePreviewOpen}>
          <DialogContent className="flex max-h-dvh max-w-5xl flex-col overflow-hidden">
            <DialogHeader>
              <DialogTitle>{template.template_name}</DialogTitle>
              <DialogDescription>{template.template_code}</DialogDescription>
            </DialogHeader>
            <div className="min-h-0 overflow-auto rounded-md bg-muted p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={template.image_url}
                alt={t("templateImageAlt", { name: template.template_name })}
                className="mx-auto max-h-screen w-auto max-w-full object-contain"
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
