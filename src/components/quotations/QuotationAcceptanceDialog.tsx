"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { FileText, Loader2, Paperclip, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ACCEPTANCE_CHANNELS,
  validateAcceptance,
  type AcceptanceChannel,
} from "@/lib/quotations/acceptance";

export type AcceptanceWaiver = {
  storagePath: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
};

export type AcceptancePayload = {
  acceptedByName: string;
  acceptedChannel: AcceptanceChannel;
  waivers: AcceptanceWaiver[];
};

type QuotationAcceptanceDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quotationNumber?: string;
  submitting?: boolean;
  onConfirm: (payload: AcceptancePayload) => void;
};

const ACCEPT = "image/jpeg,image/jpg,image/png,image/webp,application/pdf";
const MAX_BYTES = 10 * 1024 * 1024;

const formatSize = (bytes: number) =>
  bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

/**
 * The record taken when a customer accepts a quotation.
 *
 * Acceptance is the moment the shop commits materials and bench time, so it is
 * evidenced rather than assumed: who agreed, through which channel, and the
 * document proving it. Months later, when a job is disputed, this is what the
 * shop produces.
 *
 * Everything here is also enforced in `confirm_sales_quotation_transaction` —
 * this dialog exists to make the record easy to give, not to be the thing that
 * guarantees it.
 */
export function QuotationAcceptanceDialog({
  open,
  onOpenChange,
  quotationNumber,
  submitting = false,
  onConfirm,
}: QuotationAcceptanceDialogProps) {
  const t = useTranslations("quotationAcceptance");
  const [acceptedByName, setAcceptedByName] = useState("");
  const [acceptedChannel, setAcceptedChannel] = useState<AcceptanceChannel | "">("");
  const [waivers, setWaivers] = useState<AcceptanceWaiver[]>([]);
  const [uploading, setUploading] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // A fresh record each time: carrying the last quotation's name and channel
  // into this one is exactly the mistake that makes the record worthless.
  useEffect(() => {
    if (!open) return;
    setAcceptedByName("");
    setAcceptedChannel("");
    setWaivers([]);
    setShowErrors(false);
  }, [open]);

  const errors = validateAcceptance({
    acceptedByName,
    acceptedChannel: acceptedChannel || undefined,
    waiverPaths: waivers.map((waiver) => waiver.storagePath),
  });

  const upload = async (files: FileList) => {
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (file.size > MAX_BYTES) {
          toast.error(t("tooLarge", { name: file.name }));
          continue;
        }
        const body = new FormData();
        body.append("file", file);
        const response = await fetch("/api/quotation-waivers", { method: "POST", body });
        const payload = await response.json();
        if (!response.ok) {
          toast.error(payload?.error || t("uploadFailed"));
          continue;
        }
        setWaivers((current) => [
          ...current,
          {
            storagePath: payload.storagePath,
            fileName: payload.fileName,
            mimeType: payload.mimeType,
            fileSizeBytes: payload.fileSizeBytes,
          },
        ]);
      }
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const submit = () => {
    if (errors.length > 0) {
      setShowErrors(true);
      return;
    }
    onConfirm({
      acceptedByName: acceptedByName.trim(),
      acceptedChannel: acceptedChannel as AcceptanceChannel,
      waivers,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>
            {t("lede", { number: quotationNumber ?? t("thisQuotation") })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="accepted-by">{t("acceptedBy")} *</Label>
            <Input
              id="accepted-by"
              value={acceptedByName}
              placeholder={t("acceptedByPlaceholder")}
              onChange={(event) => setAcceptedByName(event.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="accepted-channel">{t("channel")} *</Label>
            <Select
              value={acceptedChannel}
              onValueChange={(value) => setAcceptedChannel(value as AcceptanceChannel)}
            >
              <SelectTrigger id="accepted-channel">
                <SelectValue placeholder={t("channelPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {ACCEPTANCE_CHANNELS.map((channel) => (
                  <SelectItem key={channel} value={channel}>
                    {t(`channels.${channel}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>{t("waiver")} *</Label>
            <p className="text-xs text-muted-foreground">{t("waiverHint")}</p>

            {waivers.length > 0 ? (
              <ul className="divide-y rounded-md border">
                {waivers.map((waiver) => (
                  <li
                    key={waiver.storagePath}
                    className="flex items-center gap-2 px-3 py-2 text-sm"
                  >
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">{waiver.fileName}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatSize(waiver.fileSizeBytes)}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 shrink-0 p-0 text-muted-foreground hover:text-destructive"
                      aria-label={t("removeFile", { name: waiver.fileName })}
                      onClick={() =>
                        setWaivers((current) =>
                          current.filter((entry) => entry.storagePath !== waiver.storagePath)
                        )
                      }
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
            ) : null}

            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT}
              multiple
              className="hidden"
              onChange={(event) => {
                if (event.target.files?.length) void upload(event.target.files);
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full border-dashed"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
            >
              {uploading ? (
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Paperclip className="mr-1 h-3.5 w-3.5" />
              )}
              {uploading ? t("uploading") : t("addFiles")}
            </Button>
          </div>

          {showErrors && errors.length > 0 ? (
            <ul className="space-y-1 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
              {errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t("cancel")}
          </Button>
          <Button type="button" onClick={submit} disabled={submitting || uploading}>
            {submitting ? t("confirming") : t("confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
