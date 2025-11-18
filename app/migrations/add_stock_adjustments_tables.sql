-- Create stock_adjustments table
CREATE TABLE IF NOT EXISTS public.stock_adjustments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    adjustment_code VARCHAR(50) NOT NULL,
    adjustment_type VARCHAR(50) NOT NULL CHECK (adjustment_type IN ('physical_count', 'damage', 'loss', 'found', 'quality_issue', 'other')),
    adjustment_date DATE NOT NULL,
    warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE RESTRICT,
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'approved', 'posted', 'rejected')),
    reason TEXT NOT NULL,
    notes TEXT,
    total_value DECIMAL(15, 2) NOT NULL DEFAULT 0,
    stock_transaction_id UUID REFERENCES public.stock_transactions(id) ON DELETE SET NULL,
    approved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    approved_at TIMESTAMP WITH TIME ZONE,
    posted_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    posted_at TIMESTAMP WITH TIME ZONE,
    created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    updated_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(company_id, adjustment_code)
);

-- Create stock_adjustment_items table
CREATE TABLE IF NOT EXISTS public.stock_adjustment_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    adjustment_id UUID NOT NULL REFERENCES public.stock_adjustments(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE RESTRICT,
    item_code VARCHAR(50) NOT NULL,
    item_name VARCHAR(255) NOT NULL,
    current_qty DECIMAL(15, 4) NOT NULL,
    adjusted_qty DECIMAL(15, 4) NOT NULL,
    difference DECIMAL(15, 4) NOT NULL,
    unit_cost DECIMAL(15, 2) NOT NULL,
    total_cost DECIMAL(15, 2) NOT NULL,
    uom_id UUID NOT NULL REFERENCES public.uoms(id) ON DELETE RESTRICT,
    uom_name VARCHAR(50),
    reason TEXT,
    created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    updated_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_stock_adjustments_company_id ON public.stock_adjustments(company_id);
CREATE INDEX IF NOT EXISTS idx_stock_adjustments_warehouse_id ON public.stock_adjustments(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_stock_adjustments_status ON public.stock_adjustments(status);
CREATE INDEX IF NOT EXISTS idx_stock_adjustments_adjustment_date ON public.stock_adjustments(adjustment_date);
CREATE INDEX IF NOT EXISTS idx_stock_adjustments_deleted_at ON public.stock_adjustments(deleted_at);

CREATE INDEX IF NOT EXISTS idx_stock_adjustment_items_company_id ON public.stock_adjustment_items(company_id);
CREATE INDEX IF NOT EXISTS idx_stock_adjustment_items_adjustment_id ON public.stock_adjustment_items(adjustment_id);
CREATE INDEX IF NOT EXISTS idx_stock_adjustment_items_item_id ON public.stock_adjustment_items(item_id);

-- Add comments
COMMENT ON TABLE public.stock_adjustments IS 'Stock adjustments for inventory corrections';
COMMENT ON TABLE public.stock_adjustment_items IS 'Line items for stock adjustments';

-- Enable Row Level Security
ALTER TABLE public.stock_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_adjustment_items ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view adjustments from their company" ON public.stock_adjustments
    FOR SELECT USING (company_id = (SELECT company_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can insert adjustments to their company" ON public.stock_adjustments
    FOR INSERT WITH CHECK (company_id = (SELECT company_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can update adjustments in their company" ON public.stock_adjustments
    FOR UPDATE USING (company_id = (SELECT company_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can delete adjustments in their company" ON public.stock_adjustments
    FOR DELETE USING (company_id = (SELECT company_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can view adjustment items from their company" ON public.stock_adjustment_items
    FOR SELECT USING (company_id = (SELECT company_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can insert adjustment items to their company" ON public.stock_adjustment_items
    FOR INSERT WITH CHECK (company_id = (SELECT company_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can update adjustment items in their company" ON public.stock_adjustment_items
    FOR UPDATE USING (company_id = (SELECT company_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can delete adjustment items in their company" ON public.stock_adjustment_items
    FOR DELETE USING (company_id = (SELECT company_id FROM public.users WHERE id = auth.uid()));
