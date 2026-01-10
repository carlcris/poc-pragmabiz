'use client'

import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Printer, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { POSTransaction } from '@/types/pos'
import { generateReceiptPDF } from '@/lib/receipt/generateReceipt'

type ReceiptPanelProps = {
  transaction: POSTransaction | null
  open: boolean
  onClose: () => void
}

export function ReceiptPanel({ transaction, open, onClose }: ReceiptPanelProps) {
  const [pdfDataUrl, setPdfDataUrl] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)

  const generateReceipt = useCallback(async () => {
    if (!transaction) return

    setIsGenerating(true)
    try {
      const dataUrl = await generateReceiptPDF(transaction)
      setPdfDataUrl(dataUrl)
    } catch {
    } finally {
      setIsGenerating(false)
    }
  }, [transaction])

  useEffect(() => {
    if (open && transaction) {
      generateReceipt()
    } else {
      setPdfDataUrl(null)
    }
  }, [open, transaction, generateReceipt])

  const handlePrint = () => {
    if (!pdfDataUrl || !transaction) return

    // Convert data URL to blob
    const base64Data = pdfDataUrl.split(',')[1]
    const byteCharacters = atob(base64Data)
    const byteNumbers = new Array(byteCharacters.length)
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i)
    }
    const byteArray = new Uint8Array(byteNumbers)
    const blob = new Blob([byteArray], { type: 'application/pdf' })
    const blobUrl = URL.createObjectURL(blob)

    // Open in new window and print
    const printWindow = window.open(blobUrl, '_blank')

    if (printWindow) {
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print()
          // Clean up blob URL after some time
          setTimeout(() => {
            URL.revokeObjectURL(blobUrl)
          }, 1000)
        }, 250)
      }
    } else {
      // Fallback if popup blocked
      URL.revokeObjectURL(blobUrl)
    }
  }

  const handleDownload = () => {
    if (!pdfDataUrl || !transaction) return

    const link = document.createElement('a')
    link.href = pdfDataUrl
    link.download = `receipt-${transaction.transactionNumber}.pdf`
    link.click()
  }

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/50 z-40 transition-opacity duration-500 ease-out ${
          open ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onClose}
      />

      {/* Slide Panel */}
      <div
        className={`fixed top-0 right-0 h-screen w-full md:w-[600px] bg-background shadow-2xl z-50 transform transition-all duration-500 ease-out flex flex-col ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Receipt</h2>
          <div className="flex items-center gap-2">
            {pdfDataUrl && (
              <>
                <Button variant="outline" size="sm" onClick={handlePrint}>
                  <Printer className="h-4 w-4 mr-2" />
                  Print
                </Button>
                <Button variant="outline" size="sm" onClick={handleDownload}>
                  <Download className="h-4 w-4 mr-2" />
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
        <div className="flex-1 overflow-hidden bg-gray-50 flex justify-center">
          {isGenerating ? (
            <div className="flex items-center justify-center h-full w-full">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
                <p className="text-muted-foreground">Generating receipt...</p>
              </div>
            </div>
          ) : pdfDataUrl ? (
            <div className="w-full h-full overflow-auto flex justify-center">
              <div className="bg-white" style={{ width: '80mm', maxWidth: '100%' }}>
                <iframe
                  src={pdfDataUrl}
                  className="w-full border-0"
                  style={{ height: '100%', minHeight: '100%' }}
                  title="Receipt Preview"
                />
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full w-full">
              <p className="text-muted-foreground">Failed to generate receipt</p>
            </div>
          )}
        </div>
      </div>
    </>,
    document.body
  )
}
