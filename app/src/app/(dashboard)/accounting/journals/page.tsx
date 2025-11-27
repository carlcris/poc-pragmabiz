'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Plus, Search, Eye, FileText } from 'lucide-react'
import type { JournalEntryWithLines, JournalEntryStatus, JournalSourceModule } from '@/types/accounting'
import { format } from 'date-fns'
import { JournalEntryFormDialog } from '@/components/accounting/JournalEntryFormDialog'
import { JournalEntryViewDialog } from '@/components/accounting/JournalEntryViewDialog'

export default function JournalsPage() {
  const [journals, setJournals] = useState<JournalEntryWithLines[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<JournalEntryStatus | 'all'>('all')
  const [sourceModuleFilter, setSourceModuleFilter] = useState<JournalSourceModule | 'all'>('all')
  const [showFormDialog, setShowFormDialog] = useState(false)
  const [showViewDialog, setShowViewDialog] = useState(false)
  const [selectedJournal, setSelectedJournal] = useState<JournalEntryWithLines | null>(null)

  useEffect(() => {
    fetchJournals()
  }, [statusFilter, sourceModuleFilter])

  const fetchJournals = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()

      if (statusFilter !== 'all') {
        params.append('status', statusFilter)
      }

      if (sourceModuleFilter !== 'all') {
        params.append('sourceModule', sourceModuleFilter)
      }

      const response = await fetch(`/api/accounting/journals?${params.toString()}`)

      if (!response.ok) {
        throw new Error('Failed to fetch journals')
      }

      const result = await response.json()
      setJournals(result.data || [])
    } catch (error) {
      console.error('Error fetching journals:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredJournals = journals.filter((journal) => {
    if (searchTerm) {
      const search = searchTerm.toLowerCase()
      return (
        journal.journalCode.toLowerCase().includes(search) ||
        journal.description?.toLowerCase().includes(search) ||
        journal.referenceCode?.toLowerCase().includes(search)
      )
    }
    return true
  })

  const getStatusBadge = (status: JournalEntryStatus) => {
    const colors: Record<JournalEntryStatus, string> = {
      draft: 'bg-yellow-100 text-yellow-800',
      posted: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800',
    }

    return (
      <Badge className={colors[status]} variant="secondary">
        {status.toUpperCase()}
      </Badge>
    )
  }

  const getSourceModuleBadge = (module: JournalSourceModule) => {
    const colors: Record<JournalSourceModule, string> = {
      AR: 'bg-blue-100 text-blue-800',
      AP: 'bg-purple-100 text-purple-800',
      Inventory: 'bg-orange-100 text-orange-800',
      Manual: 'bg-gray-100 text-gray-800',
      COGS: 'bg-yellow-100 text-yellow-800',
    }

    return (
      <Badge className={colors[module]} variant="secondary">
        {module}
      </Badge>
    )
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
    }).format(amount)
  }

  const handleViewJournal = (journal: JournalEntryWithLines) => {
    setSelectedJournal(journal)
    setShowViewDialog(true)
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Journal Entries</h1>
          <p className="text-muted-foreground">View and manage general ledger journal entries</p>
        </div>
        <Button onClick={() => setShowFormDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Journal Entry
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by journal code, description, or reference..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as JournalEntryStatus | 'all')}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="posted">Posted</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>

        <Select value={sourceModuleFilter} onValueChange={(value) => setSourceModuleFilter(value as JournalSourceModule | 'all')}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            <SelectItem value="AR">AR</SelectItem>
            <SelectItem value="AP">AP</SelectItem>
            <SelectItem value="COGS">COGS</SelectItem>
            <SelectItem value="Inventory">Inventory</SelectItem>
            <SelectItem value="Manual">Manual</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="border rounded-lg p-4">
          <div className="text-sm text-muted-foreground">Total Entries</div>
          <div className="text-2xl font-bold">{journals.length}</div>
        </div>
        <div className="border rounded-lg p-4">
          <div className="text-sm text-muted-foreground">Posted</div>
          <div className="text-2xl font-bold text-green-600">
            {journals.filter(j => j.status === 'posted').length}
          </div>
        </div>
        <div className="border rounded-lg p-4">
          <div className="text-sm text-muted-foreground">Draft</div>
          <div className="text-2xl font-bold text-yellow-600">
            {journals.filter(j => j.status === 'draft').length}
          </div>
        </div>
        <div className="border rounded-lg p-4">
          <div className="text-sm text-muted-foreground">Total Debits</div>
          <div className="text-2xl font-bold">
            {formatCurrency(journals.reduce((sum, j) => sum + Number(j.totalDebit), 0))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Journal Code</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Debit</TableHead>
              <TableHead className="text-right">Credit</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8">
                  Loading journals...
                </TableCell>
              </TableRow>
            ) : filteredJournals.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  No journal entries found
                </TableCell>
              </TableRow>
            ) : (
              filteredJournals.map((journal) => (
                <TableRow key={journal.id}>
                  <TableCell className="font-mono font-medium">{journal.journalCode}</TableCell>
                  <TableCell>{format(new Date(journal.postingDate), 'MMM dd, yyyy')}</TableCell>
                  <TableCell>{getSourceModuleBadge(journal.sourceModule)}</TableCell>
                  <TableCell className="font-mono text-sm">{journal.referenceCode || '-'}</TableCell>
                  <TableCell className="max-w-xs truncate">{journal.description || '-'}</TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrency(Number(journal.totalDebit))}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrency(Number(journal.totalCredit))}
                  </TableCell>
                  <TableCell>{getStatusBadge(journal.status)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewJournal(journal)}
                        title="View journal entry"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        title="Print journal entry"
                      >
                        <FileText className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Journal Entry Form Dialog */}
      <JournalEntryFormDialog
        open={showFormDialog}
        onOpenChange={setShowFormDialog}
        onSuccess={fetchJournals}
      />

      {/* Journal Entry View Dialog */}
      <JournalEntryViewDialog
        open={showViewDialog}
        onOpenChange={setShowViewDialog}
        journal={selectedJournal}
        onSuccess={fetchJournals}
      />
    </div>
  )
}
