'use client'

import { useState, useMemo } from 'react'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Search, Eye, Printer, XCircle } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { DateRangePicker } from '@/components/analytics/date-range-picker'
import { DataTablePagination } from '@/components/shared/DataTablePagination'
import { AdminPinDialog } from '@/components/pos/AdminPinDialog'
import { ReceiptPanel } from '@/components/pos/ReceiptPanel'
import { usePOSTransactions, useVoidPOSTransaction } from '@/hooks/usePos'
import { TransactionDetailsDialog } from '@/components/pos/TransactionDetailsDialog'
import type { POSTransaction } from '@/types/pos'
import type { DateRange } from 'react-day-picker'

export default function POSTransactionsPage() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [dateRange, setDateRange] = useState<DateRange | undefined>()
  const [cashierFilter, setCashierFilter] = useState<string>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(5)
  const [selectedTransaction, setSelectedTransaction] = useState<POSTransaction | null>(null)
  const [transactionToVoid, setTransactionToVoid] = useState<POSTransaction | null>(null)
  const [showAdminPinDialog, setShowAdminPinDialog] = useState(false)
  const [showVoidConfirmDialog, setShowVoidConfirmDialog] = useState(false)
  const [receiptTransaction, setReceiptTransaction] = useState<POSTransaction | null>(null)
  const [showReceiptPanel, setShowReceiptPanel] = useState(false)

  const queryParams = useMemo(() => {
    const params: Record<string, string | number | undefined> = {
      search: search || undefined,
      status: statusFilter !== 'all' ? statusFilter : undefined,
      dateFrom: dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : undefined,
      dateTo: dateRange?.to ? format(dateRange.to, 'yyyy-MM-dd') : undefined,
      cashierId: cashierFilter !== 'all' ? cashierFilter : undefined,
      page: currentPage,
      limit: pageSize,
    }
    // Remove undefined values
    return Object.fromEntries(
      Object.entries(params).filter(([_, v]) => v !== undefined)
    ) as Record<string, string | number>
  }, [search, statusFilter, dateRange, cashierFilter, currentPage, pageSize])

  const { data, isLoading } = usePOSTransactions(queryParams)
  const voidTransaction = useVoidPOSTransaction()

  const transactions = data?.data || []

  // Get unique cashiers for filter dropdown
  const uniqueCashiers = useMemo(() => {
    const cashiers = new Map<string, string>()
    transactions.forEach((txn: POSTransaction) => {
      if (txn.cashierId && txn.cashierName) {
        cashiers.set(txn.cashierId, txn.cashierName)
      }
    })
    return Array.from(cashiers.entries()).map(([id, name]) => ({ id, name }))
  }, [transactions])

  const handleVoidClick = (transaction: POSTransaction) => {
    setTransactionToVoid(transaction)
    setShowAdminPinDialog(true)
  }

  const handleAdminPinVerify = async (pin: string): Promise<boolean> => {
    // Hardcoded admin PIN for now
    const ADMIN_PIN = '0000'

    if (pin === ADMIN_PIN) {
      setShowAdminPinDialog(false)
      setShowVoidConfirmDialog(true)
      return true
    }

    return false
  }

  const handleVoidTransaction = async () => {
    if (transactionToVoid) {
      await voidTransaction.mutateAsync(transactionToVoid.id)
      setTransactionToVoid(null)
      setShowVoidConfirmDialog(false)
    }
  }

  const handleCancelVoid = () => {
    setTransactionToVoid(null)
    setShowAdminPinDialog(false)
    setShowVoidConfirmDialog(false)
  }

  const handlePrintReceipt = (transaction: POSTransaction) => {
    setReceiptTransaction(transaction)
    setShowReceiptPanel(true)
  }

  const handleCloseReceipt = () => {
    setShowReceiptPanel(false)
    setReceiptTransaction(null)
  }

  const handleClearFilters = () => {
    setSearch('')
    setStatusFilter('all')
    setDateRange(undefined)
    setCashierFilter('all')
    setCurrentPage(1)
  }

  // Reset to page 1 when filters change
  const handleSearchChange = (value: string) => {
    setSearch(value)
    setCurrentPage(1)
  }

  const handleStatusChange = (value: string) => {
    setStatusFilter(value)
    setCurrentPage(1)
  }

  const handleDateRangeChange = (range: DateRange | undefined) => {
    setDateRange(range)
    setCurrentPage(1)
  }

  const handleCashierChange = (value: string) => {
    setCashierFilter(value)
    setCurrentPage(1)
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'PHP',
    }).format(amount)
  }

  const formatDateTime = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMM dd, yyyy hh:mm a')
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

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">POS Transactions</h1>
          <p className="text-sm md:text-base text-muted-foreground">View and manage point of sale transactions</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <div className="border rounded-lg p-3 md:p-4">
          <div className="text-xs md:text-sm text-muted-foreground">Total Transactions</div>
          <div className="text-xl md:text-2xl font-bold">{transactions.length}</div>
        </div>
        <div className="border rounded-lg p-3 md:p-4">
          <div className="text-xs md:text-sm text-muted-foreground">Completed</div>
          <div className="text-xl md:text-2xl font-bold text-green-600">
            {transactions.filter((t: POSTransaction) => t.status === 'completed').length}
          </div>
        </div>
        <div className="border rounded-lg p-3 md:p-4">
          <div className="text-xs md:text-sm text-muted-foreground">Voided</div>
          <div className="text-xl md:text-2xl font-bold text-gray-500">
            {transactions.filter((t: POSTransaction) => t.status === 'voided').length}
          </div>
        </div>
        <div className="border rounded-lg p-3 md:p-4">
          <div className="text-xs md:text-sm text-muted-foreground">Total Sales</div>
          <div className="text-lg md:text-2xl font-bold">
            {formatCurrency(
              transactions
                .filter((t: POSTransaction) => t.status === 'completed')
                .reduce((sum: number, t: POSTransaction) => sum + t.totalAmount, 0)
            )}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by transaction number, customer, or cashier..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-10"
            />
          </div>

          <Select value={statusFilter} onValueChange={handleStatusChange}>
            <SelectTrigger className="w-full md:w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="voided">Voided</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center">
          <div className="w-full md:w-[300px]">
            <DateRangePicker value={dateRange} onChange={handleDateRangeChange} />
          </div>

          <Select value={cashierFilter} onValueChange={handleCashierChange}>
            <SelectTrigger className="w-full md:w-[200px]">
              <SelectValue placeholder="All Cashiers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Cashiers</SelectItem>
              {uniqueCashiers.map((cashier) => (
                <SelectItem key={cashier.id} value={cashier.id}>
                  {cashier.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {(search || statusFilter !== 'all' || dateRange || cashierFilter !== 'all') && (
            <Button variant="ghost" onClick={handleClearFilters} className="w-full md:w-auto">
              Clear Filters
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="max-h-[calc(100vh-400px)] overflow-y-auto rounded-md border">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                <TableHead>Transaction #</TableHead>
                <TableHead>Date & Time</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Cashier</TableHead>
                <TableHead>Items</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  Loading transactions...
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      ) : transactions.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground rounded-md border">
          {search || statusFilter !== 'all' || dateRange || cashierFilter !== 'all'
            ? 'No transactions found matching your filters'
            : 'No transactions yet'}
        </div>
      ) : (
        <>
          <div className="max-h-[calc(100vh-400px)] overflow-y-auto rounded-md border">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead>Transaction #</TableHead>
                  <TableHead>Date & Time</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Cashier</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((transaction: POSTransaction) => (
                  <TableRow key={transaction.id}>
                    <TableCell className="font-mono font-medium">
                      {transaction.transactionNumber}
                    </TableCell>
                    <TableCell>{formatDateTime(transaction.transactionDate)}</TableCell>
                    <TableCell>
                      {transaction.customerName || (
                        <span className="text-muted-foreground italic">Walk-in Customer</span>
                      )}
                    </TableCell>
                    <TableCell>{transaction.cashierName}</TableCell>
                    <TableCell>{transaction.items.length} items</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(transaction.totalAmount)}
                    </TableCell>
                    <TableCell>{getStatusBadge(transaction.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedTransaction(transaction)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Print Receipt"
                          onClick={() => handlePrintReceipt(transaction)}
                        >
                          <Printer className="h-4 w-4" />
                        </Button>
                        {transaction.status === 'completed' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Void Transaction"
                            onClick={() => handleVoidClick(transaction)}
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {data?.pagination && data.pagination.total > 0 && (
            <div className="mt-4">
              <DataTablePagination
                currentPage={currentPage}
                totalPages={data.pagination.totalPages}
                pageSize={pageSize}
                totalItems={data.pagination.total}
                onPageChange={setCurrentPage}
                onPageSizeChange={setPageSize}
              />
            </div>
          )}
        </>
      )}

      {/* Transaction Details Dialog */}
      <TransactionDetailsDialog
        transaction={selectedTransaction}
        open={!!selectedTransaction}
        onOpenChange={(open) => !open && setSelectedTransaction(null)}
      />

      {/* Admin PIN Verification Dialog */}
      <AdminPinDialog
        open={showAdminPinDialog}
        onOpenChange={handleCancelVoid}
        onVerify={handleAdminPinVerify}
        title="Administrator Verification Required"
        description="Please enter administrator PIN to void this transaction."
      />

      {/* Void Confirmation Dialog */}
      <AlertDialog open={showVoidConfirmDialog} onOpenChange={handleCancelVoid}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Void Transaction</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to void transaction{' '}
              <span className="font-mono font-semibold">{transactionToVoid?.transactionNumber}</span>?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelVoid}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleVoidTransaction} className="bg-red-600 hover:bg-red-700">
              Void Transaction
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Receipt Panel */}
      <ReceiptPanel
        transaction={receiptTransaction}
        open={showReceiptPanel}
        onClose={handleCloseReceipt}
      />
    </div>
  )
}
