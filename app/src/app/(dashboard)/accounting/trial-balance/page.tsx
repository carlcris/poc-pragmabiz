'use client'

import { useState } from 'react'
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
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Download, Printer, Search, CheckCircle2, AlertTriangle } from 'lucide-react'
import type { TrialBalance } from '@/types/accounting'
import { format } from 'date-fns'

export default function TrialBalancePage() {
  const [trialBalance, setTrialBalance] = useState<TrialBalance | null>(null)
  const [loading, setLoading] = useState(false)
  const [asOfDate, setAsOfDate] = useState(() => {
    return new Date().toISOString().split('T')[0]
  })

  const fetchTrialBalance = async () => {
    if (!asOfDate) {
      return
    }

    try {
      setLoading(true)
      const params = new URLSearchParams({
        asOfDate,
      })

      const response = await fetch(`/api/accounting/trial-balance?${params.toString()}`)

      if (!response.ok) {
        throw new Error('Failed to fetch trial balance')
      }

      const result = await response.json()
      setTrialBalance(result.data)
    } catch (error) {
      console.error('Error fetching trial balance:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
    }).format(amount)
  }

  const getAccountTypeBadgeColor = (accountType: string) => {
    const colors: Record<string, string> = {
      asset: 'bg-blue-100 text-blue-800',
      liability: 'bg-red-100 text-red-800',
      equity: 'bg-purple-100 text-purple-800',
      revenue: 'bg-green-100 text-green-800',
      expense: 'bg-orange-100 text-orange-800',
      cogs: 'bg-yellow-100 text-yellow-800',
    }
    return colors[accountType] || 'bg-gray-100 text-gray-800'
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Trial Balance</h1>
          <p className="text-muted-foreground">Verify that debits equal credits</p>
        </div>
        {trialBalance && (
          <div className="flex gap-2">
            <Button variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
            <Button variant="outline">
              <Printer className="mr-2 h-4 w-4" />
              Print
            </Button>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="border rounded-lg p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>As of Date</Label>
            <Input
              type="date"
              value={asOfDate}
              onChange={(e) => setAsOfDate(e.target.value)}
            />
          </div>

          <div className="flex items-end">
            <Button
              onClick={fetchTrialBalance}
              disabled={!asOfDate || loading}
              className="w-full"
            >
              <Search className="mr-2 h-4 w-4" />
              {loading ? 'Loading...' : 'Generate Report'}
            </Button>
          </div>
        </div>
      </div>

      {/* Trial Balance Report */}
      {trialBalance && (
        <div className="space-y-4">
          {/* Report Header */}
          <div className="border rounded-lg p-4">
            <div className="flex justify-between items-center">
              <div>
                <div className="text-sm text-muted-foreground">As of</div>
                <div className="text-lg font-semibold">
                  {format(new Date(trialBalance.asOfDate), 'MMMM dd, yyyy')}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {trialBalance.isBalanced ? (
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle2 className="h-5 w-5" />
                    <span className="font-semibold">Balanced</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-red-600">
                    <AlertTriangle className="h-5 w-5" />
                    <span className="font-semibold">Not Balanced</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="border rounded-lg p-4">
              <div className="text-sm text-muted-foreground">Total Debits</div>
              <div className="text-2xl font-bold text-blue-600">
                {formatCurrency(trialBalance.totalDebits)}
              </div>
            </div>
            <div className="border rounded-lg p-4">
              <div className="text-sm text-muted-foreground">Total Credits</div>
              <div className="text-2xl font-bold text-purple-600">
                {formatCurrency(trialBalance.totalCredits)}
              </div>
            </div>
            <div className="border rounded-lg p-4">
              <div className="text-sm text-muted-foreground">Difference</div>
              <div className={`text-2xl font-bold ${
                trialBalance.isBalanced ? 'text-green-600' : 'text-red-600'
              }`}>
                {formatCurrency(Math.abs(trialBalance.totalDebits - trialBalance.totalCredits))}
              </div>
            </div>
          </div>

          {/* Trial Balance Table */}
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[150px]">Account Number</TableHead>
                  <TableHead>Account Name</TableHead>
                  <TableHead className="w-[120px]">Type</TableHead>
                  <TableHead className="text-right w-[150px]">Debit</TableHead>
                  <TableHead className="text-right w-[150px]">Credit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trialBalance.accounts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No account activity found for the selected period
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {trialBalance.accounts.map((account) => (
                      <TableRow key={account.accountNumber}>
                        <TableCell className="font-mono">{account.accountNumber}</TableCell>
                        <TableCell>{account.accountName}</TableCell>
                        <TableCell>
                          <Badge className={getAccountTypeBadgeColor(account.accountType)}>
                            {account.accountType.toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {account.debit > 0 ? formatCurrency(account.debit) : '-'}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {account.credit > 0 ? formatCurrency(account.credit) : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                    {/* Totals Row */}
                    <TableRow className="bg-muted/50 font-bold">
                      <TableCell colSpan={3}>Total</TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(trialBalance.totalDebits)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(trialBalance.totalCredits)}
                      </TableCell>
                    </TableRow>
                  </>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  )
}
