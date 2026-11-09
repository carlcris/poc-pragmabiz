-- Seed data for development
-- This file will be executed after migrations when running `supabase db reset`

SELECT set_config('app.skip_reorder_notification_sync', 'true', false);

-- ============================================================================
-- SEED DATA: Companies
-- ============================================================================

INSERT INTO companies (id, code, name, legal_name, tax_id, email, phone, address_line1, city, state, country, postal_code, currency_code, is_active)
VALUES
    ('1e10e2dd-655e-41e0-a508-edfd660a9bcf', 'AIS', 'Achlers Integrated Sales', 'Achlers Integrated Sales', '123-456-789', 'contact@achlers.com', '+63-917-123-4567', '123 Business St', 'Davao City', 'Davao del Sur', 'Philippines', '8000', 'PHP', true);

-- ============================================================================
-- SEED DATA: Default Business Unit
-- ============================================================================

INSERT INTO business_units (id, company_id, code, name, type, is_active, created_at, updated_at)
VALUES
  (
    'd69c52d5-6755-4e28-87e3-24c680a5897b',
    '1e10e2dd-655e-41e0-a508-edfd660a9bcf',
    'MAIN',
    'Main-Bulacan',
    'primary',
    true,
    now(),
    now()
  ),
  (
    'd5d09f49-c3d7-4f24-aca9-57bea45e0a54',
    '1e10e2dd-655e-41e0-a508-edfd660a9bcf',
    'WH-BRANCH 01',
    'Bambang',
    'warehouse',
    true,
    now(),
    now()
  ),
  (
    'bbce384d-dd71-441c-a5e3-2b5e5d1543ce',
    '1e10e2dd-655e-41e0-a508-edfd660a9bcf',
    'STR-BRANCH 02',
    'Abad Santos',
    'store',
    true,
    now(),
    now()
  );

-- ============================================================================
-- SEED DATA: Auth Users
-- ============================================================================
-- Auth users are seeded in this file (auth.users + public.users + role assignments).

-- ============================================================================
-- SEED DATA: Units of Measure
-- ============================================================================

-- Common units for picture frame business (deterministic IDs for FK references below)
INSERT INTO "public"."units_of_measure"("id","company_id","code","name","symbol","is_base_unit","is_active","created_at","created_by","updated_at","updated_by","deleted_at","version")
VALUES
('3c85b916-e9bd-492a-b770-b9af41c9c1f3','1e10e2dd-655e-41e0-a508-edfd660a9bcf','PCS','Pieces','pcs',TRUE,TRUE,'2026-02-20 01:54:02.288286',NULL,'2026-02-20 02:29:46.822541',NULL,NULL,1),
('6a8496ec-5964-4540-ae7c-7d6adeefb583','1e10e2dd-655e-41e0-a508-edfd660a9bcf','BOX','Box','box',FALSE,TRUE,'2026-02-20 01:54:02.288286',NULL,'2026-02-20 02:29:46.822541',NULL,NULL,1),
('bb8a0618-0bd2-46cd-b049-dd5fde6971a6','1e10e2dd-655e-41e0-a508-edfd660a9bcf','FT','Feet','ft',TRUE,TRUE,'2026-02-20 01:54:02.288286',NULL,'2026-02-20 02:29:46.822541',NULL,NULL,1),
('2c9c1f88-6262-4e51-ba4b-e51d8945aa35','1e10e2dd-655e-41e0-a508-edfd660a9bcf','IN','Inch','in',FALSE,TRUE,'2026-02-20 01:54:02.288286',NULL,'2026-02-20 02:29:46.822541',NULL,NULL,1),
('1228fc7e-2217-47a8-8259-4122b586a4a2','1e10e2dd-655e-41e0-a508-edfd660a9bcf','SQF','Square Feet','sqft',FALSE,TRUE,'2026-02-20 01:54:02.288286',NULL,'2026-02-20 02:29:46.822541',NULL,NULL,1),
('53301358-2ba2-40b2-a462-cd0272d63aab','1e10e2dd-655e-41e0-a508-edfd660a9bcf','ROLL','Roll','roll',FALSE,TRUE,'2026-02-20 01:54:02.288286',NULL,'2026-02-20 02:29:46.822541',NULL,NULL,1),
('4279ac79-aeea-42f6-8a19-6625bc780631','1e10e2dd-655e-41e0-a508-edfd660a9bcf','PACK','Pack','pack',FALSE,TRUE,'2026-02-20 01:54:02.288286',NULL,'2026-02-20 02:29:46.822541',NULL,NULL,1),
('c564caff-616d-4eef-ac7f-8416ad1477e8','1e10e2dd-655e-41e0-a508-edfd660a9bcf','SET','Set','set',FALSE,TRUE,'2026-02-20 01:54:02.288286',NULL,'2026-02-20 02:29:46.822541',NULL,NULL,1),
('0b2747d8-afa3-483b-9fcd-9e9db1479e85','1e10e2dd-655e-41e0-a508-edfd660a9bcf','BUNDLE','Bundle','bundle',FALSE,TRUE,'2026-02-20 01:54:02.288286',NULL,'2026-02-20 02:29:46.822541',NULL,NULL,1),
('dba6ff0b-04c8-4e09-bd35-aa52f0060dd6','1e10e2dd-655e-41e0-a508-edfd660a9bcf','SHEET','Sheet','sheet',FALSE,TRUE,'2026-02-20 01:54:02.288286',NULL,'2026-02-20 02:29:46.822541',NULL,NULL,1);
-- ============================================================================
-- SEED DATA: Item Categories
-- ============================================================================

INSERT INTO "public"."item_categories"("id","company_id","parent_id","code","name","description","is_active","created_at","created_by","updated_at","updated_by","deleted_at","version","custom_fields")
VALUES
('13dac784-1469-419a-a3ee-b003e596a07e','1e10e2dd-655e-41e0-a508-edfd660a9bcf',NULL,'PACK','Packaging Materials','Packaging materials for frames',TRUE,'2026-02-20 04:38:13.397445',NULL,'2026-02-20 04:42:01.843038',NULL,NULL,1,NULL),
('2d55cdd1-8321-4383-9c75-b44f1b9d855b','1e10e2dd-655e-41e0-a508-edfd660a9bcf',NULL,'SUPPLY','Supplies','Tools and supplies for frame assembly',TRUE,'2026-02-20 04:38:13.397445',NULL,'2026-02-20 04:42:01.843038',NULL,NULL,1,NULL),
('3371533a-eca9-4ccd-aac4-597ee27c4f7d','1e10e2dd-655e-41e0-a508-edfd660a9bcf',NULL,'ACRY','Acrylic','Lightweight, shatter-resistant sheets for picture framing',TRUE,'2026-02-20 04:38:13.397445',NULL,'2026-02-23 18:24:05.369522',NULL,NULL,1,NULL),
('7729a6e6-b797-4d3f-8527-36ad910824f5','1e10e2dd-655e-41e0-a508-edfd660a9bcf',NULL,'MAT','Matboard','Matboards and mounting boards',TRUE,'2026-02-20 04:38:13.397445',NULL,'2026-02-20 04:42:01.843038',NULL,NULL,1,NULL),
('9fd932f7-54ed-4a1d-a99e-50c996ce9745','1e10e2dd-655e-41e0-a508-edfd660a9bcf',NULL,'GLASS','Glass','Glass sheets for picture frames',TRUE,'2026-02-20 04:38:13.397445',NULL,'2026-02-20 04:42:01.843038',NULL,NULL,1,NULL),
('a0cb8f17-34c7-433b-969e-a3474bcd1ade','1e10e2dd-655e-41e0-a508-edfd660a9bcf',NULL,'MOLD','Moldings','Frame moldings and profiles',TRUE,'2026-02-20 04:38:13.397445',NULL,'2026-02-20 04:42:01.843038',NULL,NULL,1,NULL),
('e8a7d6cf-f743-4b10-ad68-b9a7e2977d0e','1e10e2dd-655e-41e0-a508-edfd660a9bcf',NULL,'BACK','Backing','Backing boards and materials',TRUE,'2026-02-20 04:38:13.397445',NULL,'2026-02-20 04:42:01.843038',NULL,NULL,1,NULL),
('a13139e8-23e3-4c8e-b7f3-934ec41afbe0','1e10e2dd-655e-41e0-a508-edfd660a9bcf',NULL,'MIRR','Mirror','Reflective sheets for decorative and framed displays',TRUE,'2026-02-20 04:38:13.397445',NULL,'2026-02-20 04:42:01.843038',NULL,NULL,1,NULL),
('b2386b6e-5aa5-4dcb-b56a-a74f63615de6','1e10e2dd-655e-41e0-a508-edfd660a9bcf',NULL,'ACCE','Accessories','Supporting items used in picture framing and assembly',TRUE,'2026-02-23 18:24:05.369522',NULL,'2026-02-23 18:24:05.369522',NULL,NULL,1,NULL),
('e591604c-25b6-45f2-a7d2-3ea94ef8e1e2','1e10e2dd-655e-41e0-a508-edfd660a9bcf',NULL,'WEDGE','Wedges','Securing pieces used to hold artwork firmly in place',TRUE,'2026-02-23 18:24:05.369522',NULL,'2026-02-23 18:24:05.369522',NULL,NULL,1,NULL),
('bc402ea2-9639-4fdd-9a9a-ad78790a0d87','1e10e2dd-655e-41e0-a508-edfd660a9bcf',NULL,'FLEX','Flexible','Bendable materials for curved or custom frame designs',TRUE,'2026-02-23 18:24:05.369522',NULL,'2026-02-23 18:24:05.369522',NULL,NULL,1,NULL),
('2f0a43c8-b38d-4c1b-89f9-53590ec71599','1e10e2dd-655e-41e0-a508-edfd660a9bcf',NULL,'MACH','Machines','Equipment used for framing, cutting, and assembly',TRUE,'2026-02-23 18:24:05.369522',NULL,'2026-02-23 18:24:05.369522',NULL,NULL,1,NULL),
('bc48a101-cb9b-4daa-adc4-efa9ea853f91','1e10e2dd-655e-41e0-a508-edfd660a9bcf',NULL,'SHRINK','Shrink Film','Protective wrapping for finished frames and artwork',TRUE,'2026-02-23 18:24:05.369522',NULL,'2026-02-23 18:24:05.369522',NULL,NULL,1,NULL),
('c1326506-d04c-491c-953f-ddcc46ee4d43','1e10e2dd-655e-41e0-a508-edfd660a9bcf',NULL,'PTACK','Photo tack','Removable adhesive for mounting photos and prints',TRUE,'2026-02-23 18:24:05.369522',NULL,'2026-02-23 18:24:05.369522',NULL,NULL,1,NULL),
('6b8aa7d9-c0e9-4216-9d6a-973327c22b26','1e10e2dd-655e-41e0-a508-edfd660a9bcf',NULL,'ARTS','Arts','Decorative elements and materials for creative framing',TRUE,'2026-02-23 18:24:05.369522',NULL,'2026-02-23 18:24:05.369522',NULL,NULL,1,NULL),
('5f302f1e-0650-4b0d-b94f-53fb446ab1f7','1e10e2dd-655e-41e0-a508-edfd660a9bcf',NULL,'FRM','Photo Frame','Photo Frame',TRUE,'2026-06-21 07:21:47.115335+00',NULL,'2026-06-21 07:21:47.115335+00',NULL,NULL,1,NULL);
-- ============================================================================
-- SEED DATA: Validate UOM Setup for Items
-- ============================================================================

DO $$
DECLARE
    v_company_id UUID := '1e10e2dd-655e-41e0-a508-edfd660a9bcf';
    v_item RECORD;
    v_items_processed INT := 0;
BEGIN
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Creating packages for all seeded items...';
    RAISE NOTICE '============================================';

    -- Loop through all items and create base packages using UOM details
    FOR v_item IN
        SELECT
            i.id,
            i.item_code,
            i.item_name,
            i.uom_id,
            u.name as uom_name,
            u.code as uom_code
        FROM items i
        JOIN units_of_measure u ON i.uom_id = u.id
        WHERE i.company_id = v_company_id
          AND i.deleted_at IS NULL
    LOOP
        v_items_processed := v_items_processed + 1;
    END LOOP;

    RAISE NOTICE '============================================';
    RAISE NOTICE 'UOM setup complete!';
    RAISE NOTICE 'Items processed: %', v_items_processed;
    RAISE NOTICE '============================================';
END $$;

-- ============================================================================
-- SEED DATA: Warehouses
-- ============================================================================

INSERT INTO warehouses (id, company_id, business_unit_id, warehouse_code, warehouse_name, warehouse_type, address_line1, city, state, country, postal_code, contact_person, phone, email, is_active, is_van)
VALUES
    -- Main Office Warehouses
    ('b4dd7da9-4a6f-418c-98b4-6a05520eb6c5', '1e10e2dd-655e-41e0-a508-edfd660a9bcf', 'd69c52d5-6755-4e28-87e3-24c680a5897b', 'WH-BU01', 'Warehouse BU01', 'main', 'JP Laurel Ave', 'Malolos City', 'Region III', 'Philippines', '8000', 'Juan Dela Cruz', '+63-917-111-2222', 'taguig.wh@achlers.com', true, false),
    ('a2b20002-0000-4000-8000-000000000002', '1e10e2dd-655e-41e0-a508-edfd660a9bcf', 'd69c52d5-6755-4e28-87e3-24c680a5897b', 'WH-BU02', 'Warehouse BU02', 'main', 'JP Laurel Ave', 'Malolos City', 'Region III', 'Philippines', '8000', 'Warehouse B Team', '+63-917-111-2233', 'warehouse-b@achlers.com', true, false),
    ('b1bc2eeb-aab4-4aa1-a225-b82c95975a53', '1e10e2dd-655e-41e0-a508-edfd660a9bcf', 'd5d09f49-c3d7-4f24-aca9-57bea45e0a54', 'WH-BA01', 'Warehouse BA01', 'main', '123 Lopez St.', 'Manila', 'NCR', 'Philippines', '9000', 'Maria Santos', '+63-917-222-3333', 'pasay.wh@achlers.com', true, false),
    ('c830f462-6973-42cd-8125-898376fbc291', '1e10e2dd-655e-41e0-a508-edfd660a9bcf', 'bbce384d-dd71-441c-a5e3-2b5e5d1543ce', 'STR-AS01', 'Warehouse AS01', 'store', '456 Juan Luna St.', 'Pasig City', 'NCR', 'Philippines', '9500', 'Miguel Flores', '+63-917-333-4444', 'pasig@achlers.com', true, false);
-- ============================================================================
-- SEED DATA: Customers
-- ============================================================================

-- We need to use a user_id for created_by and updated_by
-- Using NULL for created_by/updated_by since user will be created via Auth API
DO $$
DECLARE
    v_company_id UUID := '1e10e2dd-655e-41e0-a508-edfd660a9bcf';
    v_user_id UUID := NULL;
BEGIN
    -- Insert sample customers
    INSERT INTO customers (
        company_id, business_unit_id, customer_code, customer_name, customer_type, tax_id, email, phone, website,
        billing_address_line1, billing_address_line2, billing_city, billing_state, billing_country, billing_postal_code,
        shipping_address_line1, shipping_address_line2, shipping_city, shipping_state, shipping_country, shipping_postal_code,
        payment_terms, credit_limit, credit_days,
        contact_person, contact_phone, contact_email,
        is_active, created_by, updated_by
    )
    VALUES
        -- Company Customers
        (
            v_company_id, 'd69c52d5-6755-4e28-87e3-24c680a5897b', 'CUST-001', 'SM Retail Corporation', 'company', '123-456-789-000',
            'purchasing@smretail.com.ph', '+63-82-227-1234', 'www.smretail.com.ph',
            'SM City Davao', 'J.P. Laurel Avenue', 'Davao City', 'Davao del Sur', 'Philippines', '8000',
            'SM City Davao', 'J.P. Laurel Avenue', 'Davao City', 'Davao del Sur', 'Philippines', '8000',
            'net_30', 500000.00, 30,
            'Maria Santos', '+63-917-123-4567', 'maria.santos@smretail.com.ph',
            true, v_user_id, v_user_id
        ),
        (
            v_company_id, 'd69c52d5-6755-4e28-87e3-24c680a5897b', 'CUST-002', 'Gaisano Capital', 'company', '234-567-890-000',
            'procurement@gaisano.com', '+63-88-856-7890', 'www.gaisano.com',
            'Gaisano Mall of Davao', 'JP Laurel Avenue', 'Davao City', 'Davao del Sur', 'Philippines', '8000',
            'Gaisano Mall of Davao', 'JP Laurel Avenue', 'Davao City', 'Davao del Sur', 'Philippines', '8000',
            'net_60', 800000.00, 60,
            'Juan Dela Cruz', '+63-917-234-5678', 'juan.delacruz@gaisano.com',
            true, v_user_id, v_user_id
        ),
        (
            v_company_id, 'd69c52d5-6755-4e28-87e3-24c680a5897b', 'CUST-003', 'NCCC Mall', 'company', '345-678-901-000',
            'buyer@nccc.com.ph', '+63-82-305-5000', 'www.nccc.com.ph',
            'NCCC Mall Davao', 'Ma-a Road', 'Davao City', 'Davao del Sur', 'Philippines', '8000',
            'NCCC Mall Davao', 'Ma-a Road', 'Davao City', 'Davao del Sur', 'Philippines', '8000',
            'net_30', 600000.00, 30,
            'Ana Reyes', '+63-917-345-6789', 'ana.reyes@nccc.com.ph',
            true, v_user_id, v_user_id
        ),
        (
            v_company_id, 'd69c52d5-6755-4e28-87e3-24c680a5897b', 'CUST-004', 'Robinsons Supermarket', 'company', '456-789-012-000',
            'supply@robinsons.com.ph', '+63-82-221-2000', 'www.robinsons.com.ph',
            'Robinsons Place Davao', 'Roxas Avenue', 'Davao City', 'Davao del Sur', 'Philippines', '8000',
            'Robinsons Place Davao', 'Roxas Avenue', 'Davao City', 'Davao del Sur', 'Philippines', '8000',
            'net_45', 700000.00, 45,
            'Carlos Ramos', '+63-917-456-7890', 'carlos.ramos@robinsons.com.ph',
            true, v_user_id, v_user_id
        ),
        (
            v_company_id, 'd69c52d5-6755-4e28-87e3-24c680a5897b', 'CUST-005', 'Puregold Price Club', 'company', '567-890-123-000',
            'orders@puregold.com.ph', '+63-82-234-5000', 'www.puregold.com.ph',
            'Puregold Davao', 'McArthur Highway', 'Davao City', 'Davao del Sur', 'Philippines', '8000',
            'Puregold Davao', 'McArthur Highway', 'Davao City', 'Davao del Sur', 'Philippines', '8000',
            'net_30', 450000.00, 30,
            'Lisa Garcia', '+63-917-567-8901', 'lisa.garcia@puregold.com.ph',
            true, v_user_id, v_user_id
        ),

        -- Government Customers
        (
            v_company_id, 'd69c52d5-6755-4e28-87e3-24c680a5897b', 'CUST-GOV-001', 'Department of Education - Davao Division', 'government', 'GOV-123-456',
            'deped.davao@deped.gov.ph', '+63-82-227-6051', 'davao.deped.gov.ph',
            'DepEd Division Office', 'E. Quirino Avenue', 'Davao City', 'Davao del Sur', 'Philippines', '8000',
            'DepEd Division Office', 'E. Quirino Avenue', 'Davao City', 'Davao del Sur', 'Philippines', '8000',
            'net_60', 1000000.00, 60,
            'Dr. Roberto Cruz', '+63-917-678-9012', 'roberto.cruz@deped.gov.ph',
            true, v_user_id, v_user_id
        ),
        (
            v_company_id, 'd69c52d5-6755-4e28-87e3-24c680a5897b', 'CUST-GOV-002', 'Davao City Government', 'government', 'GOV-234-567',
            'procurement@davaocity.gov.ph', '+63-82-227-1000', 'www.davaocity.gov.ph',
            'Davao City Hall', 'San Pedro Street', 'Davao City', 'Davao del Sur', 'Philippines', '8000',
            'Davao City Hall', 'San Pedro Street', 'Davao City', 'Davao del Sur', 'Philippines', '8000',
            'net_90', 2000000.00, 90,
            'Engr. Pedro Gonzales', '+63-917-789-0123', 'pedro.gonzales@davaocity.gov.ph',
            true, v_user_id, v_user_id
        ),

        -- Individual Customers (Walk-in/Retail)
        (
            v_company_id, 'd69c52d5-6755-4e28-87e3-24c680a5897b', 'CUST-IND-001', 'John Paul Rivera', 'individual', NULL,
            'jp.rivera@email.com', '+63-917-890-1234', NULL,
            'Phase 1, Block 3, Lot 5', 'Ecoland Subdivision', 'Davao City', 'Davao del Sur', 'Philippines', '8000',
            'Phase 1, Block 3, Lot 5', 'Ecoland Subdivision', 'Davao City', 'Davao del Sur', 'Philippines', '8000',
            'cash', 50000.00, 0,
            NULL, NULL, NULL,
            true, v_user_id, v_user_id
        ),
        (
            v_company_id, 'd69c52d5-6755-4e28-87e3-24c680a5897b', 'CUST-IND-002', 'Sarah Mae Santos', 'individual', NULL,
            'sarah.santos@email.com', '+63-917-901-2345', NULL,
            '123 Palma Gil Street', 'Poblacion District', 'Davao City', 'Davao del Sur', 'Philippines', '8000',
            '123 Palma Gil Street', 'Poblacion District', 'Davao City', 'Davao del Sur', 'Philippines', '8000',
            'due_on_receipt', 30000.00, 0,
            NULL, NULL, NULL,
            true, v_user_id, v_user_id
        ),
        (
            v_company_id, 'd69c52d5-6755-4e28-87e3-24c680a5897b', 'CUST-IND-003', 'Michael Angelo Torres', 'individual', NULL,
            'miguel.torres@email.com', '+63-917-012-3456', NULL,
            '456 Quirino Avenue', 'Matina District', 'Davao City', 'Davao del Sur', 'Philippines', '8000',
            '456 Quirino Avenue', 'Matina District', 'Davao City', 'Davao del Sur', 'Philippines', '8000',
            'cash', 25000.00, 0,
            NULL, NULL, NULL,
            true, v_user_id, v_user_id
        ),

        -- Additional Company Customers (Regional)
        (
            v_company_id, 'd69c52d5-6755-4e28-87e3-24c680a5897b', 'CUST-006', 'Cagayan de Oro Trading Corp', 'company', '678-901-234-000',
            'orders@cdotrading.com', '+63-88-858-1234', 'www.cdotrading.com',
            'Carmen Business Park', 'Corrales Avenue', 'Cagayan de Oro', 'Misamis Oriental', 'Philippines', '9000',
            'Carmen Business Park', 'Corrales Avenue', 'Cagayan de Oro', 'Misamis Oriental', 'Philippines', '9000',
            'net_30', 400000.00, 30,
            'Dante Villaruel', '+63-918-123-4567', 'dante.v@cdotrading.com',
            true, v_user_id, v_user_id
        ),
        (
            v_company_id, 'd69c52d5-6755-4e28-87e3-24c680a5897b', 'CUST-007', 'General Santos Wholesale Center', 'company', '789-012-345-000',
            'wholesale@gensan.com', '+63-83-552-3456', 'www.gensanwholesale.com',
            'National Highway', 'Calumpang', 'General Santos', 'South Cotabato', 'Philippines', '9500',
            'National Highway', 'Calumpang', 'General Santos', 'South Cotabato', 'Philippines', '9500',
            'net_45', 550000.00, 45,
            'Gloria Mercado', '+63-918-234-5678', 'gloria.m@gensan.com',
            true, v_user_id, v_user_id
        ),

        -- Inactive Customer (for testing)
        (
            v_company_id, 'd69c52d5-6755-4e28-87e3-24c680a5897b', 'CUST-008', 'Inactive Trading Inc', 'company', '890-123-456-000',
            'contact@inactive.com', '+63-82-000-0000', NULL,
            'Old Business District', 'Building 1', 'Davao City', 'Davao del Sur', 'Philippines', '8000',
            'Old Business District', 'Building 1', 'Davao City', 'Davao del Sur', 'Philippines', '8000',
            'net_30', 100000.00, 30,
            'Inactive Contact', '+63-917-000-0000', 'inactive@test.com',
            false, v_user_id, v_user_id
        ),

        -- Downtown Branch Customers
        (
            v_company_id, 'd5d09f49-c3d7-4f24-aca9-57bea45e0a54', 'CUST-DTN-001', 'Metro Department Store', 'company', '111-222-333-000',
            'sales@metrodept.com', '+63-82-301-2345', 'www.metrodept.com',
            'Downtown Plaza', 'Rizal Avenue', 'Davao City', 'Davao del Sur', 'Philippines', '8000',
            'Downtown Plaza', 'Rizal Avenue', 'Davao City', 'Davao del Sur', 'Philippines', '8000',
            'net_30', 300000.00, 30,
            'Rosa Martinez', '+63-917-111-2222', 'rosa.martinez@metrodept.com',
            true, v_user_id, v_user_id
        ),
        (
            v_company_id, 'd5d09f49-c3d7-4f24-aca9-57bea45e0a54', 'CUST-DTN-002', 'City Mall Retail', 'company', '222-333-444-000',
            'procurement@citymall.ph', '+63-82-302-3456', 'www.citymall.ph',
            'City Center', 'C.M. Recto Street', 'Davao City', 'Davao del Sur', 'Philippines', '8000',
            'City Center', 'C.M. Recto Street', 'Davao City', 'Davao del Sur', 'Philippines', '8000',
            'net_60', 450000.00, 60,
            'Pedro Gonzales', '+63-917-222-3333', 'pedro.gonzales@citymall.ph',
            true, v_user_id, v_user_id
        ),
        (
            v_company_id, 'd5d09f49-c3d7-4f24-aca9-57bea45e0a54', 'CUST-DTN-003', 'Urban Boutique', 'retail', '333-444-555-000',
            'orders@urbanboutique.com', '+63-82-303-4567', NULL,
            'Fashion District', '2nd Floor, Edificio Building', 'Davao City', 'Davao del Sur', 'Philippines', '8000',
            'Fashion District', '2nd Floor, Edificio Building', 'Davao City', 'Davao del Sur', 'Philippines', '8000',
            'net_15', 150000.00, 15,
            'Linda Cruz', '+63-917-333-4444', 'linda.cruz@urbanboutique.com',
            true, v_user_id, v_user_id
        ),
        (
            v_company_id, 'd5d09f49-c3d7-4f24-aca9-57bea45e0a54', 'CUST-DTN-004', 'Downtown General Store', 'retail', '444-555-666-000',
            'manager@dtgenstore.com', '+63-82-304-5678', NULL,
            'Main Street', 'Corner Quezon Avenue', 'Davao City', 'Davao del Sur', 'Philippines', '8000',
            'Main Street', 'Corner Quezon Avenue', 'Davao City', 'Davao del Sur', 'Philippines', '8000',
            'net_30', 200000.00, 30,
            'Anna Reyes', '+63-917-444-5555', 'anna.reyes@dtgenstore.com',
            true, v_user_id, v_user_id
        ),

        -- Warehouse Business Unit Customers (Wholesale/Distributors)
        (
            v_company_id, 'bbce384d-dd71-441c-a5e3-2b5e5d1543ce', 'CUST-WHS-001', 'Mindanao Wholesale Distributors', 'wholesale', '555-666-777-000',
            'orders@mindanaowholesale.com', '+63-82-401-2345', 'www.mindanaowholesale.com',
            'Industrial Park', 'Warehouse Complex A', 'Davao City', 'Davao del Sur', 'Philippines', '8000',
            'Industrial Park', 'Warehouse Complex A', 'Davao City', 'Davao del Sur', 'Philippines', '8000',
            'net_90', 1000000.00, 90,
            'Roberto Santos', '+63-917-555-6666', 'roberto.santos@mindanaowholesale.com',
            true, v_user_id, v_user_id
        ),
        (
            v_company_id, 'bbce384d-dd71-441c-a5e3-2b5e5d1543ce', 'CUST-WHS-002', 'Southern Philippines Trading', 'wholesale', '666-777-888-000',
            'purchasing@southernph.com', '+63-82-402-3456', 'www.southernph.com',
            'Port Area', 'Building 5', 'Davao City', 'Davao del Sur', 'Philippines', '8000',
            'Port Area', 'Building 5', 'Davao City', 'Davao del Sur', 'Philippines', '8000',
            'net_60', 750000.00, 60,
            'Carmen Lopez', '+63-917-666-7777', 'carmen.lopez@southernph.com',
            true, v_user_id, v_user_id
        ),
        (
            v_company_id, 'bbce384d-dd71-441c-a5e3-2b5e5d1543ce', 'CUST-WHS-003', 'Pacific Rim Importers', 'wholesale', '777-888-999-000',
            'sales@pacificrim.ph', '+63-82-403-4567', 'www.pacificrim.ph',
            'Free Trade Zone', 'Gate 3', 'Davao City', 'Davao del Sur', 'Philippines', '8000',
            'Free Trade Zone', 'Gate 3', 'Davao City', 'Davao del Sur', 'Philippines', '8000',
            'net_90', 1200000.00, 90,
            'Michael Tan', '+63-917-777-8888', 'michael.tan@pacificrim.ph',
            true, v_user_id, v_user_id
        ),
        (
            v_company_id, 'bbce384d-dd71-441c-a5e3-2b5e5d1543ce', 'CUST-WHS-004', 'Visayas-Mindanao Supply Chain', 'wholesale', '888-999-000-111',
            'procurement@visminsupply.com', '+63-82-404-5678', NULL,
            'Logistics Hub', 'Bay 12', 'Davao City', 'Davao del Sur', 'Philippines', '8000',
            'Logistics Hub', 'Bay 12', 'Davao City', 'Davao del Sur', 'Philippines', '8000',
            'net_60', 850000.00, 60,
            'Sandra Villanueva', '+63-917-888-9999', 'sandra.v@visminsupply.com',
            true, v_user_id, v_user_id
        );

    RAISE NOTICE 'Customers seeded: % records', (SELECT COUNT(*) FROM customers WHERE company_id = v_company_id);
END $$;

-- ============================================================================
-- SEED DATA: Item Warehouse Stock Levels
-- ============================================================================

-- Assign random stock levels to items across warehouses
DO $$
DECLARE
    v_company_id UUID := '1e10e2dd-655e-41e0-a508-edfd660a9bcf';
    v_user_id UUID := '1e10e2dd-655e-41e0-a508-edfd660a9bcf';
    v_item RECORD;
    v_warehouse RECORD;
BEGIN
    -- For each item, create stock levels in main warehouses
    FOR v_item IN SELECT id, item_code FROM items WHERE company_id = v_company_id AND is_stock_item = true
    LOOP
        FOR v_warehouse IN SELECT id, warehouse_code, warehouse_type FROM warehouses WHERE company_id = v_company_id AND warehouse_type IN ('main', 'retail')
        LOOP
            INSERT INTO item_warehouse (
                company_id,
                item_id,
                warehouse_id,
                current_stock,
                reorder_level,
                reorder_quantity,
                max_quantity,
                reserved_stock,
                is_active
            )
            VALUES (
                v_company_id,
                v_item.id,
                v_warehouse.id,
                CASE
                    WHEN v_warehouse.warehouse_type = 'main' THEN FLOOR(RANDOM() * 500 + 100)
                    ELSE FLOOR(RANDOM() * 100 + 20)
                END,
                CASE
                    WHEN v_warehouse.warehouse_type = 'main' THEN 50
                    ELSE 20
                END,
                CASE
                    WHEN v_warehouse.warehouse_type = 'main' THEN 200
                    ELSE 50
                END,
                CASE
                    WHEN v_warehouse.warehouse_type = 'main' THEN 1000
                    ELSE 300
                END,
                0,
                true
            );
        END LOOP;
    END LOOP;
END $$;

-- ============================================================================
-- SEED DATA: Force Low/Out of Stock Items
-- ============================================================================

DO $$
DECLARE
    v_company_id UUID := '1e10e2dd-655e-41e0-a508-edfd660a9bcf';
    v_low_stock_codes TEXT[] := ARRAY[
        'MOLD-W-001',
        'MOLD-W-002',
        'MOLD-M-001',
        'GLASS-16X20',
        'GLASS-24X36',
        'MAT-WHT-32X40',
        'BACK-16X20',
        'HARD-D-RINGS'
    ];
    v_out_of_stock_codes TEXT[] := ARRAY[
        'MOLD-M-003',
        'GLASS-UV-24X36',
        'SUPPLY-GLUE'
    ];
    v_overstock_codes TEXT[] := ARRAY[
        'MOLD-W-003',
        'PACK-KRAFT'
    ];
BEGIN
    -- Set low stock (below reorder level, above zero)
    UPDATE item_warehouse iw
    SET current_stock = 10
    FROM items i
    WHERE iw.item_id = i.id
      AND i.company_id = v_company_id
      AND i.item_code = ANY(v_low_stock_codes);

    -- Set out of stock
    UPDATE item_warehouse iw
    SET current_stock = 0
    FROM items i
    WHERE iw.item_id = i.id
      AND i.company_id = v_company_id
      AND i.item_code = ANY(v_out_of_stock_codes);

    -- Set overstock (above max quantity)
    UPDATE item_warehouse iw
    SET current_stock = COALESCE(iw.max_quantity, 0) + 50
    FROM items i
    WHERE iw.item_id = i.id
      AND i.company_id = v_company_id
      AND i.item_code = ANY(v_overstock_codes);
END $$;

-- ============================================================================
-- COMPLETION MESSAGE
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '===============================================';
    RAISE NOTICE 'Seed data inserted successfully!';
    RAISE NOTICE '===============================================';
    RAISE NOTICE 'Company: Demo Company Inc. (ID: 1e10e2dd-655e-41e0-a508-edfd660a9bcf)';
    RAISE NOTICE 'Units of Measure: % records', (SELECT COUNT(*) FROM units_of_measure);
    RAISE NOTICE 'Item Categories: % records', (SELECT COUNT(*) FROM item_categories);
    RAISE NOTICE 'Items: % records', (SELECT COUNT(*) FROM items);
    RAISE NOTICE 'Warehouses: % records', (SELECT COUNT(*) FROM warehouses);
    RAISE NOTICE 'Customers: % records', (SELECT COUNT(*) FROM customers);
    RAISE NOTICE 'Suppliers: % records', (SELECT COUNT(*) FROM suppliers);
    RAISE NOTICE 'Purchase Orders: % records', (SELECT COUNT(*) FROM purchase_orders);
    RAISE NOTICE 'Item-Warehouse Stock: % records', (SELECT COUNT(*) FROM item_warehouse);
    RAISE NOTICE '===============================================';
    RAISE NOTICE 'Seeded core users and requested Super Admin accounts';
    RAISE NOTICE 'RBAC: demo, admin, and requested accounts are Super Admin; cashier has Cashier role';
    RAISE NOTICE '===============================================';
END $$;

INSERT INTO "auth"."users"("instance_id","id","aud","role","email","encrypted_password","email_confirmed_at","invited_at","confirmation_token","confirmation_sent_at","recovery_token","recovery_sent_at","email_change_token_new","email_change","email_change_sent_at","last_sign_in_at","raw_app_meta_data","raw_user_meta_data","is_super_admin","created_at","updated_at","phone","phone_confirmed_at","phone_change","phone_change_token","phone_change_sent_at","email_change_token_current","email_change_confirm_status","banned_until","reauthentication_token","reauthentication_sent_at","is_sso_user","deleted_at","is_anonymous")
VALUES
('00000000-0000-0000-0000-000000000000','5745e13c-ab07-48b7-9db7-24372b16f5a9','authenticated','authenticated','demo@pragmatica.app','$2a$10$fl1NcrikDWUCdcVrOa2MRebN.HByAT8m80Jk2K9P5L09INoP1omFG','2025-11-06 07:07:59.211291+00',NULL,'',NULL,'',NULL,'','',NULL,'2025-11-06 07:07:59.218139+00','{"provider": "email", "providers": ["email"]}','{"sub": "5745e13c-ab07-48b7-9db7-24372b16f5a9", "email": "demo@pragmatica.app", "email_verified": true, "phone_verified": false}',NULL,'2025-11-06 07:07:59.200435+00','2025-11-06 07:07:59.22046+00',NULL,NULL,'','',NULL,'',0,NULL,'',NULL,FALSE,NULL,FALSE);
INSERT INTO "auth"."users"("instance_id","id","aud","role","email","encrypted_password","email_confirmed_at","invited_at","confirmation_token","confirmation_sent_at","recovery_token","recovery_sent_at","email_change_token_new","email_change","email_change_sent_at","last_sign_in_at","raw_app_meta_data","raw_user_meta_data","is_super_admin","created_at","updated_at","phone","phone_confirmed_at","phone_change","phone_change_token","phone_change_sent_at","email_change_token_current","email_change_confirm_status","banned_until","reauthentication_token","reauthentication_sent_at","is_sso_user","deleted_at","is_anonymous")
VALUES
('00000000-0000-0000-0000-000000000000','5fa2a5a4-14ca-4afb-bfeb-abc345335a1f','authenticated','authenticated','cashier@pragmatica.app','$2a$10$fl1NcrikDWUCdcVrOa2MRebN.HByAT8m80Jk2K9P5L09INoP1omFG','2025-11-06 07:07:59.211291+00',NULL,'',NULL,'',NULL,'','',NULL,'2025-11-06 07:07:59.218139+00','{"provider": "email", "providers": ["email"]}','{"sub": "5fa2a5a4-14ca-4afb-bfeb-abc345335a1f", "email": "cashier@pragmatica.app", "email_verified": true, "phone_verified": false}',NULL,'2025-11-06 07:07:59.200435+00','2025-11-06 07:07:59.22046+00',NULL,NULL,'','',NULL,'',0,NULL,'',NULL,FALSE,NULL,FALSE);
INSERT INTO "auth"."users"("instance_id","id","aud","role","email","encrypted_password","email_confirmed_at","invited_at","confirmation_token","confirmation_sent_at","recovery_token","recovery_sent_at","email_change_token_new","email_change","email_change_sent_at","last_sign_in_at","raw_app_meta_data","raw_user_meta_data","is_super_admin","created_at","updated_at","phone","phone_confirmed_at","phone_change","phone_change_token","phone_change_sent_at","email_change_token_current","email_change_confirm_status","banned_until","reauthentication_token","reauthentication_sent_at","is_sso_user","deleted_at","is_anonymous")
VALUES
('00000000-0000-0000-0000-000000000000','b6f62b1e-8eae-4ba2-93b2-353d20fe94e0','authenticated','authenticated','admin@pragmatica.ph','$2a$10$fl1NcrikDWUCdcVrOa2MRebN.HByAT8m80Jk2K9P5L09INoP1omFG','2025-11-06 07:07:59.211291+00',NULL,'',NULL,'',NULL,'','',NULL,'2025-11-06 07:07:59.218139+00','{"provider": "email", "providers": ["email"]}','{"sub": "b6f62b1e-8eae-4ba2-93b2-353d20fe94e0", "email": "admin@pragmatica.ph", "email_verified": true, "phone_verified": false}',NULL,'2025-11-06 07:07:59.200435+00','2025-11-06 07:07:59.22046+00',NULL,NULL,'','',NULL,'',0,NULL,'',NULL,FALSE,NULL,FALSE);

INSERT INTO "public"."users"("id","company_id","username","email","first_name","last_name","phone","is_active","last_login_at","created_at","updated_at","deleted_at","van_warehouse_id")
VALUES
('5745e13c-ab07-48b7-9db7-24372b16f5a9','1e10e2dd-655e-41e0-a508-edfd660a9bcf','demo','demo@pragmatica.app','Demo','User',NULL,TRUE,NULL,'2025-11-06 07:17:41.17002','2025-11-06 07:17:41.17002',NULL,'c830f462-6973-42cd-8125-898376fbc291'),
('5fa2a5a4-14ca-4afb-bfeb-abc345335a1f','1e10e2dd-655e-41e0-a508-edfd660a9bcf','cashier','cashier@pragmatica.app','Store','Cashier',NULL,TRUE,NULL,'2025-11-06 07:17:41.17002','2025-11-06 07:17:41.17002',NULL,'c830f462-6973-42cd-8125-898376fbc291'),
('b6f62b1e-8eae-4ba2-93b2-353d20fe94e0','1e10e2dd-655e-41e0-a508-edfd660a9bcf','admin','admin@pragmatica.ph','Admin','User',NULL,TRUE,NULL,'2025-11-06 07:17:41.17002','2025-11-06 07:17:41.17002',NULL,'c830f462-6973-42cd-8125-898376fbc291');

INSERT INTO "auth"."users"("instance_id","id","aud","role","email","encrypted_password","email_confirmed_at","invited_at","confirmation_token","confirmation_sent_at","recovery_token","recovery_sent_at","email_change_token_new","email_change","email_change_sent_at","last_sign_in_at","raw_app_meta_data","raw_user_meta_data","is_super_admin","created_at","updated_at","phone","phone_confirmed_at","phone_change","phone_change_token","phone_change_sent_at","email_change_token_current","email_change_confirm_status","banned_until","reauthentication_token","reauthentication_sent_at","is_sso_user","deleted_at","is_anonymous")
VALUES
('00000000-0000-0000-0000-000000000000','bcb8f5df-b678-4c22-ba71-59b33ba06227','authenticated','authenticated','mflores@pragmatica.app','$2a$10$fl1NcrikDWUCdcVrOa2MRebN.HByAT8m80Jk2K9P5L09INoP1omFG','2025-11-06 07:07:59.211291+00',NULL,'',NULL,'',NULL,'','',NULL,'2025-11-06 07:07:59.218139+00','{"provider": "email", "providers": ["email"]}','{"sub": "bcb8f5df-b678-4c22-ba71-59b33ba06227", "email": "mflores@pragmatica.app", "email_verified": true, "phone_verified": false}',NULL,'2025-11-06 07:07:59.200435+00','2025-11-06 07:07:59.22046+00',NULL,NULL,'','',NULL,'',0,NULL,'',NULL,FALSE,NULL,FALSE);
INSERT INTO "public"."users"("id","company_id","username","email","first_name","last_name","phone","is_active","last_login_at","created_at","updated_at","deleted_at","van_warehouse_id")
VALUES
('bcb8f5df-b678-4c22-ba71-59b33ba06227','1e10e2dd-655e-41e0-a508-edfd660a9bcf','Miguel','mflores@pragmatica.app','Miguel','Flores',NULL,TRUE,NULL,'2025-11-06 07:17:41.17002','2025-11-06 07:17:41.17002',NULL,'c830f462-6973-42cd-8125-898376fbc291');

INSERT INTO "auth"."users"("instance_id","id","aud","role","email","encrypted_password","email_confirmed_at","invited_at","confirmation_token","confirmation_sent_at","recovery_token","recovery_sent_at","email_change_token_new","email_change","email_change_sent_at","last_sign_in_at","raw_app_meta_data","raw_user_meta_data","is_super_admin","created_at","updated_at","phone","phone_confirmed_at","phone_change","phone_change_token","phone_change_sent_at","email_change_token_current","email_change_confirm_status","banned_until","reauthentication_token","reauthentication_sent_at","is_sso_user","deleted_at","is_anonymous")
VALUES
('00000000-0000-0000-0000-000000000000','1d2f3a4b-5c6d-47e8-9f01-23456789abcd','authenticated','authenticated','stockman@pragmatica.app','$2a$10$fl1NcrikDWUCdcVrOa2MRebN.HByAT8m80Jk2K9P5L09INoP1omFG','2025-11-06 07:07:59.211291+00',NULL,'',NULL,'',NULL,'','',NULL,NULL,'{"provider": "email", "providers": ["email"]}','{"sub": "1d2f3a4b-5c6d-47e8-9f01-23456789abcd", "email": "stockman@pragmatica.app", "email_verified": true, "phone_verified": false}',NULL,'2025-11-06 07:07:59.200435+00','2025-11-06 07:07:59.22046+00',NULL,NULL,'','',NULL,'',0,NULL,'',NULL,FALSE,NULL,FALSE);
INSERT INTO "auth"."users"("instance_id","id","aud","role","email","encrypted_password","email_confirmed_at","invited_at","confirmation_token","confirmation_sent_at","recovery_token","recovery_sent_at","email_change_token_new","email_change","email_change_sent_at","last_sign_in_at","raw_app_meta_data","raw_user_meta_data","is_super_admin","created_at","updated_at","phone","phone_confirmed_at","phone_change","phone_change_token","phone_change_sent_at","email_change_token_current","email_change_confirm_status","banned_until","reauthentication_token","reauthentication_sent_at","is_sso_user","deleted_at","is_anonymous")
VALUES
('00000000-0000-0000-0000-000000000000','2e3f4a5b-6c7d-48e9-af01-3456789abcde','authenticated','authenticated','picker@pragmatica.app','$2a$10$fl1NcrikDWUCdcVrOa2MRebN.HByAT8m80Jk2K9P5L09INoP1omFG','2025-11-06 07:07:59.211291+00',NULL,'',NULL,'',NULL,'','',NULL,NULL,'{"provider": "email", "providers": ["email"]}','{"sub": "2e3f4a5b-6c7d-48e9-af01-3456789abcde", "email": "picker@pragmatica.app", "email_verified": true, "phone_verified": false}',NULL,'2025-11-06 07:07:59.200435+00','2025-11-06 07:07:59.22046+00',NULL,NULL,'','',NULL,'',0,NULL,'',NULL,FALSE,NULL,FALSE);
INSERT INTO "public"."users"("id","company_id","username","email","first_name","last_name","phone","is_active","last_login_at","created_at","updated_at","deleted_at","van_warehouse_id")
VALUES
('1d2f3a4b-5c6d-47e8-9f01-23456789abcd','1e10e2dd-655e-41e0-a508-edfd660a9bcf','stockman','stockman@pragmatica.app','Warehouse','Stockman',NULL,TRUE,NULL,'2025-11-06 07:17:41.17002','2025-11-06 07:17:41.17002',NULL,NULL),
('2e3f4a5b-6c7d-48e9-af01-3456789abcde','1e10e2dd-655e-41e0-a508-edfd660a9bcf','picker','picker@pragmatica.app','Warehouse','Picker',NULL,TRUE,NULL,'2025-11-06 07:17:41.17002','2025-11-06 07:17:41.17002',NULL,NULL);

-- Requested Super Admin accounts
WITH requested_super_admins(id, email) AS (
  VALUES
    ('697b80c9-66ba-40bc-93e0-140ae99f005b'::UUID, 'abnerdominic0418@gmail.com'),
    ('19ff3144-93b8-4112-8597-03313f4dbc68'::UUID, 'clariceg17@gmail.com'),
    ('25c02782-996b-4bf7-a547-5411d8561c1c'::UUID, 'fendaya@gmail.com'),
    ('f3de8cbf-64c1-406f-be69-fe5ee7ee1d7f'::UUID, 'gemyugo@gmail.com'),
    ('a43706ac-6950-4e73-9e88-a23dd024fd25'::UUID, 'jasonmadrazo101@gmail.com'),
    ('67bef70e-0045-4714-ac24-f3989d5827f6'::UUID, 'rlorengrace@gmail.com'),
    ('5a83d7fa-da00-44ea-90d2-e4b0c2fb3aae'::UUID, 'coder387@gmail.com')
)
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  is_sso_user,
  is_anonymous
)
SELECT
  '00000000-0000-0000-0000-000000000000'::UUID,
  id,
  'authenticated',
  'authenticated',
  email,
  '$2a$10$YYm.GtSjeByIE2dBgT4qNOOf2w8IJNKE4/y/j3ihOW/sQRFHIRzO6',
  NOW(),
  '',
  '',
  '',
  '',
  '{"provider": "email", "providers": ["email"]}'::JSONB,
  jsonb_build_object(
    'sub', id::TEXT,
    'email', email,
    'email_verified', TRUE,
    'phone_verified', FALSE
  ),
  NOW(),
  NOW(),
  FALSE,
  FALSE
FROM requested_super_admins;

WITH requested_super_admins(id, username, email, first_name, last_name) AS (
  VALUES
    ('697b80c9-66ba-40bc-93e0-140ae99f005b'::UUID, 'abnerdominic0418', 'abnerdominic0418@gmail.com', 'Abner Dominic', 'Belotindos'),
    ('19ff3144-93b8-4112-8597-03313f4dbc68'::UUID, 'clariceg17', 'clariceg17@gmail.com', 'Clarice', 'Manluctao'),
    ('25c02782-996b-4bf7-a547-5411d8561c1c'::UUID, 'fendaya', 'fendaya@gmail.com', 'Franklin', 'Endaya'),
    ('f3de8cbf-64c1-406f-be69-fe5ee7ee1d7f'::UUID, 'gemyugo', 'gemyugo@gmail.com', 'Karen', 'Go'),
    ('a43706ac-6950-4e73-9e88-a23dd024fd25'::UUID, 'jasonmadrazo101', 'jasonmadrazo101@gmail.com', 'Jason', 'Madrazo'),
    ('67bef70e-0045-4714-ac24-f3989d5827f6'::UUID, 'rlorengrace', 'rlorengrace@gmail.com', 'Loren Grace', 'Recolito'),
    ('5a83d7fa-da00-44ea-90d2-e4b0c2fb3aae'::UUID, 'coder387', 'coder387@gmail.com', 'Carlito', 'Crisostomo')
)
INSERT INTO public.users (
  id,
  company_id,
  username,
  email,
  first_name,
  last_name,
  phone,
  is_active,
  last_login_at,
  created_at,
  updated_at,
  deleted_at,
  van_warehouse_id
)
SELECT
  id,
  '1e10e2dd-655e-41e0-a508-edfd660a9bcf'::UUID,
  username,
  email,
  first_name,
  last_name,
  NULL,
  TRUE,
  NULL,
  NOW(),
  NOW(),
  NULL,
  NULL
FROM requested_super_admins;

-- ============================================================================
-- SEED DATA: Grant Default BU Access to Users
-- ============================================================================

INSERT INTO user_business_unit_access (user_id, business_unit_id, role, is_default, is_current, granted_at)
VALUES
  -- Regular user access to all three business units
  ('5745e13c-ab07-48b7-9db7-24372b16f5a9', 'd69c52d5-6755-4e28-87e3-24c680a5897b', 'admin', true, true, now()),
  ('5745e13c-ab07-48b7-9db7-24372b16f5a9', 'd5d09f49-c3d7-4f24-aca9-57bea45e0a54', 'admin', false, false, now()),
  ('5745e13c-ab07-48b7-9db7-24372b16f5a9', 'bbce384d-dd71-441c-a5e3-2b5e5d1543ce', 'admin', false, false, now()),
  ('b6f62b1e-8eae-4ba2-93b2-353d20fe94e0', 'd69c52d5-6755-4e28-87e3-24c680a5897b', 'admin', true, true, now()),
  ('b6f62b1e-8eae-4ba2-93b2-353d20fe94e0', 'd5d09f49-c3d7-4f24-aca9-57bea45e0a54', 'admin', false, false, now()),
  ('b6f62b1e-8eae-4ba2-93b2-353d20fe94e0', 'bbce384d-dd71-441c-a5e3-2b5e5d1543ce', 'admin', false, false, now()),
  ('5fa2a5a4-14ca-4afb-bfeb-abc345335a1f', 'bbce384d-dd71-441c-a5e3-2b5e5d1543ce', 'admin', false, true, now()),
  ('bcb8f5df-b678-4c22-ba71-59b33ba06227', 'bbce384d-dd71-441c-a5e3-2b5e5d1543ce', 'admin', false, true, now()),
  ('1d2f3a4b-5c6d-47e8-9f01-23456789abcd', 'd69c52d5-6755-4e28-87e3-24c680a5897b', 'staff', true, true, now()),
  ('2e3f4a5b-6c7d-48e9-af01-3456789abcde', 'd69c52d5-6755-4e28-87e3-24c680a5897b', 'staff', true, true, now());

WITH requested_super_admins(user_id) AS (
  VALUES
    ('697b80c9-66ba-40bc-93e0-140ae99f005b'::UUID),
    ('19ff3144-93b8-4112-8597-03313f4dbc68'::UUID),
    ('25c02782-996b-4bf7-a547-5411d8561c1c'::UUID),
    ('f3de8cbf-64c1-406f-be69-fe5ee7ee1d7f'::UUID),
    ('a43706ac-6950-4e73-9e88-a23dd024fd25'::UUID),
    ('67bef70e-0045-4714-ac24-f3989d5827f6'::UUID),
    ('5a83d7fa-da00-44ea-90d2-e4b0c2fb3aae'::UUID)
)
INSERT INTO user_business_unit_access (
  user_id,
  business_unit_id,
  role,
  is_default,
  is_current,
  granted_at
)
SELECT
  requested_super_admins.user_id,
  business_units.id,
  'admin',
  business_units.code = 'MAIN',
  business_units.code = 'MAIN',
  NOW()
FROM requested_super_admins
CROSS JOIN business_units
WHERE business_units.company_id = '1e10e2dd-655e-41e0-a508-edfd660a9bcf';

-- ============================================================================
-- SEED DATA: Cashier Role and Permissions
-- ============================================================================
-- This creates a cashier role with limited permissions for POS operations
-- Must be created BEFORE user role assignments

-- 1. Create Cashier Role for Demo Company
INSERT INTO roles (
  company_id,
  name,
  description,
  created_at,
  updated_at
)
VALUES (
  '1e10e2dd-655e-41e0-a508-edfd660a9bcf', -- Demo Company
  'Cashier',
  'Point of Sale cashier with limited access to POS and inventory viewing',
  NOW(),
  NOW()
)
ON CONFLICT ON CONSTRAINT uq_role_name_per_company DO NOTHING;

-- 2. Assign Permissions to Cashier Role
-- Link Cashier role to specific resources (permissions)

-- Dashboard
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Cashier'
  AND r.company_id = '1e10e2dd-655e-41e0-a508-edfd660a9bcf'
  AND p.resource = 'dashboard'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Items (inventory viewing for POS)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Cashier'
  AND r.company_id = '1e10e2dd-655e-41e0-a508-edfd660a9bcf'
  AND p.resource = 'items'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Sales Orders (for POS transactions)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Cashier'
  AND r.company_id = '1e10e2dd-655e-41e0-a508-edfd660a9bcf'
  AND p.resource = 'sales_orders'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Customers (for creating walk-in customers)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Cashier'
  AND r.company_id = '1e10e2dd-655e-41e0-a508-edfd660a9bcf'
  AND p.resource = 'customers'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Sales Invoices (for POS)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Cashier'
  AND r.company_id = '1e10e2dd-655e-41e0-a508-edfd660a9bcf'
  AND p.resource = 'sales_invoices'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Stock Requests (Warehouse dashboard)
INSERT INTO permissions (resource, description, can_view, can_create, can_edit, can_delete)
VALUES ('stock_requests', 'Manage stock requests', true, true, true, true)
ON CONFLICT (resource) DO NOTHING;

INSERT INTO permissions (resource, description, can_view, can_create, can_edit, can_delete)
VALUES
  ('delivery_notes', 'Manage delivery notes and delivery-note receiving', true, true, true, true),
  ('pick_lists', 'Manage pick lists and warehouse picking', true, true, true, true)
ON CONFLICT (resource) DO NOTHING;

-- ============================================================================
-- SEED DATA: Stockman Role and Permissions
-- ============================================================================
-- Stockman can run warehouse operations without purchasing workbench, admin,
-- sales, accounting, role, or user-management access.

INSERT INTO roles (
  company_id,
  name,
  description,
  created_at,
  updated_at
)
VALUES (
  '1e10e2dd-655e-41e0-a508-edfd660a9bcf',
  'Stockman',
  'Warehouse operator with access to picking, receiving, putaway, transfers, stock requests, and stock visibility',
  NOW(),
  NOW()
)
ON CONFLICT ON CONSTRAINT uq_role_name_per_company DO UPDATE
SET
  description = EXCLUDED.description,
  updated_at = NOW();

DELETE FROM role_permissions rp
USING roles r, permissions p
WHERE rp.role_id = r.id
  AND rp.permission_id = p.id
  AND r.name = 'Stockman'
  AND r.company_id = '1e10e2dd-655e-41e0-a508-edfd660a9bcf'
  AND p.resource IN (
    'suppliers',
    'purchase_orders',
    'purchase_receipts',
    'stock_requisitions'
  );

WITH stockman_permissions(resource, can_view, can_create, can_edit, can_delete) AS (
  VALUES
    ('dashboard', true, false, false, false),
    ('dashboard.card.incoming_shipments.view', true, false, false, false),
    ('dashboard.card.pick_list.view', true, false, false, false),
    ('dashboard.card.stock_requests.view', true, false, false, false),
    ('dashboard.queue.incoming_deliveries.view', true, false, false, false),
    ('dashboard.queue.pick_list.view', true, false, false, false),
    ('dashboard.queue.stock_requests.view', true, false, false, false),
    ('items', true, false, false, false),
    ('pick_lists.operation.view_only_assigned_pick_lists.view', true, false, false, false),
    ('delivery_notes.operation.receive_delivery_notes.edit', false, false, true, false),
    ('delivery_notes', true, true, true, false),
    ('pick_lists', true, true, true, false),
    ('load_lists', true, false, false, false),
    ('goods_receipt_notes', true, false, false, false),
    ('goods_receipt_notes.operation.start_receiving.edit', false, false, true, false),
    ('goods_receipt_notes.operation.save_receiving.edit', false, false, true, false),
    ('goods_receipt_notes.operation.submit_receiving.edit', false, false, true, false),
    ('load_lists.operation.mark_arrived.edit', false, false, true, false),
    ('warehouses', true, false, true, false),
    ('warehouses.operation.manage_floor_map.edit', false, false, true, false),
    ('manage_locations', true, true, true, false),
    ('view_location_stock', true, false, false, false),
    ('transfer_between_locations', true, true, true, false),
    ('stock_adjustments', true, true, true, false),
    ('stock_requests', true, true, true, false),
    ('stock_transactions', true, true, false, false)
)
INSERT INTO role_permissions (
  role_id,
  permission_id,
  can_view,
  can_create,
  can_edit,
  can_delete
)
SELECT
  r.id,
  p.id,
  sp.can_view,
  sp.can_create,
  sp.can_edit,
  sp.can_delete
FROM roles r
JOIN stockman_permissions sp ON true
JOIN permissions p ON p.resource = sp.resource
WHERE r.name = 'Stockman'
  AND r.company_id = '1e10e2dd-655e-41e0-a508-edfd660a9bcf'
ON CONFLICT (role_id, permission_id) DO UPDATE
SET
  can_view = EXCLUDED.can_view,
  can_create = EXCLUDED.can_create,
  can_edit = EXCLUDED.can_edit,
  can_delete = EXCLUDED.can_delete;

-- ============================================================================
-- SEED DATA: Picker Role and Permissions
-- ============================================================================
-- Picker can access warehouse picking queues and record picked quantities
-- without receiving, putaway, adjustment, transfer, delete, or admin access.

INSERT INTO roles (
  company_id,
  name,
  description,
  created_at,
  updated_at
)
VALUES (
  '1e10e2dd-655e-41e0-a508-edfd660a9bcf',
  'Picker',
  'Warehouse picker with access to pick lists, picking queues, and stock visibility',
  NOW(),
  NOW()
)
ON CONFLICT ON CONSTRAINT uq_role_name_per_company DO UPDATE
SET
  description = EXCLUDED.description,
  updated_at = NOW();

DELETE FROM role_permissions rp
USING roles r, permissions p
WHERE rp.role_id = r.id
  AND rp.permission_id = p.id
  AND r.name = 'Picker'
  AND r.company_id = '1e10e2dd-655e-41e0-a508-edfd660a9bcf'
  AND p.resource IN ('stock_requests', 'delivery_notes');

WITH picker_permissions(resource, can_view, can_create, can_edit, can_delete) AS (
  VALUES
    ('dashboard', true, false, false, false),
    ('dashboard.card.pick_list.view', true, false, false, false),
    ('dashboard.queue.pick_list.view', true, false, false, false),
    ('items', true, false, false, false),
    ('warehouses', true, false, false, false),
    ('view_location_stock', true, false, false, false),
    ('pick_lists.operation.view_only_assigned_pick_lists.view', true, false, false, false),
    ('pick_lists', true, false, true, false),
    ('stock_transactions', true, false, false, false)
)
INSERT INTO role_permissions (
  role_id,
  permission_id,
  can_view,
  can_create,
  can_edit,
  can_delete
)
SELECT
  r.id,
  p.id,
  pp.can_view,
  pp.can_create,
  pp.can_edit,
  pp.can_delete
FROM roles r
JOIN picker_permissions pp ON true
JOIN permissions p ON p.resource = pp.resource
WHERE r.name = 'Picker'
  AND r.company_id = '1e10e2dd-655e-41e0-a508-edfd660a9bcf'
ON CONFLICT (role_id, permission_id) DO UPDATE
SET
  can_view = EXCLUDED.can_view,
  can_create = EXCLUDED.can_create,
  can_edit = EXCLUDED.can_edit,
  can_delete = EXCLUDED.can_delete;

-- Grant Super Admin full access to all permissions
INSERT INTO role_permissions (role_id, permission_id, can_view, can_create, can_edit, can_delete)
SELECT r.id, p.id, p.can_view, p.can_create, p.can_edit, p.can_delete
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Super Admin'
  AND r.company_id = '1e10e2dd-655e-41e0-a508-edfd660a9bcf'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Ensure Super Admin role_permissions CRUD flags are fully populated
UPDATE role_permissions rp
SET
  can_view = p.can_view,
  can_create = p.can_create,
  can_edit = p.can_edit,
  can_delete = p.can_delete
FROM roles r,
     permissions p
WHERE rp.role_id = r.id
  AND rp.permission_id = p.id
  AND r.name = 'Super Admin'
  AND r.company_id = '1e10e2dd-655e-41e0-a508-edfd660a9bcf';

-- Assigned-only picking is a scope restriction. Keep it enabled for warehouse
-- operator roles and disabled for broader demo roles that should see the full
-- current-business-unit pick-list queue.
UPDATE role_permissions rp
SET can_view = LOWER(BTRIM(r.name)) IN ('picker', 'stockman'),
    can_create = FALSE,
    can_edit = FALSE,
    can_delete = FALSE
FROM roles r,
     permissions p
WHERE rp.role_id = r.id
  AND rp.permission_id = p.id
  AND p.resource = 'pick_lists.operation.view_only_assigned_pick_lists.view';

-- Keep seeded granular grants consistent with their required parent actions.
INSERT INTO role_permissions AS existing_parent (
  role_id,
  permission_id,
  can_view,
  can_create,
  can_edit,
  can_delete
)
SELECT
  child_grant.role_id,
  parent_permission.id,
  true,
  false,
  true,
  false
FROM role_permissions child_grant
JOIN permissions child_permission
  ON child_permission.id = child_grant.permission_id
 AND child_permission.resource = 'delivery_notes.operation.receive_delivery_notes.edit'
JOIN permissions parent_permission
  ON parent_permission.resource = 'delivery_notes'
WHERE child_grant.can_edit IS TRUE
ON CONFLICT (role_id, permission_id) DO UPDATE
SET can_view = existing_parent.can_view OR EXCLUDED.can_view,
    can_create = existing_parent.can_create OR EXCLUDED.can_create,
    can_edit = existing_parent.can_edit OR EXCLUDED.can_edit,
    can_delete = existing_parent.can_delete OR EXCLUDED.can_delete;

INSERT INTO role_permissions AS existing_parent (
  role_id,
  permission_id,
  can_view,
  can_create,
  can_edit,
  can_delete
)
SELECT
  child_grant.role_id,
  parent_permission.id,
  true,
  false,
  false,
  false
FROM role_permissions child_grant
JOIN permissions child_permission
  ON child_permission.id = child_grant.permission_id
 AND child_permission.resource = 'pick_lists.operation.view_only_assigned_pick_lists.view'
JOIN permissions parent_permission
  ON parent_permission.resource = 'pick_lists'
WHERE child_grant.can_view IS TRUE
ON CONFLICT (role_id, permission_id) DO UPDATE
SET can_view = existing_parent.can_view OR EXCLUDED.can_view,
    can_create = existing_parent.can_create OR EXCLUDED.can_create,
    can_edit = existing_parent.can_edit OR EXCLUDED.can_edit,
    can_delete = existing_parent.can_delete OR EXCLUDED.can_delete;

-- ============================================================================
-- SEED DATA: User Role Assignments
-- ============================================================================
-- Assign roles to users for RBAC
-- NOTE: Cashier role must be created above before assigning it to users

-- Assign Super Admin role to demo user (NULL business_unit_id = global access to all BUs)
INSERT INTO user_roles (user_id, role_id, business_unit_id, created_at)
SELECT
  '5745e13c-ab07-48b7-9db7-24372b16f5a9',
  r.id,
  NULL,  -- NULL = global role, applies to all business units
  NOW()
FROM roles r
WHERE r.name = 'Super Admin'
  AND r.company_id = '1e10e2dd-655e-41e0-a508-edfd660a9bcf'
  AND NOT EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = '5745e13c-ab07-48b7-9db7-24372b16f5a9'
      AND ur.role_id = r.id
      AND ur.business_unit_id IS NULL
  );

-- Assign Super Admin role to admin@pragmatica.ph (NULL business_unit_id = global access to all BUs)
INSERT INTO user_roles (user_id, role_id, business_unit_id, created_at)
SELECT
  'b6f62b1e-8eae-4ba2-93b2-353d20fe94e0',
  r.id,
  NULL,  -- NULL = global role, applies to all business units
  NOW()
FROM roles r
WHERE r.name = 'Super Admin'
  AND r.company_id = '1e10e2dd-655e-41e0-a508-edfd660a9bcf'
  AND NOT EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = 'b6f62b1e-8eae-4ba2-93b2-353d20fe94e0'
      AND ur.role_id = r.id
      AND ur.business_unit_id IS NULL
  );

-- Assign the requested accounts a global Super Admin role across all BUs
WITH requested_super_admins(user_id) AS (
  VALUES
    ('697b80c9-66ba-40bc-93e0-140ae99f005b'::UUID),
    ('19ff3144-93b8-4112-8597-03313f4dbc68'::UUID),
    ('25c02782-996b-4bf7-a547-5411d8561c1c'::UUID),
    ('f3de8cbf-64c1-406f-be69-fe5ee7ee1d7f'::UUID),
    ('a43706ac-6950-4e73-9e88-a23dd024fd25'::UUID),
    ('67bef70e-0045-4714-ac24-f3989d5827f6'::UUID),
    ('5a83d7fa-da00-44ea-90d2-e4b0c2fb3aae'::UUID)
)
INSERT INTO user_roles (user_id, role_id, business_unit_id, created_at)
SELECT
  requested_super_admins.user_id,
  roles.id,
  NULL,
  NOW()
FROM requested_super_admins
JOIN roles
  ON roles.name = 'Super Admin'
 AND roles.company_id = '1e10e2dd-655e-41e0-a508-edfd660a9bcf';

-- Assign Cashier role to cashier user
INSERT INTO user_roles (user_id, role_id, business_unit_id, created_at)
SELECT
  '5fa2a5a4-14ca-4afb-bfeb-abc345335a1f',
  r.id,
  'bbce384d-dd71-441c-a5e3-2b5e5d1543ce',
  NOW()
FROM roles r
WHERE r.name = 'Cashier'
  AND r.company_id = '1e10e2dd-655e-41e0-a508-edfd660a9bcf'
ON CONFLICT (user_id, role_id, business_unit_id) DO NOTHING;

-- Assign Stockman role to stockman demo user for Main-Bulacan
INSERT INTO user_roles (user_id, role_id, business_unit_id, created_at)
SELECT
  '1d2f3a4b-5c6d-47e8-9f01-23456789abcd',
  r.id,
  'd69c52d5-6755-4e28-87e3-24c680a5897b',
  NOW()
FROM roles r
WHERE r.name = 'Stockman'
  AND r.company_id = '1e10e2dd-655e-41e0-a508-edfd660a9bcf'
ON CONFLICT (user_id, role_id, business_unit_id) DO NOTHING;

-- Assign Picker role to picker demo user for Main-Bulacan
INSERT INTO user_roles (user_id, role_id, business_unit_id, created_at)
SELECT
  '2e3f4a5b-6c7d-48e9-af01-3456789abcde',
  r.id,
  'd69c52d5-6755-4e28-87e3-24c680a5897b',
  NOW()
FROM roles r
WHERE r.name = 'Picker'
  AND r.company_id = '1e10e2dd-655e-41e0-a508-edfd660a9bcf'
ON CONFLICT (user_id, role_id, business_unit_id) DO NOTHING;

-- Assign Admin role to mflores user for Main Office
INSERT INTO user_roles (user_id, role_id, business_unit_id, created_at)
SELECT
  'bcb8f5df-b678-4c22-ba71-59b33ba06227',
  r.id,
  'bbce384d-dd71-441c-a5e3-2b5e5d1543ce',
  NOW()
FROM roles r
WHERE r.name = 'Admin'
  AND r.company_id = '1e10e2dd-655e-41e0-a508-edfd660a9bcf'
ON CONFLICT (user_id, role_id, business_unit_id) DO NOTHING;

-- ============================================================================
-- SEED DATA: Suppliers
-- ============================================================================

DO $$
DECLARE
    v_company_id UUID := '1e10e2dd-655e-41e0-a508-edfd660a9bcf';
    v_user_id UUID := '5745e13c-ab07-48b7-9db7-24372b16f5a9';
BEGIN
    INSERT INTO suppliers (
        company_id, supplier_code, supplier_name, contact_person, email, phone, mobile, website, tax_id,
        billing_address_line1, billing_city, billing_state, billing_country, billing_postal_code,
        payment_terms, credit_limit, current_balance, status, notes,
        created_by, updated_by
    ) VALUES
        -- Frame Material Suppliers
        (
            v_company_id, 'SUP-001', 'Philippine Wood Products Inc.', 'Roberto Santos', 'roberto@philwoodproducts.ph', '+63-82-234-5678', '+63-917-234-5678', 'www.philwoodproducts.ph', '123-456-789-001',
            'Toril Industrial Area', 'Davao City', 'Davao del Sur', 'Philippines', '8000',
            'net_30', 2000000.00, 0, 'active', 'Main supplier for wood moldings and profiles',
            v_user_id, v_user_id
        ),
        (
            v_company_id, 'SUP-002', 'Mindanao Glass & Glazing Corp', 'Maria Gonzales', 'maria@mindanaoglass.ph', '+63-82-345-6789', '+63-917-345-6789', 'www.mindanaoglass.ph', '234-567-890-002',
            'Km 10, Sasa Industrial Park', 'Davao City', 'Davao del Sur', 'Philippines', '8000',
            'net_45', 3000000.00, 0, 'active', 'Glass sheets and UV protection glass supplier',
            v_user_id, v_user_id
        ),
        (
            v_company_id, 'SUP-003', 'Artboard Supplies Mindanao', 'Juan Dela Cruz', 'juan@artboardsupplies.ph', '+63-82-456-7890', '+63-917-456-7890', 'www.artboardsupplies.ph', '345-678-901-003',
            'MacArthur Highway, Matina', 'Davao City', 'Davao del Sur', 'Philippines', '8000',
            'net_30', 2500000.00, 0, 'active', 'Matboards, backing boards, and mounting supplies',
            v_user_id, v_user_id
        ),
        (
            v_company_id, 'SUP-004', 'Metal Frames Philippines', 'Pedro Mercado', 'pedro@metalframes.ph', '+63-83-552-3456', '+63-918-567-8901', 'www.metalframes.ph', '456-789-012-004',
            'National Highway, Calumpang', 'General Santos City', 'South Cotabato', 'Philippines', '9500',
            'net_60', 1500000.00, 0, 'active', 'Metal moldings and frame hardware supplier',
            v_user_id, v_user_id
        ),
        -- Packaging and Hardware
        (
            v_company_id, 'SUP-005', 'Packaging Solutions Davao', 'Ana Reyes', 'ana@packagingsolutions.ph', '+63-82-678-9012', '+63-917-678-9012', 'www.packagingsolutions.ph', '567-890-123-005',
            'Panacan Industrial Area', 'Davao City', 'Davao del Sur', 'Philippines', '8000',
            'net_15', 300000.00, 0, 'active', 'Bubble wrap, corner protectors, and packaging materials',
            v_user_id, v_user_id
        ),
        (
            v_company_id, 'SUP-006', 'Frame Hardware Depot', 'Carlos Ramos', 'carlos@framehardware.ph', '+63-82-789-0123', '+63-917-789-0123', 'www.framehardware.ph', '678-901-234-006',
            'Sasa Industrial Road', 'Davao City', 'Davao del Sur', 'Philippines', '8000',
            'cod', 100000.00, 0, 'active', 'D-rings, springs, hanging wire, and frame accessories',
            v_user_id, v_user_id
        ),
        -- Inactive Supplier
        (
            v_company_id, 'SUP-007', 'Old Frame Trading Co.', 'Miguel Torres', 'miguel@oldframes.ph', '+63-82-000-0000', NULL, NULL, '789-012-345-007',
            '456 Old Market Road', 'Davao City', 'Davao del Sur', 'Philippines', '8000',
            'cod', NULL, 0, 'inactive', 'No longer active - switched to other suppliers',
            v_user_id, v_user_id
        );

    RAISE NOTICE 'Suppliers seeded: % records', (SELECT COUNT(*) FROM suppliers);
END $$;


-- ============================================================================
-- SEED DATA: Chart of Accounts
-- ============================================================================

DO $$
DECLARE
    v_company_id UUID := '1e10e2dd-655e-41e0-a508-edfd660a9bcf';
    v_user_id UUID;
BEGIN
    -- Get first user for the company
    SELECT id INTO v_user_id FROM users WHERE company_id = v_company_id LIMIT 1;

    -- Insert default Chart of Accounts
    -- Get parent account ID for Sales Discounts
    DECLARE
        v_revenue_parent_id UUID;
    BEGIN
        -- Insert accounts
        INSERT INTO accounts (company_id, account_number, account_name, account_type, is_system_account, level, sort_order, created_by, updated_by)
        VALUES
            -- ASSETS
            (v_company_id, 'A-1000', 'Cash and Bank', 'asset', true, 1, 100, v_user_id, v_user_id),
            (v_company_id, 'A-1100', 'Accounts Receivable', 'asset', true, 1, 200, v_user_id, v_user_id),
            (v_company_id, 'A-1200', 'Inventory', 'asset', true, 1, 300, v_user_id, v_user_id),
            (v_company_id, 'A-1500', 'Fixed Assets', 'asset', false, 1, 400, v_user_id, v_user_id),

            -- LIABILITIES
            (v_company_id, 'L-2000', 'Accounts Payable', 'liability', true, 1, 500, v_user_id, v_user_id),
            (v_company_id, 'L-2100', 'Sales Tax Payable', 'liability', true, 1, 600, v_user_id, v_user_id),
            (v_company_id, 'L-2200', 'Accrued Expenses', 'liability', false, 1, 650, v_user_id, v_user_id),
            (v_company_id, 'L-2500', 'Long-term Debt', 'liability', false, 1, 700, v_user_id, v_user_id),

            -- EQUITY
            (v_company_id, 'E-3000', 'Owner''s Equity', 'equity', false, 1, 800, v_user_id, v_user_id),
            (v_company_id, 'E-3100', 'Retained Earnings', 'equity', false, 1, 900, v_user_id, v_user_id),

            -- REVENUE
            (v_company_id, 'R-4000', 'Sales Revenue', 'revenue', true, 1, 1000, v_user_id, v_user_id),
            (v_company_id, 'R-4100', 'Service Revenue', 'revenue', false, 1, 1100, v_user_id, v_user_id),
            (v_company_id, 'R-4900', 'Other Income', 'revenue', false, 1, 1200, v_user_id, v_user_id),

            -- COST OF GOODS SOLD
            (v_company_id, 'C-5000', 'Cost of Goods Sold', 'cogs', true, 1, 1300, v_user_id, v_user_id),

            -- EXPENSES
            (v_company_id, 'E-6000', 'Operating Expenses', 'expense', false, 1, 1400, v_user_id, v_user_id),
            (v_company_id, 'E-6100', 'Salaries and Wages', 'expense', false, 1, 1500, v_user_id, v_user_id),
            (v_company_id, 'E-6200', 'Rent Expense', 'expense', false, 1, 1600, v_user_id, v_user_id),
            (v_company_id, 'E-6300', 'Utilities Expense', 'expense', false, 1, 1700, v_user_id, v_user_id),
            (v_company_id, 'E-6400', 'Depreciation Expense', 'expense', false, 1, 1800, v_user_id, v_user_id),
            (v_company_id, 'E-6900', 'Miscellaneous Expense', 'expense', false, 1, 1900, v_user_id, v_user_id),

            -- Inventory Adjustment
            (v_company_id, 'E-6500', 'Inventory Adjustment - Loss/Gain', 'expense', true, 1, 2000, v_user_id, v_user_id);

        -- Get Sales Revenue account ID for parent relationship
        SELECT id INTO v_revenue_parent_id FROM accounts WHERE account_number = 'R-4000' AND company_id = v_company_id;

        -- Add Sales Discounts as child of Sales Revenue
        INSERT INTO accounts (company_id, account_number, account_name, account_type, parent_account_id, level, description, is_system_account, is_active, sort_order, created_by, updated_by)
        VALUES (v_company_id, 'R-4010', 'Sales Discounts', 'revenue', v_revenue_parent_id, 2, 'Contra-revenue account for sales discounts and price reductions', true, true, 1010, v_user_id, v_user_id);
    END;

    RAISE NOTICE 'Chart of Accounts seeded: % records', (SELECT COUNT(*) FROM accounts WHERE company_id = v_company_id);
END $$;

-- ============================================================================
-- SEED DATA: Item Variants, Packaging, and Prices Migration
-- ============================================================================
-- DISABLED: This section is commented out because it uses the OLD variant-based system
-- After inventory normalization migration, packages are created directly for items
-- See "SEED DATA: Create Packages for All Items" section above
-- ============================================================================

/*
DO $$
DECLARE
    v_company_id UUID := '1e10e2dd-655e-41e0-a508-edfd660a9bcf';
    v_user_id UUID;
    variants_created INTEGER;
    packaging_created INTEGER;
    fc_prices INTEGER;
    ws_prices INTEGER;
    srp_prices INTEGER;
BEGIN
    -- Get first user for the company
    SELECT id INTO v_user_id FROM users WHERE company_id = v_company_id LIMIT 1;

    -- Create DEFAULT variant for all seeded items
    INSERT INTO item_variants (
        company_id, item_id, variant_code, variant_name, description,
        attributes, is_active, is_default,
        created_at, created_by, updated_at, updated_by
    )
    SELECT
        i.company_id, i.id, 'DEFAULT', 'Default',
        'Auto-generated default variant',
        '{}'::jsonb, true, true,
        CURRENT_TIMESTAMP, COALESCE(v_user_id, i.created_by),
        CURRENT_TIMESTAMP, COALESCE(v_user_id, i.updated_by)
    FROM items i
    WHERE i.deleted_at IS NULL AND i.company_id = v_company_id
    ON CONFLICT (company_id, item_id, variant_code) DO NOTHING;

    GET DIAGNOSTICS variants_created = ROW_COUNT;

    -- Create DEFAULT packaging for all variants
    INSERT INTO item_packaging (
        company_id, variant_id, pack_type, pack_name, qty_per_pack,
        barcode, is_default, is_active,
        created_at, created_by, updated_at, updated_by
    )
    SELECT
        v.company_id, v.id, 'each', 'Each', 1,
        NULL, true, true,
        CURRENT_TIMESTAMP, COALESCE(v_user_id, i.created_by),
        CURRENT_TIMESTAMP, COALESCE(v_user_id, i.updated_by)
    FROM item_variants v
    INNER JOIN items i ON v.item_id = i.id
    WHERE v.deleted_at IS NULL AND v.is_default = true AND v.company_id = v_company_id
    ON CONFLICT (company_id, variant_id, pack_type) DO NOTHING;

    GET DIAGNOSTICS packaging_created = ROW_COUNT;

    -- Migrate Factory Cost (fc) from purchase_price
    INSERT INTO item_prices (
        company_id, variant_id, price_tier, price_tier_name, price,
        currency_code, effective_from, effective_to, is_active,
        created_at, created_by, updated_at, updated_by
    )
    SELECT
        v.company_id, v.id, 'fc', 'Factory Cost', COALESCE(i.purchase_price, 0),
        'PHP', CURRENT_DATE, NULL, true,
        CURRENT_TIMESTAMP, COALESCE(v_user_id, i.created_by),
        CURRENT_TIMESTAMP, COALESCE(v_user_id, i.updated_by)
    FROM item_variants v
    INNER JOIN items i ON v.item_id = i.id
    WHERE v.deleted_at IS NULL AND v.is_default = true
      AND i.purchase_price IS NOT NULL AND v.company_id = v_company_id
    ON CONFLICT (company_id, variant_id, price_tier, effective_from) DO NOTHING;

    GET DIAGNOSTICS fc_prices = ROW_COUNT;

    -- Migrate Wholesale (ws) from purchase_price
    INSERT INTO item_prices (
        company_id, variant_id, price_tier, price_tier_name, price,
        currency_code, effective_from, effective_to, is_active,
        created_at, created_by, updated_at, updated_by
    )
    SELECT
        v.company_id, v.id, 'ws', 'Wholesale', COALESCE(i.purchase_price, 0),
        'PHP', CURRENT_DATE, NULL, true,
        CURRENT_TIMESTAMP, COALESCE(v_user_id, i.created_by),
        CURRENT_TIMESTAMP, COALESCE(v_user_id, i.updated_by)
    FROM item_variants v
    INNER JOIN items i ON v.item_id = i.id
    WHERE v.deleted_at IS NULL AND v.is_default = true
      AND i.purchase_price IS NOT NULL AND v.company_id = v_company_id
    ON CONFLICT (company_id, variant_id, price_tier, effective_from) DO NOTHING;

    GET DIAGNOSTICS ws_prices = ROW_COUNT;

    -- Migrate SRP from sales_price
    INSERT INTO item_prices (
        company_id, variant_id, price_tier, price_tier_name, price,
        currency_code, effective_from, effective_to, is_active,
        created_at, created_by, updated_at, updated_by
    )
    SELECT
        v.company_id, v.id, 'srp', 'SRP', COALESCE(i.sales_price, 0),
        'PHP', CURRENT_DATE, NULL, true,
        CURRENT_TIMESTAMP, COALESCE(v_user_id, i.created_by),
        CURRENT_TIMESTAMP, COALESCE(v_user_id, i.updated_by)
    FROM item_variants v
    INNER JOIN items i ON v.item_id = i.id
    WHERE v.deleted_at IS NULL AND v.is_default = true
      AND i.sales_price IS NOT NULL AND v.company_id = v_company_id
    ON CONFLICT (company_id, variant_id, price_tier, effective_from) DO NOTHING;

    GET DIAGNOSTICS srp_prices = ROW_COUNT;

    RAISE NOTICE 'Variant/Packaging/Price migration complete:';
    RAISE NOTICE '  - Variants created: %', variants_created;
    RAISE NOTICE '  - Packaging created: %', packaging_created;
    RAISE NOTICE '  - FC prices: %', fc_prices;
    RAISE NOTICE '  - WS prices: %', ws_prices;
    RAISE NOTICE '  - SRP prices: %', srp_prices;
END $$;
*/

-- ============================================================================
-- SEED DATA: Sample Employees (Philippines - Mindanao)
-- ============================================================================

-- Note: This assumes a company exists. Adjust company_id and created_by as needed.
-- Get the first company and user for seeding
DO $$
DECLARE
    v_company_id UUID;
    v_user_id UUID;
BEGIN
    -- Get first company
    SELECT id INTO v_company_id FROM companies LIMIT 1;

    -- Get first user
    SELECT id INTO v_user_id FROM users LIMIT 1;

    -- Only insert if company exists
    IF v_company_id IS NOT NULL AND v_user_id IS NOT NULL THEN

        -- Insert sample employees
        INSERT INTO employees (
            company_id, business_unit_id, employee_code, first_name, last_name, email, phone,
            role, department, hire_date, commission_rate,
            city, region_state, is_active, created_by, updated_by, user_id
        ) VALUES
        -- Admin
        (v_company_id, 'd69c52d5-6755-4e28-87e3-24c680a5897b', 'EMP-001', 'Juan', 'Dela Cruz', 'juan.delacruz@example.com', '+63-917-1234567',
         'admin', 'Management', '2024-01-01', 5.00,
         'Davao City', 'Davao Region', true, v_user_id, v_user_id, '5745e13c-ab07-48b7-9db7-24372b16f5a9'),

        -- Managers
        (v_company_id, 'd69c52d5-6755-4e28-87e3-24c680a5897b', 'EMP-002', 'Maria', 'Santos', 'maria.santos@example.com', '+63-917-2345678',
         'manager', 'Sales', '2024-01-15', 3.00,
         'Cagayan de Oro City', 'Northern Mindanao', true, v_user_id, v_user_id, NULL),

        (v_company_id, 'd69c52d5-6755-4e28-87e3-24c680a5897b', 'EMP-003', 'Pedro', 'Reyes', 'pedro.reyes@example.com', '+63-917-3456789',
         'manager', 'Sales', '2024-02-01', 3.00,
         'General Santos City', 'SOCCSKSARGEN', true, v_user_id, v_user_id, NULL),
        -- Sales Agents
        (v_company_id, 'd69c52d5-6755-4e28-87e3-24c680a5897b', 'EMP-004', 'Ana', 'Garcia', 'ana.garcia@example.com', '+63-917-4567890',
         'sales_agent', 'Sales', '2024-03-01', 5.00,
         'Davao City', 'Davao Region', true, v_user_id, v_user_id, NULL),
        (v_company_id, 'd69c52d5-6755-4e28-87e3-24c680a5897b', 'EMP-005', 'Roberto', 'Cruz', 'roberto.cruz@example.com', '+63-917-5678901',
         'sales_agent', 'Sales', '2024-03-01', 5.00,
         'Tagum City', 'Davao Region', true, v_user_id, v_user_id, NULL),

        (v_company_id, 'd69c52d5-6755-4e28-87e3-24c680a5897b', 'EMP-006', 'Linda', 'Ramos', 'linda.ramos@example.com', '+63-917-6789012',
         'sales_agent', 'Sales', '2024-03-15', 6.00,
         'Cagayan de Oro City', 'Northern Mindanao', true, v_user_id, v_user_id, NULL),

        (v_company_id, 'd69c52d5-6755-4e28-87e3-24c680a5897b', 'EMP-007', 'Carlos', 'Mendoza', 'carlos.mendoza@example.com', '+63-917-7890123',
         'sales_agent', 'Sales', '2024-04-01', 5.50,
         'Iligan City', 'Northern Mindanao', true, v_user_id, v_user_id, NULL),

        (v_company_id, 'd69c52d5-6755-4e28-87e3-24c680a5897b', 'EMP-008', 'Sofia', 'Torres', 'sofia.torres@example.com', '+63-917-8901234',
         'sales_agent', 'Sales', '2024-04-01', 7.00,
         'General Santos City', 'SOCCSKSARGEN', true, v_user_id, v_user_id, NULL),

        (v_company_id, 'd69c52d5-6755-4e28-87e3-24c680a5897b', 'EMP-009', 'Miguel', 'Flores', 'miguel.flores@example.com', '+63-917-9012345',
         'sales_agent', 'Sales', '2024-04-15', 5.00,
         'Zamboanga City', 'Zamboanga Peninsula', true, v_user_id, v_user_id, 'bcb8f5df-b678-4c22-ba71-59b33ba06227'),

        (v_company_id, 'd69c52d5-6755-4e28-87e3-24c680a5897b', 'EMP-010', 'Elena', 'Diaz', 'elena.diaz@example.com', '+63-917-0123456',
         'sales_agent', 'Sales', '2024-05-01', 6.50,
         'Butuan City', 'Caraga', true, v_user_id, v_user_id, NULL);

        RAISE NOTICE 'Sample employees created successfully';
    ELSE
        RAISE NOTICE 'No company or user found. Skipping employee seed data.';
    END IF;
END $$;

-- ============================================================================
-- SEED DATA: Sample Territory Assignments
-- ============================================================================

DO $$
DECLARE
    v_company_id UUID;
    v_user_id UUID;
    v_emp_004 UUID;
    v_emp_005 UUID;
    v_emp_006 UUID;
    v_emp_007 UUID;
    v_emp_008 UUID;
    v_emp_009 UUID;
    v_emp_010 UUID;
BEGIN
    SELECT id INTO v_company_id FROM companies LIMIT 1;
    SELECT id INTO v_user_id FROM users LIMIT 1;

    IF v_company_id IS NOT NULL AND v_user_id IS NOT NULL THEN
        -- Get employee IDs
        SELECT id INTO v_emp_004 FROM employees WHERE employee_code = 'EMP-004' AND company_id = v_company_id;
        SELECT id INTO v_emp_005 FROM employees WHERE employee_code = 'EMP-005' AND company_id = v_company_id;
        SELECT id INTO v_emp_006 FROM employees WHERE employee_code = 'EMP-006' AND company_id = v_company_id;
        SELECT id INTO v_emp_007 FROM employees WHERE employee_code = 'EMP-007' AND company_id = v_company_id;
        SELECT id INTO v_emp_008 FROM employees WHERE employee_code = 'EMP-008' AND company_id = v_company_id;
        SELECT id INTO v_emp_009 FROM employees WHERE employee_code = 'EMP-009' AND company_id = v_company_id;
        SELECT id INTO v_emp_010 FROM employees WHERE employee_code = 'EMP-010' AND company_id = v_company_id;

        -- Assign territories
        INSERT INTO employee_distribution_locations (
            company_id, employee_id, city, region_state, is_primary, created_by, updated_by
        ) VALUES
        -- Ana Garcia - Davao Region
        (v_company_id, v_emp_004, 'Davao City', 'Davao Region', true, v_user_id, v_user_id),
        (v_company_id, v_emp_004, 'Digos City', 'Davao Region', false, v_user_id, v_user_id),

        -- Roberto Cruz - Davao Region
        (v_company_id, v_emp_005, 'Tagum City', 'Davao Region', true, v_user_id, v_user_id),
        (v_company_id, v_emp_005, 'Panabo City', 'Davao Region', false, v_user_id, v_user_id),

        -- Linda Ramos - Northern Mindanao
        (v_company_id, v_emp_006, 'Cagayan de Oro City', 'Northern Mindanao', true, v_user_id, v_user_id),
        (v_company_id, v_emp_006, 'Valencia City', 'Northern Mindanao', false, v_user_id, v_user_id),

        -- Carlos Mendoza - Northern Mindanao
        (v_company_id, v_emp_007, 'Iligan City', 'Northern Mindanao', true, v_user_id, v_user_id),
        (v_company_id, v_emp_007, 'Malaybalay City', 'Northern Mindanao', false, v_user_id, v_user_id),

        -- Sofia Torres - SOCCSKSARGEN
        (v_company_id, v_emp_008, 'General Santos City', 'SOCCSKSARGEN', true, v_user_id, v_user_id),
        (v_company_id, v_emp_008, 'Koronadal City', 'SOCCSKSARGEN', false, v_user_id, v_user_id),

        -- Miguel Flores - Zamboanga Peninsula
        (v_company_id, v_emp_009, 'Zamboanga City', 'Zamboanga Peninsula', true, v_user_id, v_user_id),
        (v_company_id, v_emp_009, 'Pagadian City', 'Zamboanga Peninsula', false, v_user_id, v_user_id),

        -- Elena Diaz - Caraga
        (v_company_id, v_emp_010, 'Butuan City', 'Caraga', true, v_user_id, v_user_id),
        (v_company_id, v_emp_010, 'Surigao City', 'Caraga', false, v_user_id, v_user_id);

        RAISE NOTICE 'Territory assignments created successfully';
    END IF;
END $$;

-- ============================================================================
-- SEED DATA: Link Admin User to Employee (for testing)
-- ============================================================================
    DO $$
        DECLARE
            v_user_id1 UUID;
            v_employee_id1 UUID;
            v_user_id2 UUID;
            v_employee_id2 UUID;
        BEGIN
            -- Get a sales agent employee (Ana Garcia - EMP-004)
            SELECT id INTO v_employee_id1 FROM employees WHERE employee_code = 'EMP-001' LIMIT 1;
            SELECT id INTO v_employee_id2 FROM employees WHERE employee_code = 'EMP-009' LIMIT 1;
        
        IF v_employee_id1 IS NOT NULL THEN
            -- Link user to employee in both directions
            UPDATE users SET employee_id = v_employee_id1 WHERE id = '5745e13c-ab07-48b7-9db7-24372b16f5a9';
            UPDATE employees SET user_id = '5745e13c-ab07-48b7-9db7-24372b16f5a9' WHERE id = v_employee_id1;
        
            RAISE NOTICE 'Admin user linked to employee EMP-001 (Demo User)';
        ELSE
            RAISE NOTICE 'Admin user or employee not found. Skipping user-employee link.';
        END IF;
        IF v_employee_id2 IS NOT NULL THEN
            -- Link user to employee in both directions
            UPDATE users SET employee_id = v_employee_id2 WHERE id = 'bcb8f5df-b678-4c22-ba71-59b33ba06227';
            UPDATE employees SET user_id = 'bcb8f5df-b678-4c22-ba71-59b33ba06227' WHERE id = v_employee_id2;
        
            RAISE NOTICE 'User linked to employee EMP-009 (Miguel Flores)';
        ELSE
            RAISE NOTICE 'User or employee not found. Skipping user-employee link.';
        END IF;
    END $$;

-- ============================================================================
-- NOTE: Cashier Role and User Account
-- ============================================================================
-- The Cashier role and permissions are created earlier in this file (before User Role Assignments section)
-- The cashier user account (cashier@pragmatica.app) is created above with:
--   - auth.users record
--   - public.users record
--   - business_unit_access (with is_current = true for JWT)
--   - user_roles assignment
--
-- Login credentials:
--   Email: cashier@pragmatica.app
--
-- The cashier has access to:
--   - Dashboard (view only)
--   - Inventory > Items (view only)
--   - Sales > Point of Sale, POS Transactions, Customers, Sales Orders, Invoices

-- Purpose: Backfill MAIN locations and default location references from item_warehouse totals

-- Ensure MAIN location exists per warehouse
INSERT INTO warehouse_locations (
  company_id,
  warehouse_id,
  code,
  name,
  location_type,
  is_pickable,
  is_storable,
  is_active,
  created_at,
  updated_at
)
SELECT
  w.company_id,
  w.id,
  'MAIN',
  'Main',
  'rack',
  true,
  true,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM warehouses w
WHERE w.deleted_at IS NULL
ON CONFLICT (company_id, warehouse_id, code) DO NOTHING;

-- Set MAIN as default location for all item_warehouse rows
UPDATE item_warehouse iw
SET default_location_id = wl.id
FROM warehouse_locations wl
WHERE wl.warehouse_id = iw.warehouse_id
  AND wl.code = 'MAIN'
  AND wl.deleted_at IS NULL
  AND iw.deleted_at IS NULL;

-- ============================================================================
-- Migration: Backfill Opening Item Batches
-- Version: 20260224103000
-- Description: Seeds opening balances into item_batches and item_batch_locations
--              from existing inventory. Uses item_warehouse.current_stock as
--              on-hand source of truth and uses default/MAIN locations for
--              location-batch rows.
-- Date: 2026-02-24
-- ============================================================================

BEGIN;

-- Ensure a MAIN location exists for any warehouse participating in the backfill.
INSERT INTO warehouse_locations (
  company_id,
  warehouse_id,
  code,
  name,
  location_type,
  is_pickable,
  is_storable,
  is_active,
  created_by,
  updated_by
)
SELECT DISTINCT
  iw.company_id,
  iw.warehouse_id,
  'MAIN' AS code,
  'Main' AS name,
  'rack' AS location_type,
  TRUE,
  TRUE,
  TRUE,
  NULL::UUID,
  NULL::UUID
FROM item_warehouse iw
WHERE iw.deleted_at IS NULL
  AND (COALESCE(iw.current_stock, 0) > 0 OR COALESCE(iw.reserved_stock, 0) > 0)
ON CONFLICT (company_id, warehouse_id, code) DO NOTHING;

-- If an item_warehouse row has no default location, assign MAIN for backfill consistency.
UPDATE item_warehouse iw
SET
  default_location_id = wl.id,
  updated_at = CURRENT_TIMESTAMP
FROM warehouse_locations wl
WHERE iw.deleted_at IS NULL
  AND iw.default_location_id IS NULL
  AND wl.company_id = iw.company_id
  AND wl.warehouse_id = iw.warehouse_id
  AND wl.code = 'MAIN'
  AND wl.deleted_at IS NULL;

-- Create one opening batch per item + warehouse with current stock / reserved stock.
INSERT INTO item_batches (
  company_id,
  item_id,
  warehouse_id,
  batch_code,
  received_at,
  qty_on_hand,
  qty_reserved,
  created_by,
  updated_by
)
SELECT
  iw.company_id,
  iw.item_id,
  iw.warehouse_id,
  'OPENING-BAL' AS batch_code,
  COALESCE(iw.created_at, CURRENT_TIMESTAMP) AS received_at,
  GREATEST(0, COALESCE(iw.current_stock, 0))::DECIMAL(20,4) AS qty_on_hand,
  LEAST(
    GREATEST(0, COALESCE(iw.reserved_stock, 0)),
    GREATEST(0, COALESCE(iw.current_stock, 0))
  )::DECIMAL(20,4) AS qty_reserved,
  NULL::UUID,
  NULL::UUID
FROM item_warehouse iw
WHERE iw.deleted_at IS NULL
  AND (COALESCE(iw.current_stock, 0) > 0 OR COALESCE(iw.reserved_stock, 0) > 0)
ON CONFLICT (company_id, item_id, warehouse_id, batch_code) DO UPDATE
SET
  received_at = EXCLUDED.received_at,
  qty_on_hand = EXCLUDED.qty_on_hand,
  qty_reserved = EXCLUDED.qty_reserved,
  updated_at = CURRENT_TIMESTAMP;

-- Backfill exact location-batch rows from item_warehouse balances into opening batch.
INSERT INTO item_batch_locations (
  company_id,
  item_id,
  warehouse_id,
  location_id,
  item_batch_id,
  qty_on_hand,
  qty_reserved,
  created_by,
  updated_by
)
SELECT
  iw.company_id,
  iw.item_id,
  iw.warehouse_id,
  COALESCE(iw.default_location_id, wl.id) AS location_id,
  ib.id AS item_batch_id,
  GREATEST(0, COALESCE(iw.current_stock, 0))::DECIMAL(20,4) AS qty_on_hand,
  LEAST(
    GREATEST(0, COALESCE(iw.reserved_stock, 0)),
    GREATEST(0, COALESCE(iw.current_stock, 0))
  )::DECIMAL(20,4) AS qty_reserved,
  NULL::UUID,
  NULL::UUID
FROM item_warehouse iw
JOIN item_batches ib
  ON ib.company_id = iw.company_id
 AND ib.item_id = iw.item_id
 AND ib.warehouse_id = iw.warehouse_id
 AND ib.batch_code = 'OPENING-BAL'
 AND ib.deleted_at IS NULL
LEFT JOIN warehouse_locations wl
  ON wl.company_id = iw.company_id
 AND wl.warehouse_id = iw.warehouse_id
 AND wl.code = 'MAIN'
 AND wl.deleted_at IS NULL
WHERE iw.deleted_at IS NULL
  AND COALESCE(iw.default_location_id, wl.id) IS NOT NULL
  AND (COALESCE(iw.current_stock, 0) > 0 OR COALESCE(iw.reserved_stock, 0) > 0)
ON CONFLICT (company_id, item_id, warehouse_id, location_id, item_batch_id) DO UPDATE
SET
  qty_on_hand = EXCLUDED.qty_on_hand,
  qty_reserved = EXCLUDED.qty_reserved,
  updated_at = CURRENT_TIMESTAMP;

COMMIT;
-- Backfill existing rows before adding NOT NULL / uniqueness constraints.
UPDATE item_batch_locations
SET
  batch_location_sku = public.generate_item_batch_location_sku(),
  updated_at = CURRENT_TIMESTAMP
WHERE batch_location_sku IS NULL
   OR BTRIM(batch_location_sku) = '';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'item_batch_locations_batch_location_sku_format_check'
  ) THEN
    ALTER TABLE item_batch_locations
      ADD CONSTRAINT item_batch_locations_batch_location_sku_format_check
      CHECK (batch_location_sku ~ '^[0-9]{10}$');
  END IF;
END $$;

INSERT INTO "public"."document_code_sequences"("company_id","code_prefix","last_number","created_at","updated_at")
VALUES
('1e10e2dd-655e-41e0-a508-edfd660a9bcf','ADJ',0,'2026-03-11 07:46:34.934152+00','2026-03-11 07:46:34.934152+00'),
('1e10e2dd-655e-41e0-a508-edfd660a9bcf','DN',0,'2026-03-11 07:46:34.934152+00','2026-03-11 07:46:34.934152+00'),
('1e10e2dd-655e-41e0-a508-edfd660a9bcf','GRN',0,'2026-03-11 07:46:34.934152+00','2026-03-11 07:46:34.934152+00'),
('1e10e2dd-655e-41e0-a508-edfd660a9bcf','INV',0,'2026-03-11 07:46:34.934152+00','2026-03-11 07:46:34.934152+00'),
('1e10e2dd-655e-41e0-a508-edfd660a9bcf','JE',0,'2026-03-11 07:46:34.934152+00','2026-03-11 07:46:34.934152+00'),
('1e10e2dd-655e-41e0-a508-edfd660a9bcf','LL',0,'2026-03-11 07:46:34.934152+00','2026-03-11 07:46:34.934152+00'),
('1e10e2dd-655e-41e0-a508-edfd660a9bcf','PAY',0,'2026-03-11 07:46:34.934152+00','2026-03-11 07:46:34.934152+00'),
('1e10e2dd-655e-41e0-a508-edfd660a9bcf','PL',0,'2026-03-11 07:46:34.934152+00','2026-03-11 07:46:34.934152+00'),
('1e10e2dd-655e-41e0-a508-edfd660a9bcf','PO',0,'2026-03-11 07:46:34.934152+00','2026-03-11 07:46:34.934152+00'),
('1e10e2dd-655e-41e0-a508-edfd660a9bcf','POS',0,'2026-03-11 07:46:34.934152+00','2026-03-11 07:46:34.934152+00'),
('1e10e2dd-655e-41e0-a508-edfd660a9bcf','QT',0,'2026-03-11 07:46:34.934152+00','2026-03-11 07:46:34.934152+00'),
('1e10e2dd-655e-41e0-a508-edfd660a9bcf','SO',0,'2026-03-11 07:46:34.934152+00','2026-03-11 07:46:34.934152+00'),
('1e10e2dd-655e-41e0-a508-edfd660a9bcf','SR',0,'2026-03-11 07:46:34.934152+00','2026-03-11 07:46:34.934152+00'),
('1e10e2dd-655e-41e0-a508-edfd660a9bcf','ST',0,'2026-03-11 07:46:34.934152+00','2026-03-11 07:46:34.934152+00'),
('1e10e2dd-655e-41e0-a508-edfd660a9bcf','STX',0,'2026-03-11 07:46:34.934152+00','2026-03-11 07:46:34.934152+00'),
('1e10e2dd-655e-41e0-a508-edfd660a9bcf','TRN',0,'2026-03-11 07:46:34.934152+00','2026-03-11 07:46:34.934152+00');

INSERT INTO "auth"."users"("instance_id","id","aud","role","email","encrypted_password","email_confirmed_at","invited_at","confirmation_token","confirmation_sent_at","recovery_token","recovery_sent_at","email_change_token_new","email_change","email_change_sent_at","last_sign_in_at","raw_app_meta_data","raw_user_meta_data","is_super_admin","created_at","updated_at","phone","phone_confirmed_at","phone_change","phone_change_token","phone_change_sent_at","email_change_token_current","email_change_confirm_status","banned_until","reauthentication_token","reauthentication_sent_at","is_sso_user","deleted_at","is_anonymous")
VALUES
('00000000-0000-0000-0000-000000000000','c313f071-c097-4a8a-9f08-b1e759dcaf12','authenticated','authenticated','lato_rosie@yahoo.com','$2a$10$fl1NcrikDWUCdcVrOa2MRebN.HByAT8m80Jk2K9P5L09INoP1omFG','2025-11-06 07:07:59.211291+00',NULL,'',NULL,'',NULL,'','',NULL,'2025-11-06 07:07:59.218139+00','{"provider": "email", "providers": ["email"]}','{"sub": "c313f071-c097-4a8a-9f08-b1e759dcaf12", "email": "lato_rosie@yahoo.com", "email_verified": true, "phone_verified": false}',NULL,'2025-11-06 07:07:59.200435+00','2025-11-06 07:07:59.22046+00',NULL,NULL,'','',NULL,'',0,NULL,'',NULL,FALSE,NULL,FALSE);

-- Apply the requested development passwords after every seeded auth user exists.
UPDATE auth.users
SET encrypted_password = CASE
  WHEN email = 'lato_rosie@yahoo.com'
    THEN '$2a$10$daToOGt04Cc7zQsQoJ7mq.D45jeZVNpgiP1dP7CoLnmp4CZKYakiO'
  ELSE '$2a$10$YYm.GtSjeByIE2dBgT4qNOOf2w8IJNKE4/y/j3ihOW/sQRFHIRzO6'
END
WHERE instance_id = '00000000-0000-0000-0000-000000000000'
  AND deleted_at IS NULL;

INSERT INTO "public"."users"("id","company_id","username","email","first_name","last_name","phone","is_active","last_login_at","created_at","updated_at","deleted_at","van_warehouse_id")
VALUES
('c313f071-c097-4a8a-9f08-b1e759dcaf12','1e10e2dd-655e-41e0-a508-edfd660a9bcf','Rosie','lato_rosie@yahoo.com','Rosie','Lato',NULL,TRUE,NULL,'2025-11-06 07:17:41.17002','2026-03-23 03:04:23.690267',NULL,'c830f462-6973-42cd-8125-898376fbc291');

INSERT INTO "public"."employees"("id","company_id","employee_code","first_name","last_name","email","phone","role","department","hire_date","termination_date","employment_status","commission_rate","address_line1","address_line2","city","region_state","country","postal_code","emergency_contact_name","emergency_contact_phone","is_active","created_at","created_by","updated_at","updated_by","deleted_at","version","custom_fields","user_id","business_unit_id")
VALUES
('82613e97-f513-44ae-ace2-0a8377725c92','1e10e2dd-655e-41e0-a508-edfd660a9bcf','EMP-015','Rosie','Lato','lato_rosie@yahoo.com','+63-917-5678901','sales_agent','Sales','2024-03-01',NULL,'active',5,NULL,NULL,'Tagum City','Davao Region','Philippines',NULL,NULL,NULL,TRUE,'2026-03-26 22:36:38.663213','5745e13c-ab07-48b7-9db7-24372b16f5a9','2026-03-26 22:36:38.663213','5745e13c-ab07-48b7-9db7-24372b16f5a9',NULL,1,NULL,'c313f071-c097-4a8a-9f08-b1e759dcaf12','d69c52d5-6755-4e28-87e3-24c680a5897b');

UPDATE public.employees set user_id = 'c313f071-c097-4a8a-9f08-b1e759dcaf12' where id = '82613e97-f513-44ae-ace2-0a8377725c92';

INSERT INTO "public"."user_business_unit_access"("user_id","business_unit_id","role","is_default","granted_at","granted_by","is_current")
VALUES
('c313f071-c097-4a8a-9f08-b1e759dcaf12','bbce384d-dd71-441c-a5e3-2b5e5d1543ce','admin',TRUE,'2026-03-26 22:36:38.663213+00',NULL,TRUE),
('c313f071-c097-4a8a-9f08-b1e759dcaf12','d5d09f49-c3d7-4f24-aca9-57bea45e0a54','admin',FALSE,'2026-03-26 22:36:38.663213+00',NULL,FALSE),
('c313f071-c097-4a8a-9f08-b1e759dcaf12','d69c52d5-6755-4e28-87e3-24c680a5897b','admin',FALSE,'2026-03-26 22:36:38.663213+00',NULL,FALSE);


DO $$
DECLARE
	role_id uuid;
BEGIN
SELECT id INTO role_id FROM roles where name = 'Super Admin'; 
INSERT INTO "public"."user_roles"("id","user_id","role_id","business_unit_id","created_at","created_by","updated_at","updated_by","deleted_at")
VALUES
('16bd8b58-45b7-4a2b-97ad-558e774fe7a0','c313f071-c097-4a8a-9f08-b1e759dcaf12',role_id,'d5d09f49-c3d7-4f24-aca9-57bea45e0a54','2026-03-29 05:44:03.505898+00','5745e13c-ab07-48b7-9db7-24372b16f5a9','2026-03-29 05:44:03.505898+00','5745e13c-ab07-48b7-9db7-24372b16f5a9',NULL),
('47465692-a8e5-4b16-a944-22c74817b390','c313f071-c097-4a8a-9f08-b1e759dcaf12',role_id,'bbce384d-dd71-441c-a5e3-2b5e5d1543ce','2026-03-29 05:43:57.393398+00','5745e13c-ab07-48b7-9db7-24372b16f5a9','2026-03-29 05:43:57.393398+00','5745e13c-ab07-48b7-9db7-24372b16f5a9',NULL),
('af761765-792f-4f91-b2ea-d456e328b135','c313f071-c097-4a8a-9f08-b1e759dcaf12',role_id,'d69c52d5-6755-4e28-87e3-24c680a5897b','2026-03-29 05:43:51.878104+00','5745e13c-ab07-48b7-9db7-24372b16f5a9','2026-03-29 05:43:51.878104+00','5745e13c-ab07-48b7-9db7-24372b16f5a9',NULL);
END $$;


-- ============================================================================
-- Migration: Backfill Item Unit Options Base Rows
-- Version: 20260405113000
-- Description: Creates one base item_unit_options row for each existing item.
-- Date: 2026-04-05
-- ============================================================================
BEGIN;
INSERT INTO public.item_unit_options (
  company_id,
  item_id,
  uom_id,
  option_label,
  qty_per_unit,
  is_base,
  is_default,
  is_active,
  sort_order,
  created_at,
  created_by,
  updated_at,
  updated_by
)
SELECT
  i.company_id,
  i.id AS item_id,
  i.uom_id,
  NULL AS option_label,
  1.0000 AS qty_per_unit,
  TRUE AS is_base,
  TRUE AS is_default,
  TRUE AS is_active,
  0 AS sort_order,
  COALESCE(i.created_at, CURRENT_TIMESTAMP) AS created_at,
  i.created_by,
  COALESCE(i.updated_at, CURRENT_TIMESTAMP) AS updated_at,
  i.updated_by
FROM public.items i
WHERE i.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.item_unit_options iu
    WHERE iu.item_id = i.id
      AND iu.deleted_at IS NULL
  );

DO $$
DECLARE
  v_total_items INTEGER;
  v_items_with_active_rows INTEGER;
  v_base_rows INTEGER;
BEGIN
  SELECT COUNT(*)
    INTO v_total_items
  FROM public.items
  WHERE deleted_at IS NULL;

  SELECT COUNT(DISTINCT item_id)
    INTO v_items_with_active_rows
  FROM public.item_unit_options
  WHERE deleted_at IS NULL;

  SELECT COUNT(*)
    INTO v_base_rows
  FROM public.item_unit_options
  WHERE deleted_at IS NULL
    AND is_base = TRUE;

  RAISE NOTICE '============================================';
  RAISE NOTICE 'Item Unit Options Base Backfill Complete';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Active items: %', v_total_items;
  RAISE NOTICE 'Items with active item_unit_options rows: %', v_items_with_active_rows;
  RAISE NOTICE 'Active base item_unit_options rows: %', v_base_rows;

  IF v_total_items <> v_items_with_active_rows THEN
    RAISE WARNING 'Some active items still do not have an active item_unit_options row';
  END IF;

  IF v_total_items <> v_base_rows THEN
    RAISE WARNING 'Some active items still do not have an active base item_unit_options row';
  END IF;

  RAISE NOTICE '============================================';
END $$;

COMMIT;

BEGIN;

INSERT INTO "public"."units_of_measure"("id","company_id","code","name","symbol","is_base_unit","is_active","created_at","created_by","updated_at","updated_by","deleted_at","version")
VALUES
('0adbf2f3-bae6-4abc-a773-66891d9f2c2a','1e10e2dd-655e-41e0-a508-edfd660a9bcf','STICK','Stick','stick',FALSE,TRUE,'2026-02-20 01:54:02.288286',NULL,'2026-02-20 02:29:46.822541',NULL,NULL,1);

COMMIT;



DO $glass_import$
DECLARE
  v_missing TEXT;
BEGIN
DROP TABLE IF EXISTS public.glass_import;

CREATE TABLE public.glass_import (
  item_code TEXT NOT NULL,
  dimension_text TEXT,
  width NUMERIC,
  height NUMERIC,
  thickness NUMERIC,
  thickness_unit TEXT,
  item_name TEXT NOT NULL,
  production TEXT,
  description TEXT,
  qty_per_box NUMERIC,
  qty_per_crate NUMERIC,
  purchase_price NUMERIC,
  sales_price NUMERIC,
  ws_price NUMERIC,
  srp_price NUMERIC
);

INSERT INTO public.glass_import (
  item_code, dimension_text, width, height, thickness, thickness_unit,
  item_name, production, description, qty_per_box, qty_per_crate,
  purchase_price, sales_price, ws_price, srp_price
) VALUES
  ('GLS 0001', '48 X 72 X 1.6mm', 48, 72, 1.6, 'MM', 'ACRYLIC CLEAR GLASS 48" X 72" X 1.6mm PG', NULL, 'ACRYLIC CLEAR GLASS 48" X 72" X 1.6mm PG', NULL, NULL, NULL, 1680, 1512, 1680),
  ('GLS 0002', '48 X 96 X 1.5mm', 48, 96, 1.5, 'MM', 'ACRYLIC CLEAR GLASS 48" X 72" X 1.5mm AM', NULL, 'ACRYLIC CLEAR GLASS 48" X 72" X 1.5mm AM', NULL, NULL, NULL, 1680, 1512, 1680),
  ('GLS 0003', '48 X 96 X 2mm', 48, 96, 2, 'MM', 'ACRYLIC CLEAR GLASS 48" X 96" X 2mm PG', NULL, 'ACRYLIC CLEAR GLASS 48" X 96" X 2mm PG', NULL, NULL, NULL, 2560, 2304, 2560),
  ('GLS 0004', '48 X 96 X 2mm', 48, 96, 2, 'MM', 'ACRYLIC CLEAR GLASS 48" X 96" X 2mm AM', NULL, 'ACRYLIC CLEAR GLASS 48" X 96" X 2mm AM', NULL, NULL, NULL, 2560, 2304, 2560),
  ('GLS 0005', '48 X 96 X 3mm', 48, 96, 3, 'MM', 'ACRYLIC CLEAR GLASS 48" X 96" X 3mm', NULL, 'ACRYLIC CLEAR GLASS 48" X 96" X 3mm', NULL, NULL, NULL, 3520, 3168, 3520),
  ('GLS 0006', '4 X 6', 4, 6, NULL, NULL, '4" X 6"A CUT SIZE CLEAR GLASS', 'LOCAL', '4" X 6"A CUT SIZE CLEAR GLASS', 200, NULL, NULL, 5.5, 5, 5.5),
  ('GLS 0007', '4 X 6', 4, 6, NULL, NULL, '4" X 6"E CUT SIZE CLEAR GLASS', 'IMPORTED/LOCAL', '4" X 6"E CUT SIZE CLEAR GLASS', 200, NULL, NULL, 5.5, 5, 5.5),
  ('GLS 0008', '5 X 7', 5, 7, NULL, NULL, '5" X 7"A CUT SIZE CLEAR GLASS', 'LOCAL', '5" X 7"A CUT SIZE CLEAR GLASS', 100, NULL, NULL, 8.5, 8, 8.5),
  ('GLS 0009', '5 X 7', 5, 7, NULL, NULL, '5" X 7"E CUT SIZE CLEAR GLASS', NULL, '5" X 7"E CUT SIZE CLEAR GLASS', 100, NULL, NULL, 8.5, 8, 8.5),
  ('GLS 0010', '8 X 10', 8, 10, NULL, NULL, '8" X 10"A CUT SIZE CLEAR GLASS', 'LOCAL', '8" X 10"A CUT SIZE CLEAR GLASS', 50, NULL, NULL, 15, 13.5, 15),
  ('GLS 0011', '8 X 10', 8, 10, NULL, NULL, '8" X 10"E CUT SIZE CLEAR GLASS', 'IMPORTED/LOCAL', '8" X 10"E CUT SIZE CLEAR GLASS', 50, NULL, NULL, 15, 13.5, 15),
  ('GLS 0012', '8 1/4 X 11 3/4', 8.25, 11.75, NULL, NULL, '8 1/4" X 11 3/4"A CUT SIZE CLEAR GLASS', 'LOCAL', '8 1/4" X 11 3/4"A CUT SIZE CLEAR GLASS', 50, NULL, NULL, 20, 17.5, 20),
  ('GLS 0013', '8 1/4 X 11 3/4', 8.25, 11.75, NULL, NULL, '8 1/4" X 11 3/4"E CUT SIZE CLEAR GLASS', 'IMPORTED/LOCAL', '8 1/4" X 11 3/4"E CUT SIZE CLEAR GLASS', 50, NULL, NULL, 20, 17.5, 20),
  ('GLS 0014', '8 1/2 X 11', 8.5, 11, NULL, NULL, '8 1/2" X 11"A CUT SIZE CLEAR GLASS', 'LOCAL', '8 1/2" X 11"A CUT SIZE CLEAR GLASS', 50, NULL, NULL, 20, 17.5, 20),
  ('GLS 0015', '8 1/2 X 11', 8.5, 11, NULL, NULL, '8 1/2" X 11"E CUT SIZE CLEAR GLASS', 'IMPORTED/LOCAL', '8 1/2" X 11"E CUT SIZE CLEAR GLASS', 50, NULL, NULL, 20, 17.5, 20),
  ('GLS 0016', '10 X 12', 10, 12, NULL, NULL, '10" X 12"A CUT SIZE CLEAR GLASS', 'LOCAL', '10" X 12"A CUT SIZE CLEAR GLASS', 50, NULL, NULL, 30, 24, 30),
  ('GLS 0017', '10 X 12', 10, 12, NULL, NULL, '10" X 12"E CUT SIZE CLEAR GLASS', 'IMPORTED/LOCAL', '10" X 12"E CUT SIZE CLEAR GLASS', 50, NULL, NULL, 30, 24, 30),
  ('GLS 0018', '10 X 12', 10, 12, NULL, NULL, '10" X 12" JIS CUT SIZE CLEAR GLASS', 'IMPORTED', '10" X 12" JIS CUT SIZE CLEAR GLASS', 50, NULL, NULL, 30, 23, 30),
  ('GLS 0019', '10 X 14', 10, 14, NULL, NULL, '10" X 14"A CUT SIZE CLEAR GLASS', 'LOCAL', '10" X 14"A CUT SIZE CLEAR GLASS', 25, NULL, NULL, 33.5, 30, 33.5),
  ('GLS 0020', '10 X 14', 10, 14, NULL, NULL, '10" X 14"E CUT SIZE CLEAR GLASS', 'IMPORTED/LOCAL', '10" X 14"E CUT SIZE CLEAR GLASS', 25, NULL, NULL, 33.5, 30, 33.5),
  ('GLS 0021', '10 1/4 X 13 3/4', 10.25, 13.75, NULL, NULL, '10 1/4" X 13 3/4" A CUT SIZE CLEAR GLASS', 'LOCAL', '10 1/4" X 13 3/4" A CUT SIZE CLEAR GLASS', NULL, NULL, NULL, 33.5, 30, 33.5),
  ('GLS 0022', '10 1/4 X 13 3/4', 10.25, 13.75, NULL, NULL, '10 1/4" X 13 3/4" E CUT SIZE CLEAR GLASS', 'IMPORTED/LOCAL', '10 1/4" X 13 3/4" E CUT SIZE CLEAR GLASS', NULL, NULL, NULL, 33.5, 30, 33.5),
  ('GLS 0023', '12 X 14', 12, 14, NULL, NULL, '12" X 14" A CUT SIZE CLEAR GLASS', 'LOCAL', '12" X 14" A CUT SIZE CLEAR GLASS', 50, NULL, NULL, 38, 34, 38),
  ('GLS 0024', '12 X 14', 12, 14, NULL, NULL, '12" X 14"E CUT SIZE CLEAR GLASS', 'IMPORTED/LOCAL', '12" X 14"E CUT SIZE CLEAR GLASS', 50, NULL, NULL, 38, 34, 38),
  ('GLS 0025', '13 X 16', 13, 16, NULL, NULL, '13" X 16" A CUT SIZE CLEAR GLASS', 'LOCAL', '13" X 16" A CUT SIZE CLEAR GLASS', 25, NULL, NULL, 39, 35, 39),
  ('GLS 0026', '13 X 16', 13, 16, NULL, NULL, '13" X 16"E CUT SIZE CLEAR GLASS', 'IMPORTED/LOCAL', '13" X 16"E CUT SIZE CLEAR GLASS', 25, NULL, NULL, 39, 35, 39),
  ('GLS 0027', '14 X 20', 14, 20, NULL, NULL, '14" X 20"A CUT SIZE CLEAR GLASS', 'LOCAL', '14" X 20"A CUT SIZE CLEAR GLASS', NULL, NULL, NULL, 67, 60, 67),
  ('GLS 0028', '14 X 20', 14, 20, NULL, NULL, '14" X 20"E CUT SIZE CLEAR GLASS', 'IMPORTED/LOCAL', '14" X 20"E CUT SIZE CLEAR GLASS', NULL, NULL, NULL, 67, 60, 67),
  ('GLS 0029', '16 X 20', 16, 20, NULL, NULL, '16" X 20 A CUT SIZE CLEAR GLASS', 'LOCAL', '16" X 20 A CUT SIZE CLEAR GLASS', NULL, NULL, NULL, 67, 60, 67),
  ('GLS 0030', '16 X 20', 16, 20, NULL, NULL, '16" X 20 E CUT SIZE CLEAR GLASS', 'IMPORTED/LOCAL', '16" X 20 E CUT SIZE CLEAR GLASS', NULL, NULL, NULL, 67, 60, 67),
  ('GLS 0031', '18 X 22', 18, 22, NULL, NULL, '18" X 22"A CUT SIZE CLEAR GLASS', 'LOCAL', '18" X 22"A CUT SIZE CLEAR GLASS', NULL, NULL, NULL, 81, 72.5, 81),
  ('GLS 0032', '18 X 22', 18, 22, NULL, NULL, '18" X 22"E CUT SIZE CLEAR GLASS', 'IMPORTED/LOCAL', '18" X 22"E CUT SIZE CLEAR GLASS', NULL, NULL, NULL, 81, 72.5, 81),
  ('GLS 0033', '36 X 48 X 1/16mm', 36, 48, 0.0625, 'MM', '36" X 48" X 1/16 A CLEAR GALSS', 'LOCAL', '36" X 48" X 1/16 A CLEAR GALSS', NULL, 304, NULL, 320, 265, 320),
  ('GLS 0034', '36 X 48 X 1/16mm', 36, 48, 0.0625, 'MM', '36" X 48" X 1/16 E CLEAR GALSS', 'IMPORTED', '36" X 48" X 1/16 E CLEAR GALSS', NULL, 345, NULL, 320, 265, 320);

  SELECT string_agg(required_name, ', ' ORDER BY required_name)
  INTO v_missing
  FROM (
    SELECT 'company 1e10e2dd-655e-41e0-a508-edfd660a9bcf' AS required_name
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.companies
      WHERE id = '1e10e2dd-655e-41e0-a508-edfd660a9bcf'
        AND deleted_at IS NULL
    )
    UNION ALL
    SELECT 'UOM SHEET'
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.units_of_measure
      WHERE company_id = '1e10e2dd-655e-41e0-a508-edfd660a9bcf'
        AND UPPER(code) = 'SHEET'
        AND deleted_at IS NULL
    )
    UNION ALL
    SELECT 'UOM BOX'
    WHERE EXISTS (SELECT 1 FROM public.glass_import WHERE qty_per_box IS NOT NULL)
      AND NOT EXISTS (
        SELECT 1
        FROM public.units_of_measure
        WHERE company_id = '1e10e2dd-655e-41e0-a508-edfd660a9bcf'
          AND UPPER(code) = 'BOX'
          AND deleted_at IS NULL
      )
    UNION ALL
    SELECT 'item category GLASS'
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.item_categories
      WHERE company_id = '1e10e2dd-655e-41e0-a508-edfd660a9bcf'
        AND code = 'GLASS'
        AND deleted_at IS NULL
    )
  ) missing_records;

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Glass import prerequisite records are missing: %', v_missing;
  END IF;

PERFORM setval(
  'public.item_unit_option_barcode_seq',
  GREATEST(
    (SELECT COALESCE(last_value, 1) FROM public.item_unit_option_barcode_seq),
    (SELECT COUNT(*) + 10000 FROM public.item_unit_options)
  ),
  TRUE
);

WITH constants AS (
  SELECT
    '1e10e2dd-655e-41e0-a508-edfd660a9bcf'::UUID AS company_id,
    uom_sheet.id AS sheet_uom_id,
    category.id AS category_id
  FROM public.units_of_measure uom_sheet
  JOIN public.item_categories category
    ON category.company_id = uom_sheet.company_id
   AND category.code = 'GLASS'
   AND category.deleted_at IS NULL
  WHERE uom_sheet.company_id = '1e10e2dd-655e-41e0-a508-edfd660a9bcf'
    AND UPPER(uom_sheet.code) = 'SHEET'
    AND uom_sheet.deleted_at IS NULL
)
INSERT INTO public.items (
  company_id,
  item_code,
  item_name,
  description,
  category_id,
  uom_id,
  item_type,
  purchase_price,
  sales_price,
  is_stock_item,
  track_serial,
  track_batch,
  dimensions,
  is_active,
  custom_fields
)
SELECT
  constants.company_id,
  imported.item_code,
  imported.item_name,
  imported.description,
  constants.category_id,
  constants.sheet_uom_id,
  'raw_material',
  imported.purchase_price,
  imported.sales_price,
  TRUE,
  FALSE,
  TRUE,
  jsonb_strip_nulls(jsonb_build_object(
    'width', imported.width,
    'height', imported.height,
    'unit', 'IN'
  )),
  TRUE,
  jsonb_strip_nulls(jsonb_build_object(
    'production', imported.production,
    'thickness', imported.thickness,
    'thickness_unit', imported.thickness_unit,
    'qty_per_crate', imported.qty_per_crate
  ))
FROM public.glass_import imported
CROSS JOIN constants
ON CONFLICT (company_id, item_code) DO UPDATE SET
  item_name = EXCLUDED.item_name,
  description = EXCLUDED.description,
  category_id = EXCLUDED.category_id,
  uom_id = EXCLUDED.uom_id,
  item_type = EXCLUDED.item_type,
  purchase_price = EXCLUDED.purchase_price,
  sales_price = EXCLUDED.sales_price,
  is_stock_item = EXCLUDED.is_stock_item,
  track_serial = EXCLUDED.track_serial,
  track_batch = EXCLUDED.track_batch,
  dimensions = EXCLUDED.dimensions,
  is_active = EXCLUDED.is_active,
  custom_fields = EXCLUDED.custom_fields,
  deleted_at = NULL,
  updated_at = CURRENT_TIMESTAMP;

WITH constants AS (
  SELECT
    '1e10e2dd-655e-41e0-a508-edfd660a9bcf'::UUID AS company_id,
    uom_sheet.id AS sheet_uom_id
  FROM public.units_of_measure uom_sheet
  WHERE uom_sheet.company_id = '1e10e2dd-655e-41e0-a508-edfd660a9bcf'
    AND UPPER(uom_sheet.code) = 'SHEET'
    AND uom_sheet.deleted_at IS NULL
)
INSERT INTO public.item_unit_options (
  company_id,
  item_id,
  uom_id,
  option_label,
  qty_per_unit,
  is_base,
  is_default,
  is_active,
  sort_order
)
SELECT
  constants.company_id,
  items.id,
  constants.sheet_uom_id,
  'SHEET',
  1,
  TRUE,
  TRUE,
  TRUE,
  0
FROM public.glass_import imported
CROSS JOIN constants
JOIN public.items
  ON items.company_id = constants.company_id
 AND items.item_code = imported.item_code
 AND items.deleted_at IS NULL
ON CONFLICT (company_id, item_id, uom_id, qty_per_unit) WHERE deleted_at IS NULL DO UPDATE SET
  option_label = EXCLUDED.option_label,
  is_base = TRUE,
  is_default = TRUE,
  is_active = TRUE,
  sort_order = 0,
  deleted_at = NULL,
  updated_at = CURRENT_TIMESTAMP;

WITH constants AS (
  SELECT
    '1e10e2dd-655e-41e0-a508-edfd660a9bcf'::UUID AS company_id,
    uom_box.id AS box_uom_id
  FROM public.units_of_measure uom_box
  WHERE uom_box.company_id = '1e10e2dd-655e-41e0-a508-edfd660a9bcf'
    AND UPPER(uom_box.code) = 'BOX'
    AND uom_box.deleted_at IS NULL
)
INSERT INTO public.item_unit_options (
  company_id,
  item_id,
  uom_id,
  option_label,
  qty_per_unit,
  is_base,
  is_default,
  is_active,
  sort_order
)
SELECT
  constants.company_id,
  items.id,
  constants.box_uom_id,
  FORMAT(
    'BOX (%s)',
    CASE
      WHEN imported.qty_per_box = TRUNC(imported.qty_per_box)
        THEN TRUNC(imported.qty_per_box)::TEXT
      ELSE REGEXP_REPLACE(imported.qty_per_box::TEXT, '0+$', '')
    END
  ),
  imported.qty_per_box,
  FALSE,
  FALSE,
  TRUE,
  10
FROM public.glass_import imported
CROSS JOIN constants
JOIN public.items
  ON items.company_id = constants.company_id
 AND items.item_code = imported.item_code
 AND items.deleted_at IS NULL
WHERE imported.qty_per_box IS NOT NULL
ON CONFLICT (company_id, item_id, uom_id, qty_per_unit) WHERE deleted_at IS NULL DO UPDATE SET
  option_label = EXCLUDED.option_label,
  is_base = FALSE,
  is_default = FALSE,
  is_active = TRUE,
  sort_order = 10,
  deleted_at = NULL,
  updated_at = CURRENT_TIMESTAMP;

WITH constants AS (
  SELECT '1e10e2dd-655e-41e0-a508-edfd660a9bcf'::UUID AS company_id
),
price_rows AS (
  SELECT item_code, 'default'::TEXT AS price_tier, 'Default'::TEXT AS price_tier_name, sales_price AS price
  FROM public.glass_import
  WHERE sales_price IS NOT NULL
  UNION ALL
  SELECT item_code, 'ws'::TEXT AS price_tier, 'WS'::TEXT AS price_tier_name, ws_price AS price
  FROM public.glass_import
  WHERE ws_price IS NOT NULL
  UNION ALL
  SELECT item_code, 'srp'::TEXT AS price_tier, 'SRP'::TEXT AS price_tier_name, srp_price AS price
  FROM public.glass_import
  WHERE srp_price IS NOT NULL
)
INSERT INTO public.item_prices (
  company_id,
  item_id,
  price_tier,
  price_tier_name,
  price,
  currency_code,
  effective_from,
  is_active
)
SELECT
  constants.company_id,
  items.id,
  price_rows.price_tier,
  price_rows.price_tier_name,
  price_rows.price,
  'PHP',
  DATE '2026-06-24',
  TRUE
FROM price_rows
CROSS JOIN constants
JOIN public.items
  ON items.company_id = constants.company_id
 AND items.item_code = price_rows.item_code
 AND items.deleted_at IS NULL
ON CONFLICT (company_id, item_id, price_tier, effective_from) DO UPDATE SET
  price_tier_name = EXCLUDED.price_tier_name,
  price = EXCLUDED.price,
  currency_code = EXCLUDED.currency_code,
  is_active = TRUE,
  effective_to = NULL,
  deleted_at = NULL,
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO public.warehouse_locations (
  company_id,
  warehouse_id,
  code,
  name,
  location_type,
  is_active,
  is_pickable,
  is_storable
)
SELECT
  warehouses.company_id,
  warehouses.id,
  'MAIN',
  'Main',
  'rack',
  TRUE,
  TRUE,
  TRUE
FROM public.warehouses
WHERE warehouses.company_id = '1e10e2dd-655e-41e0-a508-edfd660a9bcf'
  AND warehouses.deleted_at IS NULL
ON CONFLICT (company_id, warehouse_id, code) DO UPDATE SET
  name = EXCLUDED.name,
  location_type = EXCLUDED.location_type,
  is_active = TRUE,
  is_pickable = TRUE,
  is_storable = TRUE,
  deleted_at = NULL,
  updated_at = CURRENT_TIMESTAMP;

WITH imported_items AS (
  SELECT
    items.company_id,
    items.id AS item_id,
    warehouses.id AS warehouse_id,
    warehouse_locations.id AS location_id,
    (10 + (get_byte(decode(md5(imported.item_code || ':' || warehouses.id::TEXT), 'hex'), 0) % 91))::NUMERIC AS opening_qty
  FROM public.glass_import imported
  JOIN public.items
    ON items.company_id = '1e10e2dd-655e-41e0-a508-edfd660a9bcf'
   AND items.item_code = imported.item_code
   AND items.deleted_at IS NULL
  JOIN public.warehouses
    ON warehouses.company_id = items.company_id
   AND warehouses.deleted_at IS NULL
  JOIN public.warehouse_locations
    ON warehouse_locations.company_id = warehouses.company_id
   AND warehouse_locations.warehouse_id = warehouses.id
   AND warehouse_locations.code = 'MAIN'
   AND warehouse_locations.deleted_at IS NULL
)
INSERT INTO public.item_warehouse (
  company_id,
  item_id,
  warehouse_id,
  default_location_id,
  reorder_level,
  reorder_quantity,
  current_stock,
  reserved_stock,
  is_active
)
SELECT
  company_id,
  item_id,
  warehouse_id,
  location_id,
  25,
  100,
  opening_qty,
  0,
  TRUE
FROM imported_items
ON CONFLICT (company_id, item_id, warehouse_id) DO UPDATE SET
  default_location_id = COALESCE(public.item_warehouse.default_location_id, EXCLUDED.default_location_id),
  reorder_level = EXCLUDED.reorder_level,
  reorder_quantity = EXCLUDED.reorder_quantity,
  current_stock = EXCLUDED.current_stock,
  reserved_stock = 0,
  is_active = TRUE,
  deleted_at = NULL,
  updated_at = CURRENT_TIMESTAMP;

WITH imported_items AS (
  SELECT
    items.company_id,
    items.id AS item_id,
    warehouses.id AS warehouse_id,
    (10 + (get_byte(decode(md5(imported.item_code || ':' || warehouses.id::TEXT), 'hex'), 0) % 91))::NUMERIC AS opening_qty
  FROM public.glass_import imported
  JOIN public.items
    ON items.company_id = '1e10e2dd-655e-41e0-a508-edfd660a9bcf'
   AND items.item_code = imported.item_code
   AND items.deleted_at IS NULL
  JOIN public.warehouses
    ON warehouses.company_id = items.company_id
   AND warehouses.deleted_at IS NULL
)
INSERT INTO public.item_batches (
  company_id,
  item_id,
  warehouse_id,
  batch_code,
  received_at,
  qty_on_hand,
  qty_reserved
)
SELECT
  company_id,
  item_id,
  warehouse_id,
  'OPENING-BAL',
  TIMESTAMPTZ '2026-06-24 00:00:00+08',
  opening_qty,
  0
FROM imported_items
ON CONFLICT (company_id, item_id, warehouse_id, batch_code) DO UPDATE SET
  received_at = EXCLUDED.received_at,
  qty_on_hand = EXCLUDED.qty_on_hand,
  qty_reserved = 0,
  deleted_at = NULL,
  updated_at = CURRENT_TIMESTAMP;

WITH imported_batches AS (
  SELECT
    item_batches.company_id,
    item_batches.item_id,
    item_batches.warehouse_id,
    warehouse_locations.id AS location_id,
    item_batches.id AS item_batch_id,
    (10 + (get_byte(decode(md5(imported.item_code || ':' || item_batches.warehouse_id::TEXT), 'hex'), 0) % 91))::NUMERIC AS opening_qty
  FROM public.glass_import imported
  JOIN public.items
    ON items.company_id = '1e10e2dd-655e-41e0-a508-edfd660a9bcf'
   AND items.item_code = imported.item_code
   AND items.deleted_at IS NULL
  JOIN public.item_batches
    ON item_batches.company_id = items.company_id
   AND item_batches.item_id = items.id
   AND item_batches.batch_code = 'OPENING-BAL'
   AND item_batches.deleted_at IS NULL
  JOIN public.warehouse_locations
    ON warehouse_locations.company_id = item_batches.company_id
   AND warehouse_locations.warehouse_id = item_batches.warehouse_id
   AND warehouse_locations.code = 'MAIN'
   AND warehouse_locations.deleted_at IS NULL
)
INSERT INTO public.item_batch_locations (
  company_id,
  item_id,
  warehouse_id,
  location_id,
  item_batch_id,
  qty_on_hand,
  qty_reserved
)
SELECT
  company_id,
  item_id,
  warehouse_id,
  location_id,
  item_batch_id,
  opening_qty,
  0
FROM imported_batches
ON CONFLICT (company_id, item_id, warehouse_id, location_id, item_batch_id) DO UPDATE SET
  qty_on_hand = EXCLUDED.qty_on_hand,
  qty_reserved = 0,
  deleted_at = NULL,
  updated_at = CURRENT_TIMESTAMP;

DROP TABLE IF EXISTS public.glass_import;

END;
$glass_import$;

DO $backing_import$
DECLARE
  v_missing TEXT;
BEGIN
DROP TABLE IF EXISTS public.backing_import;

CREATE TABLE public.backing_import (
  item_code TEXT NOT NULL,
  item_name TEXT NOT NULL,
  description TEXT,
  stand NUMERIC,
  purchase_price NUMERIC,
  sales_price NUMERIC,
  ws_price NUMERIC,
  srp_price NUMERIC
);

INSERT INTO public.backing_import (
  item_code, item_name, description, stand, purchase_price, sales_price, ws_price, srp_price
) VALUES
  ('BCK 0001', '2R EASEL STAND W/O D RING', '2R EASEL STAND W/O D RING', 100, NULL, 9, 8, 9),
  ('BCK 0002', '3 1/2 X 5 EASEL STAND W/O D RING', '3 1/2 X 5 EASEL STAND W/O D RING', 100, NULL, 8, 7, 8),
  ('BCK 0003', '3 1/2 X 5 EASEL STAND W/1 D RING', '3 1/2 X 5 EASEL STAND W/1 D RING', NULL, NULL, 9.5, 8.5, 9.5),
  ('BCK 0004', '3 1/2X S EASEL STAND W/2 D RING', '3 1/2X S EASEL STAND W/2 D RING', NULL, NULL, 11, 10, 11),
  ('BCK 0005', '4 X  6 EASEL STAND W/O D RING', '4 X  6 EASEL STAND W/O D RING', 100, NULL, 8, 7, 8),
  ('BCK 0006', '4 X  6 EASEL STAND W/1 D RING', '4 X  6 EASEL STAND W/1 D RING', NULL, NULL, 9.5, 8.5, 9.5),
  ('BCK 0007', '4 X  6 EASEL STAND W/2 D RING', '4 X  6 EASEL STAND W/2 D RING', NULL, NULL, 11, 10, 11),
  ('BCK 0008', '5 X 7 EASEL STAND W/O D RING', '5 X 7 EASEL STAND W/O D RING', 100, NULL, 8, 7, 8),
  ('BCK 0009', '5 X 7 EASEL STAND W/1 D RING', '5 X 7 EASEL STAND W/1 D RING', NULL, NULL, 9.5, 8.5, 9.5),
  ('BCK 0010', '5 X 7 EASEL STAND W/2 D RING', '5 X 7 EASEL STAND W/2 D RING', NULL, NULL, 13, 10, 13),
  ('BCK 0011', '6 X 8 EASEL STAND W/O D RING', '6 X 8 EASEL STAND W/O D RING', 100, NULL, 9, 7.5, 9),
  ('BCK 0012', '6 X 8 EASEL STAND W/1 D RING', '6 X 8 EASEL STAND W/1 D RING', NULL, NULL, 10.5, 9, 10.5),
  ('BCK 0013', '6 X 8 EASEL STAND W/2 D RING', '6 X 8 EASEL STAND W/2 D RING', NULL, NULL, 12, 10.5, 12),
  ('BCK 0014', '7 X 9 EASEL STAND W/O D RING', '7 X 9 EASEL STAND W/O D RING', 100, NULL, 13.5, 12, 13.5),
  ('BCK 0015', '7 X 9 EASEL STAND W/1 D RING', '7 X 9 EASEL STAND W/1 D RING', NULL, NULL, 15, 13.5, 15),
  ('BCK 0016', '7 X 9 EASEL STAND W/2 D RING', '7 X 9 EASEL STAND W/2 D RING', NULL, NULL, 16.5, 15, 16.5),
  ('BCK 0017', '8 X 10  BACKING PLAIN MDF', '8 X 10  BACKING PLAIN MDF', 100, NULL, 7, 6, 7),
  ('BCK 0018', '8 X 10  BACKING 1 D RING MDF', '8 X 10  BACKING 1 D RING MDF', NULL, NULL, 8.5, 7.5, 8.5),
  ('BCK 0019', '8 X 10  BACKING 2 D RING MDF', '8 X 10  BACKING 2 D RING MDF', NULL, NULL, 10, 9, 10),
  ('BCK 0020', '8 X 10 EASEL STAND W/O D RING', '8 X 10 EASEL STAND W/O D RING', NULL, NULL, 13.5, 12, 13.5),
  ('BCK 0021', '8 X 10 EASEL STAND W/1 D RING', '8 X 10 EASEL STAND W/1 D RING', NULL, NULL, 15, 13.5, 15),
  ('BCK 0022', '8 X 10 EASEL STAND W/2 D RING', '8 X 10 EASEL STAND W/2 D RING', NULL, NULL, 16.5, 15, 16.5),
  ('BCK 0023', '8 1/4 X 11 3/4 BACKING PLAIN MDF', '8 1/4 X 11 3/4 BACKING PLAIN MDF', 100, NULL, 8, 7, 8),
  ('BCK 0024', '8 1/4 X 11 3/4 BACKING W/1 D RING MDF', '8 1/4 X 11 3/4 BACKING W/1 D RING MDF', NULL, NULL, 9.5, 8.5, 9.5),
  ('BCK 0025', '8 1/4 X 11 3/4 BACKING W/2 RING MDF', '8 1/4 X 11 3/4 BACKING W/2 RING MDF', NULL, NULL, 11, 10, 11),
  ('BCK 0026', '8 1/4 X 11 3/4 EASEL STAND W/O D RING', '8 1/4 X 11 3/4 EASEL STAND W/O D RING', NULL, NULL, 15.5, 14, 15.5),
  ('BCK 0027', '8 1/4 X 11 3/4 EASEL STAND W/1 D RING', '8 1/4 X 11 3/4 EASEL STAND W/1 D RING', NULL, NULL, 17, 15.5, 17),
  ('BCK 0028', '8 1/4 X 11 3/4 EASEL STAND W/2 D RING', '8 1/4 X 11 3/4 EASEL STAND W/2 D RING', NULL, NULL, 18.5, 17, 18.5),
  ('BCK 0029', '8 1/2 X 11  BACKING PLAIN MDF', '8 1/2 X 11  BACKING PLAIN MDF', 100, NULL, 8, 7, 8),
  ('BCK 0030', '8 1/2 X 11  BACKING W/1D RING MDF', '8 1/2 X 11  BACKING W/1D RING MDF', NULL, NULL, 9.5, 8.5, 9.5),
  ('BCK 0031', '8 1/2 X 11  BACKING W/2D RING MDF', '8 1/2 X 11  BACKING W/2D RING MDF', NULL, NULL, 11, 10, 11),
  ('BCK 0032', '8 1/2 X 11 EASEL STAND W/O D RING', '8 1/2 X 11 EASEL STAND W/O D RING', NULL, NULL, 15.5, 14, 15.5),
  ('BCK 0033', '8 1/2 X 11 EASEL STAND W/1 D RING', '8 1/2 X 11 EASEL STAND W/1 D RING', NULL, NULL, 17, 15.5, 17),
  ('BCK 0034', '8 1/2 X 11 EASEL STAND W/2 D RING', '8 1/2 X 11 EASEL STAND W/2 D RING', NULL, NULL, 18.5, 17, 18.5),
  ('BCK 0035', '8 1/2 X 13 BACKING PLAIN MDF', '8 1/2 X 13 BACKING PLAIN MDF', 100, NULL, 17.5, 15, 17.5),
  ('BCK 0036', '8 1/2 X 13 BACKING W/1D RING MDF', '8 1/2 X 13 BACKING W/1D RING MDF', NULL, NULL, 19, 16.5, 19),
  ('BCK 0037', '8 1/2 X 13 BACKING W/2D RING MDF', '8 1/2 X 13 BACKING W/2D RING MDF', NULL, NULL, 20.5, 18, 20.5),
  ('BCK 0038', '9 X 12 BACKING PLAIN MDF', '9 X 12 BACKING PLAIN MDF', 100, NULL, 15, 13, 15),
  ('BCK 0039', '9 X 12 EASEL STAND W/O D RING', '9 X 12 EASEL STAND W/O D RING', NULL, NULL, 16, 14, 16),
  ('BCK 0040', '9 X 12 EASEL STAND W/1 D RING', '9 X 12 EASEL STAND W/1 D RING', NULL, NULL, 18, 16, 18),
  ('BCK 0041', '9 X 12 EASEL STAND W/2 D RING', '9 X 12 EASEL STAND W/2 D RING', NULL, NULL, 20, 18, 20),
  ('BCK 0042', '10 X 12 BACKING W/1 D RING PLYWOOD', '10 X 12 BACKING W/1 D RING PLYWOOD', NULL, NULL, 11, 9.5, 11),
  ('BCK 0043', '10 X 12 BACKING W/2 D RING PLYWOOD', '10 X 12 BACKING W/2 D RING PLYWOOD', NULL, NULL, 12, 11, 12),
  ('BCK 0044', '10 X 12 EASEL STAND W/O D RING', '10 X 12 EASEL STAND W/O D RING', NULL, NULL, 16, 14, 16),
  ('BCK 0045', '10 X 12EASEL STAND W/1 D RING', '10 X 12EASEL STAND W/1 D RING', NULL, NULL, 18, 16, 18),
  ('BCK 0046', '10 X 12 EASEL STAND W/2 D RING', '10 X 12 EASEL STAND W/2 D RING', NULL, NULL, 20, 18, 20),
  ('BCK 0047', '10 X 14 BACKING PLAIN MDF', '10 X 14 BACKING PLAIN MDF', NULL, NULL, 12, 11, 12),
  ('BCK 0048', '10 1/4 X 13 3/4 BACKING PLAIN MDF', '10 1/4 X 13 3/4 BACKING PLAIN MDF', 100, NULL, 12, 11, 12),
  ('BCK 0049', '11 X 14 EASEL STAND W/1 D RING', '11 X 14 EASEL STAND W/1 D RING', NULL, NULL, 24, 22, 24),
  ('BCK 0050', '48 X 96 MDF', '48 X 96 MDF', NULL, NULL, 260, NULL, 260),
  ('BCK 0051', '48 X 96 PLYWOOD 1/8LOCAL', '48 X 96 PLYWOOD 1/8LOCAL', NULL, NULL, 450, NULL, 450),
  ('BCK 0052', '48 X 96 PLYWOOD 3/6 LOCAL', '48 X 96 PLYWOOD 3/6 LOCAL', NULL, NULL, 530, NULL, 530),
  ('BCK 0053', '48 X 96 MARINE PLY 3/16', '48 X 96 MARINE PLY 3/16', NULL, NULL, 580, NULL, 580),
  ('BCK 0054', '32 X 40 CORROGATED BOARD V FLUTE', '32 X 40 CORROGATED BOARD V FLUTE', NULL, NULL, 45, 38, 45),
  ('BCK 0055', '30 X 40 FOAM BOARD W/COVER BLACK', '30 X 40 FOAM BOARD W/COVER BLACK', NULL, NULL, 260, 230, 260),
  ('BCK 0056', '30 X 40 FOAM BOARD W/COVER WHITE', '30 X 40 FOAM BOARD W/COVER WHITE', NULL, NULL, 260, 230, 260),
  ('BCK 0057', '44 X 96 X 5mm FOAM BOARD W/O COVER(JIS)', '44 X 96 X 5mm FOAM BOARD W/O COVER(JIS)', NULL, NULL, 500, 350, 500),
  ('BCK 0058', '48 X 96 X 5mm FOAMBOARD W/COVER', '48 X 96 X 5mm FOAMBOARD W/COVER', NULL, NULL, 500, 350, 500),
  ('BCK 0059', '48 X 96 X 1.5mm XINTRA BOARD (BLUE)', '48 X 96 X 1.5mm XINTRA BOARD (BLUE)', NULL, NULL, 460, 410, 460),
  ('BCK 0060', '48 X 96 X 3 mm XINTRA BOARD (BLUE)', '48 X 96 X 3 mm XINTRA BOARD (BLUE)', NULL, NULL, 660, 590, 660),
  ('BCK 0061', '48 X 96 X 1.5mm XINTRA BOARD (GREEN)', '48 X 96 X 1.5mm XINTRA BOARD (GREEN)', NULL, NULL, 660, 590, 660),
  ('BCK 0062', '48 X 96 X 3mm XINTRA BOARD (GREEN)', '48 X 96 X 3mm XINTRA BOARD (GREEN)', NULL, NULL, 995, 895, 995),
  ('BCK 0063', '48 X 96 X 1.5 mm XINTRA BOARD (RED)', '48 X 96 X 1.5 mm XINTRA BOARD (RED)', NULL, NULL, 375, 335, 375),
  ('BCK 0064', '48 X 96 X 3 mm XINTRA BOARD (RED)', '48 X 96 X 3 mm XINTRA BOARD (RED)', NULL, NULL, 545, 490, 545);

  SELECT string_agg(required_name, ', ' ORDER BY required_name)
  INTO v_missing
  FROM (
    SELECT 'company 1e10e2dd-655e-41e0-a508-edfd660a9bcf' AS required_name
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.companies
      WHERE id = '1e10e2dd-655e-41e0-a508-edfd660a9bcf'
        AND deleted_at IS NULL
    )
    UNION ALL
    SELECT 'UOM PCS'
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.units_of_measure
      WHERE company_id = '1e10e2dd-655e-41e0-a508-edfd660a9bcf'
        AND UPPER(code) = 'PCS'
        AND deleted_at IS NULL
    )
    UNION ALL
    SELECT 'item category BACK'
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.item_categories
      WHERE company_id = '1e10e2dd-655e-41e0-a508-edfd660a9bcf'
        AND code = 'BACK'
        AND deleted_at IS NULL
    )
  ) missing_records;

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Backing import prerequisite records are missing: %', v_missing;
  END IF;

PERFORM setval(
  'public.item_unit_option_barcode_seq',
  GREATEST(
    (SELECT COALESCE(last_value, 1) FROM public.item_unit_option_barcode_seq),
    (SELECT COUNT(*) + 10000 FROM public.item_unit_options)
  ),
  TRUE
);

WITH constants AS (
  SELECT
    '1e10e2dd-655e-41e0-a508-edfd660a9bcf'::UUID AS company_id,
    uom_pcs.id AS pcs_uom_id,
    category.id AS category_id
  FROM public.units_of_measure uom_pcs
  JOIN public.item_categories category
    ON category.company_id = uom_pcs.company_id
   AND category.code = 'BACK'
   AND category.deleted_at IS NULL
  WHERE uom_pcs.company_id = '1e10e2dd-655e-41e0-a508-edfd660a9bcf'
    AND UPPER(uom_pcs.code) = 'PCS'
    AND uom_pcs.deleted_at IS NULL
)
INSERT INTO public.items (
  company_id,
  item_code,
  item_name,
  description,
  category_id,
  uom_id,
  item_type,
  purchase_price,
  sales_price,
  is_stock_item,
  track_serial,
  track_batch,
  is_active,
  custom_fields
)
SELECT
  constants.company_id,
  imported.item_code,
  imported.item_name,
  imported.description,
  constants.category_id,
  constants.pcs_uom_id,
  'raw_material',
  imported.purchase_price,
  imported.sales_price,
  TRUE,
  FALSE,
  TRUE,
  TRUE,
  jsonb_strip_nulls(jsonb_build_object(
    'stand', imported.stand
  ))
FROM public.backing_import imported
CROSS JOIN constants
ON CONFLICT (company_id, item_code) DO UPDATE SET
  item_name = EXCLUDED.item_name,
  description = EXCLUDED.description,
  category_id = EXCLUDED.category_id,
  uom_id = EXCLUDED.uom_id,
  item_type = EXCLUDED.item_type,
  purchase_price = EXCLUDED.purchase_price,
  sales_price = EXCLUDED.sales_price,
  is_stock_item = EXCLUDED.is_stock_item,
  track_serial = EXCLUDED.track_serial,
  track_batch = EXCLUDED.track_batch,
  is_active = EXCLUDED.is_active,
  custom_fields = EXCLUDED.custom_fields,
  deleted_at = NULL,
  updated_at = CURRENT_TIMESTAMP;

WITH constants AS (
  SELECT
    '1e10e2dd-655e-41e0-a508-edfd660a9bcf'::UUID AS company_id,
    uom_pcs.id AS pcs_uom_id
  FROM public.units_of_measure uom_pcs
  WHERE uom_pcs.company_id = '1e10e2dd-655e-41e0-a508-edfd660a9bcf'
    AND UPPER(uom_pcs.code) = 'PCS'
    AND uom_pcs.deleted_at IS NULL
)
INSERT INTO public.item_unit_options (
  company_id,
  item_id,
  uom_id,
  option_label,
  qty_per_unit,
  is_base,
  is_default,
  is_active,
  sort_order
)
SELECT
  constants.company_id,
  items.id,
  constants.pcs_uom_id,
  'PCS',
  1,
  TRUE,
  TRUE,
  TRUE,
  0
FROM public.backing_import imported
CROSS JOIN constants
JOIN public.items
  ON items.company_id = constants.company_id
 AND items.item_code = imported.item_code
 AND items.deleted_at IS NULL
ON CONFLICT (company_id, item_id, uom_id, qty_per_unit) WHERE deleted_at IS NULL DO UPDATE SET
  option_label = EXCLUDED.option_label,
  is_base = TRUE,
  is_default = TRUE,
  is_active = TRUE,
  sort_order = 0,
  deleted_at = NULL,
  updated_at = CURRENT_TIMESTAMP;

WITH constants AS (
  SELECT '1e10e2dd-655e-41e0-a508-edfd660a9bcf'::UUID AS company_id
),
price_rows AS (
  SELECT item_code, 'default'::TEXT AS price_tier, 'Default'::TEXT AS price_tier_name, sales_price AS price
  FROM public.backing_import
  WHERE sales_price IS NOT NULL
  UNION ALL
  SELECT item_code, 'ws'::TEXT AS price_tier, 'WS'::TEXT AS price_tier_name, ws_price AS price
  FROM public.backing_import
  WHERE ws_price IS NOT NULL
  UNION ALL
  SELECT item_code, 'srp'::TEXT AS price_tier, 'SRP'::TEXT AS price_tier_name, srp_price AS price
  FROM public.backing_import
  WHERE srp_price IS NOT NULL
)
INSERT INTO public.item_prices (
  company_id,
  item_id,
  price_tier,
  price_tier_name,
  price,
  currency_code,
  effective_from,
  is_active
)
SELECT
  constants.company_id,
  items.id,
  price_rows.price_tier,
  price_rows.price_tier_name,
  price_rows.price,
  'PHP',
  DATE '2026-06-24',
  TRUE
FROM price_rows
CROSS JOIN constants
JOIN public.items
  ON items.company_id = constants.company_id
 AND items.item_code = price_rows.item_code
 AND items.deleted_at IS NULL
ON CONFLICT (company_id, item_id, price_tier, effective_from) DO UPDATE SET
  price_tier_name = EXCLUDED.price_tier_name,
  price = EXCLUDED.price,
  currency_code = EXCLUDED.currency_code,
  is_active = TRUE,
  effective_to = NULL,
  deleted_at = NULL,
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO public.warehouse_locations (
  company_id,
  warehouse_id,
  code,
  name,
  location_type,
  is_active,
  is_pickable,
  is_storable
)
SELECT
  warehouses.company_id,
  warehouses.id,
  'MAIN',
  'Main',
  'rack',
  TRUE,
  TRUE,
  TRUE
FROM public.warehouses
WHERE warehouses.company_id = '1e10e2dd-655e-41e0-a508-edfd660a9bcf'
  AND warehouses.deleted_at IS NULL
ON CONFLICT (company_id, warehouse_id, code) DO UPDATE SET
  name = EXCLUDED.name,
  location_type = EXCLUDED.location_type,
  is_active = TRUE,
  is_pickable = TRUE,
  is_storable = TRUE,
  deleted_at = NULL,
  updated_at = CURRENT_TIMESTAMP;

WITH imported_items AS (
  SELECT
    items.company_id,
    items.id AS item_id,
    warehouses.id AS warehouse_id,
    warehouse_locations.id AS location_id,
    (10 + (get_byte(decode(md5(imported.item_code || ':' || warehouses.id::TEXT), 'hex'), 0) % 91))::NUMERIC AS opening_qty
  FROM public.backing_import imported
  JOIN public.items
    ON items.company_id = '1e10e2dd-655e-41e0-a508-edfd660a9bcf'
   AND items.item_code = imported.item_code
   AND items.deleted_at IS NULL
  JOIN public.warehouses
    ON warehouses.company_id = items.company_id
   AND warehouses.deleted_at IS NULL
  JOIN public.warehouse_locations
    ON warehouse_locations.company_id = warehouses.company_id
   AND warehouse_locations.warehouse_id = warehouses.id
   AND warehouse_locations.code = 'MAIN'
   AND warehouse_locations.deleted_at IS NULL
)
INSERT INTO public.item_warehouse (
  company_id,
  item_id,
  warehouse_id,
  default_location_id,
  reorder_level,
  reorder_quantity,
  current_stock,
  reserved_stock,
  is_active
)
SELECT
  company_id,
  item_id,
  warehouse_id,
  location_id,
  25,
  100,
  opening_qty,
  0,
  TRUE
FROM imported_items
ON CONFLICT (company_id, item_id, warehouse_id) DO UPDATE SET
  default_location_id = COALESCE(public.item_warehouse.default_location_id, EXCLUDED.default_location_id),
  reorder_level = EXCLUDED.reorder_level,
  reorder_quantity = EXCLUDED.reorder_quantity,
  current_stock = EXCLUDED.current_stock,
  reserved_stock = 0,
  is_active = TRUE,
  deleted_at = NULL,
  updated_at = CURRENT_TIMESTAMP;

WITH imported_items AS (
  SELECT
    items.company_id,
    items.id AS item_id,
    warehouses.id AS warehouse_id,
    (10 + (get_byte(decode(md5(imported.item_code || ':' || warehouses.id::TEXT), 'hex'), 0) % 91))::NUMERIC AS opening_qty
  FROM public.backing_import imported
  JOIN public.items
    ON items.company_id = '1e10e2dd-655e-41e0-a508-edfd660a9bcf'
   AND items.item_code = imported.item_code
   AND items.deleted_at IS NULL
  JOIN public.warehouses
    ON warehouses.company_id = items.company_id
   AND warehouses.deleted_at IS NULL
)
INSERT INTO public.item_batches (
  company_id,
  item_id,
  warehouse_id,
  batch_code,
  received_at,
  qty_on_hand,
  qty_reserved
)
SELECT
  company_id,
  item_id,
  warehouse_id,
  'OPENING-BAL',
  TIMESTAMPTZ '2026-06-24 00:00:00+08',
  opening_qty,
  0
FROM imported_items
ON CONFLICT (company_id, item_id, warehouse_id, batch_code) DO UPDATE SET
  received_at = EXCLUDED.received_at,
  qty_on_hand = EXCLUDED.qty_on_hand,
  qty_reserved = 0,
  deleted_at = NULL,
  updated_at = CURRENT_TIMESTAMP;

WITH imported_batches AS (
  SELECT
    item_batches.company_id,
    item_batches.item_id,
    item_batches.warehouse_id,
    warehouse_locations.id AS location_id,
    item_batches.id AS item_batch_id,
    (10 + (get_byte(decode(md5(imported.item_code || ':' || item_batches.warehouse_id::TEXT), 'hex'), 0) % 91))::NUMERIC AS opening_qty
  FROM public.backing_import imported
  JOIN public.items
    ON items.company_id = '1e10e2dd-655e-41e0-a508-edfd660a9bcf'
   AND items.item_code = imported.item_code
   AND items.deleted_at IS NULL
  JOIN public.item_batches
    ON item_batches.company_id = items.company_id
   AND item_batches.item_id = items.id
   AND item_batches.batch_code = 'OPENING-BAL'
   AND item_batches.deleted_at IS NULL
  JOIN public.warehouse_locations
    ON warehouse_locations.company_id = item_batches.company_id
   AND warehouse_locations.warehouse_id = item_batches.warehouse_id
   AND warehouse_locations.code = 'MAIN'
   AND warehouse_locations.deleted_at IS NULL
)
INSERT INTO public.item_batch_locations (
  company_id,
  item_id,
  warehouse_id,
  location_id,
  item_batch_id,
  qty_on_hand,
  qty_reserved
)
SELECT
  company_id,
  item_id,
  warehouse_id,
  location_id,
  item_batch_id,
  opening_qty,
  0
FROM imported_batches
ON CONFLICT (company_id, item_id, warehouse_id, location_id, item_batch_id) DO UPDATE SET
  qty_on_hand = EXCLUDED.qty_on_hand,
  qty_reserved = 0,
  deleted_at = NULL,
  updated_at = CURRENT_TIMESTAMP;

DROP TABLE IF EXISTS public.backing_import;

END;
$backing_import$;

DO $matboard_import$
DECLARE
  v_missing TEXT;
BEGIN
DROP TABLE IF EXISTS public.matboard_import;

CREATE TABLE public.matboard_import (
  item_code TEXT NOT NULL,
  dimension_text TEXT NOT NULL,
  width NUMERIC NOT NULL,
  height NUMERIC NOT NULL,
  item_name TEXT NOT NULL,
  description TEXT,
  qty_per_box NUMERIC,
  purchase_price NUMERIC,
  sales_price NUMERIC,
  fc_price NUMERIC,
  ws_price NUMERIC,
  above_50_sheets_price NUMERIC,
  srp_price NUMERIC,
  supplier_code TEXT
);

INSERT INTO public.matboard_import (
  item_code, dimension_text, width, height, item_name, description,
  qty_per_box, purchase_price, sales_price, fc_price, ws_price,
  above_50_sheets_price, srp_price, supplier_code
) VALUES
  ('ME30421005', '30 X 42', 30, 42, '30" X 42" EM 1005 EGG SHELL WHITE MATBOARD', '30" X 42" EM 1005 EGG SHELL WHITE MATBOARD', 50.0, NULL, 81.0, 68.0, 74.0, 79.0, 81.0, NULL),
  ('ME30421008', '30 X 42', 30, 42, '30" X 42" EM 1008 DARK IVORY MATBOARD', '30" X 42" EM 1008 DARK IVORY MATBOARD', 50.0, NULL, 81.0, 68.0, 74.0, 79.0, 81.0, NULL),
  ('ME30421009', '30 X 42', 30, 42, '30" X 42" EM 1009 LIGHT PEACH MATBOARD ', '30" X 42" EM 1009 LIGHT PEACH MATBOARD ', 50.0, NULL, 81.0, 68.0, 74.0, 79.0, 81.0, NULL),
  ('ME30421019', '30 X 42', 30, 42, '30" X 42" EM 1019 CREAM WHITE MATBOARD', '30" X 42" EM 1019 CREAM WHITE MATBOARD', 50.0, NULL, 81.0, 68.0, 74.0, 79.0, 81.0, NULL),
  ('ME30421020', '30 X 42', 30, 42, '30" X 42" EM 1020 CREAM YELLOW MATBOARD', '30" X 42" EM 1020 CREAM YELLOW MATBOARD', 50.0, NULL, 81.0, 68.0, 74.0, 79.0, 81.0, NULL),
  ('ME30421024', '30 X 42', 30, 42, '30" X 42" EM 1024 MARSHMALLOW WHITE MATBOARD', '30" X 42" EM 1024 MARSHMALLOW WHITE MATBOARD', 50.0, NULL, 81.0, 68.0, 74.0, 79.0, 81.0, NULL),
  ('ME30421065', '30 X 42', 30, 42, '30" X 42" EM 1065 COFFEE BROWN MATBOARD', '30" X 42" EM 1065 COFFEE BROWN MATBOARD', 50.0, NULL, 81.0, 68.0, 74.0, 79.0, 81.0, NULL),
  ('ME30421110', '30 X 42', 30, 42, '30" X 42" EM 1110 OAK BUFF MATBOARD', '30" X 42" EM 1110 OAK BUFF MATBOARD', 50.0, NULL, 81.0, 68.0, 74.0, 79.0, 81.0, NULL),
  ('ME30421112', '30 X 42', 30, 42, '30" X 42" EM 1112 TAUPE GRAY STRIPES MATBOARD', '30" X 42" EM 1112 TAUPE GRAY STRIPES MATBOARD', 50.0, NULL, 81.0, 68.0, 74.0, 79.0, 81.0, NULL),
  ('ME30421114', '30 X 42', 30, 42, '30" X 42" EM 1114 GOLDEN  NUGGET MATBOARD', '30" X 42" EM 1114 GOLDEN  NUGGET MATBOARD', 50.0, NULL, 81.0, 68.0, 74.0, 79.0, 81.0, NULL),
  ('ME30422003', '30 X 42', 30, 42, '30" X 42" EM 2003 MOSS GREEN MATBOARD', '30" X 42" EM 2003 MOSS GREEN MATBOARD', 50.0, NULL, 81.0, 68.0, 74.0, 79.0, 81.0, NULL),
  ('ME30422005', '30 X 42', 30, 42, '30" X 42" EM 2005 GREEN GOLD MATBOARD', '30" X 42" EM 2005 GREEN GOLD MATBOARD', 50.0, NULL, 81.0, 68.0, 74.0, 79.0, 81.0, NULL),
  ('ME30422006', '30 X 42', 30, 42, '30" X 42" EM 2006 FOGGY GREEN MATBOARD', '30" X 42" EM 2006 FOGGY GREEN MATBOARD', 50.0, NULL, 81.0, 68.0, 74.0, 79.0, 81.0, NULL),
  ('ME30422010', '30 X 42', 30, 42, '30" X 42" EM 2010 HERRING BONE OCHRE MATBOARD', '30" X 42" EM 2010 HERRING BONE OCHRE MATBOARD', 50.0, NULL, 81.0, 68.0, 74.0, 79.0, 81.0, NULL),
  ('ME30422011', '30 X 42', 30, 42, '30" X 42" EM 2011 APRICOT YELLOW MATBOARD', '30" X 42" EM 2011 APRICOT YELLOW MATBOARD', 50.0, NULL, 81.0, 68.0, 74.0, 79.0, 81.0, NULL),
  ('ME30422021', '30 X 42', 30, 42, '30" X 42" EM 2021 OVERCAST GREEN MATBOARD', '30" X 42" EM 2021 OVERCAST GREEN MATBOARD', 50.0, NULL, 81.0, 68.0, 74.0, 79.0, 81.0, NULL),
  ('ME30422035', '30 X 42', 30, 42, '30" X 42" EM 2035 BISCUIT BLOCK BROWN MATBOARD', '30" X 42" EM 2035 BISCUIT BLOCK BROWN MATBOARD', 50.0, NULL, 81.0, 68.0, 74.0, 79.0, 81.0, NULL),
  ('ME30422037', '30 X 42', 30, 42, '30" X 42" EM 2037 PINECONE BROWN MATBOARD', '30" X 42" EM 2037 PINECONE BROWN MATBOARD', 50.0, NULL, 81.0, 68.0, 74.0, 79.0, 81.0, NULL),
  ('ME30422060', '30 X 42', 30, 42, '30" X 42" EM 2060 FADED YELLOW GREEN MATBOARD', '30" X 42" EM 2060 FADED YELLOW GREEN MATBOARD', 50.0, NULL, 81.0, 68.0, 74.0, 79.0, 81.0, NULL),
  ('ME30422073', '30 X 42', 30, 42, '30" X 42" EM 2073 PRAIRE SAND MATBOARD', '30" X 42" EM 2073 PRAIRE SAND MATBOARD', 50.0, NULL, 81.0, 68.0, 74.0, 79.0, 81.0, NULL),
  ('ME30422082', '30 X 42', 30, 42, '30" X 42" EM 2082 BRIGHT WHITE MATBOARD', '30" X 42" EM 2082 BRIGHT WHITE MATBOARD', 50.0, NULL, 81.0, 68.0, 74.0, 79.0, 81.0, NULL),
  ('ME30422085', '30 X 42', 30, 42, '30" X 42" EM 2085 COCONUT WHITE MATBOARD', '30" X 42" EM 2085 COCONUT WHITE MATBOARD', 50.0, NULL, 81.0, 68.0, 74.0, 79.0, 81.0, NULL),
  ('ME30422086', '30 X 42', 30, 42, '30" X 42" EM 2086 WHITE SUGAR MATBOARD', '30" X 42" EM 2086 WHITE SUGAR MATBOARD', 50.0, NULL, 81.0, 68.0, 74.0, 79.0, 81.0, NULL),
  ('ME30422087', '30 X 42', 30, 42, '30" X 42" EM 2087 SEAL BROWN MATBOARD', '30" X 42" EM 2087 SEAL BROWN MATBOARD', 50.0, NULL, 81.0, 68.0, 74.0, 79.0, 81.0, NULL),
  ('ME30422088', '30 X 42', 30, 42, '30" X 42" EM 2088 LATTLE BROWN MATBOARD', '30" X 42" EM 2088 LATTLE BROWN MATBOARD', 50.0, NULL, 81.0, 68.0, 74.0, 79.0, 81.0, NULL),
  ('ME30422089', '30 X 42', 30, 42, '30" X 42" EM 2089 LEMON ICING MATBOARD', '30" X 42" EM 2089 LEMON ICING MATBOARD', 50.0, NULL, 81.0, 68.0, 74.0, 79.0, 81.0, NULL),
  ('ME30422091', '30 X 42', 30, 42, '30" X 42" EM 2091 COTTON CANDY PINK MATBOARD', '30" X 42" EM 2091 COTTON CANDY PINK MATBOARD', 50.0, NULL, 81.0, 68.0, 74.0, 79.0, 81.0, NULL),
  ('ME30422092', '30 X 42', 30, 42, '30" X 42" EM 2092 BLOMMING PINK MATBOARD', '30" X 42" EM 2092 BLOMMING PINK MATBOARD', 50.0, NULL, 81.0, 68.0, 74.0, 79.0, 81.0, NULL),
  ('ME30422097', '30 X 42', 30, 42, '30" X 42" EM 2097 BLACK BEAUTY MATBOARD', '30" X 42" EM 2097 BLACK BEAUTY MATBOARD', 50.0, NULL, 81.0, 68.0, 74.0, 79.0, 81.0, NULL),
  ('ME30422098', '30 X 42', 30, 42, '30" X 42" EM 2098 OFF WHITE MATBOARD', '30" X 42" EM 2098 OFF WHITE MATBOARD', 50.0, NULL, 81.0, 68.0, 74.0, 79.0, 81.0, NULL),
  ('ME30422099', '30 X 42', 30, 42, '30" X 42" EM 2099 CHARCOAL GRAY MATBOARD', '30" X 42" EM 2099 CHARCOAL GRAY MATBOARD', 50.0, NULL, 81.0, 68.0, 74.0, 79.0, 81.0, NULL),
  ('ME30422103', '30 X 42', 30, 42, '30" X 42" EM 2103 BRICK RED MATBOARD', '30" X 42" EM 2103 BRICK RED MATBOARD', 50.0, NULL, 81.0, 68.0, 74.0, 79.0, 81.0, NULL),
  ('ME30422106', '30 X 42', 30, 42, '30" X 42" EM 2106 ORANGE MATBOARD', '30" X 42" EM 2106 ORANGE MATBOARD', 50.0, NULL, 81.0, 68.0, 74.0, 79.0, 81.0, NULL),
  ('ME30422109', '30 X 42', 30, 42, '30" X 42" EM 2109 THUNDER GRAY MATBOARD', '30" X 42" EM 2109 THUNDER GRAY MATBOARD', 50.0, NULL, 81.0, 68.0, 74.0, 79.0, 81.0, NULL),
  ('ME30422110', '30 X 42', 30, 42, '30" X 42" EM 2110 FLORAL YELLOW MATBOARD ', '30" X 42" EM 2110 FLORAL YELLOW MATBOARD ', 50.0, NULL, 81.0, 68.0, 74.0, 79.0, 81.0, NULL),
  ('ME30422115', '30 X 42', 30, 42, '30" X 42" EM 2115 SEA FOAM BLUE MATBOARD', '30" X 42" EM 2115 SEA FOAM BLUE MATBOARD', 50.0, NULL, 81.0, 68.0, 74.0, 79.0, 81.0, NULL),
  ('ME30422117', '30 X 42', 30, 42, '30" X 42" EM 2117 DAISY WHITE MATBOARD', '30" X 42" EM 2117 DAISY WHITE MATBOARD', 50.0, NULL, 81.0, 68.0, 74.0, 79.0, 81.0, NULL),
  ('ME30422119', '30 X 42', 30, 42, '30" X 42" EM 2119 OLIVE GREEN MATBOARD', '30" X 42" EM 2119 OLIVE GREEN MATBOARD', 50.0, NULL, 81.0, 68.0, 74.0, 79.0, 81.0, NULL),
  ('ME30422120', '30 X 42', 30, 42, '30" X 42" EM 2120 LIGHT VIOLET MATBOARD', '30" X 42" EM 2120 LIGHT VIOLET MATBOARD', 50.0, NULL, 81.0, 68.0, 74.0, 79.0, 81.0, NULL),
  ('ME30422121', '30 X 42', 30, 42, '30" X 42" EM 2121 RUBY RED MATBOARD', '30" X 42" EM 2121 RUBY RED MATBOARD', 50.0, NULL, 81.0, 68.0, 74.0, 79.0, 81.0, NULL),
  ('ME30422131', '30 X 42', 30, 42, '30" X 42" EM 2131 GINGERBREAD BROWN MATBOARD', '30" X 42" EM 2131 GINGERBREAD BROWN MATBOARD', 50.0, NULL, 81.0, 68.0, 74.0, 79.0, 81.0, NULL),
  ('ME30422132', '30 X 42', 30, 42, '30" X 42" EM 2132 RAIN FOREST GREEN MATBOARD', '30" X 42" EM 2132 RAIN FOREST GREEN MATBOARD', 50.0, NULL, 81.0, 68.0, 74.0, 79.0, 81.0, NULL),
  ('ME30422136', '30 X 42', 30, 42, '30" X 42" EM 2136 LIGHT BLUE MATBOARD', '30" X 42" EM 2136 LIGHT BLUE MATBOARD', 50.0, NULL, 81.0, 68.0, 74.0, 79.0, 81.0, NULL),
  ('ME30422139', '30 X 42', 30, 42, '30" X 42" EM 2139 EARTHLY GREEN MATBOARD', '30" X 42" EM 2139 EARTHLY GREEN MATBOARD', 50.0, NULL, 81.0, 68.0, 74.0, 79.0, 81.0, NULL),
  ('ME30422140', '30 X 42', 30, 42, '30" X 42" EM 2140 LIGHT EARTH MATBOARD', '30" X 42" EM 2140 LIGHT EARTH MATBOARD', 50.0, NULL, 81.0, 68.0, 74.0, 79.0, 81.0, NULL),
  ('ME30422142', '30 X 42', 30, 42, '30" X 42" EM 2142 DARK BLUE MATBOARD', '30" X 42" EM 2142 DARK BLUE MATBOARD', 50.0, NULL, 81.0, 68.0, 74.0, 79.0, 81.0, NULL),
  ('ME30422148', '30 X 42', 30, 42, '30" X 42" EM 2148  ROYAL BLUE MATBOARD', '30" X 42" EM 2148  ROYAL BLUE MATBOARD', 50.0, NULL, 81.0, 68.0, 74.0, 79.0, 81.0, NULL),
  ('ME30422157', '30 X 42', 30, 42, '30" X 42" EM 2157 WHITE LINEN MATBOARD', '30" X 42" EM 2157 WHITE LINEN MATBOARD', 50.0, NULL, 81.0, 68.0, 74.0, 79.0, 81.0, NULL),
  ('ME30422158', '30 X 42', 30, 42, '30" X 42" EM 2158 MAHOGANY RED MATBOARD', '30" X 42" EM 2158 MAHOGANY RED MATBOARD', 50.0, NULL, 81.0, 68.0, 74.0, 79.0, 81.0, NULL),
  ('ME30422161', '30 X 42', 30, 42, '30" X 42" EM 2161 BURGANDY MATBOARD', '30" X 42" EM 2161 BURGANDY MATBOARD', 50.0, NULL, 81.0, 68.0, 74.0, 79.0, 81.0, NULL),
  ('ME30422009', '30 X 42', 30, 42, '30" X 42" EM 2009/5009 GOLDEN LINES MATBOARD', '30" X 42" EM 2009/5009 GOLDEN LINES MATBOARD', 50.0, NULL, 93.0, 77.5, 85.0, 91.0, 93.0, NULL),
  ('ME30425007', '30 X 42', 30, 42, '30" X 42" EM 5007 SILVER MATBOARD', '30" X 42" EM 5007 SILVER MATBOARD', 50.0, NULL, 93.0, 77.5, 85.0, 91.0, 93.0, NULL),
  ('ME30425027', '30 X 42', 30, 42, '30" X 42" EM 5027 METHALIC LIBIS WHITE MATBOARD', '30" X 42" EM 5027 METHALIC LIBIS WHITE MATBOARD', 50.0, NULL, 93.0, 77.5, 85.0, 91.0, 93.0, NULL),
  ('ME30425029', '30 X 42', 30, 42, '30" X 42" EM 5029 SAND STONE MATBOARD', '30" X 42" EM 5029 SAND STONE MATBOARD', 50.0, NULL, 93.0, 77.5, 85.0, 91.0, 93.0, NULL),
  ('ME30425030', '30 X 42', 30, 42, '30" X 42" EM 5030 METHALIC DARK BROWN MATBOARD', '30" X 42" EM 5030 METHALIC DARK BROWN MATBOARD', 50.0, NULL, 93.0, 77.5, 85.0, 91.0, 93.0, NULL),
  ('ME30425056', '30 X 42', 30, 42, '30" X 42" EM 5056 LUCKY RED MATBOARD', '30" X 42" EM 5056 LUCKY RED MATBOARD', 50.0, NULL, 93.0, 77.5, 85.0, 91.0, 93.0, NULL),
  ('ME30425066', '30 X 42', 30, 42, '30" X 42" EM 5066 FLORAL PINK MATBOARD', '30" X 42" EM 5066 FLORAL PINK MATBOARD', 50.0, NULL, 93.0, 77.5, 85.0, 91.0, 93.0, NULL),
  ('ME30425082', '30 X 42', 30, 42, '30" X 42" EM 5082/5055 FLOWER GOLD MATBOARD', '30" X 42" EM 5082/5055 FLOWER GOLD MATBOARD', 50.0, NULL, 93.0, 77.5, 85.0, 91.0, 93.0, NULL),
  ('MEM2073000', '30 X 36', 30, 36, '30" X 36 1/2" EM 2073 PRAIRE SAND MATBOARD', '30" X 36 1/2" EM 2073 PRAIRE SAND MATBOARD', 50.0, NULL, 0.0, 0.0, 0.0, 0.0, 0.0, NULL),
  ('MEM2086000', '30 X 36', 30, 36, '30" X 36 1/2" EM 2086 WHITE SUGAR MATBOARD', '30" X 36 1/2" EM 2086 WHITE SUGAR MATBOARD', 50.0, NULL, 0.0, 0.0, 0.0, 0.0, 0.0, NULL),
  ('MEM2097000', '30 X 36', 30, 36, '30" X 36 1/2" EM 2097 BLACK BEAUTY MATBOARD', '30" X 36 1/2" EM 2097 BLACK BEAUTY MATBOARD', 50.0, NULL, 0.0, 0.0, 0.0, 0.0, 0.0, NULL),
  ('MO39636004', '39 X 63', 39, 63, '39" X 63" EM 6004 LIGHT OLIVE- OVERSIZE MATBOARD', '39" X 63" EM 6004 LIGHT OLIVE- OVERSIZE MATBOARD', 40.0, NULL, 255.0, 215.0, 245.0, 253.0, 255.0, NULL),
  ('MO39636008', '39 X 63', 39, 63, '39" X 63" EM 6008 WHITE LINEN- OVERSIZE MATBOARD', '39" X 63" EM 6008 WHITE LINEN- OVERSIZE MATBOARD', 40.0, NULL, 255.0, 215.0, 245.0, 253.0, 255.0, NULL),
  ('MO39636009', '39 X 63', 39, 63, '39" X 63" EM 6009 BLACK- OVERSIZE MATBOARD', '39" X 63" EM 6009 BLACK- OVERSIZE MATBOARD', 40.0, NULL, 255.0, 215.0, 245.0, 253.0, 255.0, NULL),
  ('MO39636019', '39 X 63', 39, 63, '39" X 63" EM 6019 CREAM- OVERSIZE MATBOARD', '39" X 63" EM 6019 CREAM- OVERSIZE MATBOARD', 40.0, NULL, 255.0, 215.0, 245.0, 253.0, 255.0, NULL),
  ('MO39636022', '39 X 63', 39, 63, '39" X 63" EM 6022 GOLD- OVERSIZE MATBOARD', '39" X 63" EM 6022 GOLD- OVERSIZE MATBOARD', 40.0, NULL, 255.0, 215.0, 245.0, 253.0, 255.0, NULL),
  ('MO39636024', '39 X 63', 39, 63, '39" X 63" EM 6024 WHITE SUGAR- OVERSIZE MATBOARD', '39" X 63" EM 6024 WHITE SUGAR- OVERSIZE MATBOARD', 40.0, NULL, 255.0, 215.0, 245.0, 253.0, 255.0, NULL),
  ('MO39636030', '39 X 63', 39, 63, '39" X 63" EM 6030 CHINO GREEN- OVERSIZE MATBOARD', '39" X 63" EM 6030 CHINO GREEN- OVERSIZE MATBOARD', 40.0, NULL, 255.0, 215.0, 245.0, 253.0, 255.0, NULL),
  ('MO39636031', '39 X 63', 39, 63, '39" X 63" EM 6031 GREEN- OVERSIZE MATBOARD', '39" X 63" EM 6031 GREEN- OVERSIZE MATBOARD', 40.0, NULL, 255.0, 215.0, 245.0, 253.0, 255.0, NULL),
  ('MO39636032', '39 X 63', 39, 63, '39" X 63" EM 6032 GREEN NUGGETS- OVERSIZE MATBOARD', '39" X 63" EM 6032 GREEN NUGGETS- OVERSIZE MATBOARD', 40.0, NULL, 255.0, 215.0, 245.0, 253.0, 255.0, NULL),
  ('MO39631170', '39 X 63', 39, 63, '39" X 63" NS 117 RED- OVERSIZE MATBOARD', '39" X 63" NS 117 RED- OVERSIZE MATBOARD', NULL, NULL, 255.0, 215.0, 245.0, 253.0, 255.0, NULL),
  ('MO39631360', '39 X 63', 39, 63, '39" X 63" NS 136 GRAY- OVERSIZE MATBOARD', '39" X 63" NS 136 GRAY- OVERSIZE MATBOARD', NULL, NULL, 255.0, 215.0, 245.0, 253.0, 255.0, NULL),
  ('MS30422010', '30 X 42', 30, 42, '30" X 42" SG 201 BRIGHT WHITE MATBOARD', '30" X 42" SG 201 BRIGHT WHITE MATBOARD', 30.0, NULL, 119.0, 99.5, 109.0, 117.0, 119.0, NULL),
  ('MS30422020', '30 X 42', 30, 42, '30" X 42" SG 202 WHITE MATBOARD', '30" X 42" SG 202 WHITE MATBOARD', 30.0, NULL, 119.0, 99.5, 109.0, 117.0, 119.0, NULL),
  ('MS30422040', '30 X 42', 30, 42, '30" X 42" SG 204 SOFT WHITE MATBOARD', '30" X 42" SG 204 SOFT WHITE MATBOARD', 30.0, NULL, 119.0, 99.5, 109.0, 117.0, 119.0, NULL),
  ('MS30422070', '30 X 42', 30, 42, '30" X 42" SG 207 BEYOND PALE WHITE MATBOARD', '30" X 42" SG 207 BEYOND PALE WHITE MATBOARD', 30.0, NULL, 119.0, 99.5, 109.0, 117.0, 119.0, NULL),
  ('MS30422090', '30 X 42', 30, 42, '30" X 42" SG 209 IVORY MATBOARD', '30" X 42" SG 209 IVORY MATBOARD', 30.0, NULL, 119.0, 99.5, 109.0, 117.0, 119.0, NULL),
  ('MS30422100', '30 X 42', 30, 42, '30" X 42" SG 210 OFF WHITE MATBOARD', '30" X 42" SG 210 OFF WHITE MATBOARD', 30.0, NULL, 119.0, 99.5, 109.0, 117.0, 119.0, NULL),
  ('MS30422120', '30 X 42', 30, 42, '30" X 42" SG 212 IVORY TURRET MATBOARD', '30" X 42" SG 212 IVORY TURRET MATBOARD', 30.0, NULL, 119.0, 99.5, 109.0, 117.0, 119.0, NULL),
  ('MS30422140', '30 X 42', 30, 42, '30" X 42" SG 214 CRISP LINEN MATBOARD', '30" X 42" SG 214 CRISP LINEN MATBOARD', 30.0, NULL, 119.0, 99.5, 109.0, 117.0, 119.0, NULL),
  ('MS30422150', '30 X 42', 30, 42, '30" X 42" SG 215 DARK IVORY MATBOARD', '30" X 42" SG 215 DARK IVORY MATBOARD', 30.0, NULL, 119.0, 99.5, 109.0, 117.0, 119.0, NULL),
  ('MS30422170', '30 X 42', 30, 42, '30" X 42" SG 217 NAVAJO WHITE MATBOARD', '30" X 42" SG 217 NAVAJO WHITE MATBOARD', 30.0, NULL, 119.0, 99.5, 109.0, 117.0, 119.0, NULL),
  ('MS30422240', '30 X 42', 30, 42, '30" X 42" SG 224 JAVA MATBOARD', '30" X 42" SG 224 JAVA MATBOARD', 30.0, NULL, 119.0, 99.5, 109.0, 117.0, 119.0, NULL),
  ('MS30422250', '30 X 42', 30, 42, '30" X 42" SG 225 WELL-BRED BROWN MATBOARD', '30" X 42" SG 225 WELL-BRED BROWN MATBOARD', 30.0, NULL, 119.0, 99.5, 109.0, 117.0, 119.0, NULL),
  ('MS30422290', '30 X 42', 30, 42, '30" X 42" SG 229 DYNAMIC BLUE MATBOARD', '30" X 42" SG 229 DYNAMIC BLUE MATBOARD', 30.0, NULL, 119.0, 99.5, 109.0, 117.0, 119.0, NULL),
  ('MS30422300', '30 X 42', 30, 42, '30" X 42" SG 230 LAPIS BLUE MATBOARD', '30" X 42" SG 230 LAPIS BLUE MATBOARD', 30.0, NULL, 119.0, 99.5, 109.0, 117.0, 119.0, NULL),
  ('MS30422370', '30 X 42', 30, 42, '30" X 42" SG 237 RED MATBOARD', '30" X 42" SG 237 RED MATBOARD', 30.0, NULL, 119.0, 99.5, 109.0, 117.0, 119.0, NULL),
  ('MS30422380', '30 X 42', 30, 42, '30" X 42" SG 238 SOLID RED MATBOARD', '30" X 42" SG 238 SOLID RED MATBOARD', 30.0, NULL, 119.0, 99.5, 109.0, 117.0, 119.0, NULL),
  ('MS30422410', '30 X 42', 30, 42, '30" X 42" SG 241 PROPER GRAY MATBOARD', '30" X 42" SG 241 PROPER GRAY MATBOARD', 30.0, NULL, 119.0, 99.5, 109.0, 117.0, 119.0, NULL),
  ('MS30422450', '30 X 42', 30, 42, '30" X 42" SG 245 TRICOM BLACK MATBOARD', '30" X 42" SG 245 TRICOM BLACK MATBOARD', 30.0, NULL, 119.0, 99.5, 109.0, 117.0, 119.0, NULL),
  ('MS30423020', '30 X 42', 30, 42, '30" X 42" SG 302 BEIGE MATBOARD', '30" X 42" SG 302 BEIGE MATBOARD', 30.0, NULL, 119.0, 99.5, 109.0, 117.0, 119.0, NULL),
  ('MS30423040', '30 X 42', 30, 42, '30" X 42" SG 304 DEEP YELLOW MATBOARD', '30" X 42" SG 304 DEEP YELLOW MATBOARD', 30.0, NULL, 119.0, 99.5, 109.0, 117.0, 119.0, NULL),
  ('MS30423140', '30 X 42', 30, 42, '30" X 42" SG 314 DEEP BLUE MATBOARD', '30" X 42" SG 314 DEEP BLUE MATBOARD', 30.0, NULL, 119.0, 99.5, 109.0, 117.0, 119.0, NULL),
  ('MS30424210', '30 X 42', 30, 42, '30" X 42" SG 421 BURNISHED GOLD MATBOARD', '30" X 42" SG 421 BURNISHED GOLD MATBOARD', 30.0, NULL, 132.0, 110.0, 120.5, 130.0, 132.0, NULL),
  ('MS30424220', '30 X 42', 30, 42, '30" X 42" SG 422 BRIGHT GOLD MATBOARD', '30" X 42" SG 422 BRIGHT GOLD MATBOARD', 30.0, NULL, 132.0, 110.0, 120.5, 130.0, 132.0, NULL),
  ('MT30421024', '30 X 42', 30, 42, '30" X 42" 3MM EM 1024 MARSHMALLOW WHITE MATBOARD', '30" X 42" 3MM EM 1024 MARSHMALLOW WHITE MATBOARD', 20.0, NULL, 438.5, 365.0, 400.0, 436.5, 438.5, NULL),
  ('MT32482450', '32 X 48', 32, 48, '32" X 48" 3MM SG 245 TRICOM BLACK MATBOARD', '32" X 48" 3MM SG 245 TRICOM BLACK MATBOARD', 15.0, NULL, 438.5, 365.0, 400.0, 436.5, 438.5, NULL),
  ('MC13162035', '13 X 16', 13, 16, '13 X 16 EM 2035 BISCUIT BLOCK BROWN MATBOARD CUT SIZE', '13 X 16 EM 2035 BISCUIT BLOCK BROWN MATBOARD CUT SIZE', NULL, NULL, 18.0, 14.5, 16.5, NULL, 18.0, NULL),
  ('MC13162073', '13 X 16', 13, 16, '13 X 16 EM 2073 PRAIRE SAND MATBOARD CUT SIZE', '13 X 16 EM 2073 PRAIRE SAND MATBOARD CUT SIZE', NULL, NULL, 18.0, 14.5, 16.5, NULL, 18.0, NULL),
  ('MC13162082', '13 X 16', 13, 16, '13 X 16 EM 2082 BRIGHT WHITE MATBOARD CUT SIZE ', '13 X 16 EM 2082 BRIGHT WHITE MATBOARD CUT SIZE ', NULL, NULL, 18.0, 14.5, 16.5, NULL, 18.0, NULL),
  ('MC13162085', '13 X 16', 13, 16, '13 X 16 EM 2085 COCONUT WHITE MATBOARD CUT SIZE', '13 X 16 EM 2085 COCONUT WHITE MATBOARD CUT SIZE', NULL, NULL, 18.0, 14.5, 16.5, NULL, 18.0, NULL),
  ('MC13162086', '13 X 16', 13, 16, '13 X 16 EM 2086 WHITE SUGAR MATBOARD CUT SIZE', '13 X 16 EM 2086 WHITE SUGAR MATBOARD CUT SIZE', NULL, NULL, 18.0, 14.5, 16.5, NULL, 18.0, NULL),
  ('MC13162097', '13 X 16', 13, 16, '13 X 16 EM 2097 BLACK BEAUTY MATBOARD CUT SIZE', '13 X 16 EM 2097 BLACK BEAUTY MATBOARD CUT SIZE', NULL, NULL, 18.0, 14.5, 16.5, NULL, 18.0, NULL),
  ('MC13162117', '13 X 16', 13, 16, '13 X 16 EM 2117 DAISY WHITE MATBOARD CUT SIZE', '13 X 16 EM 2117 DAISY WHITE MATBOARD CUT SIZE', NULL, NULL, 18.0, 14.5, 16.5, NULL, 18.0, NULL),
  ('MC10142035', '10 X 14', 10, 14, '10 X 14 EM 2035 BISCUIT BLOCK BROWN MATBOARD CUT SIZE', '10 X 14 EM 2035 BISCUIT BLOCK BROWN MATBOARD CUT SIZE', NULL, NULL, 11.0, 9.0, 10.0, NULL, 11.0, NULL),
  ('MC10142073', '10 X 14', 10, 14, '10 X 14 EM 2073 PRAIRE SAND MATBOARD CUT SIZE', '10 X 14 EM 2073 PRAIRE SAND MATBOARD CUT SIZE', NULL, NULL, 11.0, 9.0, 10.0, NULL, 11.0, NULL),
  ('MC10142082', '10 X 14', 10, 14, '10 X 14 EM 2082 BRIGHT WHITE MATBOARD CUT SIZE', '10 X 14 EM 2082 BRIGHT WHITE MATBOARD CUT SIZE', NULL, NULL, 11.0, 9.0, 10.0, NULL, 11.0, NULL),
  ('MC10142085', '10 X 14', 10, 14, '10 X 14 EM 2085 COCONUT WHITE MATBOARD CUT SIZE', '10 X 14 EM 2085 COCONUT WHITE MATBOARD CUT SIZE', NULL, NULL, 11.0, 9.0, 10.0, NULL, 11.0, NULL),
  ('MC10142086', '10 X 14', 10, 14, '10 X 14 EM 2086 WHITE SUGAR MATBOARD CUT SIZE', '10 X 14 EM 2086 WHITE SUGAR MATBOARD CUT SIZE', NULL, NULL, 11.0, 9.0, 10.0, NULL, 11.0, NULL),
  ('MC10142097', '10 X 14', 10, 14, '10 X 14 EM 2097 BLACK BEAUTY MATBOARD CUT SIZE', '10 X 14 EM 2097 BLACK BEAUTY MATBOARD CUT SIZE', NULL, NULL, 11.0, 9.0, 10.0, NULL, 11.0, NULL),
  ('MC10142117', '10 X 14', 10, 14, '10 X 14 EM 2117 DAISY WHITE MATBOARD CUT SIZE', '10 X 14 EM 2117 DAISY WHITE MATBOARD CUT SIZE', NULL, NULL, 11.0, 9.0, 10.0, NULL, 11.0, NULL),
  ('MC10122035', '10 X 12', 10, 12, '10 X 12 EM 2035 BISCUIT BLOCK BROWN MATBOARD CUT SIZE', '10 X 12 EM 2035 BISCUIT BLOCK BROWN MATBOARD CUT SIZE', NULL, NULL, 10.0, 8.0, 9.0, NULL, 10.0, NULL),
  ('MC10122073', '10 X 12', 10, 12, '10 X 12 EM 2073 PRAIRE SAND MATBOARD CUT SIZE', '10 X 12 EM 2073 PRAIRE SAND MATBOARD CUT SIZE', NULL, NULL, 10.0, 8.0, 9.0, NULL, 10.0, NULL),
  ('MC10122082', '10 X 12', 10, 12, '10 X 12 EM 2082 BRIGHT WHITE MATBOARD CUT SIZE', '10 X 12 EM 2082 BRIGHT WHITE MATBOARD CUT SIZE', NULL, NULL, 10.0, 8.0, 9.0, NULL, 10.0, NULL),
  ('MC10122085', '10 X 12', 10, 12, '10 X 12 EM 2085 COCONUT WHITE MATBOARD CUT SIZE', '10 X 12 EM 2085 COCONUT WHITE MATBOARD CUT SIZE', NULL, NULL, 10.0, 8.0, 9.0, NULL, 10.0, NULL),
  ('MC10122086', '10 X 12', 10, 12, '10 X 12 EM 2086 WHITE SUGAR MATBOARD CUT SIZE', '10 X 12 EM 2086 WHITE SUGAR MATBOARD CUT SIZE', NULL, NULL, 10.0, 8.0, 9.0, NULL, 10.0, NULL),
  ('MC10122097', '10 X 12', 10, 12, '10 X 12 EM 2097 BLACK BEAUTY MATBOARD CUT SIZE', '10 X 12 EM 2097 BLACK BEAUTY MATBOARD CUT SIZE', NULL, NULL, 10.0, 8.0, 9.0, NULL, 10.0, NULL),
  ('MC10122117', '10 X 12', 10, 12, '10 X 12 EM 2117 DAISY WHITE MATBOARD CUT SIZE', '10 X 12 EM 2117 DAISY WHITE MATBOARD CUT SIZE', NULL, NULL, 10.0, 8.0, 9.0, NULL, 10.0, NULL),
  ('MC10132035', '10 X 13', 10, 13, '10 X 13 EM 2035 BISCUIT BLOCK BROWN MATBOARD CUT SIZE', '10 X 13 EM 2035 BISCUIT BLOCK BROWN MATBOARD CUT SIZE', NULL, NULL, 10.5, 8.5, 9.5, NULL, 10.5, NULL),
  ('MC10132073', '10 X 13', 10, 13, '10 X 13 EM 2073 PRAIRE SAND MATBOARD CUT SIZE', '10 X 13 EM 2073 PRAIRE SAND MATBOARD CUT SIZE', NULL, NULL, 10.5, 8.5, 9.5, NULL, 10.5, NULL),
  ('MC10132082', '10 X 13', 10, 13, '10 X 13 EM 2082 BRIGHT WHITE MATBOARD CUT SIZE ', '10 X 13 EM 2082 BRIGHT WHITE MATBOARD CUT SIZE ', NULL, NULL, 10.5, 8.5, 9.5, NULL, 10.5, NULL),
  ('MC10132085', '10 X 13', 10, 13, '10 X 13 EM 2085 COCONUT WHITE MATBOARD CUT SIZE', '10 X 13 EM 2085 COCONUT WHITE MATBOARD CUT SIZE', NULL, NULL, 10.5, 8.5, 9.5, NULL, 10.5, NULL),
  ('MC10132086', '10 X 13', 10, 13, '10 X 13 EM 2086 WHITE SUGAR MATBOARD CUT SIZE', '10 X 13 EM 2086 WHITE SUGAR MATBOARD CUT SIZE', NULL, NULL, 10.5, 8.5, 9.5, NULL, 10.5, NULL),
  ('MC10132097', '10 X 13', 10, 13, '10 X 13 EM 2097 BLACK BEAUTY MATBOARD CUT SIZE', '10 X 13 EM 2097 BLACK BEAUTY MATBOARD CUT SIZE', NULL, NULL, 10.5, 8.5, 9.5, NULL, 10.5, NULL),
  ('MC10132117', '10 X 13', 10, 13, '10 X 13 EM 2117 DAISY WHITE MATBOARD CUT SIZE', '10 X 13 EM 2117 DAISY WHITE MATBOARD CUT SIZE', NULL, NULL, 10.5, 8.5, 9.5, NULL, 10.5, NULL),
  ('MD10121019', '10 X 12', 10, 12, '10 X 12 EM 1019 MARSHMALLOW WHITE MATBOARD DIE CUT', '10 X 12 EM 1019 MARSHMALLOW WHITE MATBOARD DIE CUT', NULL, NULL, 12.5, 10.5, 11.5, NULL, 12.5, NULL),
  ('MD10122035', '10 X 12', 10, 12, '10 X 12 EM 2035 BISCUIT BLOCK BROWN MATBOARD DIE CUT', '10 X 12 EM 2035 BISCUIT BLOCK BROWN MATBOARD DIE CUT', NULL, NULL, 12.5, 10.5, 11.5, NULL, 12.5, NULL),
  ('MD10122073', '10 X 12', 10, 12, '10 X 12 EM 2073 PRAIRE SAND MATBOARD DIE SIZE', '10 X 12 EM 2073 PRAIRE SAND MATBOARD DIE SIZE', NULL, NULL, 12.5, 10.5, 11.5, NULL, 12.5, NULL),
  ('MD10122082', '10 X 12', 10, 12, '10 X 12 EM 2082 BRIGHT WHITE MATBOARD DIE CUT', '10 X 12 EM 2082 BRIGHT WHITE MATBOARD DIE CUT', NULL, NULL, 12.5, 10.5, 11.5, NULL, 12.5, NULL),
  ('MD10122085', '10 X 12', 10, 12, '10 X 12 EM 2085 COCONUT WHITE MATBOARD DIE CUT ', '10 X 12 EM 2085 COCONUT WHITE MATBOARD DIE CUT ', NULL, NULL, 12.5, 10.5, 11.5, NULL, 12.5, NULL),
  ('MD10122086', '10 X 12', 10, 12, '10 X 12 EM 2086 WHITE SUGAR MATBOARD DIE CUT', '10 X 12 EM 2086 WHITE SUGAR MATBOARD DIE CUT', NULL, NULL, 12.5, 10.5, 11.5, NULL, 12.5, NULL),
  ('MD10122097', '10 X 12', 10, 12, '10 X 12 EM 2097 BLACK BEAUTY MATBOARD DIE CUT', '10 X 12 EM 2097 BLACK BEAUTY MATBOARD DIE CUT', NULL, NULL, 12.5, 10.5, 11.5, NULL, 12.5, NULL),
  ('MV10121024', '10 X 12', 10, 12, '10 X 12 EM 1024 MARSHMALLOW WHITE MATBOARD BEVELLED CUT (JIS)', '10 X 12 EM 1024 MARSHMALLOW WHITE MATBOARD BEVELLED CUT (JIS)', NULL, NULL, 12.5, 10.5, 11.5, NULL, 12.5, NULL);

SELECT string_agg(required_name, ', ' ORDER BY required_name)
INTO v_missing
FROM (
  SELECT 'company 1e10e2dd-655e-41e0-a508-edfd660a9bcf' AS required_name
  WHERE NOT EXISTS (
    SELECT 1 FROM public.companies
    WHERE id = '1e10e2dd-655e-41e0-a508-edfd660a9bcf' AND deleted_at IS NULL
  )
  UNION ALL
  SELECT 'UOM SHEET'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.units_of_measure
    WHERE company_id = '1e10e2dd-655e-41e0-a508-edfd660a9bcf'
      AND UPPER(code) = 'SHEET' AND deleted_at IS NULL
  )
  UNION ALL
  SELECT 'UOM BOX'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.units_of_measure
    WHERE company_id = '1e10e2dd-655e-41e0-a508-edfd660a9bcf'
      AND UPPER(code) = 'BOX' AND deleted_at IS NULL
  )
  UNION ALL
  SELECT 'item category MAT'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.item_categories
    WHERE company_id = '1e10e2dd-655e-41e0-a508-edfd660a9bcf'
      AND code = 'MAT' AND deleted_at IS NULL
  )
) missing_records;

IF v_missing IS NOT NULL THEN
  RAISE EXCEPTION 'Matboard import prerequisite records are missing: %', v_missing;
END IF;

PERFORM setval(
  'public.item_unit_option_barcode_seq',
  GREATEST(
    (SELECT COALESCE(last_value, 1) FROM public.item_unit_option_barcode_seq),
    (SELECT COUNT(*) + 10000 FROM public.item_unit_options)
  ),
  TRUE
);

WITH constants AS (
  SELECT
    '1e10e2dd-655e-41e0-a508-edfd660a9bcf'::UUID AS company_id,
    uom_sheet.id AS sheet_uom_id,
    category.id AS category_id
  FROM public.units_of_measure uom_sheet
  JOIN public.item_categories category
    ON category.company_id = uom_sheet.company_id
   AND category.code = 'MAT' AND category.deleted_at IS NULL
  WHERE uom_sheet.company_id = '1e10e2dd-655e-41e0-a508-edfd660a9bcf'
    AND UPPER(uom_sheet.code) = 'SHEET' AND uom_sheet.deleted_at IS NULL
)
INSERT INTO public.items (
  company_id, item_code, item_name, description, category_id, uom_id,
  item_type, purchase_price, sales_price, supplier_code, is_stock_item,
  track_serial, track_batch, dimensions, is_active, custom_fields
)
SELECT
  constants.company_id, imported.item_code, imported.item_name, imported.description,
  constants.category_id, constants.sheet_uom_id, 'raw_material',
  imported.purchase_price, imported.sales_price,
  COALESCE(imported.supplier_code, imported.item_code),
  TRUE, FALSE, TRUE,
  jsonb_build_object('width', imported.width, 'height', imported.height, 'unit', 'IN'),
  TRUE,
  NULL
FROM public.matboard_import imported
CROSS JOIN constants
ON CONFLICT (company_id, item_code) DO UPDATE SET
  item_name = EXCLUDED.item_name, description = EXCLUDED.description,
  category_id = EXCLUDED.category_id, uom_id = EXCLUDED.uom_id,
  item_type = EXCLUDED.item_type, purchase_price = EXCLUDED.purchase_price,
  sales_price = EXCLUDED.sales_price, supplier_code = EXCLUDED.supplier_code,
  is_stock_item = EXCLUDED.is_stock_item, track_serial = EXCLUDED.track_serial,
  track_batch = EXCLUDED.track_batch, dimensions = EXCLUDED.dimensions,
  is_active = EXCLUDED.is_active, custom_fields = EXCLUDED.custom_fields,
  deleted_at = NULL, updated_at = CURRENT_TIMESTAMP;

WITH constants AS (
  SELECT '1e10e2dd-655e-41e0-a508-edfd660a9bcf'::UUID AS company_id,
         uom_sheet.id AS sheet_uom_id
  FROM public.units_of_measure uom_sheet
  WHERE uom_sheet.company_id = '1e10e2dd-655e-41e0-a508-edfd660a9bcf'
    AND UPPER(uom_sheet.code) = 'SHEET' AND uom_sheet.deleted_at IS NULL
)
INSERT INTO public.item_unit_options (
  company_id, item_id, uom_id, option_label, qty_per_unit,
  is_base, is_default, is_active, sort_order
)
SELECT constants.company_id, items.id, constants.sheet_uom_id, 'SHEET',
       1, TRUE, TRUE, TRUE, 0
FROM public.matboard_import imported
CROSS JOIN constants
JOIN public.items
  ON items.company_id = constants.company_id
 AND items.item_code = imported.item_code AND items.deleted_at IS NULL
ON CONFLICT (company_id, item_id, uom_id, qty_per_unit) WHERE deleted_at IS NULL DO UPDATE SET
  option_label = EXCLUDED.option_label, is_base = TRUE, is_default = TRUE,
  is_active = TRUE, sort_order = 0, deleted_at = NULL,
  updated_at = CURRENT_TIMESTAMP;

WITH constants AS (
  SELECT '1e10e2dd-655e-41e0-a508-edfd660a9bcf'::UUID AS company_id,
         uom_box.id AS box_uom_id
  FROM public.units_of_measure uom_box
  WHERE uom_box.company_id = '1e10e2dd-655e-41e0-a508-edfd660a9bcf'
    AND UPPER(uom_box.code) = 'BOX' AND uom_box.deleted_at IS NULL
)
INSERT INTO public.item_unit_options (
  company_id, item_id, uom_id, option_label, qty_per_unit,
  is_base, is_default, is_active, sort_order
)
SELECT constants.company_id, items.id, constants.box_uom_id,
       FORMAT('BOX (%s)', TRUNC(imported.qty_per_box)::TEXT),
       imported.qty_per_box, FALSE, FALSE, TRUE, 10
FROM public.matboard_import imported
CROSS JOIN constants
JOIN public.items
  ON items.company_id = constants.company_id
 AND items.item_code = imported.item_code AND items.deleted_at IS NULL
WHERE imported.qty_per_box IS NOT NULL
ON CONFLICT (company_id, item_id, uom_id, qty_per_unit) WHERE deleted_at IS NULL DO UPDATE SET
  option_label = EXCLUDED.option_label, is_base = FALSE, is_default = FALSE,
  is_active = TRUE, sort_order = 10, deleted_at = NULL,
  updated_at = CURRENT_TIMESTAMP;

WITH constants AS (
  SELECT '1e10e2dd-655e-41e0-a508-edfd660a9bcf'::UUID AS company_id
),
price_rows AS (
  SELECT item_code, 'default'::TEXT AS price_tier, 'Default'::TEXT AS price_tier_name, sales_price AS price
  FROM public.matboard_import WHERE sales_price IS NOT NULL
  UNION ALL
  SELECT item_code, 'fc'::TEXT, 'FC'::TEXT, fc_price
  FROM public.matboard_import WHERE fc_price IS NOT NULL
  UNION ALL
  SELECT item_code, 'ws'::TEXT, 'WS'::TEXT, ws_price
  FROM public.matboard_import WHERE ws_price IS NOT NULL
  UNION ALL
  SELECT item_code, 'above_50_sheets'::TEXT, '50 Sheets Above'::TEXT, above_50_sheets_price
  FROM public.matboard_import WHERE above_50_sheets_price IS NOT NULL
  UNION ALL
  SELECT item_code, 'srp'::TEXT, 'SRP'::TEXT, srp_price
  FROM public.matboard_import WHERE srp_price IS NOT NULL
)
INSERT INTO public.item_prices (
  company_id, item_id, price_tier, price_tier_name, price,
  currency_code, effective_from, is_active
)
SELECT constants.company_id, items.id, price_rows.price_tier,
       price_rows.price_tier_name, price_rows.price, 'PHP',
       DATE '2026-09-24', TRUE
FROM price_rows
CROSS JOIN constants
JOIN public.items
  ON items.company_id = constants.company_id
 AND items.item_code = price_rows.item_code AND items.deleted_at IS NULL
ON CONFLICT (company_id, item_id, price_tier, effective_from) DO UPDATE SET
  price_tier_name = EXCLUDED.price_tier_name, price = EXCLUDED.price,
  currency_code = EXCLUDED.currency_code, is_active = TRUE,
  effective_to = NULL, deleted_at = NULL, updated_at = CURRENT_TIMESTAMP;

INSERT INTO public.warehouse_locations (
  company_id, warehouse_id, code, name, location_type,
  is_active, is_pickable, is_storable
)
SELECT warehouses.company_id, warehouses.id, 'MAIN', 'Main', 'rack',
       TRUE, TRUE, TRUE
FROM public.warehouses
WHERE warehouses.company_id = '1e10e2dd-655e-41e0-a508-edfd660a9bcf'
  AND warehouses.deleted_at IS NULL
ON CONFLICT (company_id, warehouse_id, code) DO UPDATE SET
  name = EXCLUDED.name, location_type = EXCLUDED.location_type,
  is_active = TRUE, is_pickable = TRUE, is_storable = TRUE,
  deleted_at = NULL, updated_at = CURRENT_TIMESTAMP;

WITH imported_items AS (
  SELECT items.company_id, items.id AS item_id, warehouses.id AS warehouse_id,
         warehouse_locations.id AS location_id,
         (10 + (get_byte(decode(md5(imported.item_code || ':' || warehouses.id::TEXT), 'hex'), 0) % 91))::NUMERIC AS opening_qty
  FROM public.matboard_import imported
  JOIN public.items
    ON items.company_id = '1e10e2dd-655e-41e0-a508-edfd660a9bcf'
   AND items.item_code = imported.item_code AND items.deleted_at IS NULL
  JOIN public.warehouses
    ON warehouses.company_id = items.company_id AND warehouses.deleted_at IS NULL
  JOIN public.warehouse_locations
    ON warehouse_locations.company_id = warehouses.company_id
   AND warehouse_locations.warehouse_id = warehouses.id
   AND warehouse_locations.code = 'MAIN' AND warehouse_locations.deleted_at IS NULL
)
INSERT INTO public.item_warehouse (
  company_id, item_id, warehouse_id, default_location_id,
  reorder_level, reorder_quantity, current_stock, reserved_stock, is_active
)
SELECT company_id, item_id, warehouse_id, location_id, 25, 100,
       opening_qty, 0, TRUE
FROM imported_items
ON CONFLICT (company_id, item_id, warehouse_id) DO UPDATE SET
  default_location_id = COALESCE(public.item_warehouse.default_location_id, EXCLUDED.default_location_id),
  reorder_level = EXCLUDED.reorder_level, reorder_quantity = EXCLUDED.reorder_quantity,
  current_stock = EXCLUDED.current_stock, reserved_stock = 0,
  is_active = TRUE, deleted_at = NULL, updated_at = CURRENT_TIMESTAMP;

WITH imported_items AS (
  SELECT items.company_id, items.id AS item_id, warehouses.id AS warehouse_id,
         (10 + (get_byte(decode(md5(imported.item_code || ':' || warehouses.id::TEXT), 'hex'), 0) % 91))::NUMERIC AS opening_qty
  FROM public.matboard_import imported
  JOIN public.items
    ON items.company_id = '1e10e2dd-655e-41e0-a508-edfd660a9bcf'
   AND items.item_code = imported.item_code AND items.deleted_at IS NULL
  JOIN public.warehouses
    ON warehouses.company_id = items.company_id AND warehouses.deleted_at IS NULL
)
INSERT INTO public.item_batches (
  company_id, item_id, warehouse_id, batch_code,
  received_at, qty_on_hand, qty_reserved
)
SELECT company_id, item_id, warehouse_id, 'OPENING-BAL',
       TIMESTAMPTZ '2026-09-24 00:00:00+08', opening_qty, 0
FROM imported_items
ON CONFLICT (company_id, item_id, warehouse_id, batch_code) DO UPDATE SET
  received_at = EXCLUDED.received_at, qty_on_hand = EXCLUDED.qty_on_hand,
  qty_reserved = 0, deleted_at = NULL, updated_at = CURRENT_TIMESTAMP;

WITH imported_batches AS (
  SELECT item_batches.company_id, item_batches.item_id, item_batches.warehouse_id,
         warehouse_locations.id AS location_id, item_batches.id AS item_batch_id,
         (10 + (get_byte(decode(md5(imported.item_code || ':' || item_batches.warehouse_id::TEXT), 'hex'), 0) % 91))::NUMERIC AS opening_qty
  FROM public.matboard_import imported
  JOIN public.items
    ON items.company_id = '1e10e2dd-655e-41e0-a508-edfd660a9bcf'
   AND items.item_code = imported.item_code AND items.deleted_at IS NULL
  JOIN public.item_batches
    ON item_batches.company_id = items.company_id
   AND item_batches.item_id = items.id AND item_batches.batch_code = 'OPENING-BAL'
   AND item_batches.deleted_at IS NULL
  JOIN public.warehouse_locations
    ON warehouse_locations.company_id = item_batches.company_id
   AND warehouse_locations.warehouse_id = item_batches.warehouse_id
   AND warehouse_locations.code = 'MAIN' AND warehouse_locations.deleted_at IS NULL
)
INSERT INTO public.item_batch_locations (
  company_id, item_id, warehouse_id, location_id, item_batch_id,
  qty_on_hand, qty_reserved
)
SELECT company_id, item_id, warehouse_id, location_id, item_batch_id,
       opening_qty, 0
FROM imported_batches
ON CONFLICT (company_id, item_id, warehouse_id, location_id, item_batch_id) DO UPDATE SET
  qty_on_hand = EXCLUDED.qty_on_hand, qty_reserved = 0,
  deleted_at = NULL, updated_at = CURRENT_TIMESTAMP;

DROP TABLE IF EXISTS public.matboard_import;

END;
$matboard_import$;


DO $polystyrene_moulding_import$
DECLARE
  v_missing TEXT;
BEGIN
DROP TABLE IF EXISTS public.polystyrene_moulding_import;

CREATE TABLE public.polystyrene_moulding_import (
  item_code TEXT NOT NULL,
  supplier_code TEXT,
  specification TEXT,
  qty_per_box NUMERIC,
  purchase_price NUMERIC,
  sales_price NUMERIC,
  item_name TEXT NOT NULL,
  description TEXT,
  fc_price NUMERIC,
  ws_price NUMERIC,
  srp_price NUMERIC,
  chop_join_price NUMERIC,
  framing_price NUMERIC
);

INSERT INTO public.polystyrene_moulding_import (
  item_code, supplier_code, specification, qty_per_box, purchase_price, sales_price,
  item_name, description, fc_price, ws_price, srp_price, chop_join_price, framing_price
) VALUES
  ('PM057BK000', '1001-B', '2.7', 144.0, 1.083, 118.0, '057-197 BLK POLYSTYRENE PICTURE FRAME MOULDINGS', '057-197 BLK POLYSTYRENE PICTURE FRAME MOULDINGS', 48.0, 52.0, 118.0, 2.08, 4.63),
  ('PM057BR000', '1001-14L', '2.7', 144.0, 1.083, 118.0, '057-405 BRN POLYSTYRENE PICTURE FRAME MOULDINGS', '057-405 BRN POLYSTYRENE PICTURE FRAME MOULDINGS', 48.0, 52.0, 118.0, 2.08, 4.63),
  ('PM057DBL00', '1001-F', '2.7', 144.0, 1.083, 118.0, '057-555 DBL POLYSTYRENE PICTURE FRAME MOULDINGS', '057-555 DBL POLYSTYRENE PICTURE FRAME MOULDINGS', 48.0, 52.0, 118.0, 2.08, 4.63),
  ('PM057LC000', '1001-14P', '2.7', 144.0, 1.083, 118.0, '057-1073 LC POLYSTYRENE PICTURE FRAME MOULDINGS', '057-1073 LC POLYSTYRENE PICTURE FRAME MOULDINGS', 48.0, 52.0, 118.0, 2.08, 4.63),
  ('PM057114LC', '057-114P', '2.7', 144.0, 1.083, 118.0, '057-114P LC POLYSTYRENE PICTURE FRAME MOULDINGS', '057-114P LC POLYSTYRENE PICTURE FRAME MOULDINGS', 48.0, 52.0, 118.0, 2.08, 4.63),
  ('PM05710MR0', '1001-111R', '2.7', 144.0, 1.083, 118.0, '057-10 MRN WOOD FINISH POLYSTYRENE PICTURE FRAME MOULDINGS', '057-10 MRN WOOD FINISH POLYSTYRENE PICTURE FRAME MOULDINGS', 48.0, 52.0, 118.0, 2.08, 4.63),
  ('PM057MR000', '1001-H', '2.7', 144.0, 1.083, 118.0, '057-518 MRN POLYSTYRENE PICTURE FRAME MOULDINGS', '057-518 MRN POLYSTYRENE PICTURE FRAME MOULDINGS', 48.0, 52.0, 118.0, 2.08, 4.63),
  ('PM057WT000', '1001-02Q', '2.7', 144.0, 1.083, 118.0, '057-02Q WHITE POLYSTYRENE PICTURE FRAME MOULDINGS', '057-02Q WHITE POLYSTYRENE PICTURE FRAME MOULDINGS', 48.0, 52.0, 118.0, 2.08, 4.63),
  ('PM1001BK00', '1001-1-B', '2.7', 144.0, 1.083, 118.0, '1001-1-B BLK POLYSTYRENE PICTURE FRAME MOULDINGS', '1001-1-B BLK POLYSTYRENE PICTURE FRAME MOULDINGS', 48.0, 52.0, 118.0, 2.08, 4.63),
  ('PM1001BR00', '1001-132K', '2.7', 144.0, 1.083, 118.0, '1001-132K BRN POLYSTYRENE PICTURE FRAME MOULDINGS', '1001-132K BRN POLYSTYRENE PICTURE FRAME MOULDINGS', 48.0, 52.0, 118.0, 2.08, 4.63),
  ('PM1001GD00', '1001-G1', '2.7', 144.0, 1.083, 118.0, '1001-G1-GOLD POLYSTYRENE PICTURE FRAME MOULDINGS', '1001-G1-GOLD POLYSTYRENE PICTURE FRAME MOULDINGS', 48.0, 52.0, 118.0, 2.08, 4.63),
  ('PM1001MR00', '1001-132J', '2.7', 144.0, 1.083, 118.0, '1001-132J MRN POLYSTYRENE PICTURE FRAME MOULDINGS', '1001-132J MRN POLYSTYRENE PICTURE FRAME MOULDINGS', 48.0, 52.0, 118.0, 2.08, 4.63),
  ('PM1001SV00', '1001-03W', '2.7', 144.0, 1.083, 118.0, '1001-03W-SLV POLYSTYRENE PICTURE FRAME MOULDINGS', '1001-03W-SLV POLYSTYRENE PICTURE FRAME MOULDINGS', 48.0, 52.0, 118.0, 2.08, 4.63),
  ('PM1001WT00', '1001-02Q-1', '2.7', 144.0, 1.083, 118.0, '1001-02Q-1 WHITE POLYSTYRENE PICTURE FRAME MOULDINGS', '1001-02Q-1 WHITE POLYSTYRENE PICTURE FRAME MOULDINGS', 48.0, 52.0, 118.0, 2.08, 4.63),
  ('PM1014BK00', '1014-1-B', '2.7', 72.0, 1.767, 211.0, '1014-1-B-BLK POLYSTYRENE PICTURE FRAME MOULDINGS', '1014-1-B-BLK POLYSTYRENE PICTURE FRAME MOULDINGS', 86.0, 95.0, 211.0, 3.72, 8.27),
  ('PM1014BR00', '1014-127A', '2.7', 72.0, 1.767, 211.0, '1014-127A-BRN POLYSTYRENE PICTURE FRAME MOULDINGS', '1014-127A-BRN POLYSTYRENE PICTURE FRAME MOULDINGS', 86.0, 95.0, 211.0, 3.72, 8.27),
  ('PM1014DBR0', '1014-132K-1', '2.7', 72.0, 1.767, 211.0, '1014-132K-1-DBRN POLYSTYRENE PICTURE FRAME MOULDINGS', '1014-132K-1-DBRN POLYSTYRENE PICTURE FRAME MOULDINGS', 86.0, 95.0, 211.0, 3.72, 8.27),
  ('PM1014GD00', '1014-39M', '2.7', 72.0, 1.767, 211.0, '1014-39M-GOLD POLYSTYRENE PICTURE FRAME MOULDINGS', '1014-39M-GOLD POLYSTYRENE PICTURE FRAME MOULDINGS', 86.0, 95.0, 211.0, 3.72, 8.27),
  ('PM1014LC00', '1014-14P', '2.7', 72.0, 1.767, 211.0, '1014-14P-LC POLYSTYRENE PICTURE FRAME MOULDINGS', '1014-14P-LC POLYSTYRENE PICTURE FRAME MOULDINGS', 86.0, 95.0, 211.0, 3.72, 8.27),
  ('PM1014WT00', '1014-02Q-1', '2.7', 72.0, 1.767, 211.0, '1014-02Q-1 WHITE POLYSTYRENE PICTURE FRAME MOULDINGS', '1014-02Q-1 WHITE POLYSTYRENE PICTURE FRAME MOULDINGS', 86.0, 95.0, 211.0, 3.72, 8.27),
  ('PM1032MR00', '1032-15X', NULL, 90.0, 1.558, 212.0, '1032-15X MRN POLYSTYRENE PICTURE FRAME MOULDINGS', '1032-15X MRN POLYSTYRENE PICTURE FRAME MOULDINGS', 86.0, 96.0, 212.0, 3.74, 8.31),
  ('PM1040BR00', '1040-02X', '2.7', 110.0, 1.55, 168.0, '1040-02X BRN POLYSTYRENE PICTURE FRAME MOULDINGS', '1040-02X BRN POLYSTYRENE PICTURE FRAME MOULDINGS', 68.0, 76.0, 168.0, 2.96, 6.59),
  ('PM1041BK00', '1041-1-B', '2.7', 96.0, 1.7575, 212.0, '1041-1 BLK POLYSTYRENE PICTURE FRAME MOULDINGS', '1041-1 BLK POLYSTYRENE PICTURE FRAME MOULDINGS', 86.0, 96.0, 212.0, 3.74, 8.31),
  ('PM1087BL00', '1087-02N', '2.7', 90.0, 1.691, 205.0, '1087-02N-BLUE POLYSTYRENE PICTURE FRAME MOULDINGS', '1087-02N-BLUE POLYSTYRENE PICTURE FRAME MOULDINGS', 83.0, 93.0, 205.0, 3.62, 8.04),
  ('PM1087BR00', '1087-04T', '2.7', 90.0, 1.691, 205.0, '1087-04T-BRN POLYSTYRENE PICTURE FRAME MOULDINGS', '1087-04T-BRN POLYSTYRENE PICTURE FRAME MOULDINGS', 83.0, 93.0, 205.0, 3.62, 8.04),
  ('PM1087GD00', '1087-39M', '2.7', 90.0, 1.691, 205.0, '1087-39M-GOLD POLYSTYRENE PICTURE FRAME MOULDINGS', '1087-39M-GOLD POLYSTYRENE PICTURE FRAME MOULDINGS', 83.0, 93.0, 205.0, 3.62, 8.04),
  ('PM1087GR00', '1087-02M', '2.7', 90.0, 1.691, 205.0, '1087-02M-GRN POLYSTYRENE PICTURE FRAME MOULDINGS', '1087-02M-GRN POLYSTYRENE PICTURE FRAME MOULDINGS', 83.0, 93.0, 205.0, 3.62, 8.04),
  ('PM1087MR00', '1087-04U', '2.7', 90.0, 1.691, 205.0, '1087-04U-MRN POLYSTYRENE PICTURE FRAME MOULDINGS', '1087-04U-MRN POLYSTYRENE PICTURE FRAME MOULDINGS', 83.0, 93.0, 205.0, 3.62, 8.04),
  ('PM1087RD00', '1087-32K', '2.7', 90.0, 1.691, 205.0, '1087-32K-RED POLYSTYRENE PICTURE FRAME MOULDINGS', '1087-32K-RED POLYSTYRENE PICTURE FRAME MOULDINGS', 83.0, 93.0, 205.0, 3.62, 8.04),
  ('PM1110MR00', '1110-14B', NULL, 144.0, 1.691, 140.0, '1110-14B MRN POLYSTYRENE PICTURE FRAME MOULDINGS', '1110-14B MRN POLYSTYRENE PICTURE FRAME MOULDINGS', 57.0, 63.0, 140.0, 2.47, 5.49),
  ('PM1122BR00', '1122-127C', '2.7', 88.0, 1.691, 199.0, '1122-127C-BRN POLYSTYRENE PICTURE FRAME MOULDINGS', '1122-127C-BRN POLYSTYRENE PICTURE FRAME MOULDINGS', 81.0, 90.0, 199.0, 3.51, 7.8),
  ('PM1122MR00', '1122-127B', '2.7', 88.0, 1.691, 199.0, '1122-127B-MRN POLYSTYRENE PICTURE FRAME MOULDINGS', '1122-127B-MRN POLYSTYRENE PICTURE FRAME MOULDINGS', 81.0, 90.0, 199.0, 3.51, 7.8),
  ('PM1132BK00', '1132-1-B', '2.7', 72.0, 1.558, 205.0, '1132-1-B BLK POLYSTYRENE PICTURE FRAME MOULDINGS', '1132-1-B BLK POLYSTYRENE PICTURE FRAME MOULDINGS', 83.0, 93.0, 205.0, 3.62, 8.04),
  ('PM11321MR0', '1132-1-02E', '2.7', 72.0, 1.558, 205.0, '1132-1-02E MRN POLYSTYRENE PICTURE FRAME MOULDINGS', '1132-1-02E MRN POLYSTYRENE PICTURE FRAME MOULDINGS', 83.0, 93.0, 205.0, 3.62, 8.04),
  ('PM1132MR00', '1132-O2E', '2.7', 72.0, 1.558, 205.0, '1132-02E MRN POLYSTYRENE PICTURE FRAME MOULDINGS', '1132-02E MRN POLYSTYRENE PICTURE FRAME MOULDINGS', 83.0, 93.0, 205.0, 3.62, 8.04),
  ('PM1159BK00', '1159-B', '2.7', 41.0, 3.8, 481.0, '1159-B-BLK POLYSTYRENE PICTURE FRAME MOULDINGS', '1159-B-BLK POLYSTYRENE PICTURE FRAME MOULDINGS', 195.0, 217.0, 481.0, 8.49, 18.86),
  ('PM1159NA00', '1159-114K', '2.7', 41.0, 3.8, 481.0, '1159-114K-NTR POLYSTYRENE PICTURE FRAME MOULDINGS', '1159-114K-NTR POLYSTYRENE PICTURE FRAME MOULDINGS', 195.0, 217.0, 481.0, 8.49, 18.86),
  ('PM1159WT00', '1159-02Q-1', '2.7', 41.0, 3.8, 481.0, '1159-02Q-1 WHITE POLYSTYRENE PICTURE FRAME MOULDINGS', '1159-02Q-1 WHITE POLYSTYRENE PICTURE FRAME MOULDINGS', 195.0, 217.0, 481.0, 8.49, 18.86),
  ('PM1176BK00', '1176-20M', '2.7', 40.0, 3.1255, 401.0, '1176-20M-BLK POLYSTYRENE PICTURE FRAME MOULDINGS', '1176-20M-BLK POLYSTYRENE PICTURE FRAME MOULDINGS', 163.0, 181.0, 401.0, 7.08, 15.73),
  ('PM1223BR00', '1223-01K', '2.7', 77.0, 1.96, 221.0, '1223-01K BRN POLYSTYRENE PICTURE FRAME MOULDINGS', '1223-01K BRN POLYSTYRENE PICTURE FRAME MOULDINGS', 90.0, 99.0, 221.0, 3.9, 8.67),
  ('PM1223MR00', '1223-01L', '2.7', 77.0, 1.96, 221.0, '1223-01L MRN POLYSTYRENE PICTURE FRAME MOULDINGS', '1223-01L MRN POLYSTYRENE PICTURE FRAME MOULDINGS', 90.0, 99.0, 221.0, 3.9, 8.67),
  ('PM138BK000', '2015 B', '2.7', 66.0, 2.4206, 325.0, '138-197 BLK POLYSTYRENE PICTURE FRAME MOULDINGS', '138-197 BLK POLYSTYRENE PICTURE FRAME MOULDINGS', 132.0, 146.0, 325.0, 5.74, 12.75),
  ('PM138GDBK0', '2015 BG', '2.7', 66.0, 2.4206, 325.0, '138-198-W/GOLD BLK POLYSTYRENE PICTURE FRAME MOULDINGS', '138-198-W/GOLD BLK POLYSTYRENE PICTURE FRAME MOULDINGS', 132.0, 146.0, 325.0, 5.74, 12.75),
  ('PM138BR000', '2015-50L', '2.7', 66.0, 2.4206, 325.0, '138-BRN POLYSTYRENE PICTURE FRAME MOULDINGS', '138-BRN POLYSTYRENE PICTURE FRAME MOULDINGS', 132.0, 146.0, 325.0, 5.74, 12.75),
  ('PM138MR000', '2015-02E', '2.7', 66.0, 2.4206, 325.0, '138-MRN POLYSTYRENE PICTURE FRAME MOULDINGS', '138-MRN POLYSTYRENE PICTURE FRAME MOULDINGS', 132.0, 146.0, 325.0, 5.74, 12.75),
  ('PM138NA000', '2015-14P', '2.7', 66.0, 2.4206, 325.0, '138-NTR POLYSTYRENE PICTURE FRAME MOULDINGS', '138-NTR POLYSTYRENE PICTURE FRAME MOULDINGS', 132.0, 146.0, 325.0, 5.74, 12.75),
  ('PM138WT000', '2015-02Q', '2.7', 66.0, 2.4206, 325.0, '138-WHITE POLYSTYRENE PICTURE FRAME MOULDINGS', '138-WHITE POLYSTYRENE PICTURE FRAME MOULDINGS', 132.0, 146.0, 325.0, 5.74, 12.75),
  ('PM1389MR00', '1389-32G', '2.7', 63.0, 2.28, 277.0, '1389-32G-MRN POLYSTYRENE PICTURE FRAME MOULDINGS', '1389-32G-MRN POLYSTYRENE PICTURE FRAME MOULDINGS', 112.0, 125.0, 277.0, 4.89, 10.86),
  ('PM1391BR00', '1391-04T', '2.7', 100.0, 1.4915, 176.0, '1391-04T-BRN POLYSTYRENE PICTURE FRAME MOULDINGS', '1391-04T-BRN POLYSTYRENE PICTURE FRAME MOULDINGS', 72.0, 79.0, 176.0, 3.11, 6.9),
  ('PM1391MR00', '1391-32I', '2.7', 100.0, 1.4915, 176.0, '1391-32I-MRN POLYSTYRENE PICTURE FRAME MOULDINGS', '1391-32I-MRN POLYSTYRENE PICTURE FRAME MOULDINGS', 72.0, 79.0, 176.0, 3.11, 6.9),
  ('PM1394GD00', '1394-29J', '2.7', 48.0, 2.945, 364.0, '1394-29J-GOLD POLYSTYRENE PICTURE FRAME MOULDINGS', '1394-29J-GOLD POLYSTYRENE PICTURE FRAME MOULDINGS', 163.0, 164.0, 364.0, 6.42, 14.27),
  ('PM1407BR00', '1407-50J', '2.7', 40.0, 3.895, 463.0, '1407-50J BRN POLYSTYRENE PICTURE FRAME MOULDINGS', '1407-50J BRN POLYSTYRENE PICTURE FRAME MOULDINGS', 187.0, 208.0, 463.0, 8.17, 18.16),
  ('PM1407MR00', '1407-124B', '2.7', 40.0, 3.895, 463.0, '1407-124B MRN POLYSTYRENE PICTURE FRAME MOULDINGS', '1407-124B MRN POLYSTYRENE PICTURE FRAME MOULDINGS', 187.0, 208.0, 463.0, 8.17, 18.16),
  ('PM1407WT00', '1407-11OH', '2.7', 40.0, 3.895, 463.0, '1407-110H-WHITE POLYSTYRENE PICTURE FRAME MOULDINGS', '1407-110H-WHITE POLYSTYRENE PICTURE FRAME MOULDINGS', 187.0, 208.0, 463.0, 8.17, 18.16),
  ('PM1434MR00', '1434-28Q ', '2.7', 63.0, 2.052, 261.0, '1434-28Q MRN POLYSTYRENE PICTURE FRAME MOULDINGS', '1434-28Q MRN POLYSTYRENE PICTURE FRAME MOULDINGS', 106.0, 118.0, 261.0, 4.61, 10.84),
  ('PM1441BK00', '1441-B-1', '2.7', 51.0, 2.755, 345.0, '1441-B-1-BLK POLYSTYRENE PICTURE FRAME MOULDINGS', '1441-B-1-BLK POLYSTYRENE PICTURE FRAME MOULDINGS', 140.0, 155.0, 345.0, 6.09, 13.53),
  ('PM1469BR00', '1469-01K', '2.7', 88.0, 1.672, 205.0, '1469-01K BRN POLYSTYRENE PICTURE FRAME MOULDINGS', '1469-01K BRN POLYSTYRENE PICTURE FRAME MOULDINGS', 83.0, 93.0, 205.0, 3.62, 8.04),
  ('PM1574BK00', '1574-36B', '2.7', 48.0, 3.0495, 369.0, '1574-36B-BLK POLYSTYRENE PICTURE FRAME MOULDINGS', '1574-36B-BLK POLYSTYRENE PICTURE FRAME MOULDINGS', 149.0, 166.0, 369.0, 6.51, 14.47),
  ('PM1574GD00', '1574-03A', '2.7', 48.0, 3.0495, 369.0, '1574-03A-GOLD POLYSTYRENE PICTURE FRAME MOULDINGS', '1574-03A-GOLD POLYSTYRENE PICTURE FRAME MOULDINGS', 149.0, 166.0, 369.0, 6.51, 14.47),
  ('PM1574WT00', '1574-02Q', '2.7', 48.0, 3.0495, 369.0, '1574-02Q WHITE POLYSTYRENE PICTURE FRAME MOULDINGS', '1574-02Q WHITE POLYSTYRENE PICTURE FRAME MOULDINGS', 149.0, 166.0, 369.0, 6.51, 14.47),
  ('PM1586GD00', '1586-29J', '2.7', 90.0, 1.501, 189.0, '1586-29J-GOLD POLYSTYRENE PICTURE FRAME MOULDINGS', '1586-29J-GOLD POLYSTYRENE PICTURE FRAME MOULDINGS', 77.0, 85.0, 189.0, 3.34, 7.41),
  ('PM1589BK00', '1589-B', '2.7', 64.0, 2.375, 279.0, '1589-B BLK POLYSTYRENE PICTURE FRAME MOULDINGS', '1589-B BLK POLYSTYRENE PICTURE FRAME MOULDINGS', 114.0, 126.0, 279.0, 4.92, 10.94),
  ('PM1589DBR0', '1589-132K-1', '2.7', 64.0, 2.375, 279.0, '1589-132K-1 DBRN POLYSTYRENE PICTURE FRAME MOULDINGS', '1589-132K-1 DBRN POLYSTYRENE PICTURE FRAME MOULDINGS', 114.0, 126.0, 279.0, 4.92, 10.94),
  ('PM1589NA00', '1589-14P', '2.7', 64.0, 2.375, 279.0, '1589-14P NTR POLYSTYRENE PICTURE FRAME MOULDINGS', '1589-14P NTR POLYSTYRENE PICTURE FRAME MOULDINGS', 114.0, 126.0, 279.0, 4.92, 10.94),
  ('PM1589WT00', '1589-02Q-1', '2.7', 64.0, 2.375, 279.0, '1589-02Q-1 WHITE POLYSTYRENE PICTURE FRAME MOULDINGS', '1589-02Q-1 WHITE POLYSTYRENE PICTURE FRAME MOULDINGS', 114.0, 126.0, 279.0, 4.92, 10.94),
  ('PM1669MR00', '1669-28QG', '2.7', 49.0, 2.8462, 345.0, '1669-28QG-MRN POLYSTYRENE PICTURE FRAME MOULDINGS', '1669-28QG-MRN POLYSTYRENE PICTURE FRAME MOULDINGS', 140.0, 155.0, 345.0, 6.09, 13.53),
  ('PM1672LC00', '1672-112K', '2.7', 56.0, NULL, 277.0, '1672-112K-LC POLYSTYRENE PICTURE FRAME MOULDINGS', '1672-112K-LC POLYSTYRENE PICTURE FRAME MOULDINGS', 112.0, 125.0, 277.0, 4.89, 10.86),
  ('PM1677BK00', '1677-B', '2.7', 96.0, 1.2825, 162.0, '1677-B-BLK POLYSTYRENE PICTURE FRAME MOULDINGS', '1677-B-BLK POLYSTYRENE PICTURE FRAME MOULDINGS', 65.0, 73.0, 162.0, 2.86, 6.35),
  ('PM1677GD00', '1677-117J', '2.7', 96.0, 1.2825, 162.0, '1677-117J-GLD POLYSTYRENE PICTURE FRAME MOULDINGS', '1677-117J-GLD POLYSTYRENE PICTURE FRAME MOULDINGS', 65.0, 73.0, 162.0, 2.86, 6.35),
  ('PM1677MR00', '1677-117I', '2.7', 96.0, 1.2825, 162.0, '1677-117I-MRN POLYSTYRENE PICTURE FRAME MOULDINGS', '1677-117I-MRN POLYSTYRENE PICTURE FRAME MOULDINGS', 65.0, 73.0, 162.0, 2.86, 6.35),
  ('PM1725BK00', '1725-B', '2.7', 90.0, 1.4725, 186.0, '1725-B-BLK POLYSTYRENE PICTURE FRAME MOULDINGS', '1725-B-BLK POLYSTYRENE PICTURE FRAME MOULDINGS', 76.0, 84.0, 186.0, 3.28, 7.29),
  ('PM1725MR00', '1725.0', '2.7', 90.0, 1.4725, 186.0, '1725-MRN POLYSTYRENE PICTURE FRAME MOULDINGS', '1725-MRN POLYSTYRENE PICTURE FRAME MOULDINGS', 76.0, 84.0, 186.0, 3.28, 7.29),
  ('PM1725BRWT', '1725-109N', '2.7', 90.0, 1.4725, 186.0, '1725-109B/WHITE POLYSTYRENE PICTURE FRAME MOULDINGS', '1725-109B/WHITE POLYSTYRENE PICTURE FRAME MOULDINGS', 76.0, 84.0, 186.0, 3.28, 7.29),
  ('PM1829BK00', '1829-B1 ', '2.7', 63.0, 2.3275, 302.0, '1829-B1-BLK POLYSTYRENE PICTURE FRAME MOULDINGS', '1829-B1-BLK POLYSTYRENE PICTURE FRAME MOULDINGS', 122.0, 136.0, 302.0, 5.33, 11.84),
  ('PM1829LBL0', '1829-121Y', '2.7', 63.0, 2.3275, 302.0, '1829-121Y-LBLUE POLYSTYRENE PICTURE FRAME MOULDINGS', '1829-121Y-LBLUE POLYSTYRENE PICTURE FRAME MOULDINGS', 122.0, 136.0, 302.0, 5.33, 11.84),
  ('PM1829MR00', '1829-01T ', '2.7', 63.0, 2.3275, 302.0, '1829-01T-MRN POLYSTYRENE PICTURE FRAME MOULDINGS', '1829-01T-MRN POLYSTYRENE PICTURE FRAME MOULDINGS', 122.0, 136.0, 302.0, 5.33, 11.84),
  ('PM1829NA00', '1829-120J', '2.7', 63.0, 2.3275, 302.0, '1829-120J-NTR POLYSTYRENE PICTURE FRAME MOULDINGS', '1829-120J-NTR POLYSTYRENE PICTURE FRAME MOULDINGS', 122.0, 136.0, 302.0, 5.33, 11.84),
  ('PM1829PK00', '1829-133A ', '2.7', 63.0, 2.3275, 302.0, '1829-133A-PINK POLYSTYRENE PICTURE FRAME MOULDINGS', '1829-133A-PINK POLYSTYRENE PICTURE FRAME MOULDINGS', 122.0, 136.0, 302.0, 5.33, 11.84),
  ('PM1831GD00', '1831-120H', '2.7', 64.0, 2.185, 289.0, '1831-120H-GOLD POLYSTYRENE PICTURE FRAME MOULDINGS', '1831-120H-GOLD POLYSTYRENE PICTURE FRAME MOULDINGS', 117.0, 131.0, 289.0, 5.1, 11.33),
  ('PM1843BK00', '1843-BY', '2.7', 64.0, 1.9, 242.0, '1843-BY-BLK POLYSTYRENE PICTURE FRAME MOULDINGS', '1843-BY-BLK POLYSTYRENE PICTURE FRAME MOULDINGS', 98.0, 109.0, 242.0, 4.27, 9.49),
  ('PM1846GR00', '1846-120H', '2.7', 40.0, 3.515, 457.0, '1846-120H-GRN POLYSTYRENE PICTURE FRAME MOULDINGS', '1846-120H-GRN POLYSTYRENE PICTURE FRAME MOULDINGS', 185.0, 206.0, 457.0, 8.06, 17.92),
  ('PM1846NA00', '1846-127S', '2.7', 40.0, 3.515, 457.0, '1846-127S-NTR POLYSTYRENE PICTURE FRAME MOULDINGS', '1846-127S-NTR POLYSTYRENE PICTURE FRAME MOULDINGS', 185.0, 206.0, 457.0, 8.06, 17.92),
  ('PM1865BK00', '1865-15X', '2.7', 110.0, 1.273, 174.0, '1865-115X-BLK POLYSTYRENE PICTURE FRAME MOULDINGS', '1865-115X-BLK POLYSTYRENE PICTURE FRAME MOULDINGS', 71.0, 79.0, 174.0, 3.07, 6.82),
  ('PM1865MR00', '1865-119R', '2.7', 110.0, 1.273, 174.0, '1865-119R-MRN POLYSTYRENE PICTURE FRAME MOULDINGS', '1865-119R-MRN POLYSTYRENE PICTURE FRAME MOULDINGS', 71.0, 79.0, 174.0, 3.07, 6.82),
  ('PM1890BK00', '1890-B1', '2.7', 80.0, 1.805, 221.0, '1890-B1-BLK POLYSTYRENE PICTURE FRAME MOULDINGS', '1890-B1-BLK POLYSTYRENE PICTURE FRAME MOULDINGS', 90.0, 99.0, 221.0, 3.9, 8.67),
  ('PM1890LBL0', '1890-121Y', '2.7', 80.0, 1.805, 221.0, '1890-121Y-LBLUE POLYSTYRENE PICTURE FRAME MOULDINGS', '1890-121Y-LBLUE POLYSTYRENE PICTURE FRAME MOULDINGS', 90.0, 99.0, 221.0, 3.9, 8.67),
  ('PM1890MR00', '1890-01T', '2.7', 80.0, 1.805, 221.0, '1890-01T-MRN POLYSTYRENE PICTURE FRAME MOULDINGS', '1890-01T-MRN POLYSTYRENE PICTURE FRAME MOULDINGS', 90.0, 99.0, 221.0, 3.9, 8.67),
  ('PM1890NA00', '1890-133A', '2.7', 80.0, 1.805, 221.0, '1890-133A-NTR POLYSTYRENE PICTURE FRAME MOULDINGS', '1890-133A-NTR POLYSTYRENE PICTURE FRAME MOULDINGS', 90.0, 99.0, 221.0, 3.9, 8.67),
  ('PM1890RD00', '1890-14B', '2.7', 80.0, 1.805, 221.0, '1890-14B-RED POLYSTYRENE PICTURE FRAME MOULDINGS', '1890-14B-RED POLYSTYRENE PICTURE FRAME MOULDINGS', 90.0, 99.0, 221.0, 3.9, 8.67),
  ('PM1890WT00', '1890-129C', '2.7', 80.0, 1.805, 221.0, '1890-129C-WHITE POLYSTYRENE PICTURE FRAME MOULDINGS', '1890-129C-WHITE POLYSTYRENE PICTURE FRAME MOULDINGS', 90.0, 99.0, 221.0, 3.9, 8.67),
  ('PM2040BL00', '2040-02N', '2.7', 48.0, 3.116, 366.0, '2040-02N-BLUE POLYSTYRENE PICTURE FRAME MOULDINGS', '2040-02N-BLUE POLYSTYRENE PICTURE FRAME MOULDINGS', 148.0, 165.0, 366.0, 6.46, 14.35),
  ('PM2040GD00', '2040-02M', '2.7', 48.0, 3.116, 366.0, '2040-02G-GOLD POLYSTYRENE PICTURE FRAME MOULDINGS', '2040-02G-GOLD POLYSTYRENE PICTURE FRAME MOULDINGS', 148.0, 165.0, 366.0, 6.46, 14.35),
  ('PM2040GR00', '2040-02G', '2.7', 48.0, 3.116, 366.0, '2040-02M-GRN POLYSTYRENE PICTURE FRAME MOULDINGS', '2040-02M-GRN POLYSTYRENE PICTURE FRAME MOULDINGS', 148.0, 165.0, 366.0, 6.46, 14.35),
  ('PM2040RD00', '2040-02F', '2.7', 48.0, 3.116, 366.0, '2040-02F-RED POLYSTYRENE PICTURE FRAME MOULDINGS', '2040-02F-RED POLYSTYRENE PICTURE FRAME MOULDINGS', 148.0, 165.0, 366.0, 6.46, 14.35),
  ('PM2051GD00', '2051-05W', '2.7', 28.0, 4.5743, 549.0, '2051-05W GOLD POLYSTYRENE PICTURE FRAME MOULDINGS', '2051-05W GOLD POLYSTYRENE PICTURE FRAME MOULDINGS', 223.0, 247.0, 549.0, 9.69, 21.53),
  ('PM2058BK00', '2058-B', '2.7', 40.0, 3.23, 389.0, '2058-B BLK POLYSTYRENE PICTURE FRAME MOULDINGS', '2058-B BLK POLYSTYRENE PICTURE FRAME MOULDINGS', 158.0, 176.0, 389.0, 6.86, 15.25),
  ('PM2074BR00', '2074-15W', '2.7', 70.0, 1.805, 224.0, '2074-15W-BRN POLYSTYRENE PICTURE FRAME MOULDINGS', '2074-15W-BRN POLYSTYRENE PICTURE FRAME MOULDINGS', 91.0, 101.0, 224.0, 3.95, 8.78),
  ('PM2074MR00', '2074-15X', '2.7', 70.0, 1.805, 224.0, '2074-15X-MRN POLYSTYRENE PICTURE FRAME MOULDINGS', '2074-15X-MRN POLYSTYRENE PICTURE FRAME MOULDINGS', 91.0, 101.0, 224.0, 3.95, 8.78),
  ('PM2079BK00', '2079-B2', '2.7', 28.0, 5.225, 578.0, '2079-B2-BLK POLYSTYRENE PICTURE FRAME MOULDINGS', '2079-B2-BLK POLYSTYRENE PICTURE FRAME MOULDINGS', 235.0, 261.0, 578.0, 10.2, 22.67),
  ('PM2079BR00', '2079-132K-1', '2.7', 28.0, 5.225, 578.0, '2079-132K-1 BRN POLYSTYRENE PICTURE FRAME MOULDINGS', '2079-132K-1 BRN POLYSTYRENE PICTURE FRAME MOULDINGS', 235.0, 261.0, 578.0, 10.2, 22.67),
  ('PM2079GD00', '2079-G', '2.7', 28.0, 5.225, 578.0, '2079-GOLD POLYSTYRENE PICTURE FRAME MOULDINGS', '2079-GOLD POLYSTYRENE PICTURE FRAME MOULDINGS', 235.0, 261.0, 578.0, 10.2, 22.67),
  ('PM2079MR00', '2079-02E', '2.7', 28.0, 5.225, 578.0, '2079-02E MRN POLYSTYRENE PICTURE FRAME MOULDINGS', '2079-02E MRN POLYSTYRENE PICTURE FRAME MOULDINGS', 235.0, 261.0, 578.0, 10.2, 22.67),
  ('PM2079SV00', '2079-S', '2.7', 28.0, 5.225, 578.0, '2079-SILVER POLYSTYRENE PICTURE FRAME MOULDINGS', '2079-SILVER POLYSTYRENE PICTURE FRAME MOULDINGS', 235.0, 261.0, 578.0, 10.2, 22.67),
  ('PM2081BK00', '2081-B', '2.7', 25.0, 6.4885, 769.0, '2081-B BLK POLYSTYRENE PICTURE FRAME MOULDINGS', '2081-B BLK POLYSTYRENE PICTURE FRAME MOULDINGS', 312.0, 346.0, 769.0, 13.57, 30.16),
  ('PM2082MR00', '2082-15X', '2.7', 100.0, 1.615, 194.0, '2082-15X-MRN POLYSTYRENE PICTURE FRAME MOULDINGS', '2082-15X-MRN POLYSTYRENE PICTURE FRAME MOULDINGS', 79.0, 87.0, 194.0, 3.42, 7.61),
  ('PM2127BR00', '2020-01K', '2.7', 45.0, 3.2429, 392.0, '2127-11-BRN POLYSTYRENE PICTURE FRAME MOULDINGS', '2127-11-BRN POLYSTYRENE PICTURE FRAME MOULDINGS', 159.0, 176.0, 392.0, 6.92, 15.37),
  ('PM2127MR00', '2020-01L', '2.7', 45.0, 3.2429, 392.0, '2127-10-MRN POLYSTYRENE PICTURE FRAME MOULDINGS', '2127-10-MRN POLYSTYRENE PICTURE FRAME MOULDINGS', 159.0, 176.0, 392.0, 6.92, 15.37),
  ('PM2150LBR0', '1030-01G ', '2.7', 100.0, 1.615, 189.0, '2150-651-LBRN POLYSTYRENE PICTURE FRAME MOULDINGS', '2150-651-LBRN POLYSTYRENE PICTURE FRAME MOULDINGS', 77.0, 85.0, 189.0, 3.34, 7.41),
  ('PM2164BR00', '2164-108X', '2.7', 56.0, 2.6125, 326.0, '2164-108X-BRN POLYSTYRENE PICTURE FRAME MOULDINGS', '2164-108X-BRN POLYSTYRENE PICTURE FRAME MOULDINGS', 133.0, 147.0, 326.0, 5.75, 12.78),
  ('PM2172DBR0', '2038-02E', '2.7', 70.0, 1.976, 252.0, '2172-4-DBRN POLYSTYRENE PICTURE FRAME MOULDINGS', '2172-4-DBRN POLYSTYRENE PICTURE FRAME MOULDINGS', 102.0, 114.0, 252.0, 4.45, 9.88),
  ('PM2180SV00', '1140-18S', '2.7', 64.0, 2.5175, 298.0, '2180-4-SILVER POLYSTYRENE PICTURE FRAME MOULDINGS', '2180-4-SILVER POLYSTYRENE PICTURE FRAME MOULDINGS', 121.0, 134.0, 298.0, 5.26, 11.69),
  ('PM2223BK00', '1038-B', '2.7', 110.0, NULL, 177.0, '2223-B BLK GLOSSY  POLYSTYRENE PICTURE FRAME MOULDINGS', '2223-B BLK GLOSSY  POLYSTYRENE PICTURE FRAME MOULDINGS', 72.0, 80.0, 177.0, 3.12, 6.94),
  ('PM2223MR00', '1038-R2', '2.7', 110.0, NULL, 177.0, '2223-1 MRN POLYSTYRENE PICTURE FRAME MOULDINGS', '2223-1 MRN POLYSTYRENE PICTURE FRAME MOULDINGS', 72.0, 80.0, 177.0, 3.12, 6.94),
  ('PM2247DBR0', '2031-02R', '2.7', 70.0, 1.6215, 215.0, '2247-7 DBRN POLYSTYRENE PICTURE FRAME MOULDINGS', '2247-7 DBRN POLYSTYRENE PICTURE FRAME MOULDINGS', 87.0, 97.0, 215.0, 3.79, 8.43),
  ('PM2280BL00', '1034-02N', '2.7', 120.0, 1.0925, 124.0, '2280-BLUE POLYSTYRENE PICTURE FRAME MOULDINGS', '2280-BLUE POLYSTYRENE PICTURE FRAME MOULDINGS', 51.0, 56.0, 124.0, 2.19, 4.86),
  ('PM2280BR00', '1034-02K', '2.7', 120.0, 1.0925, 124.0, '2280-3-BRN POLYSTYRENE PICTURE FRAME MOULDINGS', '2280-3-BRN POLYSTYRENE PICTURE FRAME MOULDINGS', 51.0, 56.0, 124.0, 2.19, 4.86),
  ('PM2280CC00', '1034-14Z', '2.7', 120.0, 1.0925, 124.0, '2280-4-CHO POLYSTYRENE PICTURE FRAME MOULDINGS', '2280-4-CHO POLYSTYRENE PICTURE FRAME MOULDINGS', 51.0, 56.0, 124.0, 2.19, 4.86),
  ('PM2280GR00', '1034-02M', '2.7', 120.0, 1.0925, 124.0, '2280-1-GRN POLYSTYRENE PICTURE FRAME MOULDINGS', '2280-1-GRN POLYSTYRENE PICTURE FRAME MOULDINGS', 51.0, 56.0, 124.0, 2.19, 4.86),
  ('PM2280MR00', '1034-14B', '2.7', 120.0, 1.0925, 124.0, '2280-2-MRN POLYSTYRENE PICTURE FRAME MOULDINGS', '2280-2-MRN POLYSTYRENE PICTURE FRAME MOULDINGS', 51.0, 56.0, 124.0, 2.19, 4.86),
  ('PM2310MR00', '2115-12R', '2.7', 77.0, 1.596, 233.0, '2310-805 MRN POLYSTYRENE PICTURE FRAME MOULDINGS', '2310-805 MRN POLYSTYRENE PICTURE FRAME MOULDINGS', 94.0, 105.0, 233.0, 4.11, 9.14),
  ('PM2350GD00', '2018-01J', '2.7', 32.0, 3.6056, 553.0, '2350-2 GOLD POLYSTYRENE PICTURE FRAME MOULDINGS', '2350-2 GOLD POLYSTYRENE PICTURE FRAME MOULDINGS', 224.0, 249.0, 553.0, 9.76, 21.69),
  ('PM2350MR00', '2018-01I', '2.7', 32.0, 3.6056, 553.0, '2350-1 MRN POLYSTYRENE PICTURE FRAME MOULDINGS', '2350-1 MRN POLYSTYRENE PICTURE FRAME MOULDINGS', 224.0, 249.0, 553.0, 9.76, 21.69),
  ('PM2380BK00', '1034-05C', '2.7', 120.0, 1.0925, 124.0, '2380-BLK POLYSTYRENE PICTURE FRAME MOULDINGS', '2380-BLK POLYSTYRENE PICTURE FRAME MOULDINGS', 51.0, 56.0, 124.0, 2.19, 4.86),
  ('PM2380BL00', '1034-12G', '2.7', 120.0, 1.0925, 124.0, '2380-4-BLUE POLYSTYRENE PICTURE FRAME MOULDINGS', '2380-4-BLUE POLYSTYRENE PICTURE FRAME MOULDINGS', 51.0, 56.0, 124.0, 2.19, 4.86),
  ('PM2380GR00', '1034-12Q', '2.7', 120.0, 1.0925, 124.0, '2380-2-GRN POLYSTYRENE PICTURE FRAME MOULDINGS', '2380-2-GRN POLYSTYRENE PICTURE FRAME MOULDINGS', 51.0, 56.0, 124.0, 2.19, 4.86),
  ('PM2380MR00', '1034-H', '2.7', 120.0, 1.0925, 124.0, '2380-5-MRN POLYSTYRENE PICTURE FRAME MOULDINGS', '2380-5-MRN POLYSTYRENE PICTURE FRAME MOULDINGS', 51.0, 56.0, 124.0, 2.19, 4.86),
  ('PM2380NA00', '1034-14N', '2.7', 120.0, 1.0925, 124.0, '2380-7-NTR POLYSTYRENE PICTURE FRAME MOULDINGS', '2380-7-NTR POLYSTYRENE PICTURE FRAME MOULDINGS', 51.0, 56.0, 124.0, 2.19, 4.86),
  ('PM2380PK00', '1034-35L', '2.7', 120.0, 1.0925, 124.0, '2380-PINK POLYSTYRENE PICTURE FRAME MOULDINGS', '2380-PINK POLYSTYRENE PICTURE FRAME MOULDINGS', 51.0, 56.0, 124.0, 2.19, 4.86),
  ('PM2380RD00', '1034-05G', '2.7', 120.0, 1.0925, 124.0, '2380-3-RED POLYSTYRENE PICTURE FRAME MOULDINGSED', '2380-3-RED POLYSTYRENE PICTURE FRAME MOULDINGSED', 51.0, 56.0, 124.0, 2.19, 4.86),
  ('PM2380MMBL', '1034-111S', '2.7', 120.0, 1.0925, 127.0, '2380-MB-METBLUE POLYSTYRENE PICTURE FRAME MOULDINGS', '2380-MB-METBLUE POLYSTYRENE PICTURE FRAME MOULDINGS', 52.0, 58.0, 127.0, 2.24, 4.98),
  ('PM2380MMPK', '1034-111K', '2.7', 120.0, 1.0925, 127.0, '2380-MP-METPINK POLYSTYRENE PICTURE FRAME MOULDINGS', '2380-MP-METPINK POLYSTYRENE PICTURE FRAME MOULDINGS', 52.0, 58.0, 127.0, 2.24, 4.98),
  ('PM2380MMRD', '1034-33S', '2.7', 120.0, 1.0925, 127.0, '2380-MR-MET RED POLYSTYRENE PICTURE FRAME MOULDINGS', '2380-MR-MET RED POLYSTYRENE PICTURE FRAME MOULDINGS', 52.0, 58.0, 127.0, 2.24, 4.98),
  ('PM2388BR00', '3004-02W', '2.7', 32.0, 4.99415, 664.0, '2388-BRN POLYSTYRENE PICTURE FRAME MOULDINGS', '2388-BRN POLYSTYRENE PICTURE FRAME MOULDINGS', 269.0, 299.0, 664.0, 11.72, 26.04),
  ('PM2389BR00', '3007-13X', '2.7', 28.0, 5.206, 779.0, '2389-BRN POLYSTYRENE PICTURE FRAME MOULDINGS', '2389-BRN POLYSTYRENE PICTURE FRAME MOULDINGS', 316.0, 351.0, 779.0, 13.75, 30.55),
  ('PM2393GD00', '2393-39S', '2.7', 32.0, 4.2693, 519.0, '2393-39S-GLD POLYSTYRENE PICTURE FRAME MOULDINGS', '2393-39S-GLD POLYSTYRENE PICTURE FRAME MOULDINGS', 210.0, 234.0, 519.0, 9.16, 20.35),
  ('PM2396BR00', '2396-40A', '2.7', 28.0, 4.9305, 596.0, '2396-40A BRN POLYSTYRENE PICTURE FRAME MOULDINGS', '2396-40A BRN POLYSTYRENE PICTURE FRAME MOULDINGS', 242.0, 268.0, 596.0, 10.52, 23.37),
  ('PM2396MR00', '2396-40B', '2.7', 28.0, 4.9305, 596.0, '2396-40B MRN POLYSTYRENE PICTURE FRAME MOULDINGS', '2396-40B MRN POLYSTYRENE PICTURE FRAME MOULDINGS', 242.0, 268.0, 596.0, 10.52, 23.37),
  ('PM2403GD00', '3006-01D', '2.7', 24.0, 4.8735, 798.0, '2403-GOLD POLYSTYRENE PICTURE FRAME MOULDINGS', '2403-GOLD POLYSTYRENE PICTURE FRAME MOULDINGS', 323.0, 359.0, 798.0, 14.08, 31.29),
  ('PM2403MR00', '3006-01F', '2.7', 24.0, 4.8735, 798.0, '2403-1-MRN POLYSTYRENE PICTURE FRAME MOULDINGS', '2403-1-MRN POLYSTYRENE PICTURE FRAME MOULDINGS', 323.0, 359.0, 798.0, 14.08, 31.29),
  ('PM2439WT00', '2439-X', '2.7', 20.0, 5.985, 760.0, '2439-WHITE POLYSTYRENE PICTURE FRAME MOULDINGS', '2439-WHITE POLYSTYRENE PICTURE FRAME MOULDINGS', 308.0, 343.0, 760.0, 13.41, 29.8),
  ('PM2440BK00', '1031-05C', '2.7', 182.0, 0.8902, 107.0, '2440-5-BLK POLYSTYRENE PICTURE FRAME MOULDINGS', '2440-5-BLK POLYSTYRENE PICTURE FRAME MOULDINGS', 44.0, 48.0, 107.0, 1.89, 4.2),
  ('PM2440MR00', '1031-H', '2.7', 182.0, 0.8902, 107.0, '2440-2 MRN POLYSTYRENE PICTURE FRAME MOULDINGS', '2440-2 MRN POLYSTYRENE PICTURE FRAME MOULDINGS', 44.0, 48.0, 107.0, 1.89, 4.2),
  ('PM2440NA00', '1031-03C', '2.7', 182.0, 0.8902, 107.0, '2440-8-NTR POLYSTYRENE PICTURE FRAME MOULDINGS', '2440-8-NTR POLYSTYRENE PICTURE FRAME MOULDINGS', 44.0, 48.0, 107.0, 1.89, 4.2),
  ('PM2440OR00', '1031-12H ', '2.7', 182.0, 0.8902, 107.0, '2440-4 ORS POLYSTYRENE PICTURE FRAME MOULDINGS', '2440-4 ORS POLYSTYRENE PICTURE FRAME MOULDINGS', 44.0, 48.0, 107.0, 1.89, 4.2),
  ('PM2440WT00', '1031-02Q', '2.7', 182.0, 0.8902, 107.0, '2440-WHITE POLYSTYRENE PICTURE FRAME MOULDINGS', '2440-WHITE POLYSTYRENE PICTURE FRAME MOULDINGS', 44.0, 48.0, 107.0, 1.89, 4.2),
  ('PM2441GD00', '2013-01D', '2.7', 54.0, 2.6885, 320.0, '2441-GOLD POLYSTYRENE PICTURE FRAME MOULDINGS', '2441-GOLD POLYSTYRENE PICTURE FRAME MOULDINGS', 129.0, 144.0, 320.0, 5.65, 12.55),
  ('PM2441MR00', '2013-01F', '2.7', 54.0, 2.6885, 320.0, '2441-MRN POLYSTYRENE PICTURE FRAME MOULDINGS', '2441-MRN POLYSTYRENE PICTURE FRAME MOULDINGS', 129.0, 144.0, 320.0, 5.65, 12.55),
  ('PM2442GD00', '1032-20P', '2.7', 90.0, 1.558, 212.0, '2442-8-GOLD POLYSTYRENE PICTURE FRAME MOULDINGS', '2442-8-GOLD POLYSTYRENE PICTURE FRAME MOULDINGS', 86.0, 96.0, 212.0, 3.74, 8.31),
  ('PM2442MR00', '1032-15U', '2.7', 90.0, 1.558, 212.0, '2442-MRN POLYSTYRENE PICTURE FRAME MOULDINGS', '2442-MRN POLYSTYRENE PICTURE FRAME MOULDINGS', 86.0, 96.0, 212.0, 3.74, 8.31),
  ('PM246NA000', '2116-01M', '2.7', 55.0, 2.4415, 325.0, '246-5-NTR POLYSTYRENE PICTURE FRAME MOULDINGS', '246-5-NTR POLYSTYRENE PICTURE FRAME MOULDINGS', 132.0, 146.0, 325.0, 5.74, 12.75),
  ('PM246WT000', '2116-25VG ', '2.7', 55.0, 2.4415, 325.0, '246-7-WHT POLYSTYRENE PICTURE FRAME MOULDINGS', '246-7-WHT POLYSTYRENE PICTURE FRAME MOULDINGS', 132.0, 146.0, 325.0, 5.74, 12.75),
  ('PM2461GD00', '2461-12Z', '2.7', 24.0, 5.795, 689.0, '2461-12Z-GOLD POLYSTYRENE PICTURE FRAME MOULDINGS', '2461-12Z-GOLD POLYSTYRENE PICTURE FRAME MOULDINGS', 279.0, 311.0, 689.0, 12.16, 27.02),
  ('PM2498BGD0', '2498-BG', '2.7', 30.0, 3.9235, 512.0, '2498-BG-BGLD POLYSTYRENE PICTURE FRAME MOULDINGS', '2498-BG-BGLD POLYSTYRENE PICTURE FRAME MOULDINGS', 207.0, 231.0, 512.0, 9.04, 20.08),
  ('PM2558GD00', '2558-3005 GOLD', '2.7', 34.0, 3.895, 508.0, '2558-3005 GOLD POLYSTYRENE PICTURE FRAME MOULDINGS', '2558-3005 GOLD POLYSTYRENE PICTURE FRAME MOULDINGS', 205.0, 228.0, 508.0, 8.96, 19.92),
  ('PM2565BR00', '2565-113P', '2.7', 30.0, 4.37, 589.0, '2565-113P-BRN POLYSTYRENE PICTURE FRAME MOULDINGS', '2565-113P-BRN POLYSTYRENE PICTURE FRAME MOULDINGS', 239.0, 265.0, 589.0, 10.39, 23.1),
  ('PM2572BR00', '2572-114M', '2.7', 24.0, 4.864, 621.0, '2572-114M-BRN POLYSTYRENE PICTURE FRAME MOULDINGS', '2572-114M-BRN POLYSTYRENE PICTURE FRAME MOULDINGS', 252.0, 279.0, 621.0, 10.96, 24.35),
  ('PM2576GD00', '2576.0', '2.7', 38.0, 3.439, 497.0, '2576-GOLD POLYSTYRENE PICTURE FRAME MOULDINGS', '2576-GOLD POLYSTYRENE PICTURE FRAME MOULDINGS', 201.0, 224.0, 497.0, 8.77, 19.49),
  ('PM2588WT00', '2588-114L WHT', NULL, NULL, NULL, 536.0, '2588-114L WHT POLYSTYRENE PICTURE FRAME MOULDINGS', '2588-114L WHT POLYSTYRENE PICTURE FRAME MOULDINGS', 217.0, 241.0, 536.0, 9.46, 21.02),
  ('PM2605GD00', '2605-GOLD', '2.7', 21.0, 5.415, 745.0, '2605-130A-GOLD POLYSTYRENE PICTURE FRAME MOULDINGS', '2605-130A-GOLD POLYSTYRENE PICTURE FRAME MOULDINGS', 302.0, 335.0, 745.0, 13.15, 29.22),
  ('PM2625LC00', '2625-113M-5', '2.7', 21.0, 4.902, 634.0, '2625-113M-LC POLYSTYRENE PICTURE FRAME MOULDINGS', '2625-113M-LC POLYSTYRENE PICTURE FRAME MOULDINGS', 257.0, 285.0, 634.0, 11.19, 24.86),
  ('PM2630LBL0', '2630-127R', '2.7', 35.0, 3.8, 497.0, '2630-127R-LBLU POLYSTYRENE PICTURE FRAME MOULDINGS', '2630-127R-LBLU POLYSTYRENE PICTURE FRAME MOULDINGS', 201.0, 224.0, 497.0, 8.77, 19.49),
  ('PM2630LC00', '2630-113M-5', '2.7', 35.0, 3.8, 497.0, '2630-113W-5-LC POLYSTYRENE PICTURE FRAME MOULDINGS', '2630-113W-5-LC POLYSTYRENE PICTURE FRAME MOULDINGS', 201.0, 224.0, 497.0, 8.77, 19.49),
  ('PM2640WT00', '2640-113C', '2.7', 20.0, 6.4885, 798.0, '2640-113C-B-WHT POLYSTYRENE PICTURE FRAME MOULDINGS', '2640-113C-B-WHT POLYSTYRENE PICTURE FRAME MOULDINGS', 323.0, 359.0, 798.0, 14.08, 31.29),
  ('PM2691GD00', '2691-90UD', '2.7', 50.0, 2.375, 304.0, '2691-90U5-GLD POLYSTYRENE PICTURE FRAME MOULDINGS', '2691-90U5-GLD POLYSTYRENE PICTURE FRAME MOULDINGS', 124.0, 137.0, 304.0, 5.36, 11.92),
  ('PM2694BGD0', '2694-120D', '2.7', 30.0, 4.123, 522.0, '2694-120D-BGLD POLYSTYRENE PICTURE FRAME MOULDINGS', '2694-120D-BGLD POLYSTYRENE PICTURE FRAME MOULDINGS', 212.0, 235.0, 522.0, 9.21, 20.47),
  ('PM2749BK', '2749-B2', '2.7', 64.0, 2.5365, 351.0, '2749-B2-BLK POLYSTYRENE PICTURE FRAME MOULDINGS', '2749-B2-BLK POLYSTYRENE PICTURE FRAME MOULDINGS', 143.0, 158.0, 351.0, 6.19, 13.76),
  ('PM2749BRWT', '2749-113P', '2.7', 64.0, 2.5365, 351.0, '2749-113P-BWHT POLYSTYRENE PICTURE FRAME MOULDINGS', '2749-113P-BWHT POLYSTYRENE PICTURE FRAME MOULDINGS', 143.0, 158.0, 351.0, 6.19, 13.76),
  ('PM2749LBR0', '2749-079-5', '2.7', 64.0, 2.5365, 351.0, '2749-079-5-LBRN POLYSTYRENE PICTURE FRAME MOULDINGS', '2749-079-5-LBRN POLYSTYRENE PICTURE FRAME MOULDINGS', 143.0, 158.0, 351.0, 6.19, 13.76),
  ('PM2751BK00', '2751-BG-1', '2.7', 56.0, 2.736, 373.0, '2751-BG-1-BLK POLYSTYRENE PICTURE FRAME MOULDINGS', '2751-BG-1-BLK POLYSTYRENE PICTURE FRAME MOULDINGS', 152.0, 168.0, 373.0, 6.58, 14.63),
  ('PM2751WT00', '2751-177', '2.7', 56.0, 2.736, 373.0, '2751-177-WHT POLYSTYRENE PICTURE FRAME MOULDINGS', '2751-177-WHT POLYSTYRENE PICTURE FRAME MOULDINGS', 152.0, 168.0, 373.0, 6.58, 14.63),
  ('PM2781NA00', '2781-135H', '2.7', 26.0, 4.731, 683.0, '2781-135H-NTR POLYSTYRENE PICTURE FRAME MOULDINGS', '2781-135H-NTR POLYSTYRENE PICTURE FRAME MOULDINGS', 277.0, 307.0, 683.0, 12.05, 26.78),
  ('PM2804BR00', '2804-139O', '2.7', 50.0, 2.698, 328.0, '2804-1390-BRN POLYSTYRENE PICTURE FRAME MOULDINGS', '2804-1390-BRN POLYSTYRENE PICTURE FRAME MOULDINGS', 133.0, 148.0, 328.0, 5.79, 12.86),
  ('PM2812BK00', '2812-132B', '2.7', 42.0, 2.6125, 343.0, '2812-132B-BLK POLYSTYRENE PICTURE FRAME MOULDINGS', '2812-132B-BLK POLYSTYRENE PICTURE FRAME MOULDINGS', 139.0, 154.0, 343.0, 6.05, 13.45),
  ('PM2812GY00', '2812-058-3', '2.7', 42.0, 2.6125, 343.0, '2812-058-3 GREY POLYSTYRENE PICTURE FRAME MOULDINGS', '2812-058-3 GREY POLYSTYRENE PICTURE FRAME MOULDINGS', 139.0, 154.0, 343.0, 6.05, 13.45),
  ('PM2812GR00', '2812-02Q-3', '2.7', 42.0, 2.6125, 343.0, '2812-02Q-3-GRN POLYSTYRENE PICTURE FRAME MOULDINGS', '2812-02Q-3-GRN POLYSTYRENE PICTURE FRAME MOULDINGS', 139.0, 154.0, 343.0, 6.05, 13.45),
  ('PM2812NA00', '2812-058-1', '2.7', 42.0, 2.6125, 343.0, '2812-058-1 NTR POLYSTYRENE PICTURE FRAME MOULDINGS', '2812-058-1 NTR POLYSTYRENE PICTURE FRAME MOULDINGS', 139.0, 154.0, 343.0, 6.05, 13.45),
  ('PM2832BK00', '2832-B1', '2.7', 34.0, 4.56, 485.0, '2832-B1-BLK POLYSTYRENE PICTURE FRAME MOULDINGS', '2832-B1-BLK POLYSTYRENE PICTURE FRAME MOULDINGS', 199.0, 218.0, 485.0, 8.56, 19.02),
  ('PM2832WT00', '2832-02Q-1', '2.7', 34.0, 4.56, 485.0, '2832-02Q-WHITE POLYSTYRENE PICTURE FRAME MOULDINGS', '2832-02Q-WHITE POLYSTYRENE PICTURE FRAME MOULDINGS', 199.0, 218.0, 485.0, 8.56, 19.02),
  ('PM2833GD00', '2833-140D', '2.7', 35.0, 4.94, 653.0, '2833-140D GOLD POLYSTYRENE PICTURE FRAME MOULDINGS', '2833-140D GOLD POLYSTYRENE PICTURE FRAME MOULDINGS', 264.0, 294.0, 653.0, 11.52, 25.61),
  ('PM2851BK00', '2851-B2', '2.7', 28.0, 5.5575, 616.0, '2851-B2-BLK POLYSTYRENE PICTURE FRAME MOULDINGS', '2851-B2-BLK POLYSTYRENE PICTURE FRAME MOULDINGS', 249.0, 277.0, 616.0, 10.87, 24.16),
  ('PM2851DBR0', '2851-140Y', '2.7', 28.0, 5.5575, 616.0, '2851-140Y-DBRN POLYSTYRENE PICTURE FRAME MOULDINGS', '2851-140Y-DBRN POLYSTYRENE PICTURE FRAME MOULDINGS', 249.0, 277.0, 616.0, 10.87, 24.16),
  ('PM2851MR00', '2851-02E', '2.7', 28.0, 5.5575, 616.0, '2851-02E-MRN POLYSTYRENE PICTURE FRAME MOULDINGS', '2851-02E-MRN POLYSTYRENE PICTURE FRAME MOULDINGS', 249.0, 277.0, 616.0, 10.87, 24.16),
  ('PM2861MR00', '2861-32G', '2.7', 32.0, 3.99, 515.0, '2861-32G MRN POLYSTYRENE PICTURE FRAME MOULDINGS', '2861-32G MRN POLYSTYRENE PICTURE FRAME MOULDINGS', 208.0, 232.0, 515.0, 9.08, 20.2),
  ('PM2895BL00', '2895-255-1', '2.7', 30.0, 4.332, 535.0, '2895-255-1 BLUE POLYSTYRENE PICTURE FRAME MOULDINGS', '2895-255-1 BLUE POLYSTYRENE PICTURE FRAME MOULDINGS', 216.0, 241.0, 535.0, 9.44, 20.98),
  ('PM2895BR00', '2895-255', '2.7', 30.0, 4.332, 535.0, '2895-255 BRN POLYSTYRENE PICTURE FRAME MOULDINGS', '2895-255 BRN POLYSTYRENE PICTURE FRAME MOULDINGS', 216.0, 241.0, 535.0, 9.44, 20.98),
  ('PM2895WT', '2895-6241', '2.7', 30.0, 4.332, 535.0, '2895-6241 WHT POLYSTYRENE PICTURE FRAME MOULDINGS', '2895-6241 WHT POLYSTYRENE PICTURE FRAME MOULDINGS', 216.0, 241.0, 535.0, 9.44, 20.98),
  ('PM2905GD00', '2905-132I', '2.7', 17.0, 8.417, 1039.0, '2905-132I GOLD POLYSTYRENE PICTURE FRAME MOULDINGS', '2905-132I GOLD POLYSTYRENE PICTURE FRAME MOULDINGS', 421.0, 468.0, 1039.0, 18.34, 40.75),
  ('PM2905XSGD', '2905-132IXS', '2.7', 17.0, 8.417, 1039.0, '2905-132IXS GOLD POLYSTYRENE PICTURE FRAME MOULDINGS', '2905-132IXS GOLD POLYSTYRENE PICTURE FRAME MOULDINGS', 421.0, 468.0, 1039.0, 18.34, 40.75),
  ('PM2905SV00', '2905-250XS', '2.7', 17.0, 8.417, 1039.0, '2905-250XS SLV POLYSTYRENE PICTURE FRAME MOULDINGS', '2905-250XS SLV POLYSTYRENE PICTURE FRAME MOULDINGS', 421.0, 468.0, 1039.0, 18.34, 40.75),
  ('PM2950BK00', '2950-B-1', '2.7', 38.0, 3.496, 439.0, '2950-B-1 BLK POLYSTYRENE PICTURE FRAME MOULDINGS', '2950-B-1 BLK POLYSTYRENE PICTURE FRAME MOULDINGS', 177.0, 197.0, 439.0, 7.75, 17.22),
  ('PM2950LC00', '2950-138M', '2.7', 38.0, 3.496, 439.0, '2950-138M LC POLYSTYRENE PICTURE FRAME MOULDINGS', '2950-138M LC POLYSTYRENE PICTURE FRAME MOULDINGS', 177.0, 197.0, 439.0, 7.75, 17.22),
  ('PM2950WT00', '2950-02Q-1', '2.7', 38.0, 3.496, 439.0, '2950-02Q-1 WHITE POLYSTYRENE PICTURE FRAME MOULDINGS', '2950-02Q-1 WHITE POLYSTYRENE PICTURE FRAME MOULDINGS', 177.0, 197.0, 439.0, 7.75, 17.22),
  ('PM3008BR00', '3008-01N', '2.7', 15.0, 7.809, 968.0, '3008-01N BRN POLYSTYRENE PICTURE FRAME MOULDINGS', '3008-01N BRN POLYSTYRENE PICTURE FRAME MOULDINGS', 393.0, 436.0, 968.0, 17.08, 37.96),
  ('PM301BK000', '1014-B', '2.7', 72.0, 1.767, 211.0, '301-197-BLK POLYSTYRENE PICTURE FRAME MOULDINGS', '301-197-BLK POLYSTYRENE PICTURE FRAME MOULDINGS', 86.0, 95.0, 211.0, 3.72, 8.27),
  ('PM301MR000', '1014-R', '2.7', 72.0, 1.767, 211.0, '301-205-MRN POLYSTYRENE PICTURE FRAME MOULDINGS', '301-205-MRN POLYSTYRENE PICTURE FRAME MOULDINGS', 86.0, 95.0, 211.0, 3.72, 8.27),
  ('PM301SV000', '1014-02T', '2.7', 72.0, 1.767, 211.0, '301-041-SLV POLYSTYRENE PICTURE FRAME MOULDINGS', '301-041-SLV POLYSTYRENE PICTURE FRAME MOULDINGS', 86.0, 95.0, 211.0, 3.72, 8.27),
  ('PM301WT000', '1014-02Q', '2.7', 72.0, 1.767, 211.0, '301-02Q-WHT POLYSTYRENE PICTURE FRAME MOULDINGS', '301-02Q-WHT POLYSTYRENE PICTURE FRAME MOULDINGS', 86.0, 95.0, 211.0, 3.72, 8.27),
  ('PM3083SV00', '3083-1-37V', '2.7', 18.0, 7.3435, 900.0, '3083-SLV POLYSTYRENE PICTURE FRAME MOULDINGS', '3083-SLV POLYSTYRENE PICTURE FRAME MOULDINGS', 365.0, 405.0, 900.0, 15.88, 35.29),
  ('PM3156GD00', '3156-35G', '2.7', 21.0, 6.4885, 807.0, '3156-GOLD POLYSTYRENE PICTURE FRAME MOULDINGS', '3156-GOLD POLYSTYRENE PICTURE FRAME MOULDINGS', 327.0, 364.0, 807.0, 14.24, 31.65),
  ('PM3156SV00', '3156-03W', '2.7', 21.0, 6.4885, 807.0, '3156-SILVER POLYSTYRENE PICTURE FRAME MOULDINGS', '3156-SILVER POLYSTYRENE PICTURE FRAME MOULDINGS', 327.0, 364.0, 807.0, 14.24, 31.65),
  ('PM3168GD00', '3168-36U', '2.7', 18.0, 6.916, 854.0, '3168-GOLD POLYSTYRENE PICTURE FRAME MOULDINGS', '3168-GOLD POLYSTYRENE PICTURE FRAME MOULDINGS', 346.0, 384.0, 854.0, 15.07, 33.49),
  ('PM3168SV00', '3168-03W', '2.7', 18.0, 6.916, 854.0, '3168-SILVER POLYSTYRENE PICTURE FRAME MOULDINGS', '3168-SILVER POLYSTYRENE PICTURE FRAME MOULDINGS', 346.0, 384.0, 854.0, 15.07, 33.49),
  ('PM3185BR00', '3185-117X', '2.7', 15.0, 7.3435, 900.0, '3185-BRN POLYSTYRENE PICTURE FRAME MOULDINGS', '3185-BRN POLYSTYRENE PICTURE FRAME MOULDINGS', 365.0, 405.0, 900.0, 15.88, 35.29),
  ('PM3185GD00', '3185-37Q', '2.7', 15.0, 7.3435, 900.0, '3185-GOLD POLYSTYRENE PICTURE FRAME MOULDINGS', '3185-GOLD POLYSTYRENE PICTURE FRAME MOULDINGS', 365.0, 405.0, 900.0, 15.88, 35.29),
  ('PM3254BR00', '1034-14L', '2.7', 120.0, 1.0925, 124.0, '325-405-BRN POLYSTYRENE PICTURE FRAME MOULDINGS', '325-405-BRN POLYSTYRENE PICTURE FRAME MOULDINGS', 51.0, 56.0, 124.0, 2.19, 4.86),
  ('PM3256BR00', '1034-02X', '2.7', 120.0, 1.0925, 124.0, '325-605-BRN POLYSTYRENE PICTURE FRAME MOULDINGS', '325-605-BRN POLYSTYRENE PICTURE FRAME MOULDINGS', 51.0, 56.0, 124.0, 2.19, 4.86),
  ('PM325LBL00', '1034-18P', '2.7', 120.0, 1.0925, 124.0, '325-261 LBLUE POLYSTYRENE PICTURE FRAME MOULDINGS', '325-261 LBLUE POLYSTYRENE PICTURE FRAME MOULDINGS', 51.0, 56.0, 124.0, 2.19, 4.86),
  ('PM325MR000', '1034-02V', '2.7', 120.0, 1.0925, 124.0, '325-604-MRN POLYSTYRENE PICTURE FRAME MOULDINGS', '325-604-MRN POLYSTYRENE PICTURE FRAME MOULDINGS', 51.0, 56.0, 124.0, 2.19, 4.86),
  ('PM3283NA00', '3283-114K', '2.7', 27.0, 4.959, 643.0, '3283-114K-NTR POLYSTYRENE PICTURE FRAME MOULDINGS', '3283-114K-NTR POLYSTYRENE PICTURE FRAME MOULDINGS', 261.0, 289.0, 643.0, 11.35, 25.22),
  ('PM3283WT00', '3283-02Q', '2.7', 27.0, 4.959, 643.0, '3283-02Q-WHT POLYSTYRENE PICTURE FRAME MOULDINGS', '3283-02Q-WHT POLYSTYRENE PICTURE FRAME MOULDINGS', 261.0, 289.0, 643.0, 11.35, 25.22),
  ('PM3283SA60', '3283-SA6', '2.7', 27.0, 4.959, 643.0, '3283-SA6 POLYSTYRENE PICTURE FRAME MOULDINGS', '3283-SA6 POLYSTYRENE PICTURE FRAME MOULDINGS', 261.0, 289.0, 643.0, 11.35, 25.22),
  ('PM329MR000', '1067-01F', '2.7', 64.0, 1.9855, 236.0, '329-158-MRN POLYSTYRENE PICTURE FRAME MOULDINGS', '329-158-MRN POLYSTYRENE PICTURE FRAME MOULDINGS', 96.0, 106.0, 236.0, 4.16, 9.25),
  ('PM3318BR00', '1019-02T', '2.7', 85.0, NULL, 207.0, '3318-2-BRN POLYSTYRENE PICTURE FRAME MOULDINGS', '3318-2-BRN POLYSTYRENE PICTURE FRAME MOULDINGS', 84.0, 94.0, 207.0, 3.65, 8.12),
  ('PM38NA0000', '2114-01M', '2.7', 88.0, 1.71, 270.0, '38-5-NTR POLYSTYRENE PICTURE FRAME MOULDINGS', '38-5-NTR POLYSTYRENE PICTURE FRAME MOULDINGS', 110.0, 122.0, 270.0, 4.76, 10.59),
  ('PM38WT0000', '2114-25VG', '2.7', 88.0, 1.71, 270.0, '38-7-WHT POLYSTYRENE PICTURE FRAME MOULDINGS', '38-7-WHT POLYSTYRENE PICTURE FRAME MOULDINGS', 110.0, 122.0, 270.0, 4.76, 10.59),
  ('PM38TELA00', '2114-13YG', '2.7', 88.0, 1.71, 270.0, '38-TELA-LR1 POLYSTYRENE PICTURE FRAME MOULDINGS', '38-TELA-LR1 POLYSTYRENE PICTURE FRAME MOULDINGS', 110.0, 122.0, 270.0, 4.76, 10.59),
  ('PM402BK000', '1035-B', '2.7', 80.0, 1.7039, 208.0, '402-197-BLK POLYSTYRENE PICTURE FRAME MOULDINGS', '402-197-BLK POLYSTYRENE PICTURE FRAME MOULDINGS', 84.0, 94.0, 208.0, 3.67, 8.16),
  ('PM402BL000', '1035-14K ', '2.7', 80.0, 1.7039, 208.0, '402-533-BLU POLYSTYRENE PICTURE FRAME MOULDINGS', '402-533-BLU POLYSTYRENE PICTURE FRAME MOULDINGS', 84.0, 94.0, 208.0, 3.67, 8.16),
  ('PM402BR000', '1035-14L ', '2.7', 80.0, 1.7039, 208.0, '402-405-BRN POLYSTYRENE PICTURE FRAME MOULDINGS', '402-405-BRN POLYSTYRENE PICTURE FRAME MOULDINGS', 84.0, 94.0, 208.0, 3.67, 8.16),
  ('PM402MR000', '1035-15U', '2.7', 80.0, 1.7039, 208.0, '402-518-MRN POLYSTYRENE PICTURE FRAME MOULDINGS', '402-518-MRN POLYSTYRENE PICTURE FRAME MOULDINGS', 84.0, 94.0, 208.0, 3.67, 8.16),
  ('PM456BR000', '2014-01G', '2.7', 45.0, 2.9545, 382.0, '456-651-BRN POLYSTYRENE PICTURE FRAME MOULDINGS', '456-651-BRN POLYSTYRENE PICTURE FRAME MOULDINGS', 155.0, 172.0, 382.0, 6.74, 14.98),
  ('PM456MR000', '2014-01T', '2.7', 45.0, 2.9545, 382.0, '456-645-MRN POLYSTYRENE PICTURE FRAME MOULDINGS', '456-645-MRN POLYSTYRENE PICTURE FRAME MOULDINGS', 155.0, 172.0, 382.0, 6.74, 14.98),
  ('PM6044BR00', '6044-137N', '2.7', 64.0, 2.3275, 335.0, '6044-137N-BRN POLYSTYRENE PICTURE FRAME MOULDINGS', '6044-137N-BRN POLYSTYRENE PICTURE FRAME MOULDINGS', 136.0, 152.0, 335.0, 5.91, 13.14),
  ('PM6082FBK0', '6082-315F', '2.7', 96.0, 1.349, 164.0, '6082-315F-BLK POLYSTYRENE PICTURE FRAME MOULDINGS', '6082-315F-BLK POLYSTYRENE PICTURE FRAME MOULDINGS', 66.0, 75.0, 164.0, 2.89, 6.43),
  ('PM6082BBK0', '6082-320B', '2.7', 96.0, 1.349, 164.0, '6082-320B-BLK POLYSTYRENE PICTURE FRAME MOULDINGS', '6082-320B-BLK POLYSTYRENE PICTURE FRAME MOULDINGS', 66.0, 75.0, 164.0, 2.89, 6.43),
  ('PM6082DGD0', '6082-319D', '2.7', 96.0, 1.349, 164.0, '6082-319D-GLD POLYSTYRENE PICTURE FRAME MOULDINGS', '6082-319D-GLD POLYSTYRENE PICTURE FRAME MOULDINGS', 66.0, 75.0, 164.0, 2.89, 6.43),
  ('PM6082GGD0', '6082-315G', '2.7', 96.0, 1.349, 164.0, '6082-315G-GOLD POLYSTYRENE PICTURE FRAME MOULDINGS', '6082-315G-GOLD POLYSTYRENE PICTURE FRAME MOULDINGS', 66.0, 75.0, 164.0, 2.89, 6.43),
  ('PM6082LBR0', '6082-315L', '2.7', 96.0, 1.349, 164.0, '6082-315L-LBRN POLYSTYRENE PICTURE FRAME MOULDINGS', '6082-315L-LBRN POLYSTYRENE PICTURE FRAME MOULDINGS', 66.0, 75.0, 164.0, 2.89, 6.43),
  ('PM6082MR00', '6082-320A', '2.7', 96.0, 1.349, 164.0, '6082-320A-MRN POLYSTYRENE PICTURE FRAME MOULDINGS', '6082-320A-MRN POLYSTYRENE PICTURE FRAME MOULDINGS', 66.0, 75.0, 164.0, 2.89, 6.43),
  ('PM6084BK00', '6084-352B', '2.7', 96.0, 1.3015, 164.0, '6084-325B-BLK POLYSTYRENE PICTURE FRAME MOULDINGS', '6084-325B-BLK POLYSTYRENE PICTURE FRAME MOULDINGS', 66.0, 75.0, 164.0, 2.89, 6.43),
  ('PM6084BR00', '6084-352A', '2.7', 96.0, 1.3015, 164.0, '6084-352A-BRN POLYSTYRENE PICTURE FRAME MOULDINGS', '6084-352A-BRN POLYSTYRENE PICTURE FRAME MOULDINGS', 66.0, 75.0, 164.0, 2.89, 6.43),
  ('PM6086BL00', '6086-135U-1', '2.7', 49.0, 2.5175, 331.0, '6086-135U-1-BLUE POLYSTYRENE PICTURE FRAME MOULDINGS', '6086-135U-1-BLUE POLYSTYRENE PICTURE FRAME MOULDINGS', 133.0, 148.0, 331.0, 5.84, 12.98),
  ('PM6086BZ00', '6086-079-5', '2.7', 49.0, 2.5175, 331.0, '6086-079-5-BRONZE POLYSTYRENE PICTURE FRAME MOULDINGS', '6086-079-5-BRONZE POLYSTYRENE PICTURE FRAME MOULDINGS', 133.0, 148.0, 331.0, 5.84, 12.98),
  ('PM6086GY00', '6086-135U', '2.7', 49.0, 2.5175, 331.0, '6086-135U-GREY POLYSTYRENE PICTURE FRAME MOULDINGS', '6086-135U-GREY POLYSTYRENE PICTURE FRAME MOULDINGS', 133.0, 148.0, 331.0, 5.84, 12.98),
  ('PM6086LC00', '6086-059-2', '2.7', 49.0, 2.5175, 331.0, '6086-059-2-LC POLYSTYRENE PICTURE FRAME MOULDINGS', '6086-059-2-LC POLYSTYRENE PICTURE FRAME MOULDINGS', 133.0, 148.0, 331.0, 5.84, 12.98),
  ('PM6123113N', '6123-113N', '2.7', 72.0, 2.0425, NULL, '6123-113N POLYSTYRENE PICTURE FRAME MOULDINGS', '6123-113N POLYSTYRENE PICTURE FRAME MOULDINGS', NULL, 117.0, NULL, NULL, NULL),
  ('PM6123140G', '6123-140G', '2.7', 72.0, 2.0425, NULL, '6123-140G POLYSTYRENE PICTURE FRAME MOULDINGS', '6123-140G POLYSTYRENE PICTURE FRAME MOULDINGS', NULL, 117.0, NULL, NULL, NULL),
  ('PM6123140X', '6123-140X', '2.7', 72.0, 2.0425, NULL, '6123-140X POLYSTYRENE PICTURE FRAME MOULDINGS', '6123-140X POLYSTYRENE PICTURE FRAME MOULDINGS', NULL, 117.0, NULL, NULL, NULL),
  ('PM61231401', '6123-140G-1', '2.7', 72.0, 2.0425, NULL, '6123-140G-1 POLYSTYRENE PICTURE FRAME MOULDINGS', '6123-140G-1 POLYSTYRENE PICTURE FRAME MOULDINGS', NULL, 117.0, NULL, NULL, NULL),
  ('PM6123B000', '6123-B', '2.7', 72.0, 2.0425, NULL, '6123-B POLYSTYRENE PICTURE FRAME MOULDINGS', '6123-B POLYSTYRENE PICTURE FRAME MOULDINGS', NULL, 117.0, NULL, NULL, NULL),
  ('PM6123K000', '6123-K', '2.7', 72.0, 2.0425, NULL, '6123-K POLYSTYRENE PICTURE FRAME MOULDINGS', '6123-K POLYSTYRENE PICTURE FRAME MOULDINGS', NULL, 117.0, NULL, NULL, NULL),
  ('PM6187DBK0', '6187D-056-1', '2.7', 77.0, 1.7575, 237.0, '6187D-056-1 BLK POLYSTYRENE PICTURE FRAME MOULDINGS', '6187D-056-1 BLK POLYSTYRENE PICTURE FRAME MOULDINGS', 96.0, 106.0, 237.0, 4.18, 9.29),
  ('PM6187DBL0', '6187D-002-5', '2.7', 77.0, 1.7575, 237.0, '6187D-002-5 BLUE POLYSTYRENE PICTURE FRAME MOULDINGS', '6187D-002-5 BLUE POLYSTYRENE PICTURE FRAME MOULDINGS', 96.0, 106.0, 237.0, 4.18, 9.29),
  ('PM6187DWT0', '6187D-003-4', '2.7', 77.0, 1.7575, 237.0, '6187D-003-4 WHITE POLYSTYRENE PICTURE FRAME MOULDINGS', '6187D-003-4 WHITE POLYSTYRENE PICTURE FRAME MOULDINGS', 96.0, 106.0, 237.0, 4.18, 9.29),
  ('PM6248BK00', '6248-B1', '2.7', 49.0, 2.926, 385.0, '6248-B1 BLK POLYSTYRENE PICTURE FRAME MOULDINGS', '6248-B1 BLK POLYSTYRENE PICTURE FRAME MOULDINGS', 155.0, 173.0, 385.0, 6.79, 15.1),
  ('PM643MR000', '2082-13W', '2.7', 100.0, 1.615, 208.0, '643-929-MRN POLYSTYRENE PICTURE FRAME MOULDINGS', '643-929-MRN POLYSTYRENE PICTURE FRAME MOULDINGS', 84.0, 94.0, 208.0, 3.67, 8.16),
  ('PM795BL000', '1018-02N', '2.7', 100.0, 1.4725, 189.0, '795-510-BLUE POLYSTYRENE PICTURE FRAME MOULDINGS', '795-510-BLUE POLYSTYRENE PICTURE FRAME MOULDINGS', 77.0, 85.0, 189.0, 3.34, 7.41),
  ('PM795GR000', '1018-02M', '2.7', 100.0, 1.4725, 189.0, '795-511-GRN POLYSTYRENE PICTURE FRAME MOULDINGS', '795-511-GRN POLYSTYRENE PICTURE FRAME MOULDINGS', 77.0, 85.0, 189.0, 3.34, 7.41),
  ('PM795MR000', '1018-14B', '2.7', 100.0, 1.4725, 189.0, '795-535-MRN POLYSTYRENE PICTURE FRAME MOULDINGS', '795-535-MRN POLYSTYRENE PICTURE FRAME MOULDINGS', 77.0, 85.0, 189.0, 3.34, 7.41);

SELECT string_agg(required_name, ', ' ORDER BY required_name)
INTO v_missing
FROM (
  SELECT 'company 1e10e2dd-655e-41e0-a508-edfd660a9bcf' AS required_name
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.companies
    WHERE id = '1e10e2dd-655e-41e0-a508-edfd660a9bcf'
      AND deleted_at IS NULL
  )
  UNION ALL
  SELECT 'UOM STICK'
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.units_of_measure
    WHERE company_id = '1e10e2dd-655e-41e0-a508-edfd660a9bcf'
      AND UPPER(code) = 'STICK'
      AND deleted_at IS NULL
  )
  UNION ALL
  SELECT 'UOM BOX'
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.units_of_measure
    WHERE company_id = '1e10e2dd-655e-41e0-a508-edfd660a9bcf'
      AND UPPER(code) = 'BOX'
      AND deleted_at IS NULL
  )
  UNION ALL
  SELECT 'item category MOLD'
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.item_categories
    WHERE company_id = '1e10e2dd-655e-41e0-a508-edfd660a9bcf'
      AND code = 'MOLD'
      AND deleted_at IS NULL
  )
) missing_records;

IF v_missing IS NOT NULL THEN
  RAISE EXCEPTION 'Polystyrene moulding import prerequisite records are missing: %', v_missing;
END IF;

PERFORM setval(
  'public.item_unit_option_barcode_seq',
  GREATEST(
    (SELECT COALESCE(last_value, 1) FROM public.item_unit_option_barcode_seq),
    (SELECT COUNT(*) + 10000 FROM public.item_unit_options)
  ),
  TRUE
);

WITH constants AS (
  SELECT
    '1e10e2dd-655e-41e0-a508-edfd660a9bcf'::UUID AS company_id,
    uom_stick.id AS stick_uom_id,
    category.id AS category_id
  FROM public.units_of_measure uom_stick
  JOIN public.item_categories category
    ON category.company_id = uom_stick.company_id
   AND category.code = 'MOLD'
   AND category.deleted_at IS NULL
  WHERE uom_stick.company_id = '1e10e2dd-655e-41e0-a508-edfd660a9bcf'
    AND UPPER(uom_stick.code) = 'STICK'
    AND uom_stick.deleted_at IS NULL
)
INSERT INTO public.items (
  company_id, item_code, item_name, description, category_id, uom_id,
  item_type, purchase_price, sales_price, supplier_code, is_stock_item,
  track_serial, track_batch, is_active, material, custom_fields
)
SELECT
  constants.company_id,
  imported.item_code,
  imported.item_name,
  imported.description,
  constants.category_id,
  constants.stick_uom_id,
  'raw_material',
  imported.purchase_price,
  imported.sales_price,
  imported.supplier_code,
  TRUE,
  FALSE,
  TRUE,
  TRUE,
  'polystyrene',
  jsonb_strip_nulls(jsonb_build_object(
    'specification', imported.specification
  ))
FROM public.polystyrene_moulding_import imported
CROSS JOIN constants
ON CONFLICT (company_id, item_code) DO UPDATE SET
  item_name = EXCLUDED.item_name,
  description = EXCLUDED.description,
  category_id = EXCLUDED.category_id,
  uom_id = EXCLUDED.uom_id,
  item_type = EXCLUDED.item_type,
  purchase_price = EXCLUDED.purchase_price,
  sales_price = EXCLUDED.sales_price,
  supplier_code = EXCLUDED.supplier_code,
  is_stock_item = EXCLUDED.is_stock_item,
  track_serial = EXCLUDED.track_serial,
  track_batch = EXCLUDED.track_batch,
  is_active = EXCLUDED.is_active,
  material = EXCLUDED.material,
  custom_fields = EXCLUDED.custom_fields,
  deleted_at = NULL,
  updated_at = CURRENT_TIMESTAMP;

WITH constants AS (
  SELECT
    '1e10e2dd-655e-41e0-a508-edfd660a9bcf'::UUID AS company_id,
    uom_stick.id AS stick_uom_id
  FROM public.units_of_measure uom_stick
  WHERE uom_stick.company_id = '1e10e2dd-655e-41e0-a508-edfd660a9bcf'
    AND UPPER(uom_stick.code) = 'STICK'
    AND uom_stick.deleted_at IS NULL
)
INSERT INTO public.item_unit_options (
  company_id, item_id, uom_id, option_label, qty_per_unit,
  is_base, is_default, is_active, sort_order
)
SELECT
  constants.company_id,
  items.id,
  constants.stick_uom_id,
  'STICK',
  1,
  TRUE,
  TRUE,
  TRUE,
  0
FROM public.polystyrene_moulding_import imported
CROSS JOIN constants
JOIN public.items
  ON items.company_id = constants.company_id
 AND items.item_code = imported.item_code
 AND items.deleted_at IS NULL
ON CONFLICT (company_id, item_id, uom_id, qty_per_unit) WHERE deleted_at IS NULL DO UPDATE SET
  option_label = EXCLUDED.option_label,
  is_base = TRUE,
  is_default = TRUE,
  is_active = TRUE,
  sort_order = 0,
  deleted_at = NULL,
  updated_at = CURRENT_TIMESTAMP;

WITH constants AS (
  SELECT
    '1e10e2dd-655e-41e0-a508-edfd660a9bcf'::UUID AS company_id,
    uom_box.id AS box_uom_id
  FROM public.units_of_measure uom_box
  WHERE uom_box.company_id = '1e10e2dd-655e-41e0-a508-edfd660a9bcf'
    AND UPPER(uom_box.code) = 'BOX'
    AND uom_box.deleted_at IS NULL
)
INSERT INTO public.item_unit_options (
  company_id, item_id, uom_id, option_label, qty_per_unit,
  is_base, is_default, is_active, sort_order
)
SELECT
  constants.company_id,
  items.id,
  constants.box_uom_id,
  FORMAT(
    'BOX (%s)',
    CASE
      WHEN imported.qty_per_box = TRUNC(imported.qty_per_box)
        THEN TRUNC(imported.qty_per_box)::TEXT
      ELSE REGEXP_REPLACE(imported.qty_per_box::TEXT, '0+$', '')
    END
  ),
  imported.qty_per_box,
  FALSE,
  FALSE,
  TRUE,
  10
FROM public.polystyrene_moulding_import imported
CROSS JOIN constants
JOIN public.items
  ON items.company_id = constants.company_id
 AND items.item_code = imported.item_code
 AND items.deleted_at IS NULL
WHERE imported.qty_per_box IS NOT NULL
ON CONFLICT (company_id, item_id, uom_id, qty_per_unit) WHERE deleted_at IS NULL DO UPDATE SET
  option_label = EXCLUDED.option_label,
  is_base = FALSE,
  is_default = FALSE,
  is_active = TRUE,
  sort_order = 10,
  deleted_at = NULL,
  updated_at = CURRENT_TIMESTAMP;

WITH constants AS (
  SELECT '1e10e2dd-655e-41e0-a508-edfd660a9bcf'::UUID AS company_id
),
price_rows AS (
  SELECT item_code, 'default'::TEXT AS price_tier, 'Default'::TEXT AS price_tier_name, sales_price AS price
  FROM public.polystyrene_moulding_import
  WHERE sales_price IS NOT NULL
  UNION ALL
  SELECT item_code, 'fc'::TEXT, 'FC'::TEXT, fc_price
  FROM public.polystyrene_moulding_import
  WHERE fc_price IS NOT NULL
  UNION ALL
  SELECT item_code, 'ws'::TEXT, 'WS'::TEXT, ws_price
  FROM public.polystyrene_moulding_import
  WHERE ws_price IS NOT NULL
  UNION ALL
  SELECT item_code, 'srp'::TEXT, 'SRP'::TEXT, srp_price
  FROM public.polystyrene_moulding_import
  WHERE srp_price IS NOT NULL
  UNION ALL
  SELECT item_code, 'chop_join'::TEXT, 'Chop & Join Price'::TEXT, chop_join_price
  FROM public.polystyrene_moulding_import
  WHERE chop_join_price IS NOT NULL
  UNION ALL
  SELECT item_code, 'framing'::TEXT, 'Framing Price'::TEXT, framing_price
  FROM public.polystyrene_moulding_import
  WHERE framing_price IS NOT NULL
)
INSERT INTO public.item_prices (
  company_id, item_id, price_tier, price_tier_name, price,
  currency_code, effective_from, is_active
)
SELECT
  constants.company_id,
  items.id,
  price_rows.price_tier,
  price_rows.price_tier_name,
  price_rows.price,
  'PHP',
  DATE '2026-09-24',
  TRUE
FROM price_rows
CROSS JOIN constants
JOIN public.items
  ON items.company_id = constants.company_id
 AND items.item_code = price_rows.item_code
 AND items.deleted_at IS NULL
ON CONFLICT (company_id, item_id, price_tier, effective_from) DO UPDATE SET
  price_tier_name = EXCLUDED.price_tier_name,
  price = EXCLUDED.price,
  currency_code = EXCLUDED.currency_code,
  is_active = TRUE,
  effective_to = NULL,
  deleted_at = NULL,
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO public.warehouse_locations (
  company_id, warehouse_id, code, name, location_type,
  is_active, is_pickable, is_storable
)
SELECT
  warehouses.company_id, warehouses.id, 'MAIN', 'Main', 'rack',
  TRUE, TRUE, TRUE
FROM public.warehouses
WHERE warehouses.company_id = '1e10e2dd-655e-41e0-a508-edfd660a9bcf'
  AND warehouses.deleted_at IS NULL
ON CONFLICT (company_id, warehouse_id, code) DO UPDATE SET
  name = EXCLUDED.name,
  location_type = EXCLUDED.location_type,
  is_active = TRUE,
  is_pickable = TRUE,
  is_storable = TRUE,
  deleted_at = NULL,
  updated_at = CURRENT_TIMESTAMP;

WITH imported_items AS (
  SELECT
    items.company_id,
    items.id AS item_id,
    warehouses.id AS warehouse_id,
    warehouse_locations.id AS location_id,
    (10 + (get_byte(decode(md5(imported.item_code || ':' || warehouses.id::TEXT), 'hex'), 0) % 91))::NUMERIC AS opening_qty
  FROM public.polystyrene_moulding_import imported
  JOIN public.items
    ON items.company_id = '1e10e2dd-655e-41e0-a508-edfd660a9bcf'
   AND items.item_code = imported.item_code
   AND items.deleted_at IS NULL
  JOIN public.warehouses
    ON warehouses.company_id = items.company_id
   AND warehouses.deleted_at IS NULL
  JOIN public.warehouse_locations
    ON warehouse_locations.company_id = warehouses.company_id
   AND warehouse_locations.warehouse_id = warehouses.id
   AND warehouse_locations.code = 'MAIN'
   AND warehouse_locations.deleted_at IS NULL
)
INSERT INTO public.item_warehouse (
  company_id, item_id, warehouse_id, default_location_id,
  reorder_level, reorder_quantity, current_stock, reserved_stock, is_active
)
SELECT
  company_id, item_id, warehouse_id, location_id,
  25, 100, opening_qty, 0, TRUE
FROM imported_items
ON CONFLICT (company_id, item_id, warehouse_id) DO UPDATE SET
  default_location_id = COALESCE(public.item_warehouse.default_location_id, EXCLUDED.default_location_id),
  reorder_level = EXCLUDED.reorder_level,
  reorder_quantity = EXCLUDED.reorder_quantity,
  current_stock = EXCLUDED.current_stock,
  reserved_stock = 0,
  is_active = TRUE,
  deleted_at = NULL,
  updated_at = CURRENT_TIMESTAMP;

WITH imported_items AS (
  SELECT
    items.company_id,
    items.id AS item_id,
    warehouses.id AS warehouse_id,
    (10 + (get_byte(decode(md5(imported.item_code || ':' || warehouses.id::TEXT), 'hex'), 0) % 91))::NUMERIC AS opening_qty
  FROM public.polystyrene_moulding_import imported
  JOIN public.items
    ON items.company_id = '1e10e2dd-655e-41e0-a508-edfd660a9bcf'
    AND items.item_code = imported.item_code
    AND items.deleted_at IS NULL
  JOIN public.warehouses
    ON warehouses.company_id = items.company_id
    AND warehouses.deleted_at IS NULL
)
INSERT INTO public.item_batches (
  company_id, item_id, warehouse_id, batch_code,
  received_at, qty_on_hand, qty_reserved
)
SELECT
  company_id, item_id, warehouse_id, 'OPENING-BAL',
  TIMESTAMPTZ '2026-06-23 00:00:00+08',
  opening_qty, 0
FROM imported_items
ON CONFLICT (company_id, item_id, warehouse_id, batch_code) DO UPDATE SET
  received_at = EXCLUDED.received_at,
  qty_on_hand = EXCLUDED.qty_on_hand,
  qty_reserved = 0,
  deleted_at = NULL,
  updated_at = CURRENT_TIMESTAMP;

WITH imported_batches AS (
  SELECT
    item_batches.company_id,
    item_batches.item_id,
    item_batches.warehouse_id,
    warehouse_locations.id AS location_id,
    item_batches.id AS item_batch_id,
    (10 + (get_byte(decode(md5(imported.item_code || ':' || item_batches.warehouse_id::TEXT), 'hex'), 0) % 91))::NUMERIC AS opening_qty
  FROM public.polystyrene_moulding_import imported
  JOIN public.items
    ON items.company_id = '1e10e2dd-655e-41e0-a508-edfd660a9bcf'
   AND items.item_code = imported.item_code
   AND items.deleted_at IS NULL
  JOIN public.item_batches
    ON item_batches.company_id = items.company_id
   AND item_batches.item_id = items.id
   AND item_batches.batch_code = 'OPENING-BAL'
   AND item_batches.deleted_at IS NULL
  JOIN public.warehouse_locations
    ON warehouse_locations.company_id = item_batches.company_id
   AND warehouse_locations.warehouse_id = item_batches.warehouse_id
   AND warehouse_locations.code = 'MAIN'
   AND warehouse_locations.deleted_at IS NULL
)
INSERT INTO public.item_batch_locations (
  company_id, item_id, warehouse_id, location_id, item_batch_id,
  qty_on_hand, qty_reserved
)
SELECT
  company_id, item_id, warehouse_id, location_id, item_batch_id,
  opening_qty, 0
FROM imported_batches
ON CONFLICT (company_id, item_id, warehouse_id, location_id, item_batch_id) DO UPDATE SET
  qty_on_hand = EXCLUDED.qty_on_hand,
  qty_reserved = 0,
  deleted_at = NULL,
  updated_at = CURRENT_TIMESTAMP;

DROP TABLE IF EXISTS public.polystyrene_moulding_import;

END;
$polystyrene_moulding_import$;


DO $wonder_photo_import$
DECLARE
  v_missing TEXT;
BEGIN
DROP TABLE IF EXISTS public.wonder_photo_import;

CREATE TABLE public.wonder_photo_import (
  alt_supplier_code TEXT,
  factory_no TEXT,
  color TEXT,
  frame_size TEXT,
  production TEXT,
  qty_per_box NUMERIC,
  supplier_code TEXT,
  moldings TEXT,
  item_code TEXT NOT NULL,
  item_name TEXT NOT NULL,
  description TEXT,
  alt_code TEXT,
  source_code TEXT,
  stock_number TEXT,
  price_without_invoice NUMERIC,
  selling_price NUMERIC
);

INSERT INTO public.wonder_photo_import (
  alt_supplier_code, factory_no, color, frame_size, production, qty_per_box, supplier_code, moldings,
  item_code, item_name, description, alt_code, source_code, stock_number, price_without_invoice, selling_price
) VALUES
  (NULL, NULL, NULL, NULL, 'PHIL. PRODUCTION', NULL, NULL, NULL, '1001BLKASF0505', '5X5 1001-1-B-BLK AQUARIUM TYPE', '5X5 1001-1-B-BLK AQUARIUM TYPE', '1001BLK', 'ASF0505', '1001BLK/ASF0505', 79, 89.5),
  (NULL, NULL, NULL, NULL, 'PHIL. PRODURTION', NULL, NULL, NULL, '1001WHTASF0505', '5X5 1001-02Q-1 WHITE AQUARIUM TYPE', '5X5 1001-02Q-1 WHITE AQUARIUM TYPE', '1001WHT', 'ASF0505', '1001WHT/ASF0505', 79, 89.5),
  (NULL, NULL, NULL, NULL, 'PHIL. PRODUCTION', NULL, NULL, NULL, '1001BLKASF0808', '8X8 1001-1-B-BLK AQUARIUM TYPE', '8X8 1001-1-B-BLK AQUARIUM TYPE', '1001BLK', 'ASF0808', '1001BLK/ASF0808', 111, 125.5),
  (NULL, NULL, NULL, NULL, 'PHIL. PRODUCTION', NULL, NULL, NULL, '1001WHTASF0808', '8X8 1001-02Q-1 WHITE AQUARIUM TYPE', '8X8 1001-02Q-1 WHITE AQUARIUM TYPE', '1001WHT', 'ASF0808', '1001WHT/ASF0808', 111, 125.5),
  (NULL, NULL, NULL, NULL, 'PHIL. PRODUCTION', NULL, NULL, NULL, '1001BLKASF1010', '10X10 1001-1-B-BLK AQUARIUM TYPE', '10X10 1001-1-B-BLK AQUARIUM TYPE', '1001BLK', 'ASF1010', '1001BLK/ASF1010', 132, 149.5),
  (NULL, NULL, NULL, NULL, 'PHIL. PRODUCTION', NULL, NULL, NULL, '1001WHTASF1010', '10X10 1001-02Q-1 WHITE AQUARIUM TYPE', '10X10 1001-02Q-1 WHITE AQUARIUM TYPE', '1001WHT', 'ASF1010', '1001WHT/ASF1010', 215, 244),
  (NULL, NULL, NULL, NULL, 'PHIL. PRODUCTION', NULL, NULL, NULL, '1014BLKDG00507', '5X7 TO 8X10 1014-1-B-BLK DOUBLE GLASS W/ TOP HANGER', '5X7 TO 8X10 1014-1-B-BLK DOUBLE GLASS W/ TOP HANGER', '1014BLK', 'DG00507', '1014BLK/DG00507', 186, 211.5),
  (NULL, NULL, NULL, NULL, 'PHIL. PRODUCTION', NULL, NULL, NULL, '1014NTRDG00507', '5X7 TO 8X10 1014-14P-LC DOUBLE GLASS W/ TOP HANGER', '5X7 TO 8X10 1014-14P-LC DOUBLE GLASS W/ TOP HANGER', '1014NTR', 'DG00507', '1014NTR/DG00507', 186, 211.5),
  (NULL, NULL, NULL, NULL, 'PHIL. PRODUCTION', NULL, NULL, NULL, '1014WHTDG00507', '5X7 TO 8X10 1014-02Q-1 WHITE DOUBLE GLASS W/ TOP HANGER', '5X7 TO 8X10 1014-02Q-1 WHITE DOUBLE GLASS W/ TOP HANGER', '1014WHT', 'DG00507', '1014WHT/DG00507', 186, 211.5),
  (NULL, NULL, NULL, NULL, 'PHIL. PRODUCTION', NULL, NULL, NULL, '1014BLKDG01113', '8X10 TO 11X13 1014-1-B-BLK DOUBLE GLASS', '8X10 TO 11X13 1014-1-B-BLK DOUBLE GLASS', '1014BLK', 'DG01113', '1014BLK/DG01113', 252, 286.5),
  (NULL, NULL, NULL, NULL, 'PHIL. PRODUCTION', NULL, NULL, NULL, '1014NTRDG01113', '8X10 TO 11X13 1014-14P-LC DOUBLE GLASS', '8X10 TO 11X13 1014-14P-LC DOUBLE GLASS', '1014NTR', 'DG01113', '1014NTR/DG01113', 252, 286.5),
  (NULL, NULL, NULL, NULL, 'PHIL. PRODUCTION', NULL, NULL, NULL, '1014WHTDG01113', '8X10 TO 11X13 1014-02Q-1 WHITE DOUBLE GLASS', '8X10 TO 11X13 1014-02Q-1 WHITE DOUBLE GLASS', '1014WHT', 'DG01113', '1014WHT/DG01113', 252, 286.5),
  (NULL, NULL, NULL, NULL, 'PHIL. PRODUCTION', NULL, NULL, NULL, '1014BLWHDF1218', '12X18 1014-1-B-BLK/1001-02Q-1 WHITE DOUBLE FRAME', '12X18 1014-1-B-BLK/1001-02Q-1 WHITE DOUBLE FRAME', '1014BLWH', 'DF1218', '1014BLWH/DF1218', 263.5, 300),
  (NULL, NULL, NULL, NULL, 'PHIL. PRODUCTION', NULL, NULL, NULL, '1014BLWHDF1620', '16X20 1014-1-B-BLK/1001-02Q-1 WHITE DOUBLE FRAME', '16X20 1014-1-B-BLK/1001-02Q-1 WHITE DOUBLE FRAME', '1014BLWH', 'DF1620', '1014BLWH/DF1620', 337, 383.5),
  (NULL, NULL, NULL, NULL, 'PHIL. PRODUCTION', NULL, NULL, '1014-1-B-BLK +   1001-02Q-1 WHITE', '1014BLWHDF2024', '20X24 1014-1-B-BLK/1001-02Q-1 WHITE DOUBLE FRAME', '20X24 1014-1-B-BLK/1001-02Q-1 WHITE DOUBLE FRAME', '1014BLWH', 'DF2024', '1014BLWH/DF2024', 442.5, 503.5),
  (NULL, NULL, NULL, NULL, 'PHIL. PRODUCTION', NULL, NULL, NULL, '1014WHBLDF1218', '12X18 1014-02Q-1 WHITE/1001-1-B-BLK DOUBLE FRAME', '12X18 1014-02Q-1 WHITE/1001-1-B-BLK DOUBLE FRAME', '1014WHBL', 'DF1218', '1014WHBL/DF1218', 263.5, 300),
  (NULL, NULL, NULL, NULL, 'PHIL. PRODUCTION', NULL, NULL, NULL, '1014WHBLDF1620', '16X20 1014-02Q-1 WHITE/1001-1-B-BLK DOUBLE FRAME', '16X20 1014-02Q-1 WHITE/1001-1-B-BLK DOUBLE FRAME', '1014WHBL', 'DF1620', '1014WHBL/DF1620', 337, 383.5),
  (NULL, NULL, NULL, NULL, 'PHIL. PRODUCTION', NULL, NULL, '1014-02Q-1 WHITE + 1001-1-B-BLK', '10140WHBLDF2024', '20X24 1014-02Q-1 WHITE/1001-1-B-BLK DOUBLE FRAME', '20X24 1014-02Q-1 WHITE/1001-1-B-BLK DOUBLE FRAME', '10140WHBL', 'DF2024', '10140WHBL/DF2024', 442.5, 503.5),
  (NULL, NULL, NULL, NULL, 'PHIL. PRODUCTION', NULL, NULL, NULL, '1014NRBLDF1218', '12X18 1014-14P-LC/1001-1-B-BLK DOUBLE FRAME', '12X18 1014-14P-LC/1001-1-B-BLK DOUBLE FRAME', '1014NRBL', 'DF1218', '1014NRBL/DF1218', 263.5, 300),
  (NULL, NULL, NULL, NULL, 'PHIL. PRODUCTION', NULL, NULL, NULL, '1014NRBLDF1620', '16X20 1014-14P-LC/1001-1-B-BLK DOUBLE FRAME', '16X20 1014-14P-LC/1001-1-B-BLK DOUBLE FRAME', '1014NRBL', 'DF1620', '1014NRBL/DF1620', 337, 383.5),
  (NULL, NULL, NULL, NULL, 'PHIL. PRODUCTION', NULL, NULL, '1014-14P-LC +    1001-1-B-BLK', '1014NRBLDF2024', '20X24 1014-14P-LC/1001-1-B-BLK DOUBLE FRAME', '20X24 1014-14P-LC/1001-1-B-BLK DOUBLE FRAME', '1014NRBL', 'DF2024', '1014NRBL/DF2024', 442.5, 503.5),
  (NULL, NULL, NULL, NULL, 'PHIL. PRODUCTION', NULL, NULL, NULL, '20790GLDSM1620', '16X20 TO 19X23 2079-GOLD', '16X20 TO 19X23 2079-GOLD', '20790GLD', 'SM1620', '20790GLD/SM1620', 800, 909.5),
  (NULL, NULL, NULL, NULL, 'PHIL. PRODUCTION', NULL, NULL, NULL, '20790GLDSM2024', '20X24 TO 23X27 2079-GOLD', '20X24 TO 23X27 2079-GOLD', '20790GLD', 'SM2024', '20790GLD/SM2024', 963.5, 1095),
  (NULL, NULL, NULL, NULL, 'PHIL. PRODUCTION', NULL, NULL, '2079-GOLD', '20790GLDSM2030', '20X30 TO 23X33 2079-GOLD', '20X30 TO 23X33 2079-GOLD', '20790GLD', 'SM2030', '20790GLD/SM2030', 1068.5, 1215),
  (NULL, NULL, NULL, NULL, 'PHIL. PRODUCTION', NULL, NULL, NULL, '20790MRNSM1620', '16X20 TO 19X23 2079-02E MRN', '16X20 TO 19X23 2079-02E MRN', '20790MRN', 'SM1620', '20790MRN/SM1620', 800, 909.5),
  (NULL, NULL, NULL, NULL, 'PHIL. PRODUCTION', NULL, NULL, NULL, '20790MRNSM2024', '20X24 TO 23X27 2079-02E MRN', '20X24 TO 23X27 2079-02E MRN', '20790MRN', 'SM2024', '20790MRN/SM2024', 963.5, 1095),
  (NULL, NULL, NULL, NULL, 'PHIL. PRODUCTION', NULL, NULL, '2079-02E MRN', '20790MRNSM2030', '20X30 TO 23X33 2079-02E MRN', '20X30 TO 23X33 2079-02E MRN', '20790MRN', 'SM2030', '20790MRN/SM2030', 1068.5, 1215),
  (NULL, NULL, NULL, NULL, 'PHIL. PRODUCTION', NULL, NULL, NULL, '20790SLVSM1620', '16X20 TO 19X23 2079-SILVER', '16X20 TO 19X23 2079-SILVER', '20790SLV', 'SM1620', '20790SLV/SM1620', 800, 909.5),
  (NULL, NULL, NULL, NULL, 'PHIL. PRODUCTION', NULL, NULL, NULL, '20790SLVSM2024', '20X24 TO 23X27 2079-SILVER', '20X24 TO 23X27 2079-SILVER', '20790SLV', 'SM2024', '20790SLV/SM2024', 963.5, 1095),
  (NULL, NULL, NULL, NULL, 'PHIL. PRODUCTION', NULL, NULL, '2079-SILVER', '20790SLVSM2030', '20X30 TO 23X33 2079-SILVER', '20X30 TO 23X33 2079-SILVER', '20790SLV', 'SM2030', '20790SLV/SM2030', 1068.5, 1215),
  (NULL, NULL, NULL, NULL, 'PHIL. PRODUCTION', NULL, NULL, NULL, '2439WHTESM1218', '12X18 TO 15X21 2439-WHITE', '12X18 TO 15X21 2439-WHITE', '2439WHTE', 'SM1218', '2439WHTE/SM1218', 653, 742.5),
  (NULL, NULL, NULL, NULL, 'PHIL. PRODUCTION', NULL, NULL, NULL, '2439WHTESM1620', '16X20 TO 19X23 2439-WHITE', '16X20 TO 19X23 2439-WHITE', '2439WHTE', 'SM1620', '2439WHTE/SM1620', 800, 909.5),
  (NULL, NULL, NULL, NULL, 'PHIL. PRODUCTION', NULL, NULL, NULL, '2439WHTESM2024', '20X24 TO 23X27 2439-WHITE', '20X24 TO 23X27 2439-WHITE', '2439WHTE', 'SM2024', '2439WHTE/SM2024', 963.5, 1095),
  (NULL, NULL, NULL, NULL, 'PHIL. PRODUCTION', NULL, NULL, '2439-WHITE', '2439WHTESM2030', '20X30 TO 23X33 2439-WHITE', '20X30 TO 23X33 2439-WHITE', '2439WHTE', 'SM2030', '2439WHTE/SM2030', 1068.5, 1214),
  (NULL, NULL, NULL, NULL, 'PHIL. PRODUCTION', NULL, NULL, NULL, '2630127RNM1218', '12X18 2630-127R-LBLU', '12X18 2630-127R-LBLU', '2630127R', 'NM1218', '2630127R/NM1218', 316, 359),
  (NULL, NULL, NULL, NULL, 'PHIL. PRODUCTION', NULL, NULL, NULL, '2630127RNM1620', '16X20 2630-127R-LBLU', '16X20 2630-127R-LBLU', '2630127R', 'NM1620', '2630127R/NM1620', 421.5, 479),
  (NULL, NULL, NULL, NULL, 'PHIL. PRODUCTION', NULL, NULL, NULL, '2630127RNM2024', '20X24 2630-127R-LBLU', '20X24 2630-127R-LBLU', '2630127R', 'NM2024', '2630127R/NM2024', 526.5, 598),
  (NULL, NULL, NULL, NULL, 'PHIL. PRODUCTION', NULL, NULL, '2630-127R-LBLU', '2630127RNM2030', '20X30 2630-127R-LBLU', '20X30 2630-127R-LBLU', '2630127R', 'NM2030', '2630127R/NM2030', 653, 742.5),
  (NULL, NULL, NULL, NULL, 'PHIL. PRODUCTION', NULL, NULL, NULL, '2630113WNM1218', '12X18 2630-113W-5-LC', '12X18 2630-113W-5-LC', '2630113W', 'NM1218', '2630113W/NM1218', 316, 359),
  (NULL, NULL, NULL, NULL, 'PHIL. PRODUCTION', NULL, NULL, NULL, '2630113WNM1620', '16X20 2630-113W-5-LC', '16X20 2630-113W-5-LC', '2630113W', 'NM1620', '2630113W/NM1620', 421.5, 479),
  (NULL, NULL, NULL, NULL, 'PHIL. PRODUCTION', NULL, NULL, NULL, '2630113WNM2024', '20X24 2630-113W-5-LC', '20X24 2630-113W-5-LC', '2630113W', 'NM2024', '2630113W/NM2024', 526.5, 598),
  (NULL, NULL, NULL, NULL, 'PHIL. PRODUCTION', NULL, NULL, '2630-113W-5-LC', '2630113WNM2030', '20X30 2630-113W-5-LC', '20X30 2630-113W-5-LC', '2630113W', 'NM2030', '2630113W/NM2030', 653, 742.5),
  (NULL, NULL, NULL, NULL, 'PHIL. PRODUCTION', NULL, NULL, NULL, '2781135HNM1218', '12X18 2781-135H-NTR', '12X18 2781-135H-NTR', '2781135H', 'NM1218', '2781135H/NM1218', 395, 448.5),
  (NULL, NULL, NULL, NULL, 'PHIL. PRODUCTION', NULL, NULL, NULL, '2781135HNM1620', '16X20 2781-135H-NTR', '16X20 2781-135H-NTR', '2781135H', 'NM1620', '2781135H/NM1620', 489.5, 557),
  (NULL, NULL, NULL, NULL, 'PHIL. PRODUCTION', NULL, NULL, NULL, '2781135HNM2024', '20X24 2781-135H-NTR', '20X24 2781-135H-NTR', '2781135H', 'NM2024', '2781135H/NM2024', 621.5, 705.5),
  (NULL, NULL, NULL, NULL, 'PHIL. PRODUCTION', NULL, NULL, '2781-135H-NTR', '2781135HNM2030', '20X30 2781-135H-NTR', '20X30 2781-135H-NTR', '2781135H', 'NM2030', '2781135H/NM2030', 774, 879),
  (NULL, NULL, NULL, NULL, 'PHIL. PRODUCTION', NULL, NULL, NULL, '2812132BNM1114', '11X14 2812-132B-BLK', '11X14 2812-132B-BLK', '2812132B', 'NM1114', '2812132B/NM1114', 211, 240),
  (NULL, NULL, NULL, NULL, 'PHIL. PRODUCTION', NULL, NULL, NULL, '2812132BNM1218', '12X18 2812-132B-BLK', '12X18 2812-132B-BLK', '2812132B', 'NM1218', '2812132B/NM1218', 242.5, 276),
  (NULL, NULL, NULL, NULL, 'PHIL. PRODUCTION', NULL, NULL, NULL, '2812132BNM1620', '16X20 2812-132B-BLK', '16X20 2812-132B-BLK', '2812132B', 'NM1620', '2812132B/NM1620', 316, 359),
  (NULL, NULL, NULL, NULL, 'PHIL. PRODUCTION', NULL, NULL, NULL, '2812132BNM2024', '20X24 2812-132B-BLK', '20X24 2812-132B-BLK', '2812132B', 'NM2024', '2812132B/NM2024', 421.5, 479),
  (NULL, NULL, NULL, NULL, 'PHIL. PRODUCTION', NULL, NULL, '2812-132B-BLK', '2812132BNM2030', '20X30 2812-132B-BLK', '20X30 2812-132B-BLK', '2812132B', 'NM2030', '2812132B/NM2030', 526.5, 598),
  (NULL, NULL, NULL, NULL, 'PHIL. PRODUCTION', NULL, NULL, NULL, '28120581NM1114', '11X14 2812-058-1 NTR', '11X14 2812-058-1 NTR', '28120581', 'NM1114', '28120581/NM1114', 211, 240),
  (NULL, NULL, NULL, NULL, 'PHIL. PRODUCTION', NULL, NULL, NULL, '28120581NM1218', '12X18 2812-058-1 NTR', '12X18 2812-058-1 NTR', '28120581', 'NM1218', '28120581/NM1218', 242.5, 276),
  (NULL, NULL, NULL, NULL, 'PHIL. PRODUCTION', NULL, NULL, NULL, '28120581NM1620', '16X20 2812-058-1 NTR', '16X20 2812-058-1 NTR', '28120581', 'NM1620', '28120581/NM1620', 316, 359),
  (NULL, NULL, NULL, NULL, 'PHIL. PRODUCTION', NULL, NULL, NULL, '28120581NM2024', '20X24 2812-058-1 NTR', '20X24 2812-058-1 NTR', '28120581', 'NM2024', '28120581/NM2024', 421.5, 479),
  (NULL, NULL, NULL, NULL, 'PHIL. PRODUCTION', NULL, NULL, '2812-058-1 NTR', '28120581NM2030', '20X30 2812-058-1 NTR', '20X30 2812-058-1 NTR', '28120581', 'NM2030', '28120581/NM2030', 526.5, 598),
  ('MDF1022', 'MDF1022/BLK507', 'BLACK', '5 X 7', 'CHINA PRODUCTION', 40, 'BLK507', NULL, 'MDF10022BLK507', '5X7 M1008-2 BLK W/ STAND CLIP HANGER W/O CORNERER', '5X7 M1008-2 BLK W/ STAND CLIP HANGER W/O CORNERER', 'MDF10022', 'BLK507', 'MDF10022/BLK507', 59, 67.5),
  ('MDF1002', 'MDF10023/BRN507', 'BROWN', '5 X 7', 'CHINA PRODUCTION', 40, 'BRN507', NULL, 'MDF10023BRN507', '5X7 M1008-13 BRN W/ STAND CLIP HANGER W/O CORNERER', '5X7 M1008-13 BRN W/ STAND CLIP HANGER W/O CORNERER', 'MDF10023', 'BRN507', 'MDF10023/BRN507', 59, 67.5),
  ('MDF1002', 'MDF10026/OAK507', 'OAK', '5 X 7', 'CHINA PRODUCTION', 40, 'OAK507', NULL, 'MDF10026OAK507', '5X7 M1008-6 OAK/LC W/ STAND CLIP HANGER W/O CORNERER', '5X7 M1008-6 OAK/LC W/ STAND CLIP HANGER W/O CORNERER', 'MDF10026', 'OAK507', 'MDF10026/OAK507', 59, 67.5),
  ('MDF1002', 'MDF10021/WHT507', 'WHITE', '5 X 7', 'CHINA PRODUCTION', 40, 'WHT507', NULL, 'MDF10021WHT507', '5X7 M1008-1 WHT W/ STAND CLIP HANGER W/O CORNERER', '5X7 M1008-1 WHT W/ STAND CLIP HANGER W/O CORNERER', 'MDF10021', 'WHT507', 'MDF10021/WHT507', 59, 67.5),
  ('MDF10', 'MDF1002222/BLK810', 'BLACK', '8 X 10', 'CHINA PRODUCTION', 30, 'BLK810', NULL, 'MDF10022BLK810', '8X10 M1008-2 BLK W/ STAND CLIP HANGER W/ CORNERER', '8X10 M1008-2 BLK W/ STAND CLIP HANGER W/ CORNERER', 'MDF10022', 'BLK810', 'MDF10022/BLK810', 89.5, 102),
  ('MDF10', 'MDF10023/BRN810', 'BROWN', '8 X 10', 'CHINA PRODUCTION', 30, 'BRN810', NULL, 'MDF10023BRN810', '8X10 M1008-13 BRN W/ STAND CLIP HANGER W/ CORNERER', '8X10 M1008-13 BRN W/ STAND CLIP HANGER W/ CORNERER', 'MDF10023', 'BRN810', 'MDF10023/BRN810', 89.5, 102),
  (NULL, 'MDF10026/OAK810', 'OAK', '8 X 10', 'CHINA PRODUCTION', 30, 'OAK810', NULL, 'MDF10026OAK810', '8X10 M1008-6 OAK/LC W/ STAND CLIP HANGER W/ CORNERER', '8X10 M1008-6 OAK/LC W/ STAND CLIP HANGER W/ CORNERER', 'MDF10026', 'OAK810', 'MDF10026/OAK810', 89.5, 102),
  ('MDF10', 'MDF10021/WHT810', 'WHITE', '8 X 10', 'CHINA PRODUCTION', 30, 'WHT810', NULL, 'MDF10021WHT810', '8X10 M1008-1 WHT W/ STAND CLIP HANGER W/ CORNERER', '8X10 M1008-1 WHT W/ STAND CLIP HANGER W/ CORNERER', 'MDF10021', 'WHT810', 'MDF10021/WHT810', 89.5, 102),
  (NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '6248B12SBK0810', '8X10 6248-B1 BLK 2 SIDE FRAME W/ BOX', '8X10 6248-B1 BLK 2 SIDE FRAME W/ BOX', '6248B1', '2SBK0810', '6248B1/2SBK0810', 211, 242.5),
  (NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '6248B13SBK0810', '8X10 6248-B1 BLK 3 SIDE FRAME W/ BOX', '8X10 6248-B1 BLK 3 SIDE FRAME W/ BOX', '6248B1', '3SBK0810', '6248B1/3SBK0810', 463.5, 526.5),
  (NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '6248B12SBK1114', '11X14 6248-B1 BLK 2 SIDE FRAME W/ BOX', '11X14 6248-B1 BLK 2 SIDE FRAME W/ BOX', '6248B1', '2SBK1114', '6248B1/2SBK1114', 274, 316),
  (NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '6248B13SBK1114', '11X14 6248-B1 BLK 3 SIDE FRAME W/ BOX', '11X14 6248-B1 BLK 3 SIDE FRAME W/ BOX', '6248B1', '3SBK1114', '6248B1/3SBK1114', 611, 695);

  SELECT string_agg(required_name, ', ' ORDER BY required_name)
  INTO v_missing
  FROM (
    SELECT 'company 1e10e2dd-655e-41e0-a508-edfd660a9bcf' AS required_name
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.companies
      WHERE id = '1e10e2dd-655e-41e0-a508-edfd660a9bcf'
        AND deleted_at IS NULL
    )
    UNION ALL
    SELECT 'UOM PCS'
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.units_of_measure
      WHERE company_id = '1e10e2dd-655e-41e0-a508-edfd660a9bcf'
        AND UPPER(code) = 'PCS'
        AND deleted_at IS NULL
    )
    UNION ALL
    SELECT 'UOM BOX'
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.units_of_measure
      WHERE company_id = '1e10e2dd-655e-41e0-a508-edfd660a9bcf'
        AND UPPER(code) = 'BOX'
        AND deleted_at IS NULL
    )
    UNION ALL
    SELECT 'item category FRM'
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.item_categories
      WHERE company_id = '1e10e2dd-655e-41e0-a508-edfd660a9bcf'
        AND code = 'FRM'
        AND deleted_at IS NULL
    )
  ) missing_records;

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Wonder Photo import prerequisite records are missing: %', v_missing;
  END IF;

PERFORM setval(
  'public.item_unit_option_barcode_seq',
  GREATEST(
    (SELECT COALESCE(last_value, 1) FROM public.item_unit_option_barcode_seq),
    (SELECT COUNT(*) + 10000 FROM public.item_unit_options)
  ),
  TRUE
);

WITH constants AS (
  SELECT
    '1e10e2dd-655e-41e0-a508-edfd660a9bcf'::UUID AS company_id,
    uom_pcs.id AS pcs_uom_id,
    category.id AS category_id
  FROM public.units_of_measure uom_pcs
  JOIN public.item_categories category
    ON category.company_id = uom_pcs.company_id
   AND category.code = 'FRM'
   AND category.deleted_at IS NULL
  WHERE uom_pcs.company_id = '1e10e2dd-655e-41e0-a508-edfd660a9bcf'
    AND UPPER(uom_pcs.code) = 'PCS'
    AND uom_pcs.deleted_at IS NULL
)
INSERT INTO public.items (
  company_id,
  item_code,
  item_name,
  description,
  category_id,
  uom_id,
  item_type,
  purchase_price,
  sales_price,
  supplier_code,
  is_stock_item,
  track_serial,
  track_batch,
  is_active,
  custom_fields
)
SELECT
  constants.company_id,
  imported.item_code,
  imported.item_name,
  imported.description,
  constants.category_id,
  constants.pcs_uom_id,
  'finished_good',
  imported.price_without_invoice,
  imported.selling_price,
  imported.supplier_code,
  TRUE,
  FALSE,
  TRUE,
  TRUE,
  jsonb_strip_nulls(jsonb_build_object(
    'alt_supplier_code', imported.alt_supplier_code,
    'color', imported.color,
    'frame_size', imported.frame_size,
    'production', imported.production,
    'moldings', imported.moldings
  ))
FROM public.wonder_photo_import imported
CROSS JOIN constants
ON CONFLICT (company_id, item_code) DO UPDATE SET
  item_name = EXCLUDED.item_name,
  description = EXCLUDED.description,
  category_id = EXCLUDED.category_id,
  uom_id = EXCLUDED.uom_id,
  item_type = EXCLUDED.item_type,
  purchase_price = EXCLUDED.purchase_price,
  sales_price = EXCLUDED.sales_price,
  supplier_code = EXCLUDED.supplier_code,
  is_stock_item = EXCLUDED.is_stock_item,
  track_serial = EXCLUDED.track_serial,
  track_batch = EXCLUDED.track_batch,
  is_active = EXCLUDED.is_active,
  custom_fields = EXCLUDED.custom_fields,
  deleted_at = NULL,
  updated_at = CURRENT_TIMESTAMP;

WITH constants AS (
  SELECT
    '1e10e2dd-655e-41e0-a508-edfd660a9bcf'::UUID AS company_id,
    uom_pcs.id AS pcs_uom_id
  FROM public.units_of_measure uom_pcs
  WHERE uom_pcs.company_id = '1e10e2dd-655e-41e0-a508-edfd660a9bcf'
    AND UPPER(uom_pcs.code) = 'PCS'
    AND uom_pcs.deleted_at IS NULL
)
INSERT INTO public.item_unit_options (
  company_id,
  item_id,
  uom_id,
  option_label,
  qty_per_unit,
  is_base,
  is_default,
  is_active,
  sort_order
)
SELECT
  constants.company_id,
  items.id,
  constants.pcs_uom_id,
  'PCS',
  1,
  TRUE,
  TRUE,
  TRUE,
  0
FROM public.wonder_photo_import imported
CROSS JOIN constants
JOIN public.items
  ON items.company_id = constants.company_id
 AND items.item_code = imported.item_code
 AND items.deleted_at IS NULL
ON CONFLICT (company_id, item_id, uom_id, qty_per_unit) WHERE deleted_at IS NULL DO UPDATE SET
  option_label = EXCLUDED.option_label,
  is_base = TRUE,
  is_default = TRUE,
  is_active = TRUE,
  sort_order = 0,
  deleted_at = NULL,
  updated_at = CURRENT_TIMESTAMP;

WITH constants AS (
  SELECT
    '1e10e2dd-655e-41e0-a508-edfd660a9bcf'::UUID AS company_id,
    uom_box.id AS box_uom_id
  FROM public.units_of_measure uom_box
  WHERE uom_box.company_id = '1e10e2dd-655e-41e0-a508-edfd660a9bcf'
    AND UPPER(uom_box.code) = 'BOX'
    AND uom_box.deleted_at IS NULL
)
INSERT INTO public.item_unit_options (
  company_id,
  item_id,
  uom_id,
  option_label,
  qty_per_unit,
  is_base,
  is_default,
  is_active,
  sort_order
)
SELECT
  constants.company_id,
  items.id,
  constants.box_uom_id,
  FORMAT(
    'BOX (%s)',
    CASE
      WHEN imported.qty_per_box = TRUNC(imported.qty_per_box)
        THEN TRUNC(imported.qty_per_box)::TEXT
      ELSE REGEXP_REPLACE(imported.qty_per_box::TEXT, '0+$', '')
    END
  ),
  imported.qty_per_box,
  FALSE,
  FALSE,
  TRUE,
  10
FROM public.wonder_photo_import imported
CROSS JOIN constants
JOIN public.items
  ON items.company_id = constants.company_id
 AND items.item_code = imported.item_code
 AND items.deleted_at IS NULL
WHERE imported.qty_per_box IS NOT NULL
ON CONFLICT (company_id, item_id, uom_id, qty_per_unit) WHERE deleted_at IS NULL DO UPDATE SET
  option_label = EXCLUDED.option_label,
  is_base = FALSE,
  is_default = FALSE,
  is_active = TRUE,
  sort_order = 10,
  deleted_at = NULL,
  updated_at = CURRENT_TIMESTAMP;

WITH constants AS (
  SELECT '1e10e2dd-655e-41e0-a508-edfd660a9bcf'::UUID AS company_id
),
price_rows AS (
  SELECT item_code, 'default'::TEXT AS price_tier, 'Default'::TEXT AS price_tier_name, selling_price AS price
  FROM public.wonder_photo_import
  WHERE selling_price IS NOT NULL
  UNION ALL
  SELECT item_code, 'price_without_inv'::TEXT AS price_tier, 'Price Without Invoice'::TEXT AS price_tier_name, price_without_invoice AS price
  FROM public.wonder_photo_import
  WHERE price_without_invoice IS NOT NULL
)
INSERT INTO public.item_prices (
  company_id,
  item_id,
  price_tier,
  price_tier_name,
  price,
  currency_code,
  effective_from,
  is_active
)
SELECT
  constants.company_id,
  items.id,
  price_rows.price_tier,
  price_rows.price_tier_name,
  price_rows.price,
  'PHP',
  DATE '2026-06-21',
  TRUE
FROM price_rows
CROSS JOIN constants
JOIN public.items
  ON items.company_id = constants.company_id
 AND items.item_code = price_rows.item_code
 AND items.deleted_at IS NULL
ON CONFLICT (company_id, item_id, price_tier, effective_from) DO UPDATE SET
  price_tier_name = EXCLUDED.price_tier_name,
  price = EXCLUDED.price,
  currency_code = EXCLUDED.currency_code,
  is_active = TRUE,
  effective_to = NULL,
  deleted_at = NULL,
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO public.warehouse_locations (
  company_id,
  warehouse_id,
  code,
  name,
  location_type,
  is_active,
  is_pickable,
  is_storable
)
SELECT
  warehouses.company_id,
  warehouses.id,
  'MAIN',
  'Main',
  'rack',
  TRUE,
  TRUE,
  TRUE
FROM public.warehouses
WHERE warehouses.company_id = '1e10e2dd-655e-41e0-a508-edfd660a9bcf'
  AND warehouses.deleted_at IS NULL
ON CONFLICT (company_id, warehouse_id, code) DO UPDATE SET
  name = EXCLUDED.name,
  location_type = EXCLUDED.location_type,
  is_active = TRUE,
  is_pickable = TRUE,
  is_storable = TRUE,
  deleted_at = NULL,
  updated_at = CURRENT_TIMESTAMP;

WITH imported_items AS (
  SELECT
    items.company_id,
    items.id AS item_id,
    warehouses.id AS warehouse_id,
    warehouse_locations.id AS location_id,
    (10 + (get_byte(decode(md5(imported.item_code || ':' || warehouses.id::TEXT), 'hex'), 0) % 91))::NUMERIC AS opening_qty
  FROM public.wonder_photo_import imported
  JOIN public.items
    ON items.company_id = '1e10e2dd-655e-41e0-a508-edfd660a9bcf'
   AND items.item_code = imported.item_code
   AND items.deleted_at IS NULL
  JOIN public.warehouses
    ON warehouses.company_id = items.company_id
   AND warehouses.deleted_at IS NULL
  JOIN public.warehouse_locations
    ON warehouse_locations.company_id = warehouses.company_id
   AND warehouse_locations.warehouse_id = warehouses.id
   AND warehouse_locations.code = 'MAIN'
   AND warehouse_locations.deleted_at IS NULL
)
INSERT INTO public.item_warehouse (
  company_id,
  item_id,
  warehouse_id,
  default_location_id,
  reorder_level,
  reorder_quantity,
  current_stock,
  reserved_stock,
  is_active
)
SELECT
  company_id,
  item_id,
  warehouse_id,
  location_id,
  25,
  100,
  opening_qty,
  0,
  TRUE
FROM imported_items
ON CONFLICT (company_id, item_id, warehouse_id) DO UPDATE SET
  default_location_id = COALESCE(public.item_warehouse.default_location_id, EXCLUDED.default_location_id),
  reorder_level = EXCLUDED.reorder_level,
  reorder_quantity = EXCLUDED.reorder_quantity,
  current_stock = EXCLUDED.current_stock,
  reserved_stock = 0,
  is_active = TRUE,
  deleted_at = NULL,
  updated_at = CURRENT_TIMESTAMP;

WITH imported_items AS (
  SELECT
    items.company_id,
    items.id AS item_id,
    warehouses.id AS warehouse_id,
    (10 + (get_byte(decode(md5(imported.item_code || ':' || warehouses.id::TEXT), 'hex'), 0) % 91))::NUMERIC AS opening_qty
  FROM public.wonder_photo_import imported
  JOIN public.items
    ON items.company_id = '1e10e2dd-655e-41e0-a508-edfd660a9bcf'
   AND items.item_code = imported.item_code
   AND items.deleted_at IS NULL
  JOIN public.warehouses
    ON warehouses.company_id = items.company_id
   AND warehouses.deleted_at IS NULL
)
INSERT INTO public.item_batches (
  company_id,
  item_id,
  warehouse_id,
  batch_code,
  received_at,
  qty_on_hand,
  qty_reserved
)
SELECT
  company_id,
  item_id,
  warehouse_id,
  'OPENING-BAL',
  TIMESTAMPTZ '2026-06-21 00:00:00+08',
  opening_qty,
  0
FROM imported_items
ON CONFLICT (company_id, item_id, warehouse_id, batch_code) DO UPDATE SET
  received_at = EXCLUDED.received_at,
  qty_on_hand = EXCLUDED.qty_on_hand,
  qty_reserved = 0,
  deleted_at = NULL,
  updated_at = CURRENT_TIMESTAMP;

WITH imported_batches AS (
  SELECT
    item_batches.company_id,
    item_batches.item_id,
    item_batches.warehouse_id,
    warehouse_locations.id AS location_id,
    item_batches.id AS item_batch_id,
    (10 + (get_byte(decode(md5(imported.item_code || ':' || item_batches.warehouse_id::TEXT), 'hex'), 0) % 91))::NUMERIC AS opening_qty
  FROM public.wonder_photo_import imported
  JOIN public.items
    ON items.company_id = '1e10e2dd-655e-41e0-a508-edfd660a9bcf'
   AND items.item_code = imported.item_code
   AND items.deleted_at IS NULL
  JOIN public.item_batches
    ON item_batches.company_id = items.company_id
   AND item_batches.item_id = items.id
   AND item_batches.batch_code = 'OPENING-BAL'
   AND item_batches.deleted_at IS NULL
  JOIN public.warehouse_locations
    ON warehouse_locations.company_id = item_batches.company_id
   AND warehouse_locations.warehouse_id = item_batches.warehouse_id
   AND warehouse_locations.code = 'MAIN'
   AND warehouse_locations.deleted_at IS NULL
)
INSERT INTO public.item_batch_locations (
  company_id,
  item_id,
  warehouse_id,
  location_id,
  item_batch_id,
  qty_on_hand,
  qty_reserved
)
SELECT
  company_id,
  item_id,
  warehouse_id,
  location_id,
  item_batch_id,
  opening_qty,
  0
FROM imported_batches
ON CONFLICT (company_id, item_id, warehouse_id, location_id, item_batch_id) DO UPDATE SET
  qty_on_hand = EXCLUDED.qty_on_hand,
  qty_reserved = 0,
  deleted_at = NULL,
  updated_at = CURRENT_TIMESTAMP;

DROP TABLE IF EXISTS public.wonder_photo_import;

END;
$wonder_photo_import$;

DO $innovatronix_import$
DECLARE
  v_missing TEXT;
BEGIN
DROP TABLE IF EXISTS public.innovatronix_import;

CREATE TABLE public.innovatronix_import (
  supplier_code TEXT,
  color TEXT,
  frame_size TEXT,
  production TEXT,
  qty_per_box NUMERIC,
  price_without_invoice NUMERIC NOT NULL DEFAULT 0,
  item_code TEXT NOT NULL,
  item_name TEXT NOT NULL,
  description TEXT,
  selling_price NUMERIC,
  sop NUMERIC
);

INSERT INTO public.innovatronix_import (
  supplier_code, color, frame_size, production, qty_per_box, price_without_invoice,
  item_code, item_name, description, selling_price, sop
) VALUES
  ('1890-121Y', 'PASTEL BLUE 40''s', 'A5(8.3"*5.85")', 'CHINA/PHIL. PRODUCTION', NULL, 4.75, 'INVX0001', 'PICTURE FRAME A5 POLYSYRENE STICK 5.85 X 8.26PASTE BLUE #1890', 'PICTURE FRAME A5 POLYSYRENE STICK 5.85 X 8.26PASTE BLUE #1890', 67.0, NULL),
  ('1890-133A', 'PASTEL PINK 40''s', 'A5(8.3"*5.85")', 'CHINA/PHIL. PRODUCTION', NULL, 4.75, 'INVX0002', 'PICTURE FRAME A5 POLYSYRENE STICK 5.85 X 8.26PASTE PINK #1891', 'PICTURE FRAME A5 POLYSYRENE STICK 5.85 X 8.26PASTE PINK #1891', 67.0, NULL),
  (NULL, NULL, NULL, 'PHIL. PRODUCTION', NULL, 0, 'INVX0003', 'PICTURE FRAME A5 TWIN FRAME POLYSYRENE  BOOKTYPENATURAL', 'PICTURE FRAME A5 TWIN FRAME POLYSYRENE  BOOKTYPENATURAL', 130.0, NULL),
  (NULL, NULL, NULL, 'PHIL. PRODUCTION', NULL, 0, 'INVX0004', 'PICTURE FRAME 4R TWIN FRAME POLYSYRENE  BOOKTYPENATURAL', 'PICTURE FRAME 4R TWIN FRAME POLYSYRENE  BOOKTYPENATURAL', 104.0, NULL),
  (NULL, NULL, NULL, 'PHIL. PRODUCTION', NULL, 0, 'INVX0005', 'PICTURE FRAME A4 POLYSYRENE  8.3 X 11.7 BLUE', 'PICTURE FRAME A4 POLYSYRENE  8.3 X 11.7 BLUE', 75.0, 2.0),
  (NULL, NULL, NULL, 'PHIL. PRODUCTION', NULL, 0, 'INVX0006', 'PICTURE FRAME A4 POLYSYRENE  8.3 X 11.7 NATURAL', 'PICTURE FRAME A4 POLYSYRENE  8.3 X 11.7 NATURAL', 75.0, 2.0),
  ('1001-1-B', 'BLACK 40''s', 'A4(8.3"*11.7")', 'CHINA/PHIL. PRODUCTION', NULL, 5.62, 'INVX0007', 'PICTURE FRAME A4 POLYSYRENE  8.3 X 11.7 BLACK', 'PICTURE FRAME A4 POLYSYRENE  8.3 X 11.7 BLACK', 75.0, 2.0),
  (NULL, NULL, NULL, 'PHIL. PRODUCTION', NULL, 0, 'INVX0008', 'PICTURE FRAME A4 POLYSYRENE  8.3 X 11.7 BROWN', 'PICTURE FRAME A4 POLYSYRENE  8.3 X 11.7 BROWN', 75.0, 2.0),
  (NULL, NULL, NULL, 'PHIL. PRODUCTION', NULL, 0, 'INVX0009', 'PICTURE FRAME A4 POLYSYRENE  8.3 X 11.7 MAROON', 'PICTURE FRAME A4 POLYSYRENE  8.3 X 11.7 MAROON', 75.0, 2.0),
  (NULL, NULL, NULL, 'PHIL. PRODUCTION', NULL, 0, 'INVX0010', 'PICTURE FRAME A4 POLYSYRENE  8.3 X 11.7 SILVER', 'PICTURE FRAME A4 POLYSYRENE  8.3 X 11.7 SILVER', 75.0, 2.0),
  ('1725-109N', 'BROWN W/ WHITE 20"s', 'A4(8.3"*11.7")', 'CHINA/PHIL. PRODUCTION', NULL, 6.37, 'INVX0011', 'PICTURE FRAME A4 POLYSYRENE  8.3 X 11.7 ROWN WHITE', 'PICTURE FRAME A4 POLYSYRENE  8.3 X 11.7 ROWN WHITE', 102.0, 2.0),
  ('1890-121Y', 'PASTEL BLUE 20''s', 'A4(8.3"*11.7")', 'CHINA/PHIL. PRODUCTION', NULL, 6.95, 'INVX0012', 'PICTURE FRAME A4 POLYSYRENE STICK PASTEL BLUE #1890', 'PICTURE FRAME A4 POLYSYRENE STICK PASTEL BLUE #1890', 102.0, 2.0),
  ('1890-133A', 'PASTEL PINK 20''s', 'A4(8.3"*11.7")', 'CHINA/PHIL. PRODUCTION', NULL, 6.95, 'INVX0013', 'PICTURE FRAME A4 POLYSYRENE STICK PASTEL PINK #1890', 'PICTURE FRAME A4 POLYSYRENE STICK PASTEL PINK #1890', 102.0, 2.0),
  (NULL, NULL, NULL, 'PHIL. PRODUCTION', NULL, 0, 'INVX0014', 'PICTURE FRAME A4 SIZE GLASS TO GLASS -BLACK', 'PICTURE FRAME A4 SIZE GLASS TO GLASS -BLACK', 193.0, 3.0),
  ('2749-LBRN', 'ROSE GOLD 10''s', 'A4 W/MATTING', 'CHINA/PHIL. PRODUCTION', NULL, 12.03, 'INVX0015', 'PICTURE FRAME A4 W/MATTING POLYSTYRENE ROSE GOLD #2749-LBRN', 'PICTURE FRAME A4 W/MATTING POLYSTYRENE ROSE GOLD #2749-LBRN', 185.0, 2.0),
  ('1035-B', 'BLACK 10''s', 'A4 W/MATTING', 'CHINA/PHIL. PRODUCTION', NULL, 10.0, 'INVX0016', 'PICTURE FRAME A4 W/MATTING 8.3 X 11.7 POLYSTYRENE (BLACK)', 'PICTURE FRAME A4 W/MATTING 8.3 X 11.7 POLYSTYRENE (BLACK)', 149.75, 7.0),
  ('1035-14K', 'BLUE 10''s', 'A4 W/MATTING', 'CHINA/PHIL. PRODUCTION', NULL, 10.0, 'INVX0017', 'PICTURE FRAME A4 W/MATTING 8.3 X 11.7 POLYSTYRENE (BLUE)', 'PICTURE FRAME A4 W/MATTING 8.3 X 11.7 POLYSTYRENE (BLUE)', 149.75, 7.0),
  ('1035-15U', 'MAROON 10''s', 'A4 W/MATTING', 'CHINA/PHIL. PRODUCTION', NULL, 10.0, 'INVX0018', 'PICTURE FRAME A4 W/MATTING 8.3 X 11.7 POLYSTYRENE MAROON)', 'PICTURE FRAME A4 W/MATTING 8.3 X 11.7 POLYSTYRENE MAROON)', 149.75, 7.0),
  ('2822-121Y (1829-121Y)', 'PASTEL BLUE 10''s', 'A3+(13"*19)', 'CHINA/PHIL. PRODUCTION', NULL, 21.65, 'INVX0019', 'PICTURE DOUBLE FRAME A3+ POLYSTYRENE (13 X 19) PASTEL BLUE #1829', 'PICTURE DOUBLE FRAME A3+ POLYSTYRENE (13 X 19) PASTEL BLUE #1829', 345.0, 7.0),
  ('2822-133A (1829-133A)', 'PASTEL BLUE 10''s', 'A3+(13"*19)', 'CHINA/PHIL. PRODUCTION', NULL, 21.65, 'INVX0020', 'PICTURE DOUBLE FRAME A3+ POLYSTYRENE (13 X 19) PASTEL PINK #1830', 'PICTURE DOUBLE FRAME A3+ POLYSTYRENE (13 X 19) PASTEL PINK #1830', 345.0, 7.0),
  ('2074-BRN (2896-15W)', 'BRN 10''s', 'A3+(13"*19)', 'CHINA/PHIL. PRODUCTION', NULL, 19.1, 'INVX0021', 'PICTURE FRAME A3+ 13 X 19 POLYSTYRENE W/ EXPANDER', 'PICTURE FRAME A3+ 13 X 19 POLYSTYRENE W/ EXPANDER', 320.0, NULL),
  ('2819-LBRN(2749-LBRN)', 'ROSE GOLD 10''s', 'A3+(13"*19)', 'CHINA/PHIL. PRODUCTION', NULL, 20.9, 'INVX0022', 'PICTURE DOUBLE FRAME A3+ POLYSTYRENE (13 X 19)ROSE GOLD #2749-LBRN', 'PICTURE DOUBLE FRAME A3+ POLYSTYRENE (13 X 19)ROSE GOLD #2749-LBRN', 355.0, 7.0),
  (NULL, NULL, NULL, 'PHILIPPINES PRODUCTION', NULL, 0, 'INVX0023', 'PICTURE FRAME OIL PAINTING 18 X 24', 'PICTURE FRAME OIL PAINTING 18 X 24', 690.0, NULL);

  SELECT string_agg(required_name, ', ' ORDER BY required_name)
  INTO v_missing
  FROM (
    SELECT 'company 1e10e2dd-655e-41e0-a508-edfd660a9bcf' AS required_name
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.companies
      WHERE id = '1e10e2dd-655e-41e0-a508-edfd660a9bcf'
        AND deleted_at IS NULL
    )
    UNION ALL
    SELECT 'UOM PCS'
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.units_of_measure
      WHERE company_id = '1e10e2dd-655e-41e0-a508-edfd660a9bcf'
        AND UPPER(code) = 'PCS'
        AND deleted_at IS NULL
    )
    UNION ALL
    SELECT 'UOM BOX'
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.units_of_measure
      WHERE company_id = '1e10e2dd-655e-41e0-a508-edfd660a9bcf'
        AND UPPER(code) = 'BOX'
        AND deleted_at IS NULL
    )
    UNION ALL
    SELECT 'item category FRM'
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.item_categories
      WHERE company_id = '1e10e2dd-655e-41e0-a508-edfd660a9bcf'
        AND code = 'FRM'
        AND deleted_at IS NULL
    )
  ) missing_records;

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Innovatronix import prerequisite records are missing: %', v_missing;
  END IF;

PERFORM setval(
  'public.item_unit_option_barcode_seq',
  GREATEST(
    (SELECT COALESCE(last_value, 1) FROM public.item_unit_option_barcode_seq),
    (SELECT COUNT(*) + 10000 FROM public.item_unit_options)
  ),
  TRUE
);

WITH constants AS (
  SELECT
    '1e10e2dd-655e-41e0-a508-edfd660a9bcf'::UUID AS company_id,
    uom_pcs.id AS pcs_uom_id,
    category.id AS category_id
  FROM public.units_of_measure uom_pcs
  JOIN public.item_categories category
    ON category.company_id = uom_pcs.company_id
   AND category.code = 'FRM'
   AND category.deleted_at IS NULL
  WHERE uom_pcs.company_id = '1e10e2dd-655e-41e0-a508-edfd660a9bcf'
    AND UPPER(uom_pcs.code) = 'PCS'
    AND uom_pcs.deleted_at IS NULL
)
INSERT INTO public.items (
  company_id,
  item_code,
  item_name,
  description,
  category_id,
  uom_id,
  item_type,
  purchase_price,
  sales_price,
  supplier_code,
  sop,
  is_stock_item,
  track_serial,
  track_batch,
  is_active,
  custom_fields
)
SELECT
  constants.company_id,
  imported.item_code,
  imported.item_name,
  imported.description,
  constants.category_id,
  constants.pcs_uom_id,
  'finished_good',
  imported.price_without_invoice,
  imported.selling_price,
  imported.supplier_code,
  imported.sop,
  TRUE,
  FALSE,
  TRUE,
  TRUE,
  jsonb_strip_nulls(jsonb_build_object(
    'color', imported.color,
    'frame_size', imported.frame_size,
    'production', imported.production
  ))
FROM public.innovatronix_import imported
CROSS JOIN constants
ON CONFLICT (company_id, item_code) DO UPDATE SET
  item_name = EXCLUDED.item_name,
  description = EXCLUDED.description,
  category_id = EXCLUDED.category_id,
  uom_id = EXCLUDED.uom_id,
  item_type = EXCLUDED.item_type,
  purchase_price = EXCLUDED.purchase_price,
  sales_price = EXCLUDED.sales_price,
  supplier_code = EXCLUDED.supplier_code,
  sop = EXCLUDED.sop,
  is_stock_item = EXCLUDED.is_stock_item,
  track_serial = EXCLUDED.track_serial,
  track_batch = EXCLUDED.track_batch,
  is_active = EXCLUDED.is_active,
  custom_fields = EXCLUDED.custom_fields,
  deleted_at = NULL,
  updated_at = CURRENT_TIMESTAMP;

WITH constants AS (
  SELECT
    '1e10e2dd-655e-41e0-a508-edfd660a9bcf'::UUID AS company_id,
    uom_pcs.id AS pcs_uom_id
  FROM public.units_of_measure uom_pcs
  WHERE uom_pcs.company_id = '1e10e2dd-655e-41e0-a508-edfd660a9bcf'
    AND UPPER(uom_pcs.code) = 'PCS'
    AND uom_pcs.deleted_at IS NULL
)
INSERT INTO public.item_unit_options (
  company_id,
  item_id,
  uom_id,
  option_label,
  qty_per_unit,
  is_base,
  is_default,
  is_active,
  sort_order
)
SELECT
  constants.company_id,
  items.id,
  constants.pcs_uom_id,
  'PCS',
  1,
  TRUE,
  TRUE,
  TRUE,
  0
FROM public.innovatronix_import imported
CROSS JOIN constants
JOIN public.items
  ON items.company_id = constants.company_id
 AND items.item_code = imported.item_code
 AND items.deleted_at IS NULL
ON CONFLICT (company_id, item_id, uom_id, qty_per_unit) WHERE deleted_at IS NULL DO UPDATE SET
  option_label = EXCLUDED.option_label,
  is_base = TRUE,
  is_default = TRUE,
  is_active = TRUE,
  sort_order = 0,
  deleted_at = NULL,
  updated_at = CURRENT_TIMESTAMP;

WITH constants AS (
  SELECT
    '1e10e2dd-655e-41e0-a508-edfd660a9bcf'::UUID AS company_id,
    uom_box.id AS box_uom_id
  FROM public.units_of_measure uom_box
  WHERE uom_box.company_id = '1e10e2dd-655e-41e0-a508-edfd660a9bcf'
    AND UPPER(uom_box.code) = 'BOX'
    AND uom_box.deleted_at IS NULL
)
INSERT INTO public.item_unit_options (
  company_id,
  item_id,
  uom_id,
  option_label,
  qty_per_unit,
  is_base,
  is_default,
  is_active,
  sort_order
)
SELECT
  constants.company_id,
  items.id,
  constants.box_uom_id,
  FORMAT(
    'BOX (%s)',
    CASE
      WHEN imported.qty_per_box = TRUNC(imported.qty_per_box)
        THEN TRUNC(imported.qty_per_box)::TEXT
      ELSE REGEXP_REPLACE(imported.qty_per_box::TEXT, '0+$', '')
    END
  ),
  imported.qty_per_box,
  FALSE,
  FALSE,
  TRUE,
  10
FROM public.innovatronix_import imported
CROSS JOIN constants
JOIN public.items
  ON items.company_id = constants.company_id
 AND items.item_code = imported.item_code
 AND items.deleted_at IS NULL
WHERE imported.qty_per_box IS NOT NULL
ON CONFLICT (company_id, item_id, uom_id, qty_per_unit) WHERE deleted_at IS NULL DO UPDATE SET
  option_label = EXCLUDED.option_label,
  is_base = FALSE,
  is_default = FALSE,
  is_active = TRUE,
  sort_order = 10,
  deleted_at = NULL,
  updated_at = CURRENT_TIMESTAMP;

WITH constants AS (
  SELECT '1e10e2dd-655e-41e0-a508-edfd660a9bcf'::UUID AS company_id
),
price_rows AS (
  SELECT item_code, 'default'::TEXT AS price_tier, 'Default'::TEXT AS price_tier_name, selling_price AS price
  FROM public.innovatronix_import
  WHERE selling_price IS NOT NULL
  UNION ALL
  SELECT item_code, 'price_without_inv'::TEXT AS price_tier, 'Price Without Invoice'::TEXT AS price_tier_name, price_without_invoice AS price
  FROM public.innovatronix_import
)
INSERT INTO public.item_prices (
  company_id,
  item_id,
  price_tier,
  price_tier_name,
  price,
  currency_code,
  effective_from,
  is_active
)
SELECT
  constants.company_id,
  items.id,
  price_rows.price_tier,
  price_rows.price_tier_name,
  price_rows.price,
  'PHP',
  DATE '2026-06-22',
  TRUE
FROM price_rows
CROSS JOIN constants
JOIN public.items
  ON items.company_id = constants.company_id
 AND items.item_code = price_rows.item_code
 AND items.deleted_at IS NULL
ON CONFLICT (company_id, item_id, price_tier, effective_from) DO UPDATE SET
  price_tier_name = EXCLUDED.price_tier_name,
  price = EXCLUDED.price,
  currency_code = EXCLUDED.currency_code,
  is_active = TRUE,
  effective_to = NULL,
  deleted_at = NULL,
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO public.warehouse_locations (
  company_id,
  warehouse_id,
  code,
  name,
  location_type,
  is_active,
  is_pickable,
  is_storable
)
SELECT
  warehouses.company_id,
  warehouses.id,
  'MAIN',
  'Main',
  'rack',
  TRUE,
  TRUE,
  TRUE
FROM public.warehouses
WHERE warehouses.company_id = '1e10e2dd-655e-41e0-a508-edfd660a9bcf'
  AND warehouses.deleted_at IS NULL
ON CONFLICT (company_id, warehouse_id, code) DO UPDATE SET
  name = EXCLUDED.name,
  location_type = EXCLUDED.location_type,
  is_active = TRUE,
  is_pickable = TRUE,
  is_storable = TRUE,
  deleted_at = NULL,
  updated_at = CURRENT_TIMESTAMP;

WITH imported_items AS (
  SELECT
    items.company_id,
    items.id AS item_id,
    warehouses.id AS warehouse_id,
    warehouse_locations.id AS location_id,
    (10 + (get_byte(decode(md5(imported.item_code || ':' || warehouses.id::TEXT), 'hex'), 0) % 91))::NUMERIC AS opening_qty
  FROM public.innovatronix_import imported
  JOIN public.items
    ON items.company_id = '1e10e2dd-655e-41e0-a508-edfd660a9bcf'
   AND items.item_code = imported.item_code
   AND items.deleted_at IS NULL
  JOIN public.warehouses
    ON warehouses.company_id = items.company_id
   AND warehouses.deleted_at IS NULL
  JOIN public.warehouse_locations
    ON warehouse_locations.company_id = warehouses.company_id
   AND warehouse_locations.warehouse_id = warehouses.id
   AND warehouse_locations.code = 'MAIN'
   AND warehouse_locations.deleted_at IS NULL
)
INSERT INTO public.item_warehouse (
  company_id,
  item_id,
  warehouse_id,
  default_location_id,
  reorder_level,
  reorder_quantity,
  current_stock,
  reserved_stock,
  is_active
)
SELECT
  company_id,
  item_id,
  warehouse_id,
  location_id,
  25,
  100,
  opening_qty,
  0,
  TRUE
FROM imported_items
ON CONFLICT (company_id, item_id, warehouse_id) DO UPDATE SET
  default_location_id = COALESCE(public.item_warehouse.default_location_id, EXCLUDED.default_location_id),
  reorder_level = EXCLUDED.reorder_level,
  reorder_quantity = EXCLUDED.reorder_quantity,
  current_stock = EXCLUDED.current_stock,
  reserved_stock = 0,
  is_active = TRUE,
  deleted_at = NULL,
  updated_at = CURRENT_TIMESTAMP;

WITH imported_items AS (
  SELECT
    items.company_id,
    items.id AS item_id,
    warehouses.id AS warehouse_id,
    (10 + (get_byte(decode(md5(imported.item_code || ':' || warehouses.id::TEXT), 'hex'), 0) % 91))::NUMERIC AS opening_qty
  FROM public.innovatronix_import imported
  JOIN public.items
    ON items.company_id = '1e10e2dd-655e-41e0-a508-edfd660a9bcf'
   AND items.item_code = imported.item_code
   AND items.deleted_at IS NULL
  JOIN public.warehouses
    ON warehouses.company_id = items.company_id
   AND warehouses.deleted_at IS NULL
)
INSERT INTO public.item_batches (
  company_id,
  item_id,
  warehouse_id,
  batch_code,
  received_at,
  qty_on_hand,
  qty_reserved
)
SELECT
  company_id,
  item_id,
  warehouse_id,
  'OPENING-BAL',
  TIMESTAMPTZ '2026-06-22 00:00:00+08',
  opening_qty,
  0
FROM imported_items
ON CONFLICT (company_id, item_id, warehouse_id, batch_code) DO UPDATE SET
  received_at = EXCLUDED.received_at,
  qty_on_hand = EXCLUDED.qty_on_hand,
  qty_reserved = 0,
  deleted_at = NULL,
  updated_at = CURRENT_TIMESTAMP;

WITH imported_batches AS (
  SELECT
    item_batches.company_id,
    item_batches.item_id,
    item_batches.warehouse_id,
    warehouse_locations.id AS location_id,
    item_batches.id AS item_batch_id,
    (10 + (get_byte(decode(md5(imported.item_code || ':' || item_batches.warehouse_id::TEXT), 'hex'), 0) % 91))::NUMERIC AS opening_qty
  FROM public.innovatronix_import imported
  JOIN public.items
    ON items.company_id = '1e10e2dd-655e-41e0-a508-edfd660a9bcf'
   AND items.item_code = imported.item_code
   AND items.deleted_at IS NULL
  JOIN public.item_batches
    ON item_batches.company_id = items.company_id
   AND item_batches.item_id = items.id
   AND item_batches.batch_code = 'OPENING-BAL'
   AND item_batches.deleted_at IS NULL
  JOIN public.warehouse_locations
    ON warehouse_locations.company_id = item_batches.company_id
   AND warehouse_locations.warehouse_id = item_batches.warehouse_id
   AND warehouse_locations.code = 'MAIN'
   AND warehouse_locations.deleted_at IS NULL
)
INSERT INTO public.item_batch_locations (
  company_id,
  item_id,
  warehouse_id,
  location_id,
  item_batch_id,
  qty_on_hand,
  qty_reserved
)
SELECT
  company_id,
  item_id,
  warehouse_id,
  location_id,
  item_batch_id,
  opening_qty,
  0
FROM imported_batches
ON CONFLICT (company_id, item_id, warehouse_id, location_id, item_batch_id) DO UPDATE SET
  qty_on_hand = EXCLUDED.qty_on_hand,
  qty_reserved = 0,
  deleted_at = NULL,
  updated_at = CURRENT_TIMESTAMP;

DROP TABLE IF EXISTS public.innovatronix_import;

-- Default reorder policy now lives on items. Seed data backfills it from the
-- seeded warehouse settings so fresh databases have item-level defaults.
UPDATE public.items i
SET
  reorder_level = CASE
    WHEN COALESCE(i.reorder_level, 0) = 0 AND source.reorder_level IS NOT NULL
      THEN source.reorder_level
    ELSE i.reorder_level
  END,
  reorder_quantity = CASE
    WHEN COALESCE(i.reorder_quantity, 0) = 0 AND source.reorder_quantity IS NOT NULL
      THEN source.reorder_quantity
    ELSE i.reorder_quantity
  END,
  updated_at = CURRENT_TIMESTAMP
FROM (
  SELECT
    iw.item_id,
    MAX(NULLIF(COALESCE(iw.reorder_level, 0), 0)) AS reorder_level,
    MAX(NULLIF(COALESCE(iw.reorder_quantity, 0), 0)) AS reorder_quantity
  FROM public.item_warehouse iw
  WHERE iw.deleted_at IS NULL
  GROUP BY iw.item_id
) source
WHERE i.id = source.item_id
  AND i.deleted_at IS NULL
  AND (
    (COALESCE(i.reorder_level, 0) = 0 AND source.reorder_level IS NOT NULL)
    OR (COALESCE(i.reorder_quantity, 0) = 0 AND source.reorder_quantity IS NOT NULL)
  );

END;
$innovatronix_import$;

INSERT INTO public.settings (
  company_id,
  business_unit_id,
  group_key,
  setting_key,
  value
)
SELECT
  business_unit.company_id,
  business_unit.id,
  'inventory',
  'picking_validation_policy',
  to_jsonb('batch_only'::TEXT)
FROM public.business_units business_unit
WHERE business_unit.is_active IS TRUE
ON CONFLICT (company_id, business_unit_id, group_key, setting_key)
  WHERE business_unit_id IS NOT NULL
DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = CURRENT_TIMESTAMP;

-- ============================================================================
-- SEED DATA: Warehouse B Rack Locations and Distributed Opening Inventory
-- ============================================================================

WITH warehouse_b AS (
  SELECT id, company_id
  FROM public.warehouses
  WHERE id = 'a2b20002-0000-4000-8000-000000000002'
    AND warehouse_code = 'WH-BU02'
    AND business_unit_id = 'd69c52d5-6755-4e28-87e3-24c680a5897b'
    AND deleted_at IS NULL
),
location_seed(code, name) AS (
  VALUES
    ('WHB-A', 'Rack A'),
    ('WHB-B', 'Rack B'),
    ('WHB-C', 'Rack C'),
    ('WHB-D', 'Rack D'),
    ('WHB-E', 'Rack E'),
    ('WHB-F', 'Rack F'),
    ('WHB-G', 'Rack G'),
    ('WHB-H', 'Rack H'),
    ('WHB-I', 'Rack I'),
    ('WHB-J', 'Rack J')
)
INSERT INTO public.warehouse_locations (
  company_id,
  warehouse_id,
  code,
  name,
  location_type,
  is_pickable,
  is_storable,
  is_active
)
SELECT
  warehouse_b.company_id,
  warehouse_b.id,
  location_seed.code,
  location_seed.name,
  'rack',
  TRUE,
  TRUE,
  TRUE
FROM warehouse_b
CROSS JOIN location_seed
ON CONFLICT (company_id, warehouse_id, code) DO UPDATE SET
  name = EXCLUDED.name,
  location_type = EXCLUDED.location_type,
  is_pickable = TRUE,
  is_storable = TRUE,
  is_active = TRUE,
  deleted_at = NULL,
  updated_at = CURRENT_TIMESTAMP;

WITH target_locations AS (
  SELECT
    warehouse_locations.id,
    ROW_NUMBER() OVER (ORDER BY warehouse_locations.code) AS row_number
  FROM public.warehouse_locations
  WHERE warehouse_locations.warehouse_id = 'a2b20002-0000-4000-8000-000000000002'
    AND warehouse_locations.code IN (
      'WHB-A',
      'WHB-B',
      'WHB-C',
      'WHB-D',
      'WHB-E',
      'WHB-F',
      'WHB-G',
      'WHB-H',
      'WHB-I',
      'WHB-J'
    )
    AND warehouse_locations.deleted_at IS NULL
),
ranked_opening_stock AS (
  SELECT
    item_batch_locations.id,
    ROW_NUMBER() OVER (ORDER BY items.item_code, item_batch_locations.id) AS row_number
  FROM public.item_batch_locations
  JOIN public.items
    ON items.id = item_batch_locations.item_id
   AND items.company_id = item_batch_locations.company_id
   AND items.deleted_at IS NULL
  JOIN public.item_batches
    ON item_batches.id = item_batch_locations.item_batch_id
   AND item_batches.batch_code = 'OPENING-BAL'
   AND item_batches.deleted_at IS NULL
  JOIN public.warehouse_locations current_location
    ON current_location.id = item_batch_locations.location_id
   AND current_location.code = 'MAIN'
   AND current_location.deleted_at IS NULL
  WHERE item_batch_locations.warehouse_id = 'a2b20002-0000-4000-8000-000000000002'
    AND item_batch_locations.qty_on_hand > 0
    AND item_batch_locations.deleted_at IS NULL
),
location_assignments AS (
  SELECT
    ranked_opening_stock.id AS item_batch_location_id,
    target_locations.id AS location_id
  FROM ranked_opening_stock
  JOIN target_locations
    ON target_locations.row_number = ranked_opening_stock.row_number
  WHERE ranked_opening_stock.row_number <= 10
),
-- Location is part of stock identity. Replace these opening-balance fixtures
-- atomically instead of updating their location; the new rack gets its own SKU.
relocated_opening_stock AS (
  DELETE FROM public.item_batch_locations stock
  USING location_assignments
  WHERE stock.id = location_assignments.item_batch_location_id
  RETURNING stock.company_id, stock.item_id, stock.warehouse_id,
    location_assignments.location_id, stock.item_batch_id,
    stock.qty_on_hand, stock.qty_reserved
)
INSERT INTO public.item_batch_locations (
  company_id, item_id, warehouse_id, location_id, item_batch_id,
  qty_on_hand, qty_reserved
)
SELECT company_id, item_id, warehouse_id, location_id, item_batch_id,
  qty_on_hand, qty_reserved
FROM relocated_opening_stock;

WITH target_locations AS (
  SELECT
    warehouse_locations.id,
    ROW_NUMBER() OVER (ORDER BY warehouse_locations.code) AS row_number
  FROM public.warehouse_locations
  WHERE warehouse_locations.warehouse_id = 'a2b20002-0000-4000-8000-000000000002'
    AND warehouse_locations.code IN (
      'WHB-A',
      'WHB-B',
      'WHB-C',
      'WHB-D',
      'WHB-E',
      'WHB-F',
      'WHB-G',
      'WHB-H',
      'WHB-I',
      'WHB-J'
    )
    AND warehouse_locations.deleted_at IS NULL
),
ranked_item_stock AS (
  SELECT
    item_warehouse.id,
    ROW_NUMBER() OVER (ORDER BY items.item_code, item_warehouse.id) AS row_number
  FROM public.item_warehouse
  JOIN public.items
    ON items.id = item_warehouse.item_id
   AND items.company_id = item_warehouse.company_id
   AND items.deleted_at IS NULL
  WHERE item_warehouse.warehouse_id = 'a2b20002-0000-4000-8000-000000000002'
    AND item_warehouse.current_stock > 0
    AND item_warehouse.deleted_at IS NULL
),
location_assignments AS (
  SELECT
    ranked_item_stock.id AS item_warehouse_id,
    target_locations.id AS location_id
  FROM ranked_item_stock
  JOIN target_locations
    ON target_locations.row_number = ranked_item_stock.row_number
  WHERE ranked_item_stock.row_number <= 10
)
UPDATE public.item_warehouse
SET
  default_location_id = location_assignments.location_id,
  updated_at = CURRENT_TIMESTAMP
FROM location_assignments
WHERE item_warehouse.id = location_assignments.item_warehouse_id;

-- Spread one existing item's opening stock across Warehouse B racks A-D.
DO $existing_item_multi_rack_seed$
DECLARE
  v_company_id CONSTANT UUID := '1e10e2dd-655e-41e0-a508-edfd660a9bcf';
  v_warehouse_id CONSTANT UUID := 'a2b20002-0000-4000-8000-000000000002';
  v_item_id UUID;
  v_item_batch_id UUID;
  v_batch_total NUMERIC(20, 4);
  v_rack_a_id UUID;
  v_rack_b_id UUID;
  v_rack_c_id UUID;
  v_rack_d_id UUID;
  v_rack_a_qty NUMERIC(20, 2);
  v_rack_b_qty NUMERIC(20, 2);
  v_rack_c_qty NUMERIC(20, 2);
  v_rack_d_qty NUMERIC(20, 2);
  v_location_total NUMERIC(20, 4);
BEGIN
  SELECT warehouse_locations.id
  INTO v_rack_a_id
  FROM public.warehouse_locations
  WHERE warehouse_locations.company_id = v_company_id
    AND warehouse_locations.warehouse_id = v_warehouse_id
    AND warehouse_locations.code = 'WHB-A'
    AND warehouse_locations.deleted_at IS NULL;

  SELECT warehouse_locations.id
  INTO v_rack_b_id
  FROM public.warehouse_locations
  WHERE warehouse_locations.company_id = v_company_id
    AND warehouse_locations.warehouse_id = v_warehouse_id
    AND warehouse_locations.code = 'WHB-B'
    AND warehouse_locations.deleted_at IS NULL;

  SELECT warehouse_locations.id
  INTO v_rack_c_id
  FROM public.warehouse_locations
  WHERE warehouse_locations.company_id = v_company_id
    AND warehouse_locations.warehouse_id = v_warehouse_id
    AND warehouse_locations.code = 'WHB-C'
    AND warehouse_locations.deleted_at IS NULL;

  SELECT warehouse_locations.id
  INTO v_rack_d_id
  FROM public.warehouse_locations
  WHERE warehouse_locations.company_id = v_company_id
    AND warehouse_locations.warehouse_id = v_warehouse_id
    AND warehouse_locations.code = 'WHB-D'
    AND warehouse_locations.deleted_at IS NULL;

  IF v_rack_a_id IS NULL OR v_rack_b_id IS NULL OR v_rack_c_id IS NULL OR v_rack_d_id IS NULL THEN
    RAISE EXCEPTION 'Cannot spread existing item stock without Warehouse B racks A-D';
  END IF;

  SELECT
    items.id,
    item_batches.id,
    item_batches.qty_on_hand
  INTO
    v_item_id,
    v_item_batch_id,
    v_batch_total
  FROM public.items
  JOIN public.units_of_measure
    ON units_of_measure.id = items.uom_id
   AND units_of_measure.company_id = items.company_id
   AND units_of_measure.code = 'STICK'
   AND units_of_measure.deleted_at IS NULL
  JOIN public.item_batches
    ON item_batches.company_id = items.company_id
   AND item_batches.item_id = items.id
   AND item_batches.warehouse_id = v_warehouse_id
   AND item_batches.batch_code = 'OPENING-BAL'
   AND item_batches.qty_on_hand >= 10
   AND item_batches.qty_on_hand = TRUNC(item_batches.qty_on_hand)
   AND item_batches.qty_reserved = 0
   AND item_batches.deleted_at IS NULL
  WHERE items.company_id = v_company_id
    AND items.deleted_at IS NULL
  ORDER BY items.item_code, item_batches.id
  LIMIT 1;

  IF v_item_id IS NULL THEN
    RAISE NOTICE 'No eligible existing Warehouse B opening-balance item found for multi-rack seed';
    RETURN;
  END IF;

  v_rack_a_qty := FLOOR(v_batch_total * 0.40);
  v_rack_b_qty := FLOOR(v_batch_total * 0.30);
  v_rack_c_qty := FLOOR(v_batch_total * 0.20);
  v_rack_d_qty := v_batch_total - v_rack_a_qty - v_rack_b_qty - v_rack_c_qty;

  DELETE FROM public.item_batch_locations
  WHERE item_batch_locations.company_id = v_company_id
    AND item_batch_locations.item_id = v_item_id
    AND item_batch_locations.warehouse_id = v_warehouse_id
    AND item_batch_locations.item_batch_id = v_item_batch_id;

  INSERT INTO public.item_batch_locations (
    company_id,
    item_id,
    warehouse_id,
    location_id,
    item_batch_id,
    qty_on_hand,
    qty_reserved
  )
  VALUES
    (
      v_company_id,
      v_item_id,
      v_warehouse_id,
      v_rack_a_id,
      v_item_batch_id,
      v_rack_a_qty,
      0.00
    ),
    (
      v_company_id,
      v_item_id,
      v_warehouse_id,
      v_rack_b_id,
      v_item_batch_id,
      v_rack_b_qty,
      0.00
    ),
    (
      v_company_id,
      v_item_id,
      v_warehouse_id,
      v_rack_c_id,
      v_item_batch_id,
      v_rack_c_qty,
      0.00
    ),
    (
      v_company_id,
      v_item_id,
      v_warehouse_id,
      v_rack_d_id,
      v_item_batch_id,
      v_rack_d_qty,
      0.00
    );

  UPDATE public.item_warehouse
  SET
    default_location_id = v_rack_a_id,
    updated_at = CURRENT_TIMESTAMP
  WHERE item_warehouse.company_id = v_company_id
    AND item_warehouse.item_id = v_item_id
    AND item_warehouse.warehouse_id = v_warehouse_id
    AND item_warehouse.deleted_at IS NULL;

  SELECT SUM(item_batch_locations.qty_on_hand)
  INTO v_location_total
  FROM public.item_batch_locations
  WHERE item_batch_locations.company_id = v_company_id
    AND item_batch_locations.item_id = v_item_id
    AND item_batch_locations.warehouse_id = v_warehouse_id
    AND item_batch_locations.item_batch_id = v_item_batch_id
    AND item_batch_locations.deleted_at IS NULL;

  IF v_location_total IS DISTINCT FROM v_batch_total THEN
    RAISE EXCEPTION
      'Existing item multi-rack total % does not reconcile to batch total %',
      v_location_total,
      v_batch_total;
  END IF;
END;
$existing_item_multi_rack_seed$;

SELECT set_config('app.skip_reorder_notification_sync', 'false', false);

-- ============================================================================
-- Framing reference data
--
-- Required framing identities are seeded for every active company, using only
-- that company's units, categories and actors. No demo data lives in migrations.
--
-- Kept idempotent (NOT EXISTS guards) so re-seeding a populated database is a
-- no-op rather than a duplicate-key failure.
-- ============================================================================

-- Each tenant needs its own unit and category references, even when it has no
-- imported item catalogue. Existing active records and prices are not replaced.
INSERT INTO public.units_of_measure (company_id, code, name, symbol, is_base_unit, is_active)
SELECT company.id, 'PCS', 'Pieces', 'pcs', true, true
FROM public.companies company
WHERE company.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.units_of_measure u
    WHERE u.company_id = company.id AND u.code = 'PCS'
  );

INSERT INTO public.item_categories (company_id, code, name, is_active)
SELECT company.id, seed.code, seed.name, true
FROM public.companies company
CROSS JOIN (VALUES
  ('FRM', 'Photo Frame'), ('ACCE', 'Accessories'), ('GLASS', 'Glass'), ('BACK', 'Backing')
) AS seed(code, name)
WHERE company.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.item_categories category
    WHERE category.company_id = company.id
      AND (category.code = seed.code OR (category.name = seed.name AND category.deleted_at IS NULL))
  );

-- CUT: the unit a frame consumes its components in. A moulding is stocked in
-- STICK and a board in SHEET, but a frame takes a length cut from one and a
-- piece cut from the other, which is how the shop's paper invoices bill them.
INSERT INTO public.units_of_measure (company_id, code, name, symbol, is_base_unit, is_active)
SELECT c.id, 'CUT', 'Cut', 'cut', false, true
FROM public.companies c
WHERE c.deleted_at IS NULL AND NOT EXISTS (
  SELECT 1 FROM public.units_of_measure u
  WHERE u.company_id = c.id AND u.code = 'CUT' AND u.deleted_at IS NULL
);

-- The two service items a configured line bills against. Not stock: the line
-- skips inventory and material moves through the job order instead.
WITH constants AS (
  SELECT
    company.id AS company_id,
    (SELECT id FROM public.units_of_measure WHERE company_id = company.id AND code = 'PCS' AND deleted_at IS NULL LIMIT 1) AS uom_id,
    (SELECT id FROM public.item_categories WHERE company_id = company.id AND name = 'Photo Frame' AND deleted_at IS NULL LIMIT 1) AS category_id,
    (SELECT id FROM public.users WHERE company_id = company.id AND deleted_at IS NULL ORDER BY created_at, id LIMIT 1) AS actor_id
  FROM public.companies company WHERE company.deleted_at IS NULL
),
seed (item_code, item_name) AS (
  VALUES
    ('SVC-CHOPJOIN', 'Chop & Join'),
    ('SVC-FRAMING',  'Framing')
)
INSERT INTO public.items (
  company_id, item_code, item_name, item_type, category_id, uom_id,
  is_stock_item, is_active, created_by, updated_by
)
SELECT
  constants.company_id, seed.item_code, seed.item_name, 'finished_good',
  constants.category_id, constants.uom_id, FALSE, TRUE,
  constants.actor_id, constants.actor_id
FROM seed CROSS JOIN constants
WHERE constants.company_id IS NOT NULL
  AND constants.uom_id IS NOT NULL
  AND constants.category_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.items existing
    WHERE existing.company_id = constants.company_id
      AND existing.item_code = seed.item_code
      AND existing.deleted_at IS NULL
  );

-- Fitting hardware. Flexipoints and multipoints bill from the fraction the
-- operator writes; the L-support prices are FLAT per-frame charges (the shop
-- reckons big as 4 sides x 18.00, small as 4 x 8.00, but the app multiplies
-- only by the frame count).
WITH constants AS (
  SELECT
    company.id AS company_id,
    (SELECT id FROM public.units_of_measure WHERE company_id = company.id AND code = 'PCS' AND deleted_at IS NULL LIMIT 1) AS uom_id,
    (SELECT id FROM public.item_categories WHERE company_id = company.id AND name = 'Accessories' AND deleted_at IS NULL LIMIT 1) AS category_id,
    (SELECT id FROM public.users WHERE company_id = company.id AND deleted_at IS NULL ORDER BY created_at, id LIMIT 1) AS actor_id
  FROM public.companies company WHERE company.deleted_at IS NULL
),
seed (item_code, item_name, sales_price) AS (
  VALUES
    ('FIT-FLEXI',     'Flexipoints',        1.50),
    ('FIT-MULTI',     'Multipoints',        8.00),
    ('FIT-LSUP-S',    'L-Support (Small)', 32.00),
    ('FIT-LSUP-B',    'L-Support (Big)',   72.00)
)
INSERT INTO public.items (
  company_id, item_code, item_name, item_type, category_id, uom_id,
  sales_price, is_active, created_by, updated_by
)
SELECT
  constants.company_id, seed.item_code, seed.item_name, 'raw_material',
  constants.category_id, constants.uom_id, seed.sales_price, TRUE,
  constants.actor_id, constants.actor_id
FROM seed CROSS JOIN constants
WHERE constants.company_id IS NOT NULL
  AND constants.uom_id IS NOT NULL
  AND constants.category_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.items existing
    WHERE existing.company_id = constants.company_id
      AND existing.item_code = seed.item_code
      AND existing.deleted_at IS NULL
  );

-- Glazing and backing types, one item each so the choice reaches the printed
-- breakdown and draws down inventory like any other component.
WITH constants AS (
  SELECT
    company.id AS company_id,
    (SELECT id FROM public.units_of_measure WHERE company_id = company.id AND code = 'PCS' AND deleted_at IS NULL LIMIT 1) AS uom_id,
    (SELECT id FROM public.users WHERE company_id = company.id AND deleted_at IS NULL ORDER BY created_at, id LIMIT 1) AS actor_id
  FROM public.companies company WHERE company.deleted_at IS NULL
),
seed (item_code, item_name, category_name) AS (
  VALUES
    ('GLZ-CLEAR',   'Clear Glass (cut to size)',     'Glass'),
    ('GLZ-DOUBLE',  'Double Glass (cut to size)',    'Glass'),
    ('GLZ-ACRYLIC', 'Acrylic (cut to size)',         'Glass'),
    ('GLZ-NONGLR',  'Non-Glare Glass (cut to size)', 'Glass'),
    ('GLZ-OCTAGON', 'Octagon Glass (cut to size)',   'Glass'),
    ('BCK-MDF',     'MDF Backing (cut to size)',     'Backing'),
    ('BCK-PLY',     'Plywood Backing (cut to size)', 'Backing'),
    ('BCK-SINTRA',  'Sintra Backing (cut to size)',  'Backing'),
    ('BCK-FOAM',    'Foam Backing (cut to size)',    'Backing')
)
INSERT INTO public.items (
  company_id, item_code, item_name, item_type, category_id, uom_id,
  is_active, created_by, updated_by
)
SELECT
  constants.company_id, seed.item_code, seed.item_name, 'raw_material',
  category.id, constants.uom_id, TRUE, constants.actor_id, constants.actor_id
FROM seed
CROSS JOIN constants
JOIN public.item_categories category
  ON category.company_id = constants.company_id
 AND category.name = seed.category_name AND category.deleted_at IS NULL
WHERE constants.company_id IS NOT NULL
  AND constants.uom_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.items existing
    WHERE existing.company_id = constants.company_id
      AND existing.item_code = seed.item_code
      AND existing.deleted_at IS NULL
  );

-- Per-piece hardware rates on the `default` tier, read the same way any other
-- item price is.
WITH constants AS (
  SELECT
    company.id AS company_id,
    (SELECT id FROM public.users WHERE company_id = company.id AND deleted_at IS NULL ORDER BY created_at, id LIMIT 1) AS actor_id
  FROM public.companies company WHERE company.deleted_at IS NULL
),
seed (item_code, price) AS (
  VALUES
    ('FIT-FLEXI',   1.50),
    ('FIT-MULTI',   8.00),
    ('FIT-LSUP-S', 32.00),
    ('FIT-LSUP-B', 72.00)
)
INSERT INTO public.item_prices (
  company_id, item_id, price_tier, price_tier_name, price, currency_code,
  is_active, created_by, updated_by
)
SELECT
  constants.company_id, item.id, 'default', 'Default', seed.price, 'PHP',
  TRUE, constants.actor_id, constants.actor_id
FROM seed
CROSS JOIN constants
JOIN public.items item
  ON item.company_id = constants.company_id
 AND item.item_code = seed.item_code
 AND item.deleted_at IS NULL
WHERE NOT EXISTS (
  SELECT 1 FROM public.item_prices existing
  WHERE existing.item_id = item.id
    AND existing.price_tier = 'default'
    AND existing.deleted_at IS NULL
);

-- ---------------------------------------------------------------------------
-- Framing reference stock
--
-- The glazing, backing and fitting items above are seeded as item masters only,
-- with no item_warehouse row at all — so every one of them reads as zero stock
-- and cannot be issued to a job order. Residual-material production remains
-- allowed; these balances are only for the demo warehouse issue workflow.
--
-- Opening quantities are generous because these are cut-to-size consumables a
-- demo should never run out of. The two SVC- items are deliberately excluded:
-- they are services, not stocked goods.
--
-- Idempotent: re-running tops the balances back up rather than doubling them.
-- ---------------------------------------------------------------------------
WITH constants AS (
  SELECT company.id AS company_id
  FROM public.companies company WHERE company.deleted_at IS NULL
),
seed (item_code, opening_qty) AS (
  VALUES
    ('GLZ-CLEAR',   500),
    ('GLZ-DOUBLE',  300),
    ('GLZ-ACRYLIC', 300),
    ('GLZ-NONGLR',  200),
    ('GLZ-OCTAGON', 150),
    ('BCK-MDF',     500),
    ('BCK-PLY',     500),
    ('BCK-SINTRA',  250),
    ('BCK-FOAM',    250),
    ('FIT-FLEXI',   2000),
    ('FIT-MULTI',   2000),
    ('FIT-LSUP-S',  1000),
    ('FIT-LSUP-B',  1000)
),
targets AS (
  SELECT
    constants.company_id,
    item.id AS item_id,
    warehouse.id AS warehouse_id,
    location.id AS location_id,
    seed.opening_qty::NUMERIC AS opening_qty
  FROM seed
  CROSS JOIN constants
  JOIN public.items item
    ON item.company_id = constants.company_id
   AND item.item_code = seed.item_code
   AND item.deleted_at IS NULL
  JOIN public.warehouses warehouse
    ON warehouse.company_id = constants.company_id
   AND warehouse.deleted_at IS NULL
  LEFT JOIN public.warehouse_locations location
    ON location.company_id = constants.company_id
   AND location.warehouse_id = warehouse.id
   AND location.code = 'MAIN'
   AND location.deleted_at IS NULL
)
INSERT INTO public.item_warehouse (
  company_id, item_id, warehouse_id, default_location_id,
  reorder_level, reorder_quantity, current_stock, reserved_stock, is_active
)
SELECT
  company_id, item_id, warehouse_id, location_id,
  50, 200, opening_qty, 0, TRUE
FROM targets
ON CONFLICT (company_id, item_id, warehouse_id) DO UPDATE SET
  default_location_id = COALESCE(public.item_warehouse.default_location_id, EXCLUDED.default_location_id),
  reorder_level = EXCLUDED.reorder_level,
  reorder_quantity = EXCLUDED.reorder_quantity,
  current_stock = GREATEST(public.item_warehouse.current_stock, EXCLUDED.current_stock),
  is_active = TRUE,
  deleted_at = NULL,
  updated_at = CURRENT_TIMESTAMP;
DO $canvas_import$
DECLARE
  v_missing TEXT;
BEGIN
INSERT INTO public.item_categories (
  company_id, code, name, description, is_active
)
SELECT
  '1e10e2dd-655e-41e0-a508-edfd660a9bcf',
  'CANVAS',
  'Canvas',
  'Canvas products and canvas panels',
  TRUE
WHERE NOT EXISTS (
  SELECT 1
  FROM public.item_categories
  WHERE company_id = '1e10e2dd-655e-41e0-a508-edfd660a9bcf'
    AND code = 'CANVAS'
    AND deleted_at IS NULL
);

DROP TABLE IF EXISTS public.canvas_import;

CREATE TABLE public.canvas_import (
  item_code TEXT NOT NULL,
  item_name TEXT NOT NULL,
  description TEXT,
  qty_per_case NUMERIC,
  fc_price NUMERIC,
  ws_price NUMERIC,
  srp_price NUMERIC
);

INSERT INTO public.canvas_import (
  item_code, item_name, description, qty_per_case, fc_price, ws_price, srp_price
) VALUES
  ('SCWC081000', '8 X 10 WHITE STRETCHED CANVAS  100% COTTON 380g', '8 X 10 WHITE STRETCHED CANVAS  100% COTTON 380g', 40.0, 86.0, 102.0, 114.0),
  ('SCWC091200', '9 X 12 WHITE STRETCHED CANVAS  100% COTTON 380g', '9 X 12 WHITE STRETCHED CANVAS  100% COTTON 380g', 40.0, 93.5, 110.0, 122.5),
  ('SCWC121200', '12 X 12 WHITE STRETCHED CANVAS  100% COTTON 380g', '12 X 12 WHITE STRETCHED CANVAS  100% COTTON 380g', 40.0, 108.0, 127.0, 142.5),
  ('SCWC101400', '10 X 14 WHITE STRETCHED CANVAS 100% COTTON 380g', '10 X 14 WHITE STRETCHED CANVAS 100% COTTON 380g', 40.0, 108.0, 127.0, 142.5),
  ('SCWC121600', '12 X 16 WHITE STRETCHED CANVAS  100% COTTON 380g', '12 X 16 WHITE STRETCHED CANVAS  100% COTTON 380g', 40.0, 147.0, 173.5, 192.5),
  ('SCWC141800', '14 X 18 WHITE STRETCHED CANVAS  100% COTTON 380g', '14 X 18 WHITE STRETCHED CANVAS  100% COTTON 380g', 20.0, 153.0, 180.0, 199.5),
  ('SCWC162000', '16 X 20 WHITE STRETCHED CANVAS  100% COTTON 380g', '16 X 20 WHITE STRETCHED CANVAS  100% COTTON 380g', 20.0, 157.0, 183.5, 206.0),
  ('SCWC182400', '18 X 24 WHITE  STRETCHED CANVAS  100% COTTON 380g', '18 X 24 WHITE  STRETCHED CANVAS  100% COTTON 380g', 20.0, 208.0, 244.5, 271.0),
  ('SCWC203000', '20 X 30 WHITE STRETCHED CANVAS  100% COTTON 380g', '20 X 30 WHITE STRETCHED CANVAS  100% COTTON 380g', 10.0, 306.0, 359.5, 400.0),
  ('SCWC243600', '24 X 36  WHITE STRETCHED CANVAS  100% COTTON 380g', '24 X 36  WHITE STRETCHED CANVAS  100% COTTON 380g', 10.0, 356.0, 419.5, 464.5),
  ('SCBC091200', '9 X 12 BLACK STRETCHED CANVAS  100% COTTON 380g', '9 X 12 BLACK STRETCHED CANVAS  100% COTTON 380g', 40.0, 98.0, 115.0, 128.5),
  ('SCBC101400', '10 X 14 BLACK STRETCHED CANVAS  100% COTTON 380g', '10 X 14 BLACK STRETCHED CANVAS  100% COTTON 380g', 40.0, 114.0, 133.5, 148.0),
  ('SCBC162000', '16 X 20 BLACK STRETCHED CANVAS  100% COTTON 380g', '16 X 20 BLACK STRETCHED CANVAS  100% COTTON 380g', 20.0, 171.0, 202.0, 224.0),
  ('SCBC121800', '12 X 18 BLACK STRETCHED CANVAS  100% COTTON 380g', '12 X 18 BLACK STRETCHED CANVAS  100% COTTON 380g', 20.0, 248.5, 293.0, 324.0),
  ('SCBC203000', '20 X 30 BLACK STRETCHED CANVAS  100% COTTON 380g', '20 X 30 BLACK STRETCHED CANVAS  100% COTTON 380g', 10.0, 348.5, 409.5, 454.5),
  ('SCBC243600', '24 X 36 BLACK STRETCHED CANVAS  100% COTTON 380g', '24 X 36 BLACK STRETCHED CANVAS  100% COTTON 380g', 10.0, 428.0, 503.5, 559.0),
  ('SCWR080800', '8" WHITE ROUND WHITE STRETCHED CANVAS 380g', '8" WHITE ROUND WHITE STRETCHED CANVAS 380g', NULL, 171.0, 201.0, 224.0),
  ('SCWR121200', '12" WHITE ROUND WHITE STRETCHED CANVAS 380g', '12" WHITE ROUND WHITE STRETCHED CANVAS 380g', NULL, 220.0, 259.0, 287.5),
  ('SCWR161600', '16" WHITE ROUND WHITE STRETCHED CANVAS 380g', '16" WHITE ROUND WHITE STRETCHED CANVAS 380g', NULL, 257.0, 302.5, 336.0),
  ('SCWR202000', '20" WHITE ROUND WHITE STRETCHED CANVAS 380g', '20" WHITE ROUND WHITE STRETCHED CANVAS 380g', NULL, 306.0, 361.0, 401.0),
  ('SCWR235235', '23.5" WHITE ROUND WHITE STRETCHED CANVAS 380g', '23.5" WHITE ROUND WHITE STRETCHED CANVAS 380g', NULL, 550.0, 648.0, 719.0),
  ('SCWH201600', '20cm X 16cm HEART WHITE STRETCHED CANVAS 380g', '20cm X 16cm HEART WHITE STRETCHED CANVAS 380g', NULL, 171.0, 201.0, 224.0),
  ('SCWH302400', '30cm X 24cm HEART WHITE STRETCHED CANVAS 380g', '30cm X 24cm HEART WHITE STRETCHED CANVAS 380g', NULL, 220.0, 259.0, 287.5),
  ('SCWH403200', '40cm X 32Cm HEART WHITE STRETCHED CANVAS 380g', '40cm X 32Cm HEART WHITE STRETCHED CANVAS 380g', NULL, 257.0, 302.5, 336.0),
  ('SCWH504000', '50cm X 40cm HEART WHITE STRETCHED CANVAS 380g', '50cm X 40cm HEART WHITE STRETCHED CANVAS 380g', NULL, 306.0, 361.0, 401.0),
  ('CPW0810000', '8 X 10 WHITE CANVAS PANEL 380g', '8 X 10 WHITE CANVAS PANEL 380g', 60.0, 36.0, 43.0, 48.0),
  ('CPW0912000', '9 X 12 WHITE CANVAS PANEL 380g', '9 X 12 WHITE CANVAS PANEL 380g', 60.0, 44.5, 52.0, 59.0),
  ('CPW1014000', '10 X 14 WHITE CANVAS PANEL 380g', '10 X 14 WHITE CANVAS PANEL 380g', 48.0, 65.0, 76.5, 86.0),
  ('CPW1218000', '12 X 18 WHITE CANVAS PANEL 380g', '12 X 18 WHITE CANVAS PANEL 380g', 48.0, 99.0, 116.0, 130.0),
  ('CRB8210060', '82" X 10m BLACK CANVAS ROLL CRB 821006 380g', '82" X 10m BLACK CANVAS ROLL CRB 821006 380g', NULL, 4278.0, 4644.5, 4889.0),
  ('CRW8210050', '82" X 10m WHITE CANVAS ROLL CRW 821005 380g', '82" X 10m WHITE CANVAS ROLL CRW 821005 380g', NULL, 3544.5, 4033.5, 4278.0),
  ('CRW8210060', '82" X 10m WHITE CANVAS ROLL CRW 821006 380g', '82" X 10m WHITE CANVAS ROLL CRW 821006 380g', NULL, 3544.5, 4033.5, 4278.0),
  ('CRW7010030', '70" X 10m WHITE CANVAS ROLL CRW 701003 420g', '70" X 10m WHITE CANVAS ROLL CRW 701003 420g', NULL, 4191.0, 4657.0, 5500.0),
  ('CRW8210030', '82" X 10m WHITE CANVAS ROLL CRW 821003 420g', '82" X 10m WHITE CANVAS ROLL CRW 821003 420g', NULL, 4889.0, 5011.0, 5133.5),
  ('SCWBF08100', '8 X 10 WHITE SCTRETCHED CANVAS 380g W/ BLACK FRAME', '8 X 10 WHITE SCTRETCHED CANVAS 380g W/ BLACK FRAME', 20.0, 267.0, 313.5, 348.5),
  ('SCWGF08100', '8 X 10 WHITE SCTRETCHED CANVAS 380g W/ GOLD FRAME ', '8 X 10 WHITE SCTRETCHED CANVAS 380g W/ GOLD FRAME ', 20.0, 267.0, 313.5, 348.5),
  ('SCWWF08100', '8 X 10 WHITE SCTRETCHED CANVAS 380g W/ WHITE FRAME', '8 X 10 WHITE SCTRETCHED CANVAS 380g W/ WHITE FRAME', 20.0, 267.0, 313.5, 348.5),
  ('SCWBF09120', '9 X 12 WHITE SCRETCHED CANVAS 380g W/ BLACK FRAME', '9 X 12 WHITE SCRETCHED CANVAS 380g W/ BLACK FRAME', 20.0, 291.0, 342.5, 380.0),
  ('SCWGF09120', '9 X 12 WHITE SCRETCHED CANVAS 380g W/ GOLD FRAME', '9 X 12 WHITE SCRETCHED CANVAS 380g W/ GOLD FRAME', 20.0, 291.0, 342.5, 380.0),
  ('SCWWF09120', '9 X 12 WHITE SCRETCHED CANVAS 380g W/ WHITE FRAME', '9 X 12 WHITE SCRETCHED CANVAS 380g W/ WHITE FRAME', 20.0, 291.0, 342.5, 380.0),
  ('SCWBF12120', '12 x 12 WHITE SCRETCHED CANVAS 380g W/ BLACK FRAME', '12 x 12 WHITE SCRETCHED CANVAS 380g W/ BLACK FRAME', 20.0, 330.0, 389.0, 432.0),
  ('SCWGF12120', '12 X 12 WHITE SCRETCHED CANVAS 380g W/ GOLD FRAME', '12 X 12 WHITE SCRETCHED CANVAS 380g W/ GOLD FRAME', 20.0, 330.0, 389.0, 432.0),
  ('SCWWF12120', '12 X 12 WHITE SCRETCHED CANVAS 380g W/ WHITE FRAME', '12 X 12 WHITE SCRETCHED CANVAS 380g W/ WHITE FRAME', 20.0, 330.0, 389.0, 432.0),
  ('SCWBF10140', '10 X 14 WHITE SCRETCHED CANVAS 380g W/ BLACK FRAME', '10 X 14 WHITE SCRETCHED CANVAS 380g W/ BLACK FRAME', 20.0, 330.0, 389.0, 432.0),
  ('SCWGF10140', '10 X 14 WHITE SCRETCHED CANVAS 380g W/ GOLD FRAME', '10 X 14 WHITE SCRETCHED CANVAS 380g W/ GOLD FRAME', 20.0, 330.0, 389.0, 432.0),
  ('SCWWF10140', '10  X 14 WHITE SCRETCHED CANVAS 380g W/ WHITE FRAME', '10  X 14 WHITE SCRETCHED CANVAS 380g W/ WHITE FRAME', 20.0, 330.0, 389.0, 432.0),
  ('SCWBF12160', '12 X 16 WHITE SCRETCHED CANVAS 380g W/ BLACK FRAME', '12 X 16 WHITE SCRETCHED CANVAS 380g W/ BLACK FRAME', 20.0, 401.0, 472.5, 524.5),
  ('SCWGF12160', '12 X 16 WHITE SCRETCHED CANVAS 380g W/ GOLD FRAME', '12 X 16 WHITE SCRETCHED CANVAS 380g W/ GOLD FRAME', 20.0, 401.0, 472.5, 524.5),
  ('SCWGF12161', '12 X 16 WHITE SCRETCHED CANVAS 380g W/ WHITE FRAME', '12 X 16 WHITE SCRETCHED CANVAS 380g W/ WHITE FRAME', 20.0, 401.0, 472.5, 524.5),
  ('SCWBF14180', '14 X 18 WHITE SCRETCHED CANVAS 380g W/ BLACK FRAME', '14 X 18 WHITE SCRETCHED CANVAS 380g W/ BLACK FRAME', 20.0, 430.0, 506.0, 562.5),
  ('SCWGF14180', '14 X 18 WHITE SCRETCHED CANVAS 380g W/ GOLD FRAME', '14 X 18 WHITE SCRETCHED CANVAS 380g W/ GOLD FRAME', 20.0, 430.0, 506.0, 562.5),
  ('SCWWF14180', '14 X 18 WHITE SCRETCHED CANVAS 380g W/ WHITE FRAME', '14 X 18 WHITE SCRETCHED CANVAS 380g W/ WHITE FRAME', 20.0, 430.0, 506.0, 562.5),
  ('SCWBF16200', '16 X 20 WHITE SCRETCHED CANVAS 380g W/ BLACK FRAME', '16 X 20 WHITE SCRETCHED CANVAS 380g W/ BLACK FRAME', 10.0, 464.5, 547.0, 608.0),
  ('SCWGF16200', '16 X 20 WHITE SCRETCHED CANVAS 380g W/ GOLD FRAME', '16 X 20 WHITE SCRETCHED CANVAS 380g W/ GOLD FRAME', 10.0, 464.5, 547.0, 608.0),
  ('SCWWF16200', '16 X 20 WHITE SCRETCHED CANVAS 380g W/ WHITE FRAME', '16 X 20 WHITE SCRETCHED CANVAS 380g W/ WHITE FRAME', 10.0, 464.5, 547.0, 608.0),
  ('SCWBF18240', '18 X 24 WHITE SCRETCHED CANVAS 380g W/ BLACK FRAME', '18 X 24 WHITE SCRETCHED CANVAS 380g W/ BLACK FRAME', 10.0, 594.5, 698.0, 776.0),
  ('SCWGF18240', '18 X 24 WHITE SCRETCHED CANVAS 380g W/ GOLD FRAME', '18 X 24 WHITE SCRETCHED CANVAS 380g W/ GOLD FRAME', 10.0, 594.5, 698.0, 776.0),
  ('SCWWF18240', '18 X 24 WHITE SCRETCHED CANVAS 380g W/ WHITE FRAME', '18 X 24 WHITE SCRETCHED CANVAS 380g W/ WHITE FRAME', 10.0, 594.5, 698.0, 776.0),
  ('SCWBF20300', '20 X 30 WHITE SCRETCHED CANVAS 380g W/ BLACK FRAME', '20 X 30 WHITE SCRETCHED CANVAS 380g W/ BLACK FRAME', 6.0, 703.0, 828.0, 919.0),
  ('SCWGF20300', '20 X 30 WHITE SCRETCHED CANVAS 380g W/ GOLD FRAME', '20 X 30 WHITE SCRETCHED CANVAS 380g W/ GOLD FRAME', 6.0, 703.0, 828.0, 919.0),
  ('SCWWF20300', '20 X 30 WHITE SCRETCHED CANVAS 380g W/ WHITE FRAME', '20 X 30 WHITE SCRETCHED CANVAS 380g W/ WHITE FRAME', 6.0, 703.0, 828.0, 919.0),
  ('SCWBF24360', '24 X 36 WHITE SCRETCHED CANVAS 380g W/ BLACK FRAME', '24 X 36 WHITE SCRETCHED CANVAS 380g W/ BLACK FRAME', 6.0, 820.0, 964.5, 1073.5),
  ('SCWGF24360', '24 X 36 WHITE SCRETCHED CANVAS 380g W/ GOLD FRAME', '24 X 36 WHITE SCRETCHED CANVAS 380g W/ GOLD FRAME', 6.0, 820.0, 964.5, 1073.5),
  ('SCWWF24360', '24 X 36 WHITE SCRETCHED CANVAS 380g W/ WHITE FRAME', '24 X 36 WHITE SCRETCHED CANVAS 380g W/ WHITE FRAME', 6.0, 820.0, 964.5, 1073.5),
  ('SCBBF09120', '9 X 12 BLACK SCRETCHED CANVAS 380g W/ BLACK FRAME', '9 X 12 BLACK SCRETCHED CANVAS 380g W/ BLACK FRAME', 20.0, 296.0, 348.5, 387.0),
  ('SCBGF09120', '9 X 12 BLACK SCRETCHED CANVAS 380g W/ GOLD FRAME', '9 X 12 BLACK SCRETCHED CANVAS 380g W/ GOLD FRAME', 20.0, 296.0, 348.5, 387.0),
  ('SCBWF09120', '9 X 12 BLACK SCRETCHED CANVAS 380g W/ WHITE FRAME', '9 X 12 BLACK SCRETCHED CANVAS 380g W/ WHITE FRAME', 20.0, 296.0, 348.5, 387.0),
  ('SCBBF10140', '10 X 14 BLACK SCRETCHED CANVAS 380g W/ BLACK FRAME', '10 X 14 BLACK SCRETCHED CANVAS 380g W/ BLACK FRAME', 20.0, 338.0, 397.5, 440.0),
  ('SCBGF10140', '10 X 14 BLACK SCRETCHED CANVAS 380g W/ GOLD FRAME', '10 X 14 BLACK SCRETCHED CANVAS 380g W/ GOLD FRAME', 20.0, 338.0, 397.5, 440.0),
  ('SCBWF10140', '10 X 14 BLACK SCRETCHED CANVAS 380g W/ WHITE FRAME', '10 X 14 BLACK SCRETCHED CANVAS 380g W/ WHITE FRAME', 20.0, 338.0, 397.5, 440.0),
  ('SCBBF16200', '16 X 20 BLACK SCRETCHED CANVAS 380g W/ BLACK FRAME', '16 X 20 BLACK SCRETCHED CANVAS 380g W/ BLACK FRAME', 10.0, 479.0, 563.5, 626.0),
  ('SCBGF16200', '16 X 20 BLACK SCRETCHED CANVAS 380g W/ GOLD FRAME', '16 X 20 BLACK SCRETCHED CANVAS 380g W/ GOLD FRAME', 10.0, 479.0, 563.5, 626.0),
  ('SCBWF16200', '16 X 20 BLACK SCRETCHED CANVAS 380g W/ WHITE FRAME', '16 X 20 BLACK SCRETCHED CANVAS 380g W/ WHITE FRAME', 10.0, 479.0, 563.5, 626.0),
  ('SCBBF18240', '18 X 24 BLACK SCRETCHED CANVAS 380g W/ BLACK FRAME', '18 X 24 BLACK SCRETCHED CANVAS 380g W/ BLACK FRAME', 10.0, 634.5, 746.0, 829.0),
  ('SCBGF18240', '18 X 24 BLACK SCRETCHED CANVAS 380g W/ GOLD FRAME', '18 X 24 BLACK SCRETCHED CANVAS 380g W/ GOLD FRAME', 10.0, 634.5, 746.0, 829.0),
  ('SCBWF18240', '18 X 24 BLACK SCRETCHED CANVAS 380g W/ WHITE FRAME', '18 X 24 BLACK SCRETCHED CANVAS 380g W/ WHITE FRAME', 10.0, 634.5, 746.0, 829.0),
  ('SCBBF20300', '20 X 30 BLACK SCRETCHED CANVAS 380g W/ BLACK FRAME', '20 X 30 BLACK SCRETCHED CANVAS 380g W/ BLACK FRAME', 6.0, 746.0, 877.0, 974.5),
  ('SCBGF20300', '20 X 30 BLACK SCRETCHED CANVAS 380g W/ GOLD FRAME', '20 X 30 BLACK SCRETCHED CANVAS 380g W/ GOLD FRAME', 6.0, 746.0, 877.0, 974.5),
  ('SCBWF20300', '20 X 30 BLACK SCRETCHED CANVAS 380g W/ WHITE FRAME', '20 X 30 BLACK SCRETCHED CANVAS 380g W/ WHITE FRAME', 6.0, 746.0, 877.0, 974.5),
  ('SCBBF24360', '24 X 36 BLACK SCRETCHED CANVAS 380g W/ BLACK FRAME', '24 X 36 BLACK SCRETCHED CANVAS 380g W/ BLACK FRAME', 6.0, 892.5, 1049.0, 1167.5),
  ('SCBGF24360', '24 X 36 BLACK SCRETCHED CANVAS 380g W/ GOLD FRAME', '24 X 36 BLACK SCRETCHED CANVAS 380g W/ GOLD FRAME', 6.0, 892.5, 1049.0, 1167.5),
  ('SCBWF24360', '24 X 36 BLACK SCRETCHED CANVAS 380g W/ WHITE FRAME', '24 X 36 BLACK SCRETCHED CANVAS 380g W/ WHITE FRAME', 6.0, 892.5, 1049.0, 1167.5),
  ('SCRBF08080', '8" ROUND STRETCHED CANVAS W/ BLACK FRAME', '8" ROUND STRETCHED CANVAS W/ BLACK FRAME', NULL, 428.0, 503.5, 560.0),
  ('SCRWF08080', '8" ROUND STRETCHED CANVAS W/ WHITE FRAME', '8" ROUND STRETCHED CANVAS W/ WHITE FRAME', NULL, 428.0, 503.5, 560.0),
  ('SCRBF12120', '12" ROUND STRETCHED CANVAS W/ BLACK FRAME', '12" ROUND STRETCHED CANVAS W/ BLACK FRAME', NULL, 571.0, 672.5, 747.0),
  ('SCRWF12120', '12" ROUND STRETCHED CANVAS W/ WHITE FRAME', '12" ROUND STRETCHED CANVAS W/ WHITE FRAME', NULL, 571.0, 672.5, 747.0),
  ('SCRBF16160', '16" ROUND STRETCHED CANVAS W/ BLACK FRAME', '16" ROUND STRETCHED CANVAS W/ BLACK FRAME', NULL, 770.0, 907.0, 1008.5),
  ('SCRWF16160', '16" ROUND STRETCHED CANVAS W/ WHITE FRAME', '16" ROUND STRETCHED CANVAS W/ WHITE FRAME', NULL, 770.0, 907.0, 1008.5),
  ('SCRBF20200', '20" ROUND STRETCHED CANVAS W/ BLACK FRAME', '20" ROUND STRETCHED CANVAS W/ BLACK FRAME', NULL, 1002.5, 1179.5, 1310.0),
  ('SCRWF20200', '20" ROUND STRETCHED CANVAS W/ WHITE FRAME', '20" ROUND STRETCHED CANVAS W/ WHITE FRAME', NULL, 1002.5, 1179.5, 1310.0),
  ('CPWBF08100', '8 X 10 CANVAS PANEL WHITE 380g W/ BLACK FRAME', '8 X 10 CANVAS PANEL WHITE 380g W/ BLACK FRAME', 40.0, 110.0, 130.0, 144.5),
  ('CPWNF08100', '8 X 10 CANVAS PANEL WHITE 380g W/ NATURAL FRAME', '8 X 10 CANVAS PANEL WHITE 380g W/ NATURAL FRAME', 40.0, 110.0, 130.0, 144.5),
  ('CPWWF08100', '8 X 10 CANVAS PANEL WHITE 380g W/ WHITE FRAME', '8 X 10 CANVAS PANEL WHITE 380g W/ WHITE FRAME', 40.0, 110.0, 130.0, 144.5),
  ('CPWBF09120', '9 X 12 CANVAS PANEL WHITE 380g W/ BLACK FRAME', '9 X 12 CANVAS PANEL WHITE 380g W/ BLACK FRAME', 40.0, 134.5, 159.0, 177.5),
  ('CPWNF09120', '9 X 12 CANVAS PANEL WHITE 380g W/ NATURAL FRAME', '9 X 12 CANVAS PANEL WHITE 380g W/ NATURAL FRAME', 40.0, 134.5, 159.0, 177.5),
  ('CPWWF9120', '9 X 12 CANVAS PANEL WHITE 380g W/ WHITE FRAME', '9 X 12 CANVAS PANEL WHITE 380g W/ WHITE FRAME', 40.0, 134.5, 159.0, 177.5),
  ('CPWBF10140', '10 X 14 CANVAS PANEL WHITE 380g W/ BLACK FRAME', '10 X 14 CANVAS PANEL WHITE 380g W/ BLACK FRAME', 40.0, 165.0, 194.5, 217.0),
  ('CPWNF10140', '10 X 14 CANVAS PANEL WHITE 380g W/ NATURAL FRAME', '10 X 14 CANVAS PANEL WHITE 380g W/ NATURAL FRAME', 40.0, 165.0, 194.5, 217.0),
  ('CPWWF10140', '10 X 14 CANVAS PANEL WHITE 380g W/ WHITE FRAME', '10 X 14 CANVAS PANEL WHITE 380g W/ WHITE FRAME', 40.0, 165.0, 194.5, 217.0),
  ('CPWBF12180', '12 X 18 CANVAS PANEL WHITE 380g W/ BLACK FRAME', '12 X 18 CANVAS PANEL WHITE 380g W/ BLACK FRAME', 24.0, 257.0, 432.0, 481.0),
  ('CPWNF12180', '12 X 18 CANVAS PANEL WHITE 380g W/ NATURAL FRAME', '12 X 18 CANVAS PANEL WHITE 380g W/ NATURAL FRAME', 24.0, 257.0, 432.0, 481.0),
  ('CPWWF12180', '12 X 18 CANVAS PANEL WHITE 380g W/ WHITE FRAME', '12 X 18 CANVAS PANEL WHITE 380g W/ WHITE FRAME', 24.0, 257.0, 432.0, 481.0);

SELECT string_agg(required_name, ', ' ORDER BY required_name)
INTO v_missing
FROM (
  SELECT 'company 1e10e2dd-655e-41e0-a508-edfd660a9bcf' AS required_name
  WHERE NOT EXISTS (
    SELECT 1 FROM public.companies
    WHERE id = '1e10e2dd-655e-41e0-a508-edfd660a9bcf' AND deleted_at IS NULL
  )
  UNION ALL
  SELECT 'UOM PCS'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.units_of_measure
    WHERE company_id = '1e10e2dd-655e-41e0-a508-edfd660a9bcf'
      AND UPPER(code) = 'PCS' AND deleted_at IS NULL
  )
  UNION ALL
  SELECT 'UOM BOX'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.units_of_measure
    WHERE company_id = '1e10e2dd-655e-41e0-a508-edfd660a9bcf'
      AND UPPER(code) = 'BOX' AND deleted_at IS NULL
  )
  UNION ALL
  SELECT 'item category CANVAS'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.item_categories
    WHERE company_id = '1e10e2dd-655e-41e0-a508-edfd660a9bcf'
      AND code = 'CANVAS' AND deleted_at IS NULL
  )
) missing_records;

IF v_missing IS NOT NULL THEN
  RAISE EXCEPTION 'Canvas import prerequisite records are missing: %', v_missing;
END IF;

PERFORM setval(
  'public.item_unit_option_barcode_seq',
  GREATEST(
    (SELECT COALESCE(last_value, 1) FROM public.item_unit_option_barcode_seq),
    (SELECT COUNT(*) + 10000 FROM public.item_unit_options)
  ),
  TRUE
);

WITH constants AS (
  SELECT
    '1e10e2dd-655e-41e0-a508-edfd660a9bcf'::UUID AS company_id,
    uom_pcs.id AS pcs_uom_id,
    category.id AS category_id
  FROM public.units_of_measure uom_pcs
  JOIN public.item_categories category
    ON category.company_id = uom_pcs.company_id
   AND category.code = 'CANVAS'
   AND category.deleted_at IS NULL
  WHERE uom_pcs.company_id = '1e10e2dd-655e-41e0-a508-edfd660a9bcf'
    AND UPPER(uom_pcs.code) = 'PCS'
    AND uom_pcs.deleted_at IS NULL
)
INSERT INTO public.items (
  company_id, item_code, item_name, description, category_id, uom_id,
  item_type, purchase_price, sales_price, is_stock_item, track_serial,
  track_batch, is_active
)
SELECT
  constants.company_id, imported.item_code, imported.item_name, imported.description,
  constants.category_id, constants.pcs_uom_id, 'finished_good',
  imported.fc_price, imported.srp_price, TRUE, FALSE, TRUE, TRUE
FROM public.canvas_import imported
CROSS JOIN constants
ON CONFLICT (company_id, item_code) DO UPDATE SET
  item_name = EXCLUDED.item_name,
  description = EXCLUDED.description,
  category_id = EXCLUDED.category_id,
  uom_id = EXCLUDED.uom_id,
  item_type = EXCLUDED.item_type,
  purchase_price = EXCLUDED.purchase_price,
  sales_price = EXCLUDED.sales_price,
  is_stock_item = EXCLUDED.is_stock_item,
  track_serial = EXCLUDED.track_serial,
  track_batch = EXCLUDED.track_batch,
  is_active = EXCLUDED.is_active,
  deleted_at = NULL,
  updated_at = CURRENT_TIMESTAMP;

WITH constants AS (
  SELECT
    '1e10e2dd-655e-41e0-a508-edfd660a9bcf'::UUID AS company_id,
    uom_pcs.id AS pcs_uom_id
  FROM public.units_of_measure uom_pcs
  WHERE uom_pcs.company_id = '1e10e2dd-655e-41e0-a508-edfd660a9bcf'
    AND UPPER(uom_pcs.code) = 'PCS' AND uom_pcs.deleted_at IS NULL
)
INSERT INTO public.item_unit_options (
  company_id, item_id, uom_id, option_label, qty_per_unit,
  is_base, is_default, is_active, sort_order
)
SELECT constants.company_id, items.id, constants.pcs_uom_id, 'PCS',
       1, TRUE, TRUE, TRUE, 0
FROM public.canvas_import imported
CROSS JOIN constants
JOIN public.items
  ON items.company_id = constants.company_id
 AND items.item_code = imported.item_code AND items.deleted_at IS NULL
ON CONFLICT (company_id, item_id, uom_id, qty_per_unit) WHERE deleted_at IS NULL DO UPDATE SET
  option_label = EXCLUDED.option_label, is_base = TRUE, is_default = TRUE,
  is_active = TRUE, sort_order = 0, deleted_at = NULL,
  updated_at = CURRENT_TIMESTAMP;

WITH constants AS (
  SELECT
    '1e10e2dd-655e-41e0-a508-edfd660a9bcf'::UUID AS company_id,
    uom_box.id AS box_uom_id
  FROM public.units_of_measure uom_box
  WHERE uom_box.company_id = '1e10e2dd-655e-41e0-a508-edfd660a9bcf'
    AND UPPER(uom_box.code) = 'BOX' AND uom_box.deleted_at IS NULL
)
INSERT INTO public.item_unit_options (
  company_id, item_id, uom_id, option_label, qty_per_unit,
  is_base, is_default, is_active, sort_order
)
SELECT constants.company_id, items.id, constants.box_uom_id,
       FORMAT('BOX (%s)', TRUNC(imported.qty_per_case)::TEXT),
       imported.qty_per_case, FALSE, FALSE, TRUE, 10
FROM public.canvas_import imported
CROSS JOIN constants
JOIN public.items
  ON items.company_id = constants.company_id
 AND items.item_code = imported.item_code AND items.deleted_at IS NULL
WHERE imported.qty_per_case IS NOT NULL
ON CONFLICT (company_id, item_id, uom_id, qty_per_unit) WHERE deleted_at IS NULL DO UPDATE SET
  option_label = EXCLUDED.option_label, is_base = FALSE, is_default = FALSE,
  is_active = TRUE, sort_order = 10, deleted_at = NULL,
  updated_at = CURRENT_TIMESTAMP;

WITH constants AS (
  SELECT '1e10e2dd-655e-41e0-a508-edfd660a9bcf'::UUID AS company_id
),
price_rows AS (
  SELECT item_code, 'default'::TEXT AS price_tier, 'Default'::TEXT AS price_tier_name, srp_price AS price
  FROM public.canvas_import WHERE srp_price IS NOT NULL
  UNION ALL
  SELECT item_code, 'fc'::TEXT, 'FC'::TEXT, fc_price
  FROM public.canvas_import WHERE fc_price IS NOT NULL
  UNION ALL
  SELECT item_code, 'ws'::TEXT, 'WS'::TEXT, ws_price
  FROM public.canvas_import WHERE ws_price IS NOT NULL
)
INSERT INTO public.item_prices (
  company_id, item_id, price_tier, price_tier_name, price,
  currency_code, effective_from, is_active
)
SELECT constants.company_id, items.id, price_rows.price_tier,
       price_rows.price_tier_name, price_rows.price, 'PHP',
       DATE '2026-09-24', TRUE
FROM price_rows
CROSS JOIN constants
JOIN public.items
  ON items.company_id = constants.company_id
 AND items.item_code = price_rows.item_code AND items.deleted_at IS NULL
ON CONFLICT (company_id, item_id, price_tier, effective_from) DO UPDATE SET
  price_tier_name = EXCLUDED.price_tier_name, price = EXCLUDED.price,
  currency_code = EXCLUDED.currency_code, is_active = TRUE,
  effective_to = NULL, deleted_at = NULL, updated_at = CURRENT_TIMESTAMP;

INSERT INTO public.warehouse_locations (
  company_id, warehouse_id, code, name, location_type,
  is_active, is_pickable, is_storable
)
SELECT warehouses.company_id, warehouses.id, 'MAIN', 'Main', 'rack',
       TRUE, TRUE, TRUE
FROM public.warehouses
WHERE warehouses.company_id = '1e10e2dd-655e-41e0-a508-edfd660a9bcf'
  AND warehouses.deleted_at IS NULL
ON CONFLICT (company_id, warehouse_id, code) DO UPDATE SET
  name = EXCLUDED.name, location_type = EXCLUDED.location_type,
  is_active = TRUE, is_pickable = TRUE, is_storable = TRUE,
  deleted_at = NULL, updated_at = CURRENT_TIMESTAMP;

WITH imported_items AS (
  SELECT items.company_id, items.id AS item_id, warehouses.id AS warehouse_id,
         warehouse_locations.id AS location_id,
         (10 + (get_byte(decode(md5(imported.item_code || ':' || warehouses.id::TEXT), 'hex'), 0) % 91))::NUMERIC AS opening_qty
  FROM public.canvas_import imported
  JOIN public.items
    ON items.company_id = '1e10e2dd-655e-41e0-a508-edfd660a9bcf'
   AND items.item_code = imported.item_code AND items.deleted_at IS NULL
  JOIN public.warehouses
    ON warehouses.company_id = items.company_id AND warehouses.deleted_at IS NULL
  JOIN public.warehouse_locations
    ON warehouse_locations.company_id = warehouses.company_id
   AND warehouse_locations.warehouse_id = warehouses.id
   AND warehouse_locations.code = 'MAIN' AND warehouse_locations.deleted_at IS NULL
)
INSERT INTO public.item_warehouse (
  company_id, item_id, warehouse_id, default_location_id,
  reorder_level, reorder_quantity, current_stock, reserved_stock, is_active
)
SELECT company_id, item_id, warehouse_id, location_id, 25, 100,
       opening_qty, 0, TRUE
FROM imported_items
ON CONFLICT (company_id, item_id, warehouse_id) DO UPDATE SET
  default_location_id = COALESCE(public.item_warehouse.default_location_id, EXCLUDED.default_location_id),
  reorder_level = EXCLUDED.reorder_level, reorder_quantity = EXCLUDED.reorder_quantity,
  current_stock = EXCLUDED.current_stock, reserved_stock = 0,
  is_active = TRUE, deleted_at = NULL, updated_at = CURRENT_TIMESTAMP;

WITH imported_items AS (
  SELECT items.company_id, items.id AS item_id, warehouses.id AS warehouse_id,
         (10 + (get_byte(decode(md5(imported.item_code || ':' || warehouses.id::TEXT), 'hex'), 0) % 91))::NUMERIC AS opening_qty
  FROM public.canvas_import imported
  JOIN public.items
    ON items.company_id = '1e10e2dd-655e-41e0-a508-edfd660a9bcf'
   AND items.item_code = imported.item_code AND items.deleted_at IS NULL
  JOIN public.warehouses
    ON warehouses.company_id = items.company_id AND warehouses.deleted_at IS NULL
)
INSERT INTO public.item_batches (
  company_id, item_id, warehouse_id, batch_code,
  received_at, qty_on_hand, qty_reserved
)
SELECT company_id, item_id, warehouse_id, 'OPENING-BAL',
       TIMESTAMPTZ '2026-09-24 00:00:00+08', opening_qty, 0
FROM imported_items
ON CONFLICT (company_id, item_id, warehouse_id, batch_code) DO UPDATE SET
  received_at = EXCLUDED.received_at, qty_on_hand = EXCLUDED.qty_on_hand,
  qty_reserved = 0, deleted_at = NULL, updated_at = CURRENT_TIMESTAMP;

WITH imported_batches AS (
  SELECT item_batches.company_id, item_batches.item_id, item_batches.warehouse_id,
         warehouse_locations.id AS location_id, item_batches.id AS item_batch_id,
         (10 + (get_byte(decode(md5(imported.item_code || ':' || item_batches.warehouse_id::TEXT), 'hex'), 0) % 91))::NUMERIC AS opening_qty
  FROM public.canvas_import imported
  JOIN public.items
    ON items.company_id = '1e10e2dd-655e-41e0-a508-edfd660a9bcf'
   AND items.item_code = imported.item_code AND items.deleted_at IS NULL
  JOIN public.item_batches
    ON item_batches.company_id = items.company_id
   AND item_batches.item_id = items.id AND item_batches.batch_code = 'OPENING-BAL'
   AND item_batches.deleted_at IS NULL
  JOIN public.warehouse_locations
    ON warehouse_locations.company_id = item_batches.company_id
   AND warehouse_locations.warehouse_id = item_batches.warehouse_id
   AND warehouse_locations.code = 'MAIN' AND warehouse_locations.deleted_at IS NULL
)
INSERT INTO public.item_batch_locations (
  company_id, item_id, warehouse_id, location_id, item_batch_id,
  qty_on_hand, qty_reserved
)
SELECT company_id, item_id, warehouse_id, location_id, item_batch_id,
       opening_qty, 0
FROM imported_batches
ON CONFLICT (company_id, item_id, warehouse_id, location_id, item_batch_id) DO UPDATE SET
  qty_on_hand = EXCLUDED.qty_on_hand, qty_reserved = 0,
  deleted_at = NULL, updated_at = CURRENT_TIMESTAMP;

DROP TABLE IF EXISTS public.canvas_import;

END;
$canvas_import$;
DO $wood_moulding_import$
DECLARE
  v_missing TEXT;
BEGIN
DROP TABLE IF EXISTS public.wood_moulding_import;

CREATE TABLE public.wood_moulding_import (
  item_code TEXT NOT NULL,
  item_name TEXT NOT NULL,
  description TEXT,
  item_type TEXT NOT NULL,
  srp_price NUMERIC,
  ws_price NUMERIC,
  fc_price NUMERIC
);

INSERT INTO public.wood_moulding_import (
  item_code, item_name, description, item_type, srp_price, ws_price, fc_price
) VALUES
  ('WM1051GD00', '1051HK GLD WOOD MOULDINGS', '1051HK GLD WOOD MOULDINGS', 'raw_material', 226.0, 163.0, 146.0),
  ('WM1051SV00', '1051YK SLV WOOD MOULDINGS', '1051YK SLV WOOD MOULDINGS', 'raw_material', 226.0, 163.0, 146.0),
  ('WM1230GD00', '1230 GOLD WOOD MOULDINGS (overrun)', '1230 GOLD WOOD MOULDINGS (overrun)', 'raw_material', 171.0, 123.0, 112.0),
  ('WM1548BK00', '1548 BLK WOOD MOULDINGS', '1548 BLK WOOD MOULDINGS', 'raw_material', 56.0, 41.0, 36.0),
  ('WM1548BR00', '1548 BRN WOOD MOULDINGS', '1548 BRN WOOD MOULDINGS', 'raw_material', 56.0, 41.0, 36.0),
  ('WM1548NA00', '1548 NTR WOOD MOULDINGS', '1548 NTR WOOD MOULDINGS', 'raw_material', 56.0, 41.0, 36.0),
  ('WM2730BR00', '2730-5T/5030T BRN WOOD MOULDINGS', '2730-5T/5030T BRN WOOD MOULDINGS', 'raw_material', 85.0, 61.0, 55.0),
  ('WM2730WT00', '2730-5W WHT WOOD MOULDINGS', '2730-5W WHT WOOD MOULDINGS', 'raw_material', 85.0, 61.0, 55.0),
  ('WM2956BK00', '2956 BLK/3060L WOOD MOULDINGS', '2956 BLK/3060L WOOD MOULDINGS', 'raw_material', 76.0, 55.0, 49.0),
  ('WM305GD000', '305 G GLD WOOD MOULDINGS', '305 G GLD WOOD MOULDINGS', 'raw_material', 63.0, 46.0, 41.0),
  ('WM411GD000', '411 BG GLD WOOD MOULDINGS', '411 BG GLD WOOD MOULDINGS', 'raw_material', 45.0, 26.0, 22.0),
  ('WM4211BK00', '4211 BLK/L7140 WOOD MOULDINGS', '4211 BLK/L7140 WOOD MOULDINGS', 'raw_material', 130.0, 94.0, 84.0),
  ('WM4838GDGY', '4838 GOLD W/ GREY WOOD MOULDINGS', '4838 GOLD W/ GREY WOOD MOULDINGS', 'raw_material', 126.0, 92.0, 82.0),
  ('WM5033GD00', '5033G-1 GLD WOOD MOULDINGS', '5033G-1 GLD WOOD MOULDINGS', 'raw_material', 97.0, 71.0, 63.0),
  ('WM5052GD00', '5052HK GLD WOOD MOULDINGS', '5052HK GLD WOOD MOULDINGS', 'raw_material', 155.0, 113.0, 101.0),
  ('WM50535GD0', '5053-5HK GLD WOOD MOULDINGS', '5053-5HK GLD WOOD MOULDINGS', 'raw_material', 189.0, 137.0, 123.0),
  ('WM50535SV0', '5053-5YK SLV WOOD MOULDINGS', '5053-5YK SLV WOOD MOULDINGS', 'raw_material', 189.0, 137.0, 123.0),
  ('WM505316GD', '5053-16HK GLD WOOD MOULDINGS', '5053-16HK GLD WOOD MOULDINGS', 'raw_material', 189.0, 137.0, 123.0),
  ('WM505316SV', '5053-16YK SLV WOOD MOULDINGS', '5053-16YK SLV WOOD MOULDINGS', 'raw_material', 189.0, 137.0, 123.0),
  ('WM5057GD00', '5057 G GLD WOOD MOULDINGS', '5057 G GLD WOOD MOULDINGS', 'raw_material', 113.0, 81.0, 71.0),
  ('WM5068GD00', '5068 G GLD WOOD MOULDINGS', '5068 G GLD WOOD MOULDINGS', 'raw_material', 27.0, 20.0, 18.0),
  ('WM5079GD00', '5079 G GLD WOOD MOULDINGS', '5079 G GLD WOOD MOULDINGS', 'raw_material', 52.0, 37.0, 33.0),
  ('WM5079BRGD', '5079-2G BGOLD WOOD MOULDINGS', '5079-2G BGOLD WOOD MOULDINGS', 'raw_material', 52.0, 37.0, 33.0),
  ('WM5335SV00', '5335S SLV WOOD MOULDINGS', '5335S SLV WOOD MOULDINGS', 'raw_material', 98.0, 71.0, 63.0),
  ('WM5495GD00', '5495HK GLD WOOD MOULDINGS', '5495HK GLD WOOD MOULDINGS', 'raw_material', 237.0, 235.0, 212.0),
  ('WM5495SV00', '5495YK SLV WOOD MOULDINGS', '5495YK SLV WOOD MOULDINGS', 'raw_material', 237.0, 235.0, 212.0),
  ('WM5590GD00', '5590 GLD WOOD MOULDINGS', '5590 GLD WOOD MOULDINGS', 'raw_material', 176.0, 126.0, 114.0),
  ('WM6538BR00', '6538TK BRN WOOD MOULDINGS', '6538TK BRN WOOD MOULDINGS', 'raw_material', 145.0, 104.0, 94.0),
  ('WM7195BR00', '7195 BRN WOOD MOULDINGS', '7195 BRN WOOD MOULDINGS', 'raw_material', 162.0, 116.0, 104.0),
  ('WM7195MR00', '7195 MRN WOOD MOULDINGS', '7195 MRN WOOD MOULDINGS', 'raw_material', 162.0, 116.0, 104.0),
  ('WM72335BK0', '72335B WOOD MOULDINGS', '72335B WOOD MOULDINGS', 'raw_material', 69.0, 50.0, 45.0),
  ('WM72335BR0', '72335C2 BRN WOOD MOULDINGS', '72335C2 BRN WOOD MOULDINGS', 'raw_material', 69.0, 50.0, 45.0),
  ('WM72335NA0', '72335N NTR WOOD MOULDINGS', '72335N NTR WOOD MOULDINGS', 'raw_material', 69.0, 50.0, 45.0),
  ('WM72335WT0', '72335W WHITE WOOD MOULDINGS', '72335W WHITE WOOD MOULDINGS', 'raw_material', 69.0, 50.0, 45.0),
  ('WM72623BK0', '72623B BLK WOOD MOULDINGS', '72623B BLK WOOD MOULDINGS', 'raw_material', 48.0, 34.0, 31.0),
  ('WM72623WT0', '72623W WHT WOOD MOULDINGS', '72623W WHT WOOD MOULDINGS', 'raw_material', 48.0, 34.0, 31.0),
  ('WM7448GD00', '7448G-1 GLD WOOD MOULDINGS', '7448G-1 GLD WOOD MOULDINGS', 'raw_material', 126.0, 92.0, 82.0),
  ('WM7448SV00', '7448S SLV WOOD MOULDINGS', '7448S SLV WOOD MOULDINGS', 'raw_material', 126.0, 92.0, 82.0),
  ('WM7528BK00', '7528B BLK WOOD MOULDINGS', '7528B BLK WOOD MOULDINGS', 'raw_material', 119.0, 86.0, 77.0),
  ('WM7528WT00', '7528W WHITE WOOD MOULDINGS', '7528W WHITE WOOD MOULDINGS', 'raw_material', 119.0, 86.0, 77.0),
  ('WM8027SV00', '8027 SLV WOOD MOULDINGS', '8027 SLV WOOD MOULDINGS', 'raw_material', 73.0, 53.0, 47.0),
  ('WM8027GD00', '8027-G GOLD WOOD MOULDINGS', '8027-G GOLD WOOD MOULDINGS', 'raw_material', 73.0, 53.0, 47.0),
  ('WM8038BRGD', '8038/8083 BRN GOLD WOOD MOULDINGS', '8038/8083 BRN GOLD WOOD MOULDINGS', 'raw_material', 176.0, 126.0, 114.0),
  ('WM8039GD00', '8039 GOLD WOOD MOULDINGS', '8039 GOLD WOOD MOULDINGS', 'raw_material', 114.0, 82.0, 74.0),
  ('WM8049BK00', '8049 BLK WOOD MOULDINGS', '8049 BLK WOOD MOULDINGS', 'raw_material', 56.0, 41.0, 36.0),
  ('WM8050BR00', '8050 R2 BRN WOOD MOULDINGS', '8050 R2 BRN WOOD MOULDINGS', 'raw_material', 68.0, 49.0, 42.0),
  ('WM8053SV00', '8053/7232S SLV WOOD MOULDINGS', '8053/7232S SLV WOOD MOULDINGS', 'raw_material', 99.0, 72.0, 64.0),
  ('WM8081MRGD', '8081 MRN GOLD WOOD MOULDINGS', '8081 MRN GOLD WOOD MOULDINGS', 'raw_material', 176.0, 126.0, 114.0),
  ('WM8102DMP0', '8102 R2 DMAPLE WOOD MOULDINGS', '8102 R2 DMAPLE WOOD MOULDINGS', 'raw_material', 59.0, 42.0, 38.0),
  ('WM8102MP00', '8102 NG MAPLE WOOD MOULDINGS', '8102 NG MAPLE WOOD MOULDINGS', 'raw_material', 59.0, 42.0, 38.0),
  ('WM8102MR00', '8102 R1 MRN WOOD MOULDINGS', '8102 R1 MRN WOOD MOULDINGS', 'raw_material', 59.0, 42.0, 38.0),
  ('WM82246BR0', '82246C1 BRN WOOD MOULDINGS', '82246C1 BRN WOOD MOULDINGS', 'raw_material', 68.0, 49.0, 44.0),
  ('WM82246MR0', '82246R1 MRN WOOD MOULDINGS', '82246R1 MRN WOOD MOULDINGS', 'raw_material', 68.0, 49.0, 44.0),
  ('WM82343BR0', '82343C1 BRN WOOD MOULDINGS', '82343C1 BRN WOOD MOULDINGS', 'raw_material', 72.0, 52.0, 46.0),
  ('WM82343MR0', '82343R1 MRN WOOD MOULDINGS ', '82343R1 MRN WOOD MOULDINGS ', 'raw_material', 72.0, 52.0, 46.0),
  ('WM83160BR0', '83160C2 BRN WOOD MOULDINGS', '83160C2 BRN WOOD MOULDINGS', 'raw_material', 122.0, 87.0, 78.0),
  ('WM8319MR00', '8319R1 MRN WOOD MOULDINGS', '8319R1 MRN WOOD MOULDINGS', 'raw_material', 75.0, 54.0, 48.0),
  ('WM8422MR00', '8422R1 MRN WOOD MOULDINGS', '8422R1 MRN WOOD MOULDINGS', 'raw_material', 96.0, 69.0, 62.0),
  ('WM8547HK00', '8547HK WOOD MOULDINGS', '8547HK WOOD MOULDINGS', 'raw_material', 172.0, 124.0, 112.0),
  ('WM8547YK00', '8547YK WOOD MOULDINGS', '8547YK WOOD MOULDINGS', 'raw_material', 172.0, 124.0, 112.0),
  ('WM8866GD00', '8866G-2 GOLD WOOD MOULDINGS', '8866G-2 GOLD WOOD MOULDINGS', 'raw_material', 248.0, 179.0, 161.0),
  ('WM9003GDBK', '9003-1-H3 GLD W/ BLK WOOD MOULDINGS', '9003-1-H3 GLD W/ BLK WOOD MOULDINGS', 'raw_material', 159.0, 115.0, 103.0),
  ('WMH7276HK0', 'H7276HK WOOD MOULDINGS', 'H7276HK WOOD MOULDINGS', 'raw_material', 335.0, 241.0, 217.0),
  ('WMH7276YK0', 'H7276YK WOOD MOULDINGS', 'H7276YK WOOD MOULDINGS', 'raw_material', 335.0, 241.0, 217.0),
  ('WMM1008BK0', 'M1008-2 BLK WOOD MOULDINGS', 'M1008-2 BLK WOOD MOULDINGS', 'raw_material', 17.0, 12.0, 11.0),
  ('WMM1008BR0', 'M1008-13 BRN WOOD MOULDINGS', 'M1008-13 BRN WOOD MOULDINGS', 'raw_material', 17.0, 12.0, 11.0),
  ('WMM1008MR0', 'M1008-4 MRN WOOD MOULDINGS', 'M1008-4 MRN WOOD MOULDINGS', 'raw_material', 17.0, 12.0, 11.0),
  ('WMM1008LC0', 'M1008-6 OAK/LC WOOD MOULDINGS', 'M1008-6 OAK/LC WOOD MOULDINGS', 'raw_material', 17.0, 12.0, 11.0),
  ('WMM1008WT0', 'M1008-1 WHITE WOOD MOULDINGS', 'M1008-1 WHITE WOOD MOULDINGS', 'raw_material', 17.0, 12.0, 11.0),
  ('WMM5115100', 'M5115-1 WOOD MOULDINGS', 'M5115-1 WOOD MOULDINGS', 'raw_material', 55.0, 39.0, 35.0),
  ('WMM5115200', 'M5115-2 WOOD MOULDINGS', 'M5115-2 WOOD MOULDINGS', 'raw_material', 55.0, 39.0, 35.0),
  ('WMMDF10140', 'MDF-1014 BLK WOOD MOULDINGS', 'MDF-1014 BLK WOOD MOULDINGS', 'raw_material', 27.0, 20.0, 18.0),
  ('WMMDF11SN0', 'MDF-11A SLV/NTR (8FT) WOOD MOULDINGS', 'MDF-11A SLV/NTR (8FT) WOOD MOULDINGS', 'raw_material', 37.0, 26.0, 24.0),
  ('WMMDF11BK0', 'MDF-11B BLK WOOD MOULDINGS', 'MDF-11B BLK WOOD MOULDINGS', 'raw_material', 37.0, 26.0, 24.0),
  ('WM6838DBR', 'T6838C2 DBRN WOOD MOULDINGS', 'T6838C2 DBRN WOOD MOULDINGS', 'raw_material', 163.0, 117.0, 105.0);

SELECT string_agg(required_name, ', ' ORDER BY required_name)
INTO v_missing
FROM (
  SELECT 'company 1e10e2dd-655e-41e0-a508-edfd660a9bcf' AS required_name
  WHERE NOT EXISTS (
    SELECT 1 FROM public.companies
    WHERE id = '1e10e2dd-655e-41e0-a508-edfd660a9bcf' AND deleted_at IS NULL
  )
  UNION ALL
  SELECT 'UOM STICK'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.units_of_measure
    WHERE company_id = '1e10e2dd-655e-41e0-a508-edfd660a9bcf'
      AND UPPER(code) = 'STICK' AND deleted_at IS NULL
  )
  UNION ALL
  SELECT 'item category MOLD'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.item_categories
    WHERE company_id = '1e10e2dd-655e-41e0-a508-edfd660a9bcf'
      AND code = 'MOLD' AND deleted_at IS NULL
  )
) missing_records;

IF v_missing IS NOT NULL THEN
  RAISE EXCEPTION 'Wood moulding import prerequisite records are missing: %', v_missing;
END IF;

PERFORM setval(
  'public.item_unit_option_barcode_seq',
  GREATEST(
    (SELECT COALESCE(last_value, 1) FROM public.item_unit_option_barcode_seq),
    (SELECT COUNT(*) + 10000 FROM public.item_unit_options)
  ),
  TRUE
);

WITH constants AS (
  SELECT
    '1e10e2dd-655e-41e0-a508-edfd660a9bcf'::UUID AS company_id,
    uom_stick.id AS stick_uom_id,
    category.id AS category_id
  FROM public.units_of_measure uom_stick
  JOIN public.item_categories category
    ON category.company_id = uom_stick.company_id
   AND category.code = 'MOLD' AND category.deleted_at IS NULL
  WHERE uom_stick.company_id = '1e10e2dd-655e-41e0-a508-edfd660a9bcf'
    AND UPPER(uom_stick.code) = 'STICK' AND uom_stick.deleted_at IS NULL
)
INSERT INTO public.items (
  company_id, item_code, item_name, description, category_id, uom_id,
  item_type, purchase_price, sales_price, is_stock_item, track_serial,
  track_batch, is_active, material
)
SELECT
  constants.company_id, imported.item_code, imported.item_name, imported.description,
  constants.category_id, constants.stick_uom_id, imported.item_type, NULL,
  imported.srp_price, TRUE, FALSE, TRUE, TRUE, 'wood'
FROM public.wood_moulding_import imported
CROSS JOIN constants
ON CONFLICT (company_id, item_code) DO UPDATE SET
  item_name = EXCLUDED.item_name, description = EXCLUDED.description,
  category_id = EXCLUDED.category_id, uom_id = EXCLUDED.uom_id,
  item_type = EXCLUDED.item_type, purchase_price = EXCLUDED.purchase_price,
  sales_price = EXCLUDED.sales_price, is_stock_item = EXCLUDED.is_stock_item,
  track_serial = EXCLUDED.track_serial, track_batch = EXCLUDED.track_batch,
  is_active = EXCLUDED.is_active, material = EXCLUDED.material,
  deleted_at = NULL, updated_at = CURRENT_TIMESTAMP;

WITH constants AS (
  SELECT '1e10e2dd-655e-41e0-a508-edfd660a9bcf'::UUID AS company_id,
         uom_stick.id AS stick_uom_id
  FROM public.units_of_measure uom_stick
  WHERE uom_stick.company_id = '1e10e2dd-655e-41e0-a508-edfd660a9bcf'
    AND UPPER(uom_stick.code) = 'STICK' AND uom_stick.deleted_at IS NULL
)
INSERT INTO public.item_unit_options (
  company_id, item_id, uom_id, option_label, qty_per_unit,
  is_base, is_default, is_active, sort_order
)
SELECT constants.company_id, items.id, constants.stick_uom_id, 'STICK',
       1, TRUE, TRUE, TRUE, 0
FROM public.wood_moulding_import imported
CROSS JOIN constants
JOIN public.items
  ON items.company_id = constants.company_id
 AND items.item_code = imported.item_code AND items.deleted_at IS NULL
ON CONFLICT (company_id, item_id, uom_id, qty_per_unit) WHERE deleted_at IS NULL DO UPDATE SET
  option_label = EXCLUDED.option_label, is_base = TRUE, is_default = TRUE,
  is_active = TRUE, sort_order = 0, deleted_at = NULL,
  updated_at = CURRENT_TIMESTAMP;

WITH constants AS (
  SELECT '1e10e2dd-655e-41e0-a508-edfd660a9bcf'::UUID AS company_id
),
price_rows AS (
  SELECT item_code, 'default'::TEXT AS price_tier, 'Default'::TEXT AS price_tier_name, srp_price AS price
  FROM public.wood_moulding_import WHERE srp_price IS NOT NULL
  UNION ALL
  SELECT item_code, 'ws'::TEXT, 'WS'::TEXT, ws_price
  FROM public.wood_moulding_import WHERE ws_price IS NOT NULL
  UNION ALL
  SELECT item_code, 'fc'::TEXT, 'FC'::TEXT, fc_price
  FROM public.wood_moulding_import WHERE fc_price IS NOT NULL
)
INSERT INTO public.item_prices (
  company_id, item_id, price_tier, price_tier_name, price,
  currency_code, effective_from, is_active
)
SELECT constants.company_id, items.id, price_rows.price_tier,
       price_rows.price_tier_name, price_rows.price, 'PHP',
       DATE '2026-09-24', TRUE
FROM price_rows
CROSS JOIN constants
JOIN public.items
  ON items.company_id = constants.company_id
 AND items.item_code = price_rows.item_code AND items.deleted_at IS NULL
ON CONFLICT (company_id, item_id, price_tier, effective_from) DO UPDATE SET
  price_tier_name = EXCLUDED.price_tier_name, price = EXCLUDED.price,
  currency_code = EXCLUDED.currency_code, is_active = TRUE,
  effective_to = NULL, deleted_at = NULL, updated_at = CURRENT_TIMESTAMP;

WITH imported_items AS (
  SELECT items.company_id, items.id AS item_id, warehouses.id AS warehouse_id,
         warehouse_locations.id AS location_id,
         (10 + (get_byte(decode(md5(imported.item_code || ':' || warehouses.id::TEXT), 'hex'), 0) % 91))::NUMERIC AS opening_qty
  FROM public.wood_moulding_import imported
  JOIN public.items ON items.company_id = '1e10e2dd-655e-41e0-a508-edfd660a9bcf'
    AND items.item_code = imported.item_code AND items.deleted_at IS NULL
  JOIN public.warehouses ON warehouses.company_id = items.company_id
    AND warehouses.deleted_at IS NULL
  JOIN public.warehouse_locations ON warehouse_locations.company_id = warehouses.company_id
    AND warehouse_locations.warehouse_id = warehouses.id
    AND warehouse_locations.code = 'MAIN' AND warehouse_locations.deleted_at IS NULL
)
INSERT INTO public.item_warehouse (
  company_id, item_id, warehouse_id, default_location_id,
  reorder_level, reorder_quantity, current_stock, reserved_stock, is_active
)
SELECT company_id, item_id, warehouse_id, location_id, 25, 100, opening_qty, 0, TRUE
FROM imported_items
ON CONFLICT (company_id, item_id, warehouse_id) DO UPDATE SET
  default_location_id = COALESCE(public.item_warehouse.default_location_id, EXCLUDED.default_location_id),
  reorder_level = EXCLUDED.reorder_level, reorder_quantity = EXCLUDED.reorder_quantity,
  current_stock = EXCLUDED.current_stock, reserved_stock = 0, is_active = TRUE,
  deleted_at = NULL, updated_at = CURRENT_TIMESTAMP;

WITH imported_items AS (
  SELECT items.company_id, items.id AS item_id, warehouses.id AS warehouse_id,
         (10 + (get_byte(decode(md5(imported.item_code || ':' || warehouses.id::TEXT), 'hex'), 0) % 91))::NUMERIC AS opening_qty
  FROM public.wood_moulding_import imported
  JOIN public.items ON items.company_id = '1e10e2dd-655e-41e0-a508-edfd660a9bcf'
    AND items.item_code = imported.item_code AND items.deleted_at IS NULL
  JOIN public.warehouses ON warehouses.company_id = items.company_id
    AND warehouses.deleted_at IS NULL
)
INSERT INTO public.item_batches (
  company_id, item_id, warehouse_id, batch_code,
  received_at, qty_on_hand, qty_reserved
)
SELECT company_id, item_id, warehouse_id, 'OPENING-BAL',
       TIMESTAMPTZ '2026-09-24 00:00:00+08', opening_qty, 0
FROM imported_items
ON CONFLICT (company_id, item_id, warehouse_id, batch_code) DO UPDATE SET
  received_at = EXCLUDED.received_at, qty_on_hand = EXCLUDED.qty_on_hand,
  qty_reserved = 0, deleted_at = NULL, updated_at = CURRENT_TIMESTAMP;

WITH imported_batches AS (
  SELECT item_batches.company_id, item_batches.item_id, item_batches.warehouse_id,
         warehouse_locations.id AS location_id, item_batches.id AS item_batch_id,
         (10 + (get_byte(decode(md5(imported.item_code || ':' || item_batches.warehouse_id::TEXT), 'hex'), 0) % 91))::NUMERIC AS opening_qty
  FROM public.wood_moulding_import imported
  JOIN public.items ON items.company_id = '1e10e2dd-655e-41e0-a508-edfd660a9bcf'
    AND items.item_code = imported.item_code AND items.deleted_at IS NULL
  JOIN public.item_batches ON item_batches.company_id = items.company_id
    AND item_batches.item_id = items.id AND item_batches.batch_code = 'OPENING-BAL'
    AND item_batches.deleted_at IS NULL
  JOIN public.warehouse_locations ON warehouse_locations.company_id = item_batches.company_id
    AND warehouse_locations.warehouse_id = item_batches.warehouse_id
    AND warehouse_locations.code = 'MAIN' AND warehouse_locations.deleted_at IS NULL
)
INSERT INTO public.item_batch_locations (
  company_id, item_id, warehouse_id, location_id, item_batch_id,
  qty_on_hand, qty_reserved
)
SELECT company_id, item_id, warehouse_id, location_id, item_batch_id,
       opening_qty, 0
FROM imported_batches
ON CONFLICT (company_id, item_id, warehouse_id, location_id, item_batch_id) DO UPDATE SET
  qty_on_hand = EXCLUDED.qty_on_hand, qty_reserved = 0,
  deleted_at = NULL, updated_at = CURRENT_TIMESTAMP;

DROP TABLE IF EXISTS public.wood_moulding_import;

END;
$wood_moulding_import$;
