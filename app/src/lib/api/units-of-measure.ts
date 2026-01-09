import type { UnitsOfMeasureResponse } from '@/types/uom'

const API_BASE = '/api/units-of-measure'

export const unitsOfMeasureApi = {
  getUnits: async (): Promise<UnitsOfMeasureResponse> => {
    const response = await fetch(API_BASE, {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    })
    if (!response.ok) throw new Error('Failed to fetch units of measure')
    return response.json()
  },
}
