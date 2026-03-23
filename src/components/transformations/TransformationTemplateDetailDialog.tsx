"use client";

import { useState } from "react";
import { ScissorsLineDashed } from "lucide-react";
import type { TransformationTemplateApi } from "@/types/transformation-template";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template?: TransformationTemplateApi;
};

export function TransformationTemplateDetailDialog({ open, onOpenChange, template }: Props) {
  const [imagePreviewOpen, setImagePreviewOpen] = useState(false);
  if (!template) return null;

  const inputs = template.inputs ?? [];
  const outputs = template.outputs ?? [];
  const isSheetLayout = template.template_kind === "sheet_layout";
  const layoutSections = template.layout_json?.sections ?? [];
  const sheetWidth = template.sheet_width ?? 0;
  const sheetHeight = template.sheet_height ?? 0;
  const sheetUnit = template.sheet_unit ?? "";
  const outerStrokeWidth = 0.25;
  const innerStrokeWidth = 2.2;
  const annotationPaddingX = 2.8;
  const annotationPaddingTop = 2.8;
  const annotationPaddingBottom = 3.2;

  const formatDimension = (value: number) => {
    if (Number.isInteger(value)) return `${value}`;
    return value.toFixed(2).replace(/\.?0+$/, "");
  };

  const pieceSections = layoutSections.filter((section) => section.type === "piece");
  const cutSizeSummaries = Array.from(
    pieceSections.reduce((acc, section) => {
      const key = `${section.width}x${section.height}`;
      const current = acc.get(key);
      if (current) {
        current.count += 1;
        return acc;
      }

      acc.set(key, {
        width: section.width,
        height: section.height,
        count: 1,
      });
      return acc;
    }, new Map<string, { width: number; height: number; count: number }>())
  )
    .map(([, value]) => value)
    .sort((a, b) => b.width * b.height - a.width * a.height);

  const getPreviewTextLayout = (width: number, height: number) => ({
    canShowTitle: width >= 3 && height >= 3,
    canShowDimensions: width >= 8 && height >= 6,
    canShowMappedItem: width >= 8 && height >= 6,
    titleFontSize: 1.05,
    dimensionFontSize: 0.72,
  });

  const wrapSvgText = (text: string, maxCharsPerLine: number, maxLines: number): string[] => {
    const normalized = text.trim().replace(/\s+/g, " ");
    if (!normalized) return [];

    const words = normalized.split(" ");
    const lines: string[] = [];
    let currentLine = "";

    for (const word of words) {
      const nextLine = currentLine ? `${currentLine} ${word}` : word;
      if (nextLine.length <= maxCharsPerLine) {
        currentLine = nextLine;
        continue;
      }

      if (currentLine) {
        lines.push(currentLine);
        if (lines.length === maxLines) break;
        currentLine = word;
        continue;
      }

      lines.push(word.slice(0, Math.max(1, maxCharsPerLine - 1)).trimEnd());
      if (lines.length === maxLines) break;
    }

    if (lines.length < maxLines && currentLine) {
      lines.push(currentLine);
    }

    if (words.length > 0 && lines.length) {
      const usedWords = lines.join(" ").split(" ").length;
      if (usedWords < words.length) {
        lines[lines.length - 1] = `${lines[lines.length - 1].slice(0, Math.max(0, maxCharsPerLine - 1)).trimEnd()}…`;
      }
    }

    return lines.slice(0, maxLines);
  };

  const renderSheetLayoutSvg = (className: string) => (
    <svg
      viewBox={`${-annotationPaddingX} ${-annotationPaddingTop} ${sheetWidth + annotationPaddingX * 2} ${sheetHeight + annotationPaddingTop + annotationPaddingBottom}`}
      className={className}
      style={{ aspectRatio: `${sheetWidth} / ${sheetHeight}` }}
      shapeRendering="geometricPrecision"
    >
      <g aria-hidden="true">
        <text
          x={sheetWidth / 2}
          y={-0.9}
          textAnchor="middle"
          fontSize={1.55}
          fontWeight={700}
          fill="#3b82f6"
        >
          {formatDimension(sheetWidth)}
        </text>
        <text
          x={sheetWidth / 2}
          y={sheetHeight + 2.5}
          textAnchor="middle"
          fontSize={1.55}
          fontWeight={700}
          fill="#3b82f6"
        >
          {formatDimension(sheetWidth)}
        </text>
        <text
          x={-1.25}
          y={sheetHeight / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={1.55}
          fontWeight={700}
          fill="#3b82f6"
        >
          {formatDimension(sheetHeight)}
        </text>
        <text
          x={sheetWidth + 1.25}
          y={sheetHeight / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={1.55}
          fontWeight={700}
          fill="#3b82f6"
        >
          {formatDimension(sheetHeight)}
        </text>
      </g>
      <rect
        x={0}
        y={0}
        width={sheetWidth}
        height={sheetHeight}
        fill="#ffffff"
      />
      {layoutSections.map((section) => {
        const isMappedPiece = section.type === "piece" && !!section.mappedItem;
        const fill = section.type === "piece" ? "#ffffff" : "#f8fafc";
        const strokeColor = section.type === "piece" ? "#6b7280" : "#94a3b8";
        const textLayout = getPreviewTextLayout(section.width, section.height);
        const mappedItemLines =
          section.mappedItem && textLayout.canShowMappedItem
            ? wrapSvgText(
                section.mappedItem.itemName,
                Math.max(8, Math.floor(section.width * 0.75)),
                section.height >= 24 ? 2 : 1
              )
            : [];

        return (
          <g key={section.id}>
            <rect
              x={section.x}
              y={section.y}
              width={section.width}
              height={section.height}
              fill={fill}
              stroke={strokeColor}
              strokeWidth={innerStrokeWidth}
              vectorEffect="non-scaling-stroke"
            />

            {isMappedPiece && textLayout.canShowMappedItem && section.mappedItem ? (
              <text
                x={section.x + 0.5}
                y={section.y + 0.9}
                fontSize={0.52}
                fontWeight={700}
                fill="#2563eb"
              >
                {section.mappedItem.itemCode}
              </text>
            ) : null}

            {textLayout.canShowTitle && (
              <>
                <text
                  x={section.x + section.width / 2}
                  y={
                    section.y +
                    section.height / 2 -
                    (textLayout.canShowDimensions ? textLayout.titleFontSize * 0.35 : 0)
                  }
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={textLayout.titleFontSize}
                  fontWeight={700}
                  fill="#111827"
                >
                  {section.label}
                </text>
                {textLayout.canShowDimensions && (
                  <>
                    <text
                      x={section.x + section.width / 2}
                      y={
                        section.y + section.height / 2 + textLayout.titleFontSize * 0.75
                      }
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize={textLayout.dimensionFontSize}
                      fill="#475569"
                    >
                      {section.width.toFixed(2)} x {section.height.toFixed(2)} {sheetUnit}
                    </text>
                    {mappedItemLines.length ? (
                      <text
                        x={section.x + section.width / 2}
                        y={
                          section.y +
                          section.height / 2 +
                          textLayout.titleFontSize +
                          textLayout.dimensionFontSize * 0.95
                        }
                        textAnchor="middle"
                        fontSize={Math.min(
                          Math.max(textLayout.dimensionFontSize * 0.82, 0.68),
                          1.05
                        )}
                        fontWeight={700}
                        fill="#2563eb"
                      >
                        {mappedItemLines.map((line, index) => (
                          <tspan
                            key={`${section.id}-mapped-line-${index}`}
                            x={section.x + section.width / 2}
                            dy={
                              index === 0
                                ? textLayout.dimensionFontSize * 1.2
                                : textLayout.dimensionFontSize * 1.05
                            }
                          >
                            {line}
                          </tspan>
                        ))}
                      </text>
                    ) : null}
                  </>
                )}
              </>
            )}
          </g>
        );
      })}
      <rect x={0} y={0} width={sheetWidth} height={outerStrokeWidth} fill="#111827" />
      <rect
        x={0}
        y={Math.max(sheetHeight - outerStrokeWidth, 0)}
        width={sheetWidth}
        height={outerStrokeWidth}
        fill="#111827"
      />
      <rect x={0} y={0} width={outerStrokeWidth} height={sheetHeight} fill="#111827" />
      <rect
        x={Math.max(sheetWidth - outerStrokeWidth, 0)}
        y={0}
        width={outerStrokeWidth}
        height={sheetHeight}
        fill="#111827"
      />
    </svg>
  );

  const renderCutSizeSummary = () => (
    <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
      <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
        <ScissorsLineDashed className="h-4 w-4" />
        Cut Sizes
      </div>
      <div className="space-y-2">
        {cutSizeSummaries.map((summary) => (
          <div
            key={`${summary.width}x${summary.height}`}
            className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2"
          >
            <div>
              <p className="text-sm font-semibold text-slate-900">
                {formatDimension(summary.width)} x {formatDimension(summary.height)} {sheetUnit}
              </p>
              <p className="text-xs text-slate-500">Cut size</p>
            </div>
            <div className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
              {summary.count} pcs
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderSheetLayoutPreview = () => {
    if (!sheetWidth || !sheetHeight || !layoutSections.length) {
      return (
        <div className="flex h-64 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
          No layout preview available
        </div>
      );
    }

    return (
      <button
        type="button"
        className="block w-full rounded-md border bg-white p-3 text-left transition hover:opacity-95"
        onClick={() => setImagePreviewOpen(true)}
      >
        {renderSheetLayoutSvg("w-full cursor-zoom-in rounded-md")}
        <div className="mt-3 border-t bg-background/90 px-3 py-2 text-xs text-muted-foreground">
          Click preview to view full size
        </div>
      </button>
    );
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{template.template_name}</DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="space-y-4 rounded-lg border bg-card p-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Template Code
                    </p>
                    <p className="mt-1 font-medium">{template.template_code}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Status</p>
                    <div className="mt-1">
                      <Badge className={template.is_active ? "bg-green-500" : "bg-gray-500"}>
                        {template.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Usage Count
                    </p>
                    <p className="mt-1 font-medium">{template.usage_count}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Materials
                    </p>
                    <p className="mt-1 font-medium">
                      {isSheetLayout
                        ? `${layoutSections.length} section${layoutSections.length !== 1 ? "s" : ""}`
                        : `${inputs.length} input${inputs.length !== 1 ? "s" : ""} / ${outputs.length} output${outputs.length !== 1 ? "s" : ""}`}
                    </p>
                  </div>
                </div>

                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Description
                  </p>
                  <p className="mt-1 min-h-10 text-sm">
                    {template.description?.trim() || "No description provided"}
                  </p>
                </div>
              </div>

              <div className="rounded-lg border bg-card p-4">
                {isSheetLayout ? (
                  <>
                    <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                      <ScissorsLineDashed className="h-4 w-4" />
                      Sheet Layout Preview
                    </div>
                    {renderSheetLayoutPreview()}
                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-md border bg-muted/30 p-3">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                          Parent Sheet
                        </p>
                        <p className="mt-1 font-medium">
                          {sheetWidth} x {sheetHeight} {sheetUnit}
                        </p>
                      </div>
                      <div className="rounded-md border bg-muted/30 p-3">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                          Pieces
                        </p>
                        <p className="mt-1 font-medium">
                          {layoutSections.filter((section) => section.type === "piece").length}
                        </p>
                      </div>
                      <div className="rounded-md border bg-muted/30 p-3">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                          Leftovers
                        </p>
                        <p className="mt-1 font-medium">
                          {layoutSections.filter((section) => section.type === "leftover").length}
                        </p>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="mb-3 text-xs uppercase tracking-wide text-muted-foreground">
                      Template Image
                    </p>
                    {template.image_url ? (
                      <button
                        type="button"
                        className="group block w-full overflow-hidden rounded-md border bg-muted/30 text-left transition hover:opacity-95"
                        onClick={() => setImagePreviewOpen(true)}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={template.image_url}
                          alt={`${template.template_name} template`}
                          className="h-64 w-full cursor-zoom-in object-contain bg-white"
                        />
                        <div className="border-t bg-background/90 px-3 py-2 text-xs text-muted-foreground">
                          Click image to view full size
                        </div>
                      </button>
                    ) : (
                      <div className="flex h-64 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
                        No image uploaded
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="font-semibold">
                {isSheetLayout ? "Input Products" : "Input Materials"}
              </h3>
              <div className="space-y-2">
                {inputs.length === 0 && (
                  <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                    No input {isSheetLayout ? "products" : "materials"} configured.
                  </div>
                )}
                {inputs.map((input) => (
                  <div
                    key={input.id}
                    className="flex items-start justify-between gap-4 rounded-lg border bg-card p-3"
                  >
                    <div>
                      <p className="font-medium leading-tight">
                        {input.items?.item_code} <span className="text-muted-foreground">•</span>{" "}
                        {input.items?.item_name}
                      </p>
                      {input.notes && <p className="text-sm text-muted-foreground">{input.notes}</p>}
                    </div>
                    <span className="whitespace-nowrap font-medium">
                      {input.quantity}{" "}
                      {input.uom?.uom_name || input.uom?.name || input.uom?.code || ""}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="font-semibold">Output Products</h3>
              <div className="space-y-2">
                {outputs.length === 0 && (
                  <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                    No output products configured.
                  </div>
                )}
                {outputs.map((output) => (
                  <div
                    key={output.id}
                    className="flex items-start justify-between gap-4 rounded-lg border bg-card p-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium leading-tight">
                          {output.items?.item_code} <span className="text-muted-foreground">•</span>{" "}
                          {output.items?.item_name}
                        </p>
                        {output.is_scrap && (
                          <Badge variant="outline" className="text-xs">
                            Scrap
                          </Badge>
                        )}
                      </div>
                      {output.notes && (
                        <p className="text-sm text-muted-foreground">{output.notes}</p>
                      )}
                    </div>
                    <span className="whitespace-nowrap font-medium">
                      {output.quantity}{" "}
                      {output.uom?.uom_name || output.uom?.name || output.uom?.code || ""}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {(template.image_url || isSheetLayout) && (
        <Dialog open={imagePreviewOpen} onOpenChange={setImagePreviewOpen}>
          <DialogContent className="max-h-[88vh] max-w-5xl overflow-hidden border-slate-200 bg-white p-0 shadow-xl">
            <DialogHeader className="gap-2 border-b border-slate-200 px-5 py-4 pr-14">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-0.5">
                  <DialogTitle className="text-lg font-semibold tracking-tight text-slate-950">
                    {template.template_name}
                  </DialogTitle>
                  <p className="text-xs text-slate-500">
                    {isSheetLayout ? "Layout preview" : "Image preview"} for{" "}
                    <span className="font-medium text-slate-800">{template.template_code}</span>
                  </p>
                </div>
                <div className="inline-flex w-fit items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">
                  {isSheetLayout ? "Sheet Layout" : "Template Image"}
                </div>
              </div>
            </DialogHeader>
            {isSheetLayout ? (
              <div className="max-h-[calc(88vh-76px)] overflow-auto bg-slate-50 p-4 sm:p-5">
                <div className="grid gap-5 rounded-xl border border-slate-200 bg-white p-3 shadow-sm lg:grid-cols-[minmax(0,1fr)_260px] lg:items-start sm:p-4">
                  <div className="min-w-0">{renderSheetLayoutSvg("mx-auto max-h-[68vh] w-full")}</div>
                  <div>{renderCutSizeSummary()}</div>
                </div>
              </div>
            ) : template.image_url ? (
              <div className="max-h-[calc(88vh-76px)] overflow-auto bg-slate-50 p-4 sm:p-5">
                <div className="flex min-h-[24rem] items-center justify-center rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={template.image_url}
                    alt={`${template.template_name} full preview`}
                    className="mx-auto max-h-[68vh] w-auto max-w-full object-contain"
                  />
                </div>
              </div>
            ) : null
            }
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
