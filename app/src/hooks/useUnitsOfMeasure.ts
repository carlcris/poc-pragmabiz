import { useQuery } from '@tanstack/react-query'
import { unitsOfMeasureApi } from '@/lib/api/units-of-measure'

const UNITS_OF_MEASURE_QUERY_KEY = 'units-of-measure'

export function useUnitsOfMeasure() {
  return useQuery({
    queryKey: [UNITS_OF_MEASURE_QUERY_KEY],
    queryFn: () => unitsOfMeasureApi.getUnits(),
    staleTime: 1000 * 60 * 5,
  })
}
