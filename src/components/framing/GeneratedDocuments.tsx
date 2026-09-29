"use client";

/**
 * The generated-document panel from `docs/prototypes/chop-and-join-final.html`:
 * a live Job requisition / Cut list pair that updates as the frame is configured.
 *
 * The requisition deliberately keeps the paper form's look — bordered table,
 * ruled fill-in fields, signature lines — because the shop prints it and works
 * from it alongside the handwritten originals. It renders on a white ground in
 * both themes for the same reason: it is a piece of paper, not a UI surface.
 */

import { useEffect, useRef, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { AlertTriangle, Check, Download, FileText, Loader2, Plus, Trash2 } from "lucide-react";
import { cutListRows, requisitionRow, type DocumentLabels } from "@/lib/framing/documents";
import { resolveArtworkSize } from "@/lib/framing/geometry";
import { formatInches } from "@/lib/framing/formatInches";
import { Button } from "@/components/ui/button";
import { RequisitionPaper } from "./RequisitionPaper";
import {
  ATTACHMENT_ACCEPT,
  AttachmentPreviewDialog,
  formatFileSize,
  isPreviewableImage,
  uploadAttachment,
} from "./FrameAttachmentsDialog";
import type { FrameAttachment, FrameConfiguration } from "@/lib/framing/types";

type GeneratedDocumentsProps = {
  /** The selected size. Omitted on an empty line, which prints a blank form. */
  config?: FrameConfiguration;
  labels?: DocumentLabels;
  /**
   * Every size on the line, when it carries more than one. The requisition is
   * the document for the whole job, so it prints them all — unlike the preview,
   * which follows whichever size is selected. An empty array prints a blank form.
   */
  sizes?: { config: FrameConfiguration; labels: DocumentLabels }[];
  /** Formatted line total, shown as Total sales on the requisition. */
  totalSales: string;
  /** Sheet-fit warning from the domain module, or null when everything clears. */
  fitWarning: string | null;
  customerName?: string;
  /** Printed under the customer, so the bench can route the finished work. */
  customerAddress?: string;
  /**
   * The job order number (`FJO-…`) once one exists. A quotation has no job
   * order yet — it is created when the quotation becomes a sales order — so
   * this is undefined while quoting and the field prints blank for the shop to
   * fill in by hand, as it does today.
   */
  transactionNumber?: string;
  /** Who drew up the form — the signed-in user while quoting. */
  preparedBy?: string;
  /**
   * What the customer handed over, for the whole job. Free text, framing only —
   * chop & join sells cut parts, so nothing is taken into custody.
   */
  itemsReceived?: string;
  onItemsReceivedChange?: (value: string) => void;
  /**
   * Replaces the selected size's files. Given, the attachments tab becomes an
   * entry point — upload and remove happen there rather than in a sub-dialog.
   */
  onAttachmentsChange?: (attachments: FrameAttachment[]) => void;
  billingMode?: string;
};

type DocumentTab = "requisition" | "cutList" | "attachments" | "itemsReceived";

export function GeneratedDocuments({
  config,
  labels,
  sizes,
  totalSales,
  fitWarning,
  customerName,
  customerAddress,
  transactionNumber,
  preparedBy,
  itemsReceived,
  onItemsReceivedChange,
  onAttachmentsChange,
  billingMode,
}: GeneratedDocumentsProps) {
  const t = useTranslations("framingDocuments");
  const [tab, setTab] = useState<DocumentTab>("requisition");
  const [busy, setBusy] = useState<"print" | "download" | null>(null);

  // A single-size line is just a one-entry list, so there is one code path.
  // `sizes: []` is meaningful — an empty line renders a blank form — so only a
  // missing `sizes` falls back to the singular config.
  const entries = sizes ?? (config && labels ? [{ config, labels }] : []);
  const rows = entries.map((entry) => requisitionRow(entry.config, entry.labels));
  // The cut list belongs to the workshop and covers the job too.
  // Row keys are unique within one configuration ("moulding", "glazing"), so
  // flattening several sizes collides them. Qualify by size index here rather
  // than in the domain module, which has no reason to know it is being flattened.
  const cuts = entries.flatMap((entry, sizeIndex) =>
    cutListRows(entry.config, entry.labels).map((row) => ({
      ...row,
      key: `${sizeIndex}-${row.key}`,
    }))
  );

  // Attachments follow the SELECTED size, unlike the requisition and cut list,
  // which are whole-job documents and deliberately print every size. A file
  // belongs to one frame, so showing the line's files on a size that has none
  // told the operator this frame had a sketch when it did not.
  const selectedConfig = config ?? entries[0]?.config ?? null;
  const attachments = (selectedConfig?.attachments ?? []).map((attachment) => ({
    attachment,
    sizeLabel: `${formatInches(resolveArtworkSize(selectedConfig!).lengthIn)}″ × ${formatInches(
      resolveArtworkSize(selectedConfig!).widthIn
    )}″`,
  }));

  // The attachments tab only earns its place once there is something behind it.
  // Items received is different: it is an entry point, so it shows whenever the
  // line is framing — an empty custody record is exactly what needs filling in.
  const showItemsReceived = billingMode === "framing" && Boolean(onItemsReceivedChange);
  // Attachments is always shown: it is where files are added, so hiding it
  // until files exist left no way to add the first one.
  const tabs = [
    "requisition" as const,
    "cutList" as const,
    "attachments" as const,
    ...(showItemsReceived ? (["itemsReceived"] as const) : []),
  ];
  // Neither a removed last file nor a switch to chop & join may strand the panel
  // on a tab that no longer exists.
  const activeTab = tabs.includes(tab) ? tab : "requisition";
  const isPaperTab = activeTab === "requisition" || activeTab === "cutList";

  const runAction = async (action: "print" | "download") => {
    if (busy) return;

    setBusy(action);
    try {
      // Loaded on demand: the PDF renderer is large and most sessions configure
      // a frame without ever printing it.
      const [{ pdf }, { RequisitionPDF, CutListPDF }, { openPdf, savePdf }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("@/components/framing/RequisitionPDF"),
        import("@/lib/framing/printDocument"),
      ]);

      // The PDFs take the same domain rows the screen renders, so the paper and
      // the file cannot disagree about what is on the job.
      const document =
        activeTab === "requisition" ? (
          <RequisitionPDF
            rows={rows}
            totalSales={totalSales}
            customerName={customerName}
            customerAddress={customerAddress}
            transactionNumber={transactionNumber}
            preparedBy={preparedBy}
            labels={{
              title: t("requisitionTitle"),
              shopLine: t("shopLine"),
              customer: t("customer"),
              address: t("address"),
              noAddress: t("noAddress"),
              transactionNo: t("transactionNo"),
              autoGenerated: t("autoGenerated"),
              actualQty: t("actualQty"),
              qty: t("qty"),
              unit: t("unit"),
              articleDescription: t("articleDescription"),
              artworkSize: t("artworkSize"),
              matSize: t("matSize"),
              totalCuts: t("totalCuts"),
              totalSales: t("totalSales"),
              preparedBy: t("preparedBy"),
              receivedBy: t("receivedBy"),
            }}
          />
        ) : (
          <CutListPDF
            rows={cuts}
            fitWarning={fitWarning}
            labels={{
              title: t("cutListTitle"),
              material: t("material"),
              spec: t("spec"),
              perCut: t("perCut"),
              total: t("total"),
            }}
          />
        );

      const blob = await pdf(document).toBlob();

      if (action === "print") {
        await openPdf(blob);
      } else {
        // A stable ASCII name rather than the translated tab label: the file is
        // shared with the workshop, and it carries the job's own reference when
        // one exists so two downloads do not collide.
        const stem = activeTab === "requisition" ? "job-requisition" : "cut-list";
        const reference = transactionNumber?.trim();
        savePdf(blob, reference ? `${stem}-${reference}.pdf` : `${stem}.pdf`);
      }
    } catch (error) {
      toast.error(
        error instanceof Error && error.message === "POPUP_BLOCKED"
          ? t("popupBlocked")
          : t("documentActionFailed")
      );
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          {t("generatedDocument")}
        </span>
        <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          {t("live")}
        </span>
        <div
          role="tablist"
          aria-label={t("generatedDocument")}
          className="ml-auto flex rounded-md border p-0.5"
        >
          {tabs.map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={activeTab === value}
              onClick={() => setTab(value)}
              className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                activeTab === value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {value === "attachments" && attachments.length > 0
                ? `${t(value)} (${attachments.length})`
                : t(value)}
            </button>
          ))}
        </div>
      </div>

      {/* Items received and attachments are working panels, not forms, so the
          print actions below appear only for the two paper tabs. */}
      <div>
        {activeTab === "requisition" ? (
          <RequisitionPaper
            rows={rows}
            totalSales={totalSales}
            customerName={customerName}
            customerAddress={customerAddress}
            transactionNumber={transactionNumber}
            preparedBy={preparedBy}
          />
        ) : activeTab === "cutList" ? (
          <CutListPaper rows={cuts} fitWarning={fitWarning} />
        ) : activeTab === "itemsReceived" ? (
          <ItemsReceivedSheet
            value={itemsReceived ?? ""}
            onChange={onItemsReceivedChange ?? (() => {})}
          />
        ) : (
          <AttachmentsSheet
            entries={attachments}
            showSizeLabel={entries.length > 1}
            onAttachmentsChange={onAttachmentsChange}
            current={selectedConfig?.attachments ?? []}
          />
        )}
      </div>

      {isPaperTab ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy !== null}
            onClick={() => void runAction("print")}
          >
            {busy === "print" ? t("printing") : t("print")}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy !== null}
            onClick={() => void runAction("download")}
          >
            {busy === "download" ? t("preparing") : t("downloadPdf")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function CutListPaper({
  rows,
  fitWarning,
}: {
  rows: ReturnType<typeof cutListRows>;
  fitWarning: string | null;
}) {
  const t = useTranslations("framingDocuments");

  return (
    <div className="rounded-md bg-white p-5 text-neutral-900 shadow-lg">
      <h3 className="mb-3 text-[13.5px] font-extrabold uppercase tracking-[0.06em]">
        {t("cutListTitle")}
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="border-b-[1.5px] border-neutral-800 p-1.5 text-left text-[9.5px] font-bold uppercase tracking-[0.1em] text-neutral-500">
                {t("material")}
              </th>
              <th className="border-b-[1.5px] border-neutral-800 p-1.5 text-left text-[9.5px] font-bold uppercase tracking-[0.1em] text-neutral-500">
                {t("spec")}
              </th>
              <th className="whitespace-nowrap border-b-[1.5px] border-neutral-800 p-1.5 text-right text-[9.5px] font-bold uppercase tracking-[0.1em] text-neutral-500">
                {t("perCut")}
              </th>
              <th className="border-b-[1.5px] border-neutral-800 p-1.5 text-right text-[9.5px] font-bold uppercase tracking-[0.1em] text-neutral-500">
                {t("total")}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <td className="border-b border-neutral-200 p-2 text-xs">{row.material}</td>
                <td className="border-b border-neutral-200 p-2 text-xs">{row.spec}</td>
                <td className="border-b border-neutral-200 p-2 text-right font-mono text-xs tabular-nums">
                  {row.perCut}
                </td>
                <td className="border-b border-neutral-200 p-2 text-right font-mono text-xs tabular-nums">
                  {row.total}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3">
        {fitWarning ? (
          <p className="flex items-start gap-2 rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
            <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
            <span>{fitWarning}</span>
          </p>
        ) : (
          <p className="flex items-center gap-2 rounded border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-800">
            <Check className="h-3.5 w-3.5 shrink-0" />
            <span>{t("allClear")}</span>
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * The job's reference files, as a contact sheet.
 *
 * Unlike the requisition and cut list this is not a paper form — nothing here is
 * printed or billed. It exists so the bench can see the sketch and the artwork
 * beside the sizes they belong to, which is the moment those files matter.
 *
 * Read-only on purpose: uploading and removing live in the attachments dialog,
 * so this panel keeps the "generated document" promise of being output only.
 */
function AttachmentsSheet({
  entries,
  showSizeLabel,
  onAttachmentsChange,
  current,
}: {
  entries: { attachment: FrameAttachment; sizeLabel: string }[];
  /** On a multi-size line, name which frame these files belong to. */
  showSizeLabel: boolean;
  /** Given, the sheet becomes editable: files are added and removed in place. */
  onAttachmentsChange?: (attachments: FrameAttachment[]) => void;
  /** The selected size's files, which `onAttachmentsChange` replaces. */
  current: FrameAttachment[];
}) {
  const t = useTranslations("frameAttachments");
  const inputRef = useRef<HTMLInputElement>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Index being previewed; null when the preview is closed. */
  const [previewing, setPreviewing] = useState<number | null>(null);

  const paths = entries.map((entry) => entry.attachment.storagePath).join("|");

  // Signed URLs expire, so they are minted per view rather than stored. One
  // request covers the whole sheet.
  useEffect(() => {
    const list = paths ? paths.split("|") : [];
    if (list.length === 0) {
      setUrls({});
      return;
    }
    let cancelled = false;
    setLoading(true);
    const query = list.map((path) => `path=${encodeURIComponent(path)}`).join("&");
    fetch(`/api/frame-attachments?${query}`)
      .then((response) => response.json())
      .then((payload) => {
        if (!cancelled) setUrls(payload?.urls ?? {});
      })
      .catch(() => {
        if (!cancelled) setUrls({});
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [paths]);

  const onPick = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const chosen = Array.from(event.target.files ?? []);
    // Reset first: picking the same file twice must still fire a change event.
    event.target.value = "";
    if (!onAttachmentsChange || chosen.length === 0) return;

    setUploading(true);
    setError(null);
    const added: FrameAttachment[] = [];
    for (const file of chosen) {
      const uploaded = await uploadAttachment(file, (reason) => setError(t(reason)));
      if (uploaded) added.push(uploaded);
    }
    setUploading(false);
    if (added.length > 0) onAttachmentsChange([...current, ...added]);
  };

  const remove = (index: number) => {
    onAttachmentsChange?.(current.filter((_, position) => position !== index));
  };

  const editable = Boolean(onAttachmentsChange);

  return (
    <div className="space-y-3 rounded-md border bg-background p-4">
      {loading ? (
        <div className="grid place-items-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : entries.length === 0 ? (
        /* The tab is always present now, so it opens on an empty state rather
           than being hidden until the first file exists. */
        <div className="rounded-lg border border-dashed px-4 py-10 text-center">
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {entries.map(({ attachment, sizeLabel }, index) => {
            const url = urls[attachment.storagePath];
            return (
              <figure
                key={`${attachment.storagePath}-${index}`}
                className="overflow-hidden rounded-md border"
              >
                <button
                  type="button"
                  onClick={() => setPreviewing(index)}
                  aria-label={t("previewFile", { name: attachment.fileName })}
                  title={attachment.fileName}
                  className="grid h-32 w-full place-items-center overflow-hidden bg-muted/40 transition-opacity hover:opacity-90"
                >
                  {url && isPreviewableImage(attachment.mimeType) ? (
                    // eslint-disable-next-line @next/next/no-img-element -- signed URL from a private bucket
                    <img
                      src={url}
                      alt={attachment.fileName}
                      className="h-32 w-full object-contain"
                    />
                  ) : (
                    <FileText className="h-7 w-7 text-muted-foreground" />
                  )}
                </button>
                <figcaption className="flex items-center gap-2 border-t px-2.5 py-2">
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium">
                      {attachment.fileName}
                    </span>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {formatFileSize(attachment.fileSizeBytes)}
                      {/* Only worth naming the frame when there is more than one. */}
                      {showSizeLabel ? ` · ${sizeLabel}` : ""}
                    </span>
                  </div>
                  {url ? (
                    <a
                      href={url}
                      download={attachment.fileName}
                      aria-label={t("download")}
                      title={t("download")}
                      className="grid h-7 w-7 shrink-0 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </a>
                  ) : null}
                  {editable ? (
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      aria-label={t("remove")}
                      title={t("remove")}
                      className="grid h-7 w-7 shrink-0 place-items-center rounded text-destructive hover:bg-muted"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </figcaption>
              </figure>
            );
          })}
        </div>
      )}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {editable ? (
        <div className="flex items-center gap-3">
          <input
            ref={inputRef}
            type="file"
            accept={ATTACHMENT_ACCEPT}
            multiple
            className="hidden"
            onChange={onPick}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="mr-1.5 h-3.5 w-3.5" />
            )}
            {uploading ? t("uploading") : t("addFiles")}
          </Button>
          <span className="text-xs text-muted-foreground">{t("accepted")}</span>
        </div>
      ) : null}

      {/* The same preview the attachments dialog opens, so a file looks and
          behaves identically wherever it is clicked. */}
      <AttachmentPreviewDialog
        files={entries.map((entry) => entry.attachment)}
        index={previewing}
        onIndexChange={setPreviewing}
      />
    </div>
  );
}

/**
 * What the customer handed over, for the whole job.
 *
 * Unlike its neighbours this tab is an entry point, not a generated view — the
 * custody record has to be typed somewhere, and it belongs beside the documents
 * it will print on rather than buried in the per-size editor. Free text by
 * design: an operator with a customer at the counter types a sentence, and real
 * intake rarely fits a schema ("the old frame, but only if it cleans up").
 *
 * Job-scoped, not per size: a customer hands over one bundle, and recording it
 * against each size would multiply it on the very record meant to say what the
 * shop is holding.
 */
function ItemsReceivedSheet({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const t = useTranslations("framingDocuments");

  return (
    <div className="space-y-2 rounded-md border bg-background p-4">
      <div className="flex items-baseline gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          {t("itemsReceivedHeading")}
        </span>
        <span className="text-[10px] text-muted-foreground">{t("wholeJob")}</span>
      </div>
      <Textarea
        rows={8}
        className="resize-none text-sm"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <p className="text-xs text-muted-foreground">{t("itemsReceivedHint")}</p>
    </div>
  );
}
