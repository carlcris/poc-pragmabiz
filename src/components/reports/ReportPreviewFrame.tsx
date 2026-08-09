"use client";

import { useCallback, useEffect, useState } from "react";
import { Eye, Loader2 } from "lucide-react";

export const PDF_REPORT_ROW_LIMIT = 500;

type ReportPreviewFrameProps = {
  url: string | null;
  isGenerating: boolean;
  emptyLabel: string;
  loadingLabel: string;
  title: string;
};

export function ReportPreviewFrame({
  url,
  isGenerating,
  emptyLabel,
  loadingLabel,
  title,
}: ReportPreviewFrameProps) {
  if (isGenerating) {
    return (
      <div className="flex h-full min-h-[560px] items-center justify-center rounded-lg border bg-muted/30">
        <div className="text-center">
          <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{loadingLabel}</p>
        </div>
      </div>
    );
  }

  if (!url) {
    return (
      <div className="flex h-full min-h-[560px] items-center justify-center rounded-lg border border-dashed bg-muted/20 px-6 text-center">
        <div className="max-w-sm space-y-2">
          <Eye className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{emptyLabel}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full min-h-[560px] overflow-hidden rounded-lg border bg-white">
      <iframe src={url} title={title} className="h-full min-h-[560px] w-full border-0" />
    </div>
  );
}

export function useReportPdfPreviewState(open: boolean) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);

  useEffect(() => {
    if (!open && previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  }, [open, previewUrl]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const replacePreviewUrl = useCallback((nextUrl: string | null) => {
    setPreviewUrl((currentUrl) => {
      if (currentUrl) URL.revokeObjectURL(currentUrl);
      return nextUrl;
    });
  }, []);

  return {
    previewUrl,
    isGeneratingPreview,
    setIsGeneratingPreview,
    replacePreviewUrl,
  };
}
