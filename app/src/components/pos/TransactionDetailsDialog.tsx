'use client'

import { format } from 'date-fns'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Printer } from 'lucide-react'
import type { POSTransaction } from '@/types/pos'

type TransactionDetailsDialogProps = {
  transaction: POSTransaction | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function TransactionDetailsDialog({
  transaction,
  open,
  onOpenChange,
}: TransactionDetailsDialogProps) {
  if (!transaction) return null

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'PHP',
    }).format(amount)
  }

  const formatDateTime = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMMM dd, yyyy hh:mm a')
    } catch {
      return dateString
    }
  }

  const getStatusBadge = (status: string) => {
    if (status === 'completed') {
      return <Badge className="bg-green-100 text-green-800">Completed</Badge>
    }
    if (status === 'voided') {
      return <Badge variant="secondary">Voided</Badge>
    }
    return <Badge>{status}</Badge>
  }

  const handlePrint = () => {
    // TODO: Implement print functionality
    console.log('Print receipt for transaction:', transaction.id)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Transaction Details</DialogTitle>
            <Button onClick={handlePrint} variant="outline" size="sm">
              <Printer className="mr-2 h-4 w-4" />
              Print Receipt
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Transaction Header */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-muted-foreground">Transaction Number</div>
              <div className="font-mono font-medium">{transaction.transactionNumber}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Date & Time</div>
              <div className="font-medium">{formatDateTime(transaction.transactionDate)}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Cashier</div>
              <div className="font-medium">{transaction.cashierName}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Customer</div>
              <div className="font-medium">
                {transaction.customerName || (
                  <span className="text-muted-foreground italic">Walk-in Customer</span>
                )}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Status</div>
              <div>{getStatusBadge(transaction.status)}</div>
            </div>
          </div>

          <Separator />

          {/* Items Table */}
          <div>
            <h3 className="font-semibold mb-3">Items</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead className="text-right">Discount</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transaction.items.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <div className="font-medium">{item.itemName}</div>
                      <div className="text-sm text-muted-foreground">{item.itemCode}</div>
                    </TableCell>
                    <TableCell className="text-right">{item.quantity}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.unitPrice)}</TableCell>
                    <TableCell className="text-right">
                      {item.discount > 0 ? `${item.discount}%` : '-'}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(item.lineTotal)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <Separator />

          {/* Totals */}
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-medium">{formatCurrency(transaction.subtotal)}</span>
            </div>
            {transaction.totalDiscount > 0 && (
              <div className="flex justify-between text-red-600">
                <span>Discount</span>
                <span>-{formatCurrency(transaction.totalDiscount)}</span>
              </div>
            )}
            {transaction.totalTax > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Tax ({transaction.taxRate}%)
                </span>
                <span className="font-medium">{formatCurrency(transaction.totalTax)}</span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between text-lg">
              <span className="font-semibold">Total Amount</span>
              <span className="font-bold">{formatCurrency(transaction.totalAmount)}</span>
            </div>
          </div>

          <Separator />

          {/* Payment Details */}
          <div>
            <h3 className="font-semibold mb-3">Payment</h3>
            <div className="space-y-2">
              {transaction.payments.map((payment, index) => (
                <div key={index} className="flex justify-between">
                  <span className="text-muted-foreground capitalize">{payment.method}</span>
                  <span className="font-medium">{formatCurrency(payment.amount)}</span>
                </div>
              ))}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount Paid</span>
                <span className="font-medium">{formatCurrency(transaction.amountPaid)}</span>
              </div>
              {transaction.changeAmount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Change</span>
                  <span className="font-medium">{formatCurrency(transaction.changeAmount)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          {transaction.notes && (
            <>
              <Separator />
              <div>
                <h3 className="font-semibold mb-2">Notes</h3>
                <p className="text-sm text-muted-foreground">{transaction.notes}</p>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
