-- Stock request priority is stored as text, so ordering by it sorts alphabetically
-- (urgent, normal, low, high). A generated rank lets queues order urgent-first in SQL
-- while keeping the existing text contract for inserts and filters.

ALTER TABLE public.stock_requests
  ADD COLUMN priority_rank smallint GENERATED ALWAYS AS (
    CASE priority
      WHEN 'urgent' THEN 4
      WHEN 'high' THEN 3
      WHEN 'normal' THEN 2
      WHEN 'low' THEN 1
      ELSE 0
    END
  ) STORED;

COMMENT ON COLUMN public.stock_requests.priority_rank IS
  'Ordinal of priority for urgent-first ordering: urgent 4, high 3, normal 2, low 1, null 0.';

-- Supports the warehouse dashboard stock request queue: open requests for the
-- fulfilling business unit, urgent first, then soonest required date.
CREATE INDEX idx_stock_requests_open_queue_priority
  ON public.stock_requests (fulfilling_business_unit_id, priority_rank DESC, required_date)
  WHERE deleted_at IS NULL AND status IN ('submitted', 'approved');
