BEGIN;

UPDATE public.permissions
SET
  label = 'Stock Requisition Total Amount',
  description = 'Allows viewing the Total Amount column and detail amount fields on stock requisitions.',
  updated_at = NOW()
WHERE resource = 'stock_requisitions.field.total_amount.view';

UPDATE public.permissions
SET
  label = 'Stock Requisition Unit Cost',
  description = 'Allows viewing and entering stock requisition line unit costs.',
  updated_at = NOW()
WHERE resource = 'stock_requisitions.field.unit_cost.view';

COMMIT;
