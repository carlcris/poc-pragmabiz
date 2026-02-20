-- Migration: Remove legacy SR/DN warehouse columns after canonical cutover
-- Date: 2026-02-17

BEGIN;

-- Recompile delivery-note posting functions to use canonical columns.
DO $$
DECLARE
  v_sig regprocedure;
  v_def text;
  v_new_def text;
BEGIN
  FOR v_sig, v_def IN
    SELECT
      p.oid::regprocedure,
      pg_get_functiondef(p.oid)
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('post_delivery_note_dispatch', 'post_delivery_note_receive')
  LOOP
    v_new_def := replace(v_def, 'source_entity_id', 'requesting_warehouse_id');
    v_new_def := replace(v_new_def, 'destination_entity_id', 'fulfilling_warehouse_id');

    IF v_new_def <> v_def THEN
      EXECUTE v_new_def;
    END IF;
  END LOOP;
END $$;

-- Remove compatibility triggers/functions from previous migration.
DROP TRIGGER IF EXISTS trg_sync_stock_requests_warehouse_columns ON stock_requests;
DROP TRIGGER IF EXISTS trg_sync_delivery_notes_warehouse_columns ON delivery_notes;
DROP TRIGGER IF EXISTS trg_sync_delivery_note_items_warehouse_columns ON delivery_note_items;

DROP FUNCTION IF EXISTS sync_stock_requests_warehouse_columns();
DROP FUNCTION IF EXISTS sync_delivery_notes_warehouse_columns();
DROP FUNCTION IF EXISTS sync_delivery_note_items_warehouse_columns();

-- Recreate stock request RLS policies against canonical column names.
DROP POLICY IF EXISTS bu_select_policy ON stock_requests;
CREATE POLICY bu_select_policy ON stock_requests
    FOR SELECT
    TO authenticated
    USING (
        business_unit_id IN (
            SELECT business_unit_id
            FROM user_business_unit_access
            WHERE user_id = auth.uid()
        )
        OR requesting_warehouse_id IN (
            SELECT w.id
            FROM warehouses w
            WHERE w.business_unit_id IN (
                SELECT business_unit_id
                FROM user_business_unit_access
                WHERE user_id = auth.uid()
            )
        )
        OR fulfilling_warehouse_id IN (
            SELECT w.id
            FROM warehouses w
            WHERE w.business_unit_id IN (
                SELECT business_unit_id
                FROM user_business_unit_access
                WHERE user_id = auth.uid()
            )
        )
    );

DROP POLICY IF EXISTS bu_update_policy ON stock_requests;
CREATE POLICY bu_update_policy ON stock_requests
    FOR UPDATE
    TO authenticated
    USING (
        business_unit_id IN (
            SELECT business_unit_id
            FROM user_business_unit_access
            WHERE user_id = auth.uid()
        )
        OR requesting_warehouse_id IN (
            SELECT w.id
            FROM warehouses w
            WHERE w.business_unit_id IN (
                SELECT business_unit_id
                FROM user_business_unit_access
                WHERE user_id = auth.uid()
            )
        )
        OR fulfilling_warehouse_id IN (
            SELECT w.id
            FROM warehouses w
            WHERE w.business_unit_id IN (
                SELECT business_unit_id
                FROM user_business_unit_access
                WHERE user_id = auth.uid()
            )
        )
    );

DROP POLICY IF EXISTS bu_delete_policy ON stock_requests;
CREATE POLICY bu_delete_policy ON stock_requests
    FOR DELETE
    TO authenticated
    USING (
        business_unit_id IN (
            SELECT business_unit_id
            FROM user_business_unit_access
            WHERE user_id = auth.uid()
        )
        OR requesting_warehouse_id IN (
            SELECT w.id
            FROM warehouses w
            WHERE w.business_unit_id IN (
                SELECT business_unit_id
                FROM user_business_unit_access
                WHERE user_id = auth.uid()
            )
        )
        OR fulfilling_warehouse_id IN (
            SELECT w.id
            FROM warehouses w
            WHERE w.business_unit_id IN (
                SELECT business_unit_id
                FROM user_business_unit_access
                WHERE user_id = auth.uid()
            )
        )
    );

DROP POLICY IF EXISTS bu_select_policy ON stock_request_items;
CREATE POLICY bu_select_policy ON stock_request_items
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM stock_requests sr
            WHERE sr.id = stock_request_items.stock_request_id
            AND (
                sr.business_unit_id IN (
                    SELECT business_unit_id
                    FROM user_business_unit_access
                    WHERE user_id = auth.uid()
                )
                OR sr.requesting_warehouse_id IN (
                    SELECT w.id
                    FROM warehouses w
                    WHERE w.business_unit_id IN (
                        SELECT business_unit_id
                        FROM user_business_unit_access
                        WHERE user_id = auth.uid()
                    )
                )
                OR sr.fulfilling_warehouse_id IN (
                    SELECT w.id
                    FROM warehouses w
                    WHERE w.business_unit_id IN (
                        SELECT business_unit_id
                        FROM user_business_unit_access
                        WHERE user_id = auth.uid()
                    )
                )
            )
        )
    );

DROP POLICY IF EXISTS bu_update_policy ON stock_request_items;
CREATE POLICY bu_update_policy ON stock_request_items
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM stock_requests sr
            WHERE sr.id = stock_request_items.stock_request_id
            AND (
                sr.business_unit_id IN (
                    SELECT business_unit_id
                    FROM user_business_unit_access
                    WHERE user_id = auth.uid()
                )
                OR sr.requesting_warehouse_id IN (
                    SELECT w.id
                    FROM warehouses w
                    WHERE w.business_unit_id IN (
                        SELECT business_unit_id
                        FROM user_business_unit_access
                        WHERE user_id = auth.uid()
                    )
                )
                OR sr.fulfilling_warehouse_id IN (
                    SELECT w.id
                    FROM warehouses w
                    WHERE w.business_unit_id IN (
                        SELECT business_unit_id
                        FROM user_business_unit_access
                        WHERE user_id = auth.uid()
                    )
                )
            )
        )
    );

DROP POLICY IF EXISTS bu_delete_policy ON stock_request_items;
CREATE POLICY bu_delete_policy ON stock_request_items
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM stock_requests sr
            WHERE sr.id = stock_request_items.stock_request_id
            AND (
                sr.business_unit_id IN (
                    SELECT business_unit_id
                    FROM user_business_unit_access
                    WHERE user_id = auth.uid()
                )
                OR sr.requesting_warehouse_id IN (
                    SELECT w.id
                    FROM warehouses w
                    WHERE w.business_unit_id IN (
                        SELECT business_unit_id
                        FROM user_business_unit_access
                        WHERE user_id = auth.uid()
                    )
                )
                OR sr.fulfilling_warehouse_id IN (
                    SELECT w.id
                    FROM warehouses w
                    WHERE w.business_unit_id IN (
                        SELECT business_unit_id
                        FROM user_business_unit_access
                        WHERE user_id = auth.uid()
                    )
                )
            )
        )
    );

-- Drop legacy constraints/indexes tied to old columns.
ALTER TABLE stock_requests DROP CONSTRAINT IF EXISTS stock_requests_source_warehouse_id_fkey;
ALTER TABLE stock_requests DROP CONSTRAINT IF EXISTS stock_requests_destination_warehouse_id_fkey;
DROP INDEX IF EXISTS idx_stock_requests_warehouse;

ALTER TABLE delivery_notes DROP CONSTRAINT IF EXISTS delivery_notes_source_entity_id_fkey;
ALTER TABLE delivery_notes DROP CONSTRAINT IF EXISTS delivery_notes_destination_entity_id_fkey;
ALTER TABLE delivery_notes DROP CONSTRAINT IF EXISTS delivery_notes_source_destination_check;
DROP INDEX IF EXISTS idx_dn_source_dest;

ALTER TABLE delivery_note_items DROP CONSTRAINT IF EXISTS delivery_note_items_source_entity_id_fkey;
ALTER TABLE delivery_note_items DROP CONSTRAINT IF EXISTS delivery_note_items_destination_entity_id_fkey;
ALTER TABLE delivery_note_items DROP CONSTRAINT IF EXISTS delivery_note_items_source_destination_check;
DROP INDEX IF EXISTS idx_dni_company_route;

-- Remove legacy columns.
ALTER TABLE stock_requests
  DROP COLUMN IF EXISTS source_warehouse_id,
  DROP COLUMN IF EXISTS destination_warehouse_id;

ALTER TABLE delivery_notes
  DROP COLUMN IF EXISTS source_entity_id,
  DROP COLUMN IF EXISTS destination_entity_id;

ALTER TABLE delivery_note_items
  DROP COLUMN IF EXISTS source_entity_id,
  DROP COLUMN IF EXISTS destination_entity_id;

COMMIT;
