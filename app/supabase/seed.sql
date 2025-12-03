-- Seed data for development
-- This file will be executed after migrations when running `supabase db reset`

-- ============================================================================
-- SEED DATA: Companies
-- ============================================================================

INSERT INTO companies (id, code, name, legal_name, tax_id, email, phone, address_line1, city, state, country, postal_code, currency_code, is_active)
VALUES
    ('00000000-0000-0000-0000-000000000001', 'DEMO', 'Demo Company Inc.', 'Demo Company Incorporated', '123-456-789', 'contact@democompany.com', '+63-917-123-4567', '123 Business St', 'Davao City', 'Davao del Sur', 'Philippines', '8000', 'PHP', true);

-- ============================================================================
-- SEED DATA: Demo User
-- ============================================================================
-- NOTE: Demo user must be created via Supabase Auth API after seeding
-- Use the following command after running db reset:
-- curl -X POST http://127.0.0.1:54321/auth/v1/signup \
--   -H "apikey: YOUR_ANON_KEY" \
--   -H "Content-Type: application/json" \
--   -d '{"email":"demo@pragmatica.com","password":"demo1234"}'
--
-- Then update the users table with the generated user ID

-- ============================================================================
-- SEED DATA: Units of Measure
-- ============================================================================

-- Common units for Philippines market
INSERT INTO units_of_measure (company_id, code, name, symbol, is_base_unit, is_active)
VALUES
    ('00000000-0000-0000-0000-000000000001', 'PCS', 'Pieces', 'pcs', true, true),
    ('00000000-0000-0000-0000-000000000001', 'BOX', 'Box', 'box', false, true),
    ('00000000-0000-0000-0000-000000000001', 'KG', 'Kilogram', 'kg', true, true),
    ('00000000-0000-0000-0000-000000000001', 'G', 'Gram', 'g', false, true),
    ('00000000-0000-0000-0000-000000000001', 'L', 'Liter', 'L', true, true),
    ('00000000-0000-0000-0000-000000000001', 'ML', 'Milliliter', 'ml', false, true),
    ('00000000-0000-0000-0000-000000000001', 'SACK', 'Sack', 'sack', false, true),
    ('00000000-0000-0000-0000-000000000001', 'CAVAN', 'Cavan', 'cavan', false, true),
    ('00000000-0000-0000-0000-000000000001', 'PACK', 'Pack', 'pack', false, true),
    ('00000000-0000-0000-0000-000000000001', 'SET', 'Set', 'set', false, true);

-- ============================================================================
-- SEED DATA: Item Categories
-- ============================================================================

INSERT INTO item_categories (company_id, code, name, description, is_active)
VALUES
    -- Chicken Distribution Categories
    ('00000000-0000-0000-0000-000000000001', 'WHOLE', 'Whole Chicken', 'Whole dressed chicken products', true),
    ('00000000-0000-0000-0000-000000000001', 'PARTS', 'Chicken Parts', 'Individual chicken parts and cuts', true),
    ('00000000-0000-0000-0000-000000000001', 'OFFAL', 'Chicken Offal', 'Chicken internal organs and by-products', true),
    ('00000000-0000-0000-0000-000000000001', 'PROC', 'Processed Chicken', 'Processed and value-added chicken products', true),
    ('00000000-0000-0000-0000-000000000001', 'FROZEN', 'Frozen Products', 'Frozen chicken items', true),
    ('00000000-0000-0000-0000-000000000001', 'FRESH', 'Fresh Products', 'Fresh chilled chicken items', true),
    ('00000000-0000-0000-0000-000000000001', 'PACK', 'Packaging Materials', 'Packaging and supplies for distribution', true),
    ('00000000-0000-0000-0000-000000000001', 'SUPPLY', 'Supplies', 'Ice, boxes, and other distribution supplies', true);

-- ============================================================================
-- SEED DATA: Items
-- ============================================================================

-- Get UoM IDs (we'll use the created ones)
DO $$
DECLARE
    v_company_id UUID := '00000000-0000-0000-0000-000000000001';
    v_uom_pcs UUID;
    v_uom_kg UUID;
    v_uom_l UUID;
    v_uom_box UUID;
    v_uom_sack UUID;
    v_cat_whole UUID;
    v_cat_parts UUID;
    v_cat_offal UUID;
    v_cat_proc UUID;
    v_cat_pack UUID;
    v_cat_supply UUID;
BEGIN
    -- Get UoM IDs
    SELECT id INTO v_uom_pcs FROM units_of_measure WHERE code = 'PCS' AND company_id = v_company_id;
    SELECT id INTO v_uom_kg FROM units_of_measure WHERE code = 'KG' AND company_id = v_company_id;
    SELECT id INTO v_uom_l FROM units_of_measure WHERE code = 'L' AND company_id = v_company_id;
    SELECT id INTO v_uom_box FROM units_of_measure WHERE code = 'BOX' AND company_id = v_company_id;
    SELECT id INTO v_uom_sack FROM units_of_measure WHERE code = 'SACK' AND company_id = v_company_id;

    -- Get Category IDs
    SELECT id INTO v_cat_whole FROM item_categories WHERE code = 'WHOLE' AND company_id = v_company_id;
    SELECT id INTO v_cat_parts FROM item_categories WHERE code = 'PARTS' AND company_id = v_company_id;
    SELECT id INTO v_cat_offal FROM item_categories WHERE code = 'OFFAL' AND company_id = v_company_id;
    SELECT id INTO v_cat_proc FROM item_categories WHERE code = 'PROC' AND company_id = v_company_id;
    SELECT id INTO v_cat_pack FROM item_categories WHERE code = 'PACK' AND company_id = v_company_id;
    SELECT id INTO v_cat_supply FROM item_categories WHERE code = 'SUPPLY' AND company_id = v_company_id;

    -- Insert sample items
    INSERT INTO items (company_id, item_code, item_name, description, category_id, uom_id, item_type, purchase_price, sales_price, cost_price, is_stock_item, is_active)
    VALUES
        -- Whole Chicken
        (v_company_id, 'CHK-WHOLE-S', 'Whole Chicken Small', 'Whole dressed chicken 0.8-1.0kg', v_cat_whole, v_uom_kg, 'finished_good', 135.00, 165.00, 130.00, true, true),
        (v_company_id, 'CHK-WHOLE-M', 'Whole Chicken Medium', 'Whole dressed chicken 1.0-1.2kg', v_cat_whole, v_uom_kg, 'finished_good', 130.00, 160.00, 125.00, true, true),
        (v_company_id, 'CHK-WHOLE-L', 'Whole Chicken Large', 'Whole dressed chicken 1.2-1.5kg', v_cat_whole, v_uom_kg, 'finished_good', 125.00, 155.00, 120.00, true, true),
        (v_company_id, 'CHK-WHOLE-XL', 'Whole Chicken Extra Large', 'Whole dressed chicken 1.5kg+', v_cat_whole, v_uom_kg, 'finished_good', 120.00, 150.00, 115.00, true, true),

        -- Chicken Parts
        (v_company_id, 'CHK-BREAST', 'Chicken Breast', 'Fresh chicken breast fillet per kg', v_cat_parts, v_uom_kg, 'finished_good', 185.00, 230.00, 180.00, true, true),
        (v_company_id, 'CHK-THIGH', 'Chicken Thigh', 'Fresh chicken thigh per kg', v_cat_parts, v_uom_kg, 'finished_good', 145.00, 180.00, 140.00, true, true),
        (v_company_id, 'CHK-DRUMSTICK', 'Chicken Drumstick', 'Fresh chicken drumstick per kg', v_cat_parts, v_uom_kg, 'finished_good', 140.00, 175.00, 135.00, true, true),
        (v_company_id, 'CHK-WING', 'Chicken Wings', 'Fresh chicken wings per kg', v_cat_parts, v_uom_kg, 'finished_good', 150.00, 190.00, 145.00, true, true),
        (v_company_id, 'CHK-LEG', 'Chicken Leg Quarters', 'Fresh chicken leg quarters per kg', v_cat_parts, v_uom_kg, 'finished_good', 125.00, 160.00, 120.00, true, true),
        (v_company_id, 'CHK-BACK', 'Chicken Backs', 'Chicken backs for soup per kg', v_cat_parts, v_uom_kg, 'finished_good', 55.00, 75.00, 50.00, true, true),
        (v_company_id, 'CHK-NECK', 'Chicken Necks', 'Chicken necks per kg', v_cat_parts, v_uom_kg, 'finished_good', 45.00, 65.00, 40.00, true, true),

        -- Chicken Offal
        (v_company_id, 'CHK-LIVER', 'Chicken Liver', 'Fresh chicken liver per kg', v_cat_offal, v_uom_kg, 'finished_good', 85.00, 120.00, 80.00, true, true),
        (v_company_id, 'CHK-GIZZARD', 'Chicken Gizzard', 'Fresh chicken gizzard per kg', v_cat_offal, v_uom_kg, 'finished_good', 95.00, 130.00, 90.00, true, true),
        (v_company_id, 'CHK-HEART', 'Chicken Hearts', 'Fresh chicken hearts per kg', v_cat_offal, v_uom_kg, 'finished_good', 75.00, 110.00, 70.00, true, true),
        (v_company_id, 'CHK-FEET', 'Chicken Feet', 'Cleaned chicken feet per kg', v_cat_offal, v_uom_kg, 'finished_good', 65.00, 95.00, 60.00, true, true),
        (v_company_id, 'CHK-HEAD', 'Chicken Heads', 'Chicken heads per kg', v_cat_offal, v_uom_kg, 'finished_good', 35.00, 55.00, 30.00, true, true),
        (v_company_id, 'CHK-INTESTINE', 'Chicken Intestines', 'Cleaned chicken intestines per kg', v_cat_offal, v_uom_kg, 'finished_good', 55.00, 85.00, 50.00, true, true),

        -- Processed Chicken
        (v_company_id, 'CHK-PROC-NUGGETS', 'Chicken Nuggets', 'Breaded chicken nuggets 1kg pack', v_cat_proc, v_uom_kg, 'finished_good', 185.00, 250.00, 180.00, true, true),
        (v_company_id, 'CHK-PROC-HOTDOG', 'Chicken Hotdog', 'Chicken hotdog per kg', v_cat_proc, v_uom_kg, 'finished_good', 145.00, 195.00, 140.00, true, true),
        (v_company_id, 'CHK-PROC-LONGANISA', 'Chicken Longanisa', 'Chicken longanisa per kg', v_cat_proc, v_uom_kg, 'finished_good', 155.00, 210.00, 150.00, true, true),
        (v_company_id, 'CHK-PROC-BURGER', 'Chicken Burger Patty', 'Frozen chicken burger patties per kg', v_cat_proc, v_uom_kg, 'finished_good', 165.00, 220.00, 160.00, true, true),

        -- Packaging Materials
        (v_company_id, 'PACK-STYRO-S', 'Styrofoam Box Small', 'Small styrofoam box for 2-3kg', v_cat_pack, v_uom_pcs, 'finished_good', 8.00, 15.00, 7.50, true, true),
        (v_company_id, 'PACK-STYRO-M', 'Styrofoam Box Medium', 'Medium styrofoam box for 5-7kg', v_cat_pack, v_uom_pcs, 'finished_good', 12.00, 22.00, 11.00, true, true),
        (v_company_id, 'PACK-STYRO-L', 'Styrofoam Box Large', 'Large styrofoam box for 10-15kg', v_cat_pack, v_uom_pcs, 'finished_good', 18.00, 32.00, 17.00, true, true),
        (v_company_id, 'PACK-PLASTIC-S', 'Plastic Bags Small', 'Small plastic bags 1kg capacity (100pcs)', v_cat_pack, v_uom_box, 'finished_good', 45.00, 75.00, 42.00, true, true),
        (v_company_id, 'PACK-PLASTIC-M', 'Plastic Bags Medium', 'Medium plastic bags 3kg capacity (100pcs)', v_cat_pack, v_uom_box, 'finished_good', 65.00, 105.00, 62.00, true, true),
        (v_company_id, 'PACK-PLASTIC-L', 'Plastic Bags Large', 'Large plastic bags 5kg capacity (100pcs)', v_cat_pack, v_uom_box, 'finished_good', 85.00, 135.00, 82.00, true, true),

        -- Supplies
        (v_company_id, 'SUPPLY-ICE', 'Ice Blocks', 'Ice blocks for cooling per kg', v_cat_supply, v_uom_kg, 'finished_good', 8.00, 15.00, 7.00, true, true),
        (v_company_id, 'SUPPLY-TAPE', 'Packing Tape', 'Packing tape 2" x 100yards', v_cat_supply, v_uom_pcs, 'finished_good', 35.00, 55.00, 32.00, true, true),
        (v_company_id, 'SUPPLY-LABEL', 'Price Labels', 'Price label stickers (1000pcs)', v_cat_supply, v_uom_box, 'finished_good', 85.00, 135.00, 80.00, true, true);
END $$;

-- ============================================================================
-- SEED DATA: Warehouses
-- ============================================================================

INSERT INTO warehouses (id, company_id, warehouse_code, warehouse_name, warehouse_type, address_line1, city, state, country, postal_code, contact_person, phone, email, is_active, is_van)
VALUES
    ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001', 'WH-DAVAO-01', 'Davao Main Warehouse', 'main', 'JP Laurel Ave, Bajada', 'Davao City', 'Davao del Sur', 'Philippines', '8000', 'Juan Dela Cruz', '+63-917-111-2222', 'davao.wh@democompany.com', true, false),
    ('00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000001', 'WH-CDO-01', 'Cagayan de Oro Warehouse', 'main', 'Carmen, CDO Business Park', 'Cagayan de Oro', 'Misamis Oriental', 'Philippines', '9000', 'Maria Santos', '+63-917-222-3333', 'cdo.wh@democompany.com', true, false),
    ('00000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000001', 'VAN-002', 'Demo Van 002', 'retail', 'Mobile Unit', 'General Santos City', 'South Cotabato', 'Philippines', '9500', 'Miguel Flores', '+63-917-333-4444', 'van002@democompany.com', true, false),
    ('00000000-0000-0000-0000-000000000014', '00000000-0000-0000-0000-000000000001', 'WH-BUTUAN-01', 'Butuan Distribution Center', 'transit', 'J.C. Aquino Avenue', 'Butuan City', 'Agusan del Norte', 'Philippines', '8600', 'Ana Reyes', '+63-917-444-5555', 'butuan.wh@democompany.com', true, false),
    ('00000000-0000-0000-0000-000000000015', '00000000-0000-0000-0000-000000000001', 'WH-ZAMBO-01', 'Zamboanga Retail Warehouse', 'retail', 'Gov. Camins Avenue', 'Zamboanga City', 'Zamboanga del Sur', 'Philippines', '7000', 'Carlos Miguel', '+63-917-555-6666', 'zambo.wh@democompany.com', true, false),
    ('00000000-0000-0000-0000-000000000021', '00000000-0000-0000-0000-000000000001', 'VAN-001', 'Demo Van 001', 'main', 'Mobile Unit', 'Davao City', 'Davao del Sur', 'Philippines', '8000', 'Demo User', '+63-917-777-8888', 'van001@democompany.com', true, true);

-- ============================================================================
-- SEED DATA: Customers
-- ============================================================================

-- We need to use a user_id for created_by and updated_by
-- Using NULL for created_by/updated_by since user will be created via Auth API
DO $$
DECLARE
    v_company_id UUID := '00000000-0000-0000-0000-000000000001';
    v_user_id UUID := NULL;
BEGIN
    -- Insert sample customers
    INSERT INTO customers (
        company_id, customer_code, customer_name, customer_type, tax_id, email, phone, website,
        billing_address_line1, billing_address_line2, billing_city, billing_state, billing_country, billing_postal_code,
        shipping_address_line1, shipping_address_line2, shipping_city, shipping_state, shipping_country, shipping_postal_code,
        payment_terms, credit_limit, credit_days,
        contact_person, contact_phone, contact_email,
        is_active, created_by, updated_by
    )
    VALUES
        -- Company Customers
        (
            v_company_id, 'CUST-001', 'SM Retail Corporation', 'company', '123-456-789-000',
            'purchasing@smretail.com.ph', '+63-82-227-1234', 'www.smretail.com.ph',
            'SM City Davao', 'J.P. Laurel Avenue', 'Davao City', 'Davao del Sur', 'Philippines', '8000',
            'SM City Davao', 'J.P. Laurel Avenue', 'Davao City', 'Davao del Sur', 'Philippines', '8000',
            'net_30', 500000.00, 30,
            'Maria Santos', '+63-917-123-4567', 'maria.santos@smretail.com.ph',
            true, v_user_id, v_user_id
        ),
        (
            v_company_id, 'CUST-002', 'Gaisano Capital', 'company', '234-567-890-000',
            'procurement@gaisano.com', '+63-88-856-7890', 'www.gaisano.com',
            'Gaisano Mall of Davao', 'JP Laurel Avenue', 'Davao City', 'Davao del Sur', 'Philippines', '8000',
            'Gaisano Mall of Davao', 'JP Laurel Avenue', 'Davao City', 'Davao del Sur', 'Philippines', '8000',
            'net_60', 800000.00, 60,
            'Juan Dela Cruz', '+63-917-234-5678', 'juan.delacruz@gaisano.com',
            true, v_user_id, v_user_id
        ),
        (
            v_company_id, 'CUST-003', 'NCCC Mall', 'company', '345-678-901-000',
            'buyer@nccc.com.ph', '+63-82-305-5000', 'www.nccc.com.ph',
            'NCCC Mall Davao', 'Ma-a Road', 'Davao City', 'Davao del Sur', 'Philippines', '8000',
            'NCCC Mall Davao', 'Ma-a Road', 'Davao City', 'Davao del Sur', 'Philippines', '8000',
            'net_30', 600000.00, 30,
            'Ana Reyes', '+63-917-345-6789', 'ana.reyes@nccc.com.ph',
            true, v_user_id, v_user_id
        ),
        (
            v_company_id, 'CUST-004', 'Robinsons Supermarket', 'company', '456-789-012-000',
            'supply@robinsons.com.ph', '+63-82-221-2000', 'www.robinsons.com.ph',
            'Robinsons Place Davao', 'Roxas Avenue', 'Davao City', 'Davao del Sur', 'Philippines', '8000',
            'Robinsons Place Davao', 'Roxas Avenue', 'Davao City', 'Davao del Sur', 'Philippines', '8000',
            'net_45', 700000.00, 45,
            'Carlos Ramos', '+63-917-456-7890', 'carlos.ramos@robinsons.com.ph',
            true, v_user_id, v_user_id
        ),
        (
            v_company_id, 'CUST-005', 'Puregold Price Club', 'company', '567-890-123-000',
            'orders@puregold.com.ph', '+63-82-234-5000', 'www.puregold.com.ph',
            'Puregold Davao', 'McArthur Highway', 'Davao City', 'Davao del Sur', 'Philippines', '8000',
            'Puregold Davao', 'McArthur Highway', 'Davao City', 'Davao del Sur', 'Philippines', '8000',
            'net_30', 450000.00, 30,
            'Lisa Garcia', '+63-917-567-8901', 'lisa.garcia@puregold.com.ph',
            true, v_user_id, v_user_id
        ),

        -- Government Customers
        (
            v_company_id, 'CUST-GOV-001', 'Department of Education - Davao Division', 'government', 'GOV-123-456',
            'deped.davao@deped.gov.ph', '+63-82-227-6051', 'davao.deped.gov.ph',
            'DepEd Division Office', 'E. Quirino Avenue', 'Davao City', 'Davao del Sur', 'Philippines', '8000',
            'DepEd Division Office', 'E. Quirino Avenue', 'Davao City', 'Davao del Sur', 'Philippines', '8000',
            'net_60', 1000000.00, 60,
            'Dr. Roberto Cruz', '+63-917-678-9012', 'roberto.cruz@deped.gov.ph',
            true, v_user_id, v_user_id
        ),
        (
            v_company_id, 'CUST-GOV-002', 'Davao City Government', 'government', 'GOV-234-567',
            'procurement@davaocity.gov.ph', '+63-82-227-1000', 'www.davaocity.gov.ph',
            'Davao City Hall', 'San Pedro Street', 'Davao City', 'Davao del Sur', 'Philippines', '8000',
            'Davao City Hall', 'San Pedro Street', 'Davao City', 'Davao del Sur', 'Philippines', '8000',
            'net_90', 2000000.00, 90,
            'Engr. Pedro Gonzales', '+63-917-789-0123', 'pedro.gonzales@davaocity.gov.ph',
            true, v_user_id, v_user_id
        ),

        -- Individual Customers (Walk-in/Retail)
        (
            v_company_id, 'CUST-IND-001', 'John Paul Rivera', 'individual', NULL,
            'jp.rivera@email.com', '+63-917-890-1234', NULL,
            'Phase 1, Block 3, Lot 5', 'Ecoland Subdivision', 'Davao City', 'Davao del Sur', 'Philippines', '8000',
            'Phase 1, Block 3, Lot 5', 'Ecoland Subdivision', 'Davao City', 'Davao del Sur', 'Philippines', '8000',
            'cash', 50000.00, 0,
            NULL, NULL, NULL,
            true, v_user_id, v_user_id
        ),
        (
            v_company_id, 'CUST-IND-002', 'Sarah Mae Santos', 'individual', NULL,
            'sarah.santos@email.com', '+63-917-901-2345', NULL,
            '123 Palma Gil Street', 'Poblacion District', 'Davao City', 'Davao del Sur', 'Philippines', '8000',
            '123 Palma Gil Street', 'Poblacion District', 'Davao City', 'Davao del Sur', 'Philippines', '8000',
            'due_on_receipt', 30000.00, 0,
            NULL, NULL, NULL,
            true, v_user_id, v_user_id
        ),
        (
            v_company_id, 'CUST-IND-003', 'Michael Angelo Torres', 'individual', NULL,
            'miguel.torres@email.com', '+63-917-012-3456', NULL,
            '456 Quirino Avenue', 'Matina District', 'Davao City', 'Davao del Sur', 'Philippines', '8000',
            '456 Quirino Avenue', 'Matina District', 'Davao City', 'Davao del Sur', 'Philippines', '8000',
            'cash', 25000.00, 0,
            NULL, NULL, NULL,
            true, v_user_id, v_user_id
        ),

        -- Additional Company Customers (Regional)
        (
            v_company_id, 'CUST-006', 'Cagayan de Oro Trading Corp', 'company', '678-901-234-000',
            'orders@cdotrading.com', '+63-88-858-1234', 'www.cdotrading.com',
            'Carmen Business Park', 'Corrales Avenue', 'Cagayan de Oro', 'Misamis Oriental', 'Philippines', '9000',
            'Carmen Business Park', 'Corrales Avenue', 'Cagayan de Oro', 'Misamis Oriental', 'Philippines', '9000',
            'net_30', 400000.00, 30,
            'Dante Villaruel', '+63-918-123-4567', 'dante.v@cdotrading.com',
            true, v_user_id, v_user_id
        ),
        (
            v_company_id, 'CUST-007', 'General Santos Wholesale Center', 'company', '789-012-345-000',
            'wholesale@gensan.com', '+63-83-552-3456', 'www.gensanwholesale.com',
            'National Highway', 'Calumpang', 'General Santos', 'South Cotabato', 'Philippines', '9500',
            'National Highway', 'Calumpang', 'General Santos', 'South Cotabato', 'Philippines', '9500',
            'net_45', 550000.00, 45,
            'Gloria Mercado', '+63-918-234-5678', 'gloria.m@gensan.com',
            true, v_user_id, v_user_id
        ),

        -- Inactive Customer (for testing)
        (
            v_company_id, 'CUST-008', 'Inactive Trading Inc', 'company', '890-123-456-000',
            'contact@inactive.com', '+63-82-000-0000', NULL,
            'Old Business District', 'Building 1', 'Davao City', 'Davao del Sur', 'Philippines', '8000',
            'Old Business District', 'Building 1', 'Davao City', 'Davao del Sur', 'Philippines', '8000',
            'net_30', 100000.00, 30,
            'Inactive Contact', '+63-917-000-0000', 'inactive@test.com',
            false, v_user_id, v_user_id
        );

    RAISE NOTICE 'Customers seeded: % records', (SELECT COUNT(*) FROM customers WHERE company_id = v_company_id);
END $$;

-- ============================================================================
-- SEED DATA: Item Warehouse Stock Levels
-- ============================================================================

-- Assign random stock levels to items across warehouses
DO $$
DECLARE
    v_company_id UUID := '00000000-0000-0000-0000-000000000001';
    v_user_id UUID := '00000000-0000-0000-0000-000000000001';
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
                    WHEN v_warehouse.warehouse_type = 'main' THEN (RANDOM() * 500 + 100)::DECIMAL(20,4)
                    ELSE (RANDOM() * 100 + 20)::DECIMAL(20,4)
                END,
                CASE
                    WHEN v_warehouse.warehouse_type = 'main' THEN 50.0000
                    ELSE 20.0000
                END,
                CASE
                    WHEN v_warehouse.warehouse_type = 'main' THEN 200.0000
                    ELSE 50.0000
                END,
                CASE
                    WHEN v_warehouse.warehouse_type = 'main' THEN 1000.0000
                    ELSE 300.0000
                END,
                0.0000,
                true
            );
        END LOOP;
    END LOOP;
END $$;

-- ============================================================================
-- COMPLETION MESSAGE
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '===============================================';
    RAISE NOTICE 'Seed data inserted successfully!';
    RAISE NOTICE '===============================================';
    RAISE NOTICE 'Company: Demo Company Inc. (ID: 00000000-0000-0000-0000-000000000001)';
    RAISE NOTICE 'Units of Measure: % records', (SELECT COUNT(*) FROM units_of_measure);
    RAISE NOTICE 'Item Categories: % records', (SELECT COUNT(*) FROM item_categories);
    RAISE NOTICE 'Items: % records', (SELECT COUNT(*) FROM items);
    RAISE NOTICE 'Warehouses: % records', (SELECT COUNT(*) FROM warehouses);
    RAISE NOTICE 'Customers: % records', (SELECT COUNT(*) FROM customers);
    RAISE NOTICE 'Suppliers: % records', (SELECT COUNT(*) FROM suppliers);
    RAISE NOTICE 'Purchase Orders: % records', (SELECT COUNT(*) FROM purchase_orders);
    RAISE NOTICE 'Item-Warehouse Stock: % records', (SELECT COUNT(*) FROM item_warehouse);
    RAISE NOTICE '===============================================';
    RAISE NOTICE 'NOTE: You need to create a user via Supabase Auth';
    RAISE NOTICE 'and then update the users table manually.';
    RAISE NOTICE '===============================================';
END $$;

INSERT INTO "auth"."users"("instance_id","id","aud","role","email","encrypted_password","email_confirmed_at","invited_at","confirmation_token","confirmation_sent_at","recovery_token","recovery_sent_at","email_change_token_new","email_change","email_change_sent_at","last_sign_in_at","raw_app_meta_data","raw_user_meta_data","is_super_admin","created_at","updated_at","phone","phone_confirmed_at","phone_change","phone_change_token","phone_change_sent_at","email_change_token_current","email_change_confirm_status","banned_until","reauthentication_token","reauthentication_sent_at","is_sso_user","deleted_at","is_anonymous")
VALUES
('00000000-0000-0000-0000-000000000000','5745e13c-ab07-48b7-9db7-24372b16f5a9','authenticated','authenticated','demo@pragmatica.com','$2a$10$av68P//OXhBrmx9R0WRL3.8DdVeIlcy.Wcf/yNgriwFcah51r500u','2025-11-06 07:07:59.211291+00',NULL,'',NULL,'',NULL,'','',NULL,'2025-11-06 07:07:59.218139+00','{"provider": "email", "providers": ["email"]}','{"sub": "5745e13c-ab07-48b7-9db7-24372b16f5a9", "email": "demo@pragmatica.com", "email_verified": true, "phone_verified": false}',NULL,'2025-11-06 07:07:59.200435+00','2025-11-06 07:07:59.22046+00',NULL,NULL,'','',NULL,'',0,NULL,'',NULL,FALSE,NULL,FALSE);
INSERT INTO "public"."users"("id","company_id","username","email","first_name","last_name","phone","is_active","last_login_at","created_at","updated_at","deleted_at","van_warehouse_id")
VALUES
('5745e13c-ab07-48b7-9db7-24372b16f5a9','00000000-0000-0000-0000-000000000001','demo','demo@pragmatica.com','Demo','User',NULL,TRUE,NULL,'2025-11-06 07:17:41.17002','2025-11-06 07:17:41.17002',NULL,'00000000-0000-0000-0000-000000000021');

INSERT INTO "auth"."users"("instance_id","id","aud","role","email","encrypted_password","email_confirmed_at","invited_at","confirmation_token","confirmation_sent_at","recovery_token","recovery_sent_at","email_change_token_new","email_change","email_change_sent_at","last_sign_in_at","raw_app_meta_data","raw_user_meta_data","is_super_admin","created_at","updated_at","phone","phone_confirmed_at","phone_change","phone_change_token","phone_change_sent_at","email_change_token_current","email_change_confirm_status","banned_until","reauthentication_token","reauthentication_sent_at","is_sso_user","deleted_at","is_anonymous")
VALUES
('00000000-0000-0000-0000-000000000000','bcb8f5df-b678-4c22-ba71-59b33ba06227','authenticated','authenticated','mflores@pragmatica.com','$2a$10$av68P//OXhBrmx9R0WRL3.8DdVeIlcy.Wcf/yNgriwFcah51r500u','2025-11-06 07:07:59.211291+00',NULL,'',NULL,'',NULL,'','',NULL,'2025-11-06 07:07:59.218139+00','{"provider": "email", "providers": ["email"]}','{"sub": "bcb8f5df-b678-4c22-ba71-59b33ba06227", "email": "mflores@pragmatica.com", "email_verified": true, "phone_verified": false}',NULL,'2025-11-06 07:07:59.200435+00','2025-11-06 07:07:59.22046+00',NULL,NULL,'','',NULL,'',0,NULL,'',NULL,FALSE,NULL,FALSE);
INSERT INTO "public"."users"("id","company_id","username","email","first_name","last_name","phone","is_active","last_login_at","created_at","updated_at","deleted_at","van_warehouse_id")
VALUES
('bcb8f5df-b678-4c22-ba71-59b33ba06227','00000000-0000-0000-0000-000000000001','Miguel','mflores@pragmatica.com','Miguel','Flores',NULL,TRUE,NULL,'2025-11-06 07:17:41.17002','2025-11-06 07:17:41.17002',NULL,'00000000-0000-0000-0000-000000000013');

-- ============================================================================
-- SEED DATA: Suppliers
-- ============================================================================

DO $$
DECLARE
    v_company_id UUID := '00000000-0000-0000-0000-000000000001';
    v_user_id UUID := '5745e13c-ab07-48b7-9db7-24372b16f5a9';
BEGIN
    INSERT INTO suppliers (
        company_id, supplier_code, supplier_name, contact_person, email, phone, mobile, website, tax_id,
        billing_address_line1, billing_city, billing_state, billing_country, billing_postal_code,
        payment_terms, credit_limit, current_balance, status, notes,
        created_by, updated_by
    ) VALUES
        -- Poultry Suppliers
        (
            v_company_id, 'SUP-001', 'Davao Poultry Farms Inc.', 'Roberto Santos', 'roberto@davaopoltryfarms.ph', '+63-82-234-5678', '+63-917-234-5678', 'www.davaopoltryfarms.ph', '123-456-789-001',
            'Toril District, Davao City', 'Davao City', 'Davao del Sur', 'Philippines', '8000',
            'net_30', 2000000.00, 0, 'active', 'Main supplier for fresh dressed chicken and chicken parts',
            v_user_id, v_user_id
        ),
        (
            v_company_id, 'SUP-002', 'San Miguel Foods Mindanao', 'Maria Gonzales', 'maria@sanmiguelfoods.ph', '+63-82-345-6789', '+63-917-345-6789', 'www.sanmiguelfoods.ph', '234-567-890-002',
            'Km 10, Sasa Wharf', 'Davao City', 'Davao del Sur', 'Philippines', '8000',
            'net_45', 3000000.00, 0, 'active', 'Major poultry supplier - whole chicken and processed products',
            v_user_id, v_user_id
        ),
        (
            v_company_id, 'SUP-003', 'Bounty Fresh Chicken Mindanao', 'Juan Dela Cruz', 'juan@bountyfresh.ph', '+63-82-456-7890', '+63-917-456-7890', 'www.bountyfresh.ph', '345-678-901-003',
            'MacArthur Highway, Matina', 'Davao City', 'Davao del Sur', 'Philippines', '8000',
            'net_30', 2500000.00, 0, 'active', 'Premium chicken products and offal',
            v_user_id, v_user_id
        ),
        (
            v_company_id, 'SUP-004', 'Gensan Poultry Cooperative', 'Pedro Mercado', 'pedro@gensanpoultry.ph', '+63-83-552-3456', '+63-918-567-8901', 'www.gensanpoultry.coop', '456-789-012-004',
            'National Highway, Calumpang', 'General Santos City', 'South Cotabato', 'Philippines', '9500',
            'net_60', 1500000.00, 0, 'active', 'Chicken supplier from General Santos area',
            v_user_id, v_user_id
        ),
        -- Packaging and Supplies
        (
            v_company_id, 'SUP-005', 'Packaging Solutions Davao', 'Ana Reyes', 'ana@packagingsolutions.ph', '+63-82-678-9012', '+63-917-678-9012', 'www.packagingsolutions.ph', '567-890-123-005',
            'Panacan Industrial Area', 'Davao City', 'Davao del Sur', 'Philippines', '8000',
            'net_15', 300000.00, 0, 'active', 'Styrofoam boxes, plastic bags, and packaging materials',
            v_user_id, v_user_id
        ),
        (
            v_company_id, 'SUP-006', 'Ice Plant Davao', 'Carlos Ramos', 'carlos@iceplantdavao.ph', '+63-82-789-0123', '+63-917-789-0123', 'www.iceplantdavao.ph', '678-901-234-006',
            'Sasa Wharf Road', 'Davao City', 'Davao del Sur', 'Philippines', '8000',
            'cod', 100000.00, 0, 'active', 'Ice blocks and cooling supplies',
            v_user_id, v_user_id
        ),
        -- Inactive Supplier
        (
            v_company_id, 'SUP-007', 'Old Poultry Trading Co.', 'Miguel Torres', 'miguel@oldpoultry.ph', '+63-82-000-0000', NULL, NULL, '789-012-345-007',
            '456 Old Market Road', 'Davao City', 'Davao del Sur', 'Philippines', '8000',
            'cod', NULL, 0, 'inactive', 'No longer active - switched to other suppliers',
            v_user_id, v_user_id
        );

    RAISE NOTICE 'Suppliers seeded: % records', (SELECT COUNT(*) FROM suppliers);
END $$;

-- ============================================================================
-- SEED DATA: Purchase Orders
-- ============================================================================

DO $$
DECLARE
    v_company_id UUID := '00000000-0000-0000-0000-000000000001';
    v_user_id UUID := '5745e13c-ab07-48b7-9db7-24372b16f5a9';
    v_supplier_davao UUID;
    v_supplier_sanmiguel UUID;
    v_supplier_bounty UUID;
    v_supplier_packaging UUID;
    v_item_whole_m UUID;
    v_item_breast UUID;
    v_item_thigh UUID;
    v_item_liver UUID;
    v_item_gizzard UUID;
    v_item_feet UUID;
    v_item_styro_m UUID;
    v_item_plastic_m UUID;
    v_uom_kg UUID;
    v_uom_pcs UUID;
    v_uom_box UUID;
    v_warehouse_main UUID;
    v_po_1 UUID;
    v_po_2 UUID;
    v_po_3 UUID;
BEGIN
    -- Get supplier IDs
    SELECT id INTO v_supplier_davao FROM suppliers WHERE supplier_code = 'SUP-001' AND company_id = v_company_id;
    SELECT id INTO v_supplier_sanmiguel FROM suppliers WHERE supplier_code = 'SUP-002' AND company_id = v_company_id;
    SELECT id INTO v_supplier_bounty FROM suppliers WHERE supplier_code = 'SUP-003' AND company_id = v_company_id;
    SELECT id INTO v_supplier_packaging FROM suppliers WHERE supplier_code = 'SUP-005' AND company_id = v_company_id;

    -- Get item IDs
    SELECT id INTO v_item_whole_m FROM items WHERE item_code = 'CHK-WHOLE-M' AND company_id = v_company_id;
    SELECT id INTO v_item_breast FROM items WHERE item_code = 'CHK-BREAST' AND company_id = v_company_id;
    SELECT id INTO v_item_thigh FROM items WHERE item_code = 'CHK-THIGH' AND company_id = v_company_id;
    SELECT id INTO v_item_liver FROM items WHERE item_code = 'CHK-LIVER' AND company_id = v_company_id;
    SELECT id INTO v_item_gizzard FROM items WHERE item_code = 'CHK-GIZZARD' AND company_id = v_company_id;
    SELECT id INTO v_item_feet FROM items WHERE item_code = 'CHK-FEET' AND company_id = v_company_id;
    SELECT id INTO v_item_styro_m FROM items WHERE item_code = 'PACK-STYRO-M' AND company_id = v_company_id;
    SELECT id INTO v_item_plastic_m FROM items WHERE item_code = 'PACK-PLASTIC-M' AND company_id = v_company_id;

    -- Get UoM IDs
    SELECT id INTO v_uom_kg FROM units_of_measure WHERE code = 'KG' AND company_id = v_company_id;
    SELECT id INTO v_uom_pcs FROM units_of_measure WHERE code = 'PCS' AND company_id = v_company_id;
    SELECT id INTO v_uom_box FROM units_of_measure WHERE code = 'BOX' AND company_id = v_company_id;

    -- Get warehouse ID
    SELECT id INTO v_warehouse_main FROM warehouses WHERE warehouse_code = 'WH-DAVAO-01' AND company_id = v_company_id;

    -- PO 1: Draft - Fresh chicken order
    INSERT INTO purchase_orders (
        company_id, order_code, supplier_id, order_date, expected_delivery_date,
        subtotal, discount_amount, tax_amount, total_amount, status,
        delivery_address_line1, delivery_city, delivery_state, delivery_country, delivery_postal_code,
        payment_terms, notes, created_by, updated_by
    ) VALUES (
        v_company_id, 'PO-2025-0001', v_supplier_davao, '2025-11-01', '2025-11-05',
        0, 0, 0, 0, 'draft',
        'JP Laurel Ave, Bajada', 'Davao City', 'Davao del Sur', 'Philippines', '8000',
        'Net 30 days', 'Fresh chicken order for November', v_user_id, v_user_id
    ) RETURNING id INTO v_po_1;

    -- PO 1 Items
    INSERT INTO purchase_order_items (
        company_id, purchase_order_id, item_id, item_description, quantity, uom_id,
        rate, discount_percent, discount_amount, tax_percent, tax_amount, line_total,
        sort_order, created_by, updated_by
    ) VALUES
        (v_company_id, v_po_1, v_item_whole_m, 'Whole Chicken Medium 1.0-1.2kg', 500.0000, v_uom_kg,
         130.00, 2.00, 1300.00, 0.00, 0.00, 63700.00, 0, v_user_id, v_user_id),
        (v_company_id, v_po_1, v_item_breast, 'Chicken Breast fillet', 200.0000, v_uom_kg,
         185.00, 0.00, 0.00, 0.00, 0.00, 37000.00, 1, v_user_id, v_user_id),
        (v_company_id, v_po_1, v_item_thigh, 'Chicken Thigh', 150.0000, v_uom_kg,
         145.00, 0.00, 0.00, 0.00, 0.00, 21750.00, 2, v_user_id, v_user_id);

    -- Update PO 1 totals
    UPDATE purchase_orders SET
        subtotal = 123750.00,
        discount_amount = 1300.00,
        tax_amount = 0.00,
        total_amount = 122450.00
    WHERE id = v_po_1;

    -- PO 2: Approved - Offal order (ready to receive)
    INSERT INTO purchase_orders (
        company_id, order_code, supplier_id, order_date, expected_delivery_date,
        subtotal, discount_amount, tax_amount, total_amount, status,
        delivery_address_line1, delivery_city, delivery_state, delivery_country, delivery_postal_code,
        payment_terms, notes, approved_by, approved_at, created_by, updated_by
    ) VALUES (
        v_company_id, 'PO-2025-0002', v_supplier_bounty, '2025-10-25', '2025-11-02',
        0, 0, 0, 0, 'approved',
        'JP Laurel Ave, Bajada', 'Davao City', 'Davao del Sur', 'Philippines', '8000',
        'Net 30 days', 'Chicken offal order', v_user_id, '2025-10-26 10:00:00', v_user_id, v_user_id
    ) RETURNING id INTO v_po_2;

    -- PO 2 Items
    INSERT INTO purchase_order_items (
        company_id, purchase_order_id, item_id, item_description, quantity, uom_id,
        rate, discount_percent, discount_amount, tax_percent, tax_amount, line_total,
        sort_order, created_by, updated_by
    ) VALUES
        (v_company_id, v_po_2, v_item_liver, 'Chicken Liver', 80.0000, v_uom_kg,
         85.00, 0.00, 0.00, 0.00, 0.00, 6800.00, 0, v_user_id, v_user_id),
        (v_company_id, v_po_2, v_item_gizzard, 'Chicken Gizzard', 100.0000, v_uom_kg,
         95.00, 0.00, 0.00, 0.00, 0.00, 9500.00, 1, v_user_id, v_user_id),
        (v_company_id, v_po_2, v_item_feet, 'Chicken Feet', 120.0000, v_uom_kg,
         65.00, 0.00, 0.00, 0.00, 0.00, 7800.00, 2, v_user_id, v_user_id);

    -- Update PO 2 totals
    UPDATE purchase_orders SET
        subtotal = 24100.00,
        discount_amount = 0.00,
        tax_amount = 0.00,
        total_amount = 24100.00
    WHERE id = v_po_2;

    -- PO 3: Partially Received - Packaging supplies
    INSERT INTO purchase_orders (
        company_id, order_code, supplier_id, order_date, expected_delivery_date,
        subtotal, discount_amount, tax_amount, total_amount, status,
        delivery_address_line1, delivery_city, delivery_state, delivery_country, delivery_postal_code,
        payment_terms, notes, approved_by, approved_at, created_by, updated_by
    ) VALUES (
        v_company_id, 'PO-2025-0003', v_supplier_packaging, '2025-10-20', '2025-11-05',
        0, 0, 0, 0, 'partially_received',
        'JP Laurel Ave, Bajada', 'Davao City', 'Davao del Sur', 'Philippines', '8000',
        'Net 15 days', 'Monthly packaging supplies', v_user_id, '2025-10-21 09:00:00', v_user_id, v_user_id
    ) RETURNING id INTO v_po_3;

    -- PO 3 Items
    INSERT INTO purchase_order_items (
        company_id, purchase_order_id, item_id, item_description, quantity, uom_id,
        rate, discount_percent, discount_amount, tax_percent, tax_amount, line_total,
        quantity_received, sort_order, created_by, updated_by
    ) VALUES
        (v_company_id, v_po_3, v_item_styro_m, 'Styrofoam Box Medium', 200.0000, v_uom_pcs,
         12.00, 5.00, 120.00, 12.00, 265.20, 2777.20, 100.0000, 0, v_user_id, v_user_id),
        (v_company_id, v_po_3, v_item_plastic_m, 'Plastic Bags Medium (100pcs)', 50.0000, v_uom_box,
         65.00, 0.00, 0.00, 12.00, 390.00, 3640.00, 0.0000, 1, v_user_id, v_user_id);

    -- Update PO 3 totals
    UPDATE purchase_orders SET
        subtotal = 5650.00,
        discount_amount = 120.00,
        tax_amount = 655.20,
        total_amount = 6185.20
    WHERE id = v_po_3;

    RAISE NOTICE 'Purchase Orders seeded: % records', (SELECT COUNT(*) FROM purchase_orders);
    RAISE NOTICE 'Purchase Order Items seeded: % records', (SELECT COUNT(*) FROM purchase_order_items);
END $$;

-- ============================================================================
-- SEED DATA: Van Warehouse Inventory
-- ============================================================================
-- Add initial inventory to Demo Van 001 for testing
DO $$
DECLARE
    v_van_id UUID := '00000000-0000-0000-0000-000000000021';
    v_company_id UUID := '00000000-0000-0000-0000-000000000001';
    v_item_chicken UUID;
    v_item_pork UUID;
    v_item_eggs UUID;
    v_item_rice UUID;
BEGIN
    -- Get item IDs (using items that should exist from previous seeds)
    SELECT id INTO v_item_chicken FROM items WHERE item_code = 'CHK-WHL-01' LIMIT 1;
    SELECT id INTO v_item_pork FROM items WHERE item_code = 'PRK-BLY-01' LIMIT 1;
    SELECT id INTO v_item_eggs FROM items WHERE item_code = 'EGG-FRH-01' LIMIT 1;
    SELECT id INTO v_item_rice FROM items WHERE item_code = 'RIC-WHT-01' LIMIT 1;

    -- Insert van warehouse stock (only if items exist)
    IF v_item_chicken IS NOT NULL THEN
        INSERT INTO item_warehouse_stock (company_id, item_id, warehouse_id, current_stock)
        VALUES (v_company_id, v_item_chicken, v_van_id, 15.0000)
        ON CONFLICT (company_id, item_id, warehouse_id) DO UPDATE
        SET current_stock = EXCLUDED.current_stock;
    END IF;

    IF v_item_pork IS NOT NULL THEN
        INSERT INTO item_warehouse_stock (company_id, item_id, warehouse_id, current_stock)
        VALUES (v_company_id, v_item_pork, v_van_id, 8.0000)
        ON CONFLICT (company_id, item_id, warehouse_id) DO UPDATE
        SET current_stock = EXCLUDED.current_stock;
    END IF;

    IF v_item_eggs IS NOT NULL THEN
        INSERT INTO item_warehouse_stock (company_id, item_id, warehouse_id, current_stock)
        VALUES (v_company_id, v_item_eggs, v_van_id, 3.0000)
        ON CONFLICT (company_id, item_id, warehouse_id) DO UPDATE
        SET current_stock = EXCLUDED.current_stock;
    END IF;

    IF v_item_rice IS NOT NULL THEN
        INSERT INTO item_warehouse_stock (company_id, item_id, warehouse_id, current_stock)
        VALUES (v_company_id, v_item_rice, v_van_id, 25.0000)
        ON CONFLICT (company_id, item_id, warehouse_id) DO UPDATE
        SET current_stock = EXCLUDED.current_stock;
    END IF;

    RAISE NOTICE 'Van warehouse inventory seeded for VAN-001';
END $$;
-- ============================================================================
-- SEED DATA: Chart of Accounts
-- ============================================================================

DO $$
DECLARE
    v_company_id UUID := '00000000-0000-0000-0000-000000000001';
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
-- This executes the Phase 2 migration logic for seeded items
-- Creates default variants, packaging, and migrates prices

DO $$
DECLARE
    v_company_id UUID := '00000000-0000-0000-0000-000000000001';
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

    -- Migrate Wholesale (ws) from cost_price
    INSERT INTO item_prices (
        company_id, variant_id, price_tier, price_tier_name, price,
        currency_code, effective_from, effective_to, is_active,
        created_at, created_by, updated_at, updated_by
    )
    SELECT
        v.company_id, v.id, 'ws', 'Wholesale', COALESCE(i.cost_price, 0),
        'PHP', CURRENT_DATE, NULL, true,
        CURRENT_TIMESTAMP, COALESCE(v_user_id, i.created_by),
        CURRENT_TIMESTAMP, COALESCE(v_user_id, i.updated_by)
    FROM item_variants v
    INNER JOIN items i ON v.item_id = i.id
    WHERE v.deleted_at IS NULL AND v.is_default = true
      AND i.cost_price IS NOT NULL AND v.company_id = v_company_id
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
            company_id, employee_code, first_name, last_name, email, phone,
            role, department, hire_date, commission_rate,
            city, region_state, is_active, created_by, updated_by, user_id
        ) VALUES
        -- Admin
        (v_company_id, 'EMP-001', 'Juan', 'Dela Cruz', 'juan.delacruz@example.com', '+63-917-1234567',
         'admin', 'Management', '2024-01-01', 5.00,
         'Davao City', 'Davao Region', true, v_user_id, v_user_id, '5745e13c-ab07-48b7-9db7-24372b16f5a9'),

        -- Managers
        (v_company_id, 'EMP-002', 'Maria', 'Santos', 'maria.santos@example.com', '+63-917-2345678',
         'manager', 'Sales', '2024-01-15', 3.00,
         'Cagayan de Oro City', 'Northern Mindanao', true, v_user_id, v_user_id, NULL),

        (v_company_id, 'EMP-003', 'Pedro', 'Reyes', 'pedro.reyes@example.com', '+63-917-3456789',
         'manager', 'Sales', '2024-02-01', 3.00,
         'General Santos City', 'SOCCSKSARGEN', true, v_user_id, v_user_id, NULL),
        -- Sales Agents
        (v_company_id, 'EMP-004', 'Ana', 'Garcia', 'ana.garcia@example.com', '+63-917-4567890',
         'sales_agent', 'Sales', '2024-03-01', 5.00,
         'Davao City', 'Davao Region', true, v_user_id, v_user_id, NULL),
        (v_company_id, 'EMP-005', 'Roberto', 'Cruz', 'roberto.cruz@example.com', '+63-917-5678901',
         'sales_agent', 'Sales', '2024-03-01', 5.00,
         'Tagum City', 'Davao Region', true, v_user_id, v_user_id, NULL),

        (v_company_id, 'EMP-006', 'Linda', 'Ramos', 'linda.ramos@example.com', '+63-917-6789012',
         'sales_agent', 'Sales', '2024-03-15', 6.00,
         'Cagayan de Oro City', 'Northern Mindanao', true, v_user_id, v_user_id, NULL),

        (v_company_id, 'EMP-007', 'Carlos', 'Mendoza', 'carlos.mendoza@example.com', '+63-917-7890123',
         'sales_agent', 'Sales', '2024-04-01', 5.50,
         'Iligan City', 'Northern Mindanao', true, v_user_id, v_user_id, NULL),

        (v_company_id, 'EMP-008', 'Sofia', 'Torres', 'sofia.torres@example.com', '+63-917-8901234',
         'sales_agent', 'Sales', '2024-04-01', 7.00,
         'General Santos City', 'SOCCSKSARGEN', true, v_user_id, v_user_id, NULL),

        (v_company_id, 'EMP-009', 'Miguel', 'Flores', 'miguel.flores@example.com', '+63-917-9012345',
         'sales_agent', 'Sales', '2024-04-15', 5.00,
         'Zamboanga City', 'Zamboanga Peninsula', true, v_user_id, v_user_id, 'bcb8f5df-b678-4c22-ba71-59b33ba06227'),

        (v_company_id, 'EMP-010', 'Elena', 'Diaz', 'elena.diaz@example.com', '+63-917-0123456',
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
