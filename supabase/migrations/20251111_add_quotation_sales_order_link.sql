-- Migration: Add sales_order_id to quotations for traceability
-- Description: Links quotations to sales orders when converted

-- Add sales_order_id column to sales_quotations table
ALTER TABLE sales_quotations
ADD COLUMN sales_order_id UUID REFERENCES sales_orders(id);

-- Create index for faster lookups
CREATE INDEX idx_quotations_sales_order ON sales_quotations(sales_order_id) WHERE deleted_at IS NULL;

-- Add comment
COMMENT ON COLUMN sales_quotations.sales_order_id IS 'Reference to the sales order created from this quotation';

-- Update status comment to include 'ordered'
COMMENT ON COLUMN sales_quotations.status IS 'Status: draft, sent, accepted, rejected, expired, ordered';
