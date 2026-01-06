import { useQuery } from '@tanstack/react-query'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api'

export interface StockMovementFilters {
  startDate?: string
  endDate?: string
  warehouseId?: string
  itemId?: string
  groupBy?: 'item' | 'warehouse' | 'item-warehouse'
}

export interface StockMovementData {
  itemId: string
  itemCode: string
  itemName: string
  warehouseId: string
  warehouseCode: string
  warehouseName: string
  uom: string
  totalIn: number
  totalOut: number
  netMovement: number
  totalInValue: number
  totalOutValue: number
  netValue: number
  transactionCount: number
}

export interface StockMovementResponse {
  data: StockMovementData[]
  summary: {
    totalIn: number
    totalOut: number
    netMovement: number
    totalInValue: number
    totalOutValue: number
    netValue: number
    totalTransactions: number
    itemCount: number
    warehouseCount: number
  }
  periodComparison: {
    previousPeriod: {
      startDate: string
      endDate: string
      totalIn: number
      totalOut: number
      totalInValue: number
      totalOutValue: number
    }
    changes: {
      totalInChange: number
      totalInChangePercent: number
      totalOutChange: number
      totalOutChangePercent: number
      totalInValueChange: number
      totalInValueChangePercent: number
      totalOutValueChange: number
      totalOutValueChangePercent: number
    }
  } | null
  filters: StockMovementFilters
}

export function useStockMovement(filters: StockMovementFilters) {
  return useQuery<StockMovementResponse>({
    queryKey: ['stock-movement-report', filters],
    queryFn: async () => {
      const params = new URLSearchParams()

      if (filters.startDate) params.append('startDate', filters.startDate)
      if (filters.endDate) params.append('endDate', filters.endDate)
      if (filters.warehouseId) params.append('warehouseId', filters.warehouseId)
      if (filters.itemId) params.append('itemId', filters.itemId)
      if (filters.groupBy) params.append('groupBy', filters.groupBy)

      const response = await fetch(`${API_BASE_URL}/reports/stock-movement?${params.toString()}`)

      if (!response.ok) {
        throw new Error('Failed to fetch stock movement report')
      }

      return response.json()
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}

export interface StockValuationFilters {
  warehouseId?: string
  itemId?: string
  category?: string
  groupBy?: 'item' | 'warehouse' | 'category' | 'item-warehouse'
}

export interface StockValuationData {
  groupKey: string
  groupName: string
  itemId: string | null
  itemCode: string | null
  itemName: string | null
  category: string
  warehouseId: string | null
  warehouseCode: string | null
  warehouseName: string | null
  totalQuantity: number
  totalValue: number
  averageRate: number
  uom: string
  warehouseCount: number
  itemCount: number
}

export interface StockValuationResponse {
  data: StockValuationData[]
  summary: {
    totalStockValue: number
    totalQuantity: number
    itemCount: number
    warehouseCount: number
    categoryCount: number
    averageItemValue: number
  }
  topItems: StockValuationData[]
  lowValueItems: StockValuationData[]
  categoryBreakdown: {
    category: string
    totalValue: number
    itemCount: number
    percentage: number
  }[]
  filters: StockValuationFilters
}

export function useStockValuation(filters: StockValuationFilters) {
  return useQuery<StockValuationResponse>({
    queryKey: ['stock-valuation-report', filters],
    queryFn: async () => {
      const params = new URLSearchParams()

      if (filters.warehouseId) params.append('warehouseId', filters.warehouseId)
      if (filters.itemId) params.append('itemId', filters.itemId)
      if (filters.category) params.append('category', filters.category)
      if (filters.groupBy) params.append('groupBy', filters.groupBy)

      const response = await fetch(`${API_BASE_URL}/reports/stock-valuation?${params.toString()}`)

      if (!response.ok) {
        throw new Error('Failed to fetch stock valuation report')
      }

      return response.json()
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}

export interface PackageConversionFilters {
  startDate?: string
  endDate?: string
  warehouseId?: string
  itemId?: string
  hasConversion?: boolean
  limit?: number
  offset?: number
}

export interface PackageConversionTransaction {
  id: string
  postingDate: string
  transactionCode: string
  transactionType: string
  referenceNumber: string | null
  warehouse: {
    id: string
    code: string
    name: string
  }
  item: {
    id: string
    code: string
    name: string
  }
  inputQty: number
  normalizedQty: number
  conversionFactor: number
  inputPackage: {
    id: string
    name: string
    type: string
    qtyPerPack: number
  } | null
  basePackage: {
    id: string
    name: string
    type: string
    qtyPerPack: number
  } | null
  valuationRate: number
  totalAmount: number
  usedConversion: boolean
}

export interface PackageConversionResponse {
  data: PackageConversionTransaction[]
  summary: {
    totalTransactions: number
    transactionsWithConversion: number
    transactionsWithBasePackage: number
    totalInputQty: number
    totalNormalizedQty: number
    averageConversionFactor: number
    packageTypesUsed: string[]
  }
  packageBreakdown: Array<{
    packType: string
    count: number
    totalInputQty: number
    totalNormalizedQty: number
    averageConversionFactor: number
  }>
  pagination: {
    total: number
    limit: number
    offset: number
    hasMore: boolean
  }
  filters: PackageConversionFilters
}

export function usePackageConversions(filters: PackageConversionFilters) {
  return useQuery<PackageConversionResponse>({
    queryKey: ['package-conversions-report', filters],
    queryFn: async () => {
      const params = new URLSearchParams()

      if (filters.startDate) params.append('startDate', filters.startDate)
      if (filters.endDate) params.append('endDate', filters.endDate)
      if (filters.warehouseId) params.append('warehouseId', filters.warehouseId)
      if (filters.itemId) params.append('itemId', filters.itemId)
      if (filters.hasConversion !== undefined) params.append('hasConversion', String(filters.hasConversion))
      if (filters.limit) params.append('limit', String(filters.limit))
      if (filters.offset) params.append('offset', String(filters.offset))

      const response = await fetch(`${API_BASE_URL}/reports/package-conversions?${params.toString()}`)

      if (!response.ok) {
        throw new Error('Failed to fetch package conversions report')
      }

      return response.json()
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}
