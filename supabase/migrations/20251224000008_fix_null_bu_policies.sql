-- Fix RLS policies to remove NULL business_unit_id loophole
-- This prevents records with NULL business_unit_id from being visible to all BUs

-- Step 1: Backfill NULL business_unit_id with the first available BU for each company
DO $$
DECLARE
    r RECORD;
    default_bu_id UUID;
BEGIN
    -- For each table, find records with NULL business_unit_id and assign them to a default BU

    -- Sales Invoices
    FOR r IN
        SELECT id, company_id
        FROM sales_invoices
        WHERE business_unit_id IS NULL
    LOOP
        -- Get first business unit for this company
        SELECT id INTO default_bu_id
        FROM business_units
        WHERE company_id = r.company_id
        ORDER BY created_at ASC
        LIMIT 1;

        IF default_bu_id IS NOT NULL THEN
            UPDATE sales_invoices
            SET business_unit_id = default_bu_id
            WHERE id = r.id;
            RAISE NOTICE 'Updated sales_invoice % with BU %', r.id, default_bu_id;
        END IF;
    END LOOP;

    -- Sales Orders
    FOR r IN
        SELECT id, company_id
        FROM sales_orders
        WHERE business_unit_id IS NULL
    LOOP
        SELECT id INTO default_bu_id
        FROM business_units
        WHERE company_id = r.company_id
        ORDER BY created_at ASC
        LIMIT 1;

        IF default_bu_id IS NOT NULL THEN
            UPDATE sales_orders
            SET business_unit_id = default_bu_id
            WHERE id = r.id;
            RAISE NOTICE 'Updated sales_order % with BU %', r.id, default_bu_id;
        END IF;
    END LOOP;

    -- Sales Quotations
    FOR r IN
        SELECT id, company_id
        FROM sales_quotations
        WHERE business_unit_id IS NULL
    LOOP
        SELECT id INTO default_bu_id
        FROM business_units
        WHERE company_id = r.company_id
        ORDER BY created_at ASC
        LIMIT 1;

        IF default_bu_id IS NOT NULL THEN
            UPDATE sales_quotations
            SET business_unit_id = default_bu_id
            WHERE id = r.id;
            RAISE NOTICE 'Updated sales_quotation % with BU %', r.id, default_bu_id;
        END IF;
    END LOOP;

    -- Purchase Orders
    FOR r IN
        SELECT id, company_id
        FROM purchase_orders
        WHERE business_unit_id IS NULL
    LOOP
        SELECT id INTO default_bu_id
        FROM business_units
        WHERE company_id = r.company_id
        ORDER BY created_at ASC
        LIMIT 1;

        IF default_bu_id IS NOT NULL THEN
            UPDATE purchase_orders
            SET business_unit_id = default_bu_id
            WHERE id = r.id;
            RAISE NOTICE 'Updated purchase_order % with BU %', r.id, default_bu_id;
        END IF;
    END LOOP;
END $$;

-- Step 2: Recreate RLS policies WITHOUT the NULL loophole

-- Sales Invoices
DROP POLICY IF EXISTS bu_select_policy ON sales_invoices;
DROP POLICY IF EXISTS bu_insert_policy ON sales_invoices;
DROP POLICY IF EXISTS bu_update_policy ON sales_invoices;
DROP POLICY IF EXISTS bu_delete_policy ON sales_invoices;

CREATE POLICY bu_select_policy ON sales_invoices
    FOR SELECT
    USING (business_unit_id = get_current_business_unit_id());

CREATE POLICY bu_insert_policy ON sales_invoices
    FOR INSERT
    WITH CHECK (business_unit_id = get_current_business_unit_id());

CREATE POLICY bu_update_policy ON sales_invoices
    FOR UPDATE
    USING (business_unit_id = get_current_business_unit_id());

CREATE POLICY bu_delete_policy ON sales_invoices
    FOR DELETE
    USING (business_unit_id = get_current_business_unit_id());

-- Sales Orders
DROP POLICY IF EXISTS bu_select_policy ON sales_orders;
DROP POLICY IF EXISTS bu_insert_policy ON sales_orders;
DROP POLICY IF EXISTS bu_update_policy ON sales_orders;
DROP POLICY IF EXISTS bu_delete_policy ON sales_orders;

CREATE POLICY bu_select_policy ON sales_orders
    FOR SELECT
    USING (business_unit_id = get_current_business_unit_id());

CREATE POLICY bu_insert_policy ON sales_orders
    FOR INSERT
    WITH CHECK (business_unit_id = get_current_business_unit_id());

CREATE POLICY bu_update_policy ON sales_orders
    FOR UPDATE
    USING (business_unit_id = get_current_business_unit_id());

CREATE POLICY bu_delete_policy ON sales_orders
    FOR DELETE
    USING (business_unit_id = get_current_business_unit_id());

-- Sales Quotations
DROP POLICY IF EXISTS bu_select_policy ON sales_quotations;
DROP POLICY IF EXISTS bu_insert_policy ON sales_quotations;
DROP POLICY IF EXISTS bu_update_policy ON sales_quotations;
DROP POLICY IF EXISTS bu_delete_policy ON sales_quotations;

CREATE POLICY bu_select_policy ON sales_quotations
    FOR SELECT
    USING (business_unit_id = get_current_business_unit_id());

CREATE POLICY bu_insert_policy ON sales_quotations
    FOR INSERT
    WITH CHECK (business_unit_id = get_current_business_unit_id());

CREATE POLICY bu_update_policy ON sales_quotations
    FOR UPDATE
    USING (business_unit_id = get_current_business_unit_id());

CREATE POLICY bu_delete_policy ON sales_quotations
    FOR DELETE
    USING (business_unit_id = get_current_business_unit_id());

-- Purchase Orders
DROP POLICY IF EXISTS bu_select_policy ON purchase_orders;
DROP POLICY IF EXISTS bu_insert_policy ON purchase_orders;
DROP POLICY IF EXISTS bu_update_policy ON purchase_orders;
DROP POLICY IF EXISTS bu_delete_policy ON purchase_orders;

CREATE POLICY bu_select_policy ON purchase_orders
    FOR SELECT
    USING (business_unit_id = get_current_business_unit_id());

CREATE POLICY bu_insert_policy ON purchase_orders
    FOR INSERT
    WITH CHECK (business_unit_id = get_current_business_unit_id());

CREATE POLICY bu_update_policy ON purchase_orders
    FOR UPDATE
    USING (business_unit_id = get_current_business_unit_id());

CREATE POLICY bu_delete_policy ON purchase_orders
    FOR DELETE
    USING (business_unit_id = get_current_business_unit_id());

-- Purchase Receipts
DROP POLICY IF EXISTS bu_select_policy ON purchase_receipts;
DROP POLICY IF EXISTS bu_insert_policy ON purchase_receipts;
DROP POLICY IF EXISTS bu_update_policy ON purchase_receipts;
DROP POLICY IF EXISTS bu_delete_policy ON purchase_receipts;

CREATE POLICY bu_select_policy ON purchase_receipts
    FOR SELECT
    USING (business_unit_id = get_current_business_unit_id());

CREATE POLICY bu_insert_policy ON purchase_receipts
    FOR INSERT
    WITH CHECK (business_unit_id = get_current_business_unit_id());

CREATE POLICY bu_update_policy ON purchase_receipts
    FOR UPDATE
    USING (business_unit_id = get_current_business_unit_id());

CREATE POLICY bu_delete_policy ON purchase_receipts
    FOR DELETE
    USING (business_unit_id = get_current_business_unit_id());

COMMENT ON TABLE sales_invoices IS 'RLS enforced - strict business unit isolation, no NULL allowed';
COMMENT ON TABLE sales_orders IS 'RLS enforced - strict business unit isolation, no NULL allowed';
COMMENT ON TABLE sales_quotations IS 'RLS enforced - strict business unit isolation, no NULL allowed';
COMMENT ON TABLE purchase_orders IS 'RLS enforced - strict business unit isolation, no NULL allowed';
COMMENT ON TABLE purchase_receipts IS 'RLS enforced - strict business unit isolation, no NULL allowed';
