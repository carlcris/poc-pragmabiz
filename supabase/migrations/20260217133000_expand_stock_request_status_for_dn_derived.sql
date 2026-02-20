-- Allow DN-derived SR statuses in stock_requests.status cache.

BEGIN;

ALTER TABLE stock_requests
DROP CONSTRAINT IF EXISTS stock_requests_status_check;

ALTER TABLE stock_requests
ADD CONSTRAINT stock_requests_status_check
CHECK (
  status IN (
    'draft',
    'submitted',
    'approved',
    'ready_for_pick',
    'picking',
    'picked',
    'delivered',
    'received',
    'completed',
    'cancelled',
    'allocating',
    'partially_allocated',
    'allocated',
    'dispatched',
    'partially_fulfilled',
    'fulfilled'
  )
);

COMMENT ON COLUMN stock_requests.status IS
  'Workflow + derived cache status: draft/submitted/approved/ready_for_pick/picking/picked/delivered/received/completed/cancelled + allocating/partially_allocated/allocated/dispatched/partially_fulfilled/fulfilled';

COMMIT;
