"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Printer, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { POSTransaction } from "@/types/pos";
import { generateReceiptPDF } from "@/lib/receipt/generateReceipt";

type ReceiptPanelProps = {
  transaction: POSTransaction | null;
  open: boolean;
  onClose: () => void;
};

export function ReceiptPanel({ transaction, open, onClose }: ReceiptPanelProps) {
  const [pdfDataUrl, setPdfDataUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const generateReceipt = useCallback(async () => {
    if (!transaction) return;

    setIsGenerating(true);
    try {
      const dataUrl = await generateReceiptPDF(transaction);
      setPdfDataUrl(dataUrl);
    } catch {
    } finally {
      setIsGenerating(false);
    }
  }, [transaction]);

  useEffect(() => {
    if (open && transaction) {
      generateReceipt();
    } else {
      setPdfDataUrl(null);
    }
  }, [open, transaction, generateReceipt]);

  const handlePrint = () => {
    if (!pdfDataUrl || !transaction) return;

    // Convert data URL to blob
    const base64Data = pdfDataUrl.split(",")[1];
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: "application/pdf" });
    const blobUrl = URL.createObjectURL(blob);

    // Open in new window and print
    const printWindow = window.open(blobUrl, "_blank");

    if (printWindow) {
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print();
          // Clean up blob URL after some time
          setTimeout(() => {
            URL.revokeObjectURL(blobUrl);
          }, 1000);
        }, 250);
      };
    } else {
      // Fallback if popup blocked
      URL.revokeObjectURL(blobUrl);
    }
  };

  const handleDownload = () => {
    if (!pdfDataUrl || !transaction) return;

    const link = document.createElement("a");
    link.href = pdfDataUrl;
    link.download = `receipt-${transaction.transactionNumber}.pdf`;
    link.click();
  };

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-500 ease-out ${
          open ? "opacity-100" : "opacity-0"
        }`}
        onClick={onClose}
      />

      {/* Slide Panel */}
      <div
        className={`fixed right-0 top-0 z-50 flex h-screen w-full transform flex-col bg-background shadow-2xl transition-all duration-500 ease-out md:w-[600px] ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b p-4">
          <h2 className="text-lg font-semibold">Receipt</h2>
          <div className="flex items-center gap-2">
            {pdfDataUrl && (
              <>
                <Button variant="outline" size="sm" onClick={handlePrint}>
                  <Printer className="mr-2 h-4 w-4" />
                  Print
                </Button>
                <Button variant="outline" size="sm" onClick={handleDownload}>
                  <Download className="mr-2 h-4 w-4" />
                  Download
                </Button>
              </>
            )}
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex flex-1 justify-center overflow-hidden bg-gray-50">
          {isGenerating ? (
            <div className="flex h-full w-full items-center justify-center">
              <div className="text-center">
                <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-primary" />
                <p className="text-muted-foreground">Generating receipt...</p>
              </div>
            </div>
          ) : pdfDataUrl ? (
            <div className="flex h-full w-full justify-center overflow-auto">
              <div className="bg-white" style={{ width: "80mm", maxWidth: "100%" }}>
                <iframe
                  src={pdfDataUrl}
                  className="w-full border-0"
                  style={{ height: "100%", minHeight: "100%" }}
                  title="Receipt Preview"
                />
              </div>
            </div>
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <p className="text-muted-foreground">Failed to generate receipt</p>
            </div>
          )}
        </div>
      </div>
    </>,
    document.body
  );
}
