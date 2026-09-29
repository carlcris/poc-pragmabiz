"use client";

/**
 * Reference files for one configured size — the customer's artwork photo, a
 * detailed sketch, a marked-up print.
 *
 * Opened from the Attachments row's ⋯, the same way matting, glazing and
 * backing are configured. Files are unpriced: nothing here reaches the billed
 * component rows.
 *
 * The bucket is private, so a file is previewed through a signed URL minted on
 * demand rather than a stored one. Preview stays in a dialog — never a new tab —
 * so the operator does not lose the configuration they are part-way through.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Download, FileText, Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { FrameAttachment } from "@/lib/framing/types";

/** Mirrors the bucket's own limit, so the check fails fast and in words. */
const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPT = "image/jpeg,image/jpg,image/png,image/webp,application/pdf";

type FrameAttachmentsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  attachments: FrameAttachment[];
  onApply: (attachments: FrameAttachment[]) => void;
};

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function isPreviewableImage(mimeType: string): boolean {
  return mimeType.startsWith("image/");
}

/** Limits the upload route enforces, re-exported so callers can check first. */
export const ATTACHMENT_MAX_BYTES = MAX_BYTES;
export const ATTACHMENT_ACCEPT = ACCEPT;

/**
 * Push one file at the upload route and return the stored attachment.
 *
 * Shared so the dialog and the document panel's attachments tab upload
 * identically — a second copy would drift on limits or error handling.
 * Resolves to null on failure, with the reason in `onError`.
 */
export async function uploadAttachment(
  file: File,
  onError: (message: "tooLarge" | "uploadFailed") => void
): Promise<FrameAttachment | null> {
  if (file.size > MAX_BYTES) {
    onError("tooLarge");
    return null;
  }
  try {
    const body = new FormData();
    body.append("file", file);
    const response = await fetch("/api/frame-attachments", { method: "POST", body });
    const payload = await response.json();
    if (!response.ok) {
      onError("uploadFailed");
      return null;
    }
    return {
      storagePath: payload.storagePath,
      fileName: payload.fileName,
      mimeType: payload.mimeType,
      fileSizeBytes: payload.fileSizeBytes,
    };
  } catch {
    onError("uploadFailed");
    return null;
  }
}

export function FrameAttachmentsDialog({
  open,
  onOpenChange,
  attachments,
  onApply,
}: FrameAttachmentsDialogProps) {
  const t = useTranslations("frameAttachments");
  const inputRef = useRef<HTMLInputElement>(null);

  const [files, setFiles] = useState<FrameAttachment[]>(attachments);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Index being previewed; null when the preview is closed. */
  const [previewing, setPreviewing] = useState<number | null>(null);

  // Re-seed on open so a cancelled edit leaves nothing behind.
  useEffect(() => {
    if (!open) return;
    setFiles(attachments);
    setError(null);
    setPreviewing(null);
  }, [open, attachments]);

  const upload = useCallback(async (file: File) => {
    if (file.size > MAX_BYTES) {
      setError(t("tooLarge"));
      return;
    }

    setUploading(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/api/frame-attachments", { method: "POST", body });
      const payload = await response.json();

      if (!response.ok) {
        setError(payload?.error || t("uploadFailed"));
        return;
      }

      setFiles((current) => [
        ...current,
        {
          storagePath: payload.storagePath,
          fileName: payload.fileName,
          mimeType: payload.mimeType,
          fileSizeBytes: payload.fileSizeBytes,
        },
      ]);
    } catch {
      setError(t("uploadFailed"));
    } finally {
      setUploading(false);
    }
  }, [t]);

  const onPick = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const chosen = Array.from(event.target.files ?? []);
    // Reset first: picking the same file twice must still fire a change event.
    event.target.value = "";
    for (const file of chosen) {
      await upload(file);
    }
  };

  const remove = (index: number) => {
    setFiles((current) => current.filter((_, position) => position !== index));
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl"
        /* A frame configuration is long-form work; a stray click on the
           backdrop must not discard it. Closing is deliberate only: the X, or
           Cancel. Escape is left alone as the standard accessible exit. */
        onInteractOutside={(event) => event.preventDefault()}
      >
          <DialogHeader>
            <DialogTitle>{t("title")}</DialogTitle>
            <DialogDescription>{t("lede")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-1">
            {files.length === 0 ? (
              <div className="rounded-lg border border-dashed px-4 py-10 text-center">
                <p className="text-sm text-muted-foreground">{t("empty")}</p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-lg border">
                {files.map((file, index) => (
                  <div
                    key={`${file.storagePath}-${index}`}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5",
                      index < files.length - 1 && "border-b"
                    )}
                  >
                    <span
                      className="grid h-9 w-9 shrink-0 place-items-center rounded border bg-muted/50 text-muted-foreground"
                      aria-hidden
                    >
                      <FileText className="h-4 w-4" />
                    </span>
                    <button
                      type="button"
                      onClick={() => setPreviewing(index)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <span className="block truncate text-sm font-medium">{file.fileName}</span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {formatFileSize(file.fileSizeBytes)}
                      </span>
                    </button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
                      aria-label={t("remove")}
                      title={t("remove")}
                      onClick={() => remove(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT}
              multiple
              className="hidden"
              onChange={onPick}
            />
            <Button
              type="button"
              variant="outline"
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
            <p className="text-xs text-muted-foreground">{t("accepted")}</p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t("cancel")}
            </Button>
            <Button onClick={() => onApply(files)}>{t("apply")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* A sibling, not a child: nested inside the parent Dialog it would join
          that dialog's tree and render underneath it. */}
      <AttachmentPreviewDialog
        files={files}
        index={previewing}
        onIndexChange={setPreviewing}
      />
    </>
  );
}

/**
 * In-dialog preview. Images render inline; a PDF goes in an `<object>` with a
 * download fallback for browsers that will not embed one.
 *
 * Exported because two surfaces open it: the attachments dialog's file list and
 * the document panel's attachments sheet. Both pass the whole list plus an
 * index, so the filmstrip can move between files from either entry point.
 */
export function AttachmentPreviewDialog({
  files,
  index,
  onIndexChange,
}: {
  files: FrameAttachment[];
  index: number | null;
  onIndexChange: (index: number | null) => void;
}) {
  const t = useTranslations("frameAttachments");
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const file = index === null ? null : (files[index] ?? null);

  // Signed URLs expire, so one is fetched per open rather than cached.
  useEffect(() => {
    if (!file) {
      setUrl(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch(`/api/frame-attachments?path=${encodeURIComponent(file.storagePath)}`)
      .then((response) => response.json())
      .then((payload) => {
        if (cancelled) return;
        setUrl(payload?.urls?.[file.storagePath] ?? null);
      })
      .catch(() => {
        if (!cancelled) setUrl(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [file]);

  if (!file) return null;

  return (
    <Dialog open onOpenChange={(next) => (next ? null : onIndexChange(null))}>
      <DialogContent className="max-w-3xl p-0"
        /* A frame configuration is long-form work; a stray click on the
           backdrop must not discard it. Closing is deliberate only: the X, or
           Cancel. Escape is left alone as the standard accessible exit. */
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader className="flex-row items-center gap-3 space-y-0 border-b px-4 py-3">
          <div className="min-w-0 flex-1">
            <DialogTitle className="truncate text-sm">{file.fileName}</DialogTitle>
            <DialogDescription className="font-mono text-xs">
              {formatFileSize(file.fileSizeBytes)}
            </DialogDescription>
          </div>
          {url ? (
            <Button asChild variant="ghost" size="icon" className="h-8 w-8 shrink-0">
              <a href={url} download={file.fileName} aria-label={t("download")} title={t("download")}>
                <Download className="h-4 w-4" />
              </a>
            </Button>
          ) : null}
          {/* DialogContent renders its own close button; a second would just
              sit beside it. Leave the extra room for it instead. */}
          <span className="w-6 shrink-0" aria-hidden />
        </DialogHeader>

        <div className="grid max-h-[65vh] min-h-[280px] place-items-center overflow-auto bg-muted/40 p-4">
          {loading ? (
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          ) : !url ? (
            <p className="text-sm text-muted-foreground">{t("previewUnavailable")}</p>
          ) : isPreviewableImage(file.mimeType) ? (
            // eslint-disable-next-line @next/next/no-img-element -- signed URL from a private bucket, not a static asset
            <img
              src={url}
              alt={file.fileName}
              className="max-h-[60vh] max-w-full object-contain"
            />
          ) : (
            <object data={url} type={file.mimeType} className="h-[60vh] w-full">
              <p className="p-4 text-sm text-muted-foreground">{t("cannotEmbed")}</p>
            </object>
          )}
        </div>

        {files.length > 1 ? (
          <div className="flex items-center gap-2 border-t px-4 py-2">
            {files.map((entry, position) => (
              <button
                key={`${entry.storagePath}-${position}`}
                type="button"
                onClick={() => onIndexChange(position)}
                aria-label={entry.fileName}
                title={entry.fileName}
                className={cn(
                  "grid h-8 w-8 place-items-center rounded border text-muted-foreground",
                  position === index ? "border-primary border-2" : "hover:bg-muted"
                )}
              >
                <FileText className="h-3.5 w-3.5" />
              </button>
            ))}
            <span className="ml-auto font-mono text-xs text-muted-foreground">
              {t("position", { current: (index ?? 0) + 1, total: files.length })}
            </span>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
