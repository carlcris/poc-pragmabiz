-- Seed data for development
-- This file will be executed after migrations when running `supabase db reset`

-- ============================================================================
-- SEED DATA: Companies
-- ============================================================================

INSERT INTO companies (id, code, name, legal_name, tax_id, email, phone, address_line1, city, state, country, postal_code, currency_code, is_active)
VALUES
    ('00000000-0000-0000-0000-000000000001', 'ACHLERS', 'Achlers Integrated Sales', 'Achlers Integrated Sales', '123-456-789', 'contact@achlers.com', '+63-917-123-4567', '123 Business St', 'Davao City', 'Davao del Sur', 'Philippines', '8000', 'PHP', true);

-- ============================================================================
-- SEED DATA: Default Business Unit
-- ============================================================================

INSERT INTO business_units (id, company_id, code, name, type, is_active, created_at, updated_at)
VALUES
  (
    '00000000-0000-0000-0000-000000000100',
    '00000000-0000-0000-0000-000000000001',
    'MAIN',
    'Main-Bulacan',
    'primary',
    true,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000001',
    'WH-BRANCH 01',
    'Bambang',
    'warehouse',
    true,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000102',
    '00000000-0000-0000-0000-000000000001',
    'WH-BRANCH 02',
    'Abad Santos',
    'warehouse',
    true,
    now(),
    now()
  );

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

-- Common units for picture frame business
INSERT INTO units_of_measure (company_id, code, name, symbol, is_base_unit, is_active)
VALUES
    ('00000000-0000-0000-0000-000000000001', 'PCS', 'Pieces', 'pcs', true, true),
    ('00000000-0000-0000-0000-000000000001', 'BOX', 'Box', 'box', false, true),
    ('00000000-0000-0000-0000-000000000001', 'FT', 'Feet', 'ft', true, true),
    ('00000000-0000-0000-0000-000000000001', 'IN', 'Inch', 'in', false, true),
    ('00000000-0000-0000-0000-000000000001', 'SQF', 'Square Feet', 'sqft', false, true),
    ('00000000-0000-0000-0000-000000000001', 'SHEET', 'Sheet', 'sheet', false, true),
    ('00000000-0000-0000-0000-000000000001', 'ROLL', 'Roll', 'roll', false, true),
    ('00000000-0000-0000-0000-000000000001', 'PACK', 'Pack', 'pack', false, true),
    ('00000000-0000-0000-0000-000000000001', 'SET', 'Set', 'set', false, true),
    ('00000000-0000-0000-0000-000000000001', 'BUNDLE', 'Bundle', 'bundle', false, true);

-- ============================================================================
-- SEED DATA: Item Categories
-- ============================================================================

INSERT INTO item_categories (company_id, code, name, description, is_active)
VALUES
    -- Picture Frame Categories
    ('00000000-0000-0000-0000-000000000001', 'MOLD', 'Moldings', 'Frame moldings and profiles', true),
    ('00000000-0000-0000-0000-000000000001', 'GLASS', 'Glass', 'Glass sheets for picture frames', true),
    ('00000000-0000-0000-0000-000000000001', 'MAT', 'Matboard', 'Matboards and mounting boards', true),
    ('00000000-0000-0000-0000-000000000001', 'BACK', 'Backing', 'Backing boards and materials', true),
    ('00000000-0000-0000-0000-000000000001', 'HARD', 'Hardware', 'Frame hardware and accessories', true),
    ('00000000-0000-0000-0000-000000000001', 'FIN', 'Finished Frames', 'Complete assembled frames', true),
    ('00000000-0000-0000-0000-000000000001', 'SUPPLY', 'Supplies', 'Tools and supplies for frame assembly', true),
    ('00000000-0000-0000-0000-000000000001', 'PACK', 'Packaging Materials', 'Packaging materials for frames', true);

-- ============================================================================
-- SEED DATA: Items
-- ============================================================================

-- Get UoM IDs (we'll use the created ones)
DO $$
DECLARE
    v_company_id UUID := '00000000-0000-0000-0000-000000000001';
    v_uom_pcs UUID;
    v_uom_ft UUID;
    v_uom_sheet UUID;
    v_uom_box UUID;
    v_uom_bundle UUID;
    v_cat_mold UUID;
    v_cat_glass UUID;
    v_cat_mat UUID;
    v_cat_back UUID;
    v_cat_hard UUID;
    v_cat_fin UUID;
    v_cat_pack UUID;
    v_cat_supply UUID;
BEGIN
    -- Get UoM IDs
    SELECT id INTO v_uom_pcs FROM units_of_measure WHERE code = 'PCS' AND company_id = v_company_id;
    SELECT id INTO v_uom_ft FROM units_of_measure WHERE code = 'FT' AND company_id = v_company_id;
    SELECT id INTO v_uom_sheet FROM units_of_measure WHERE code = 'SHEET' AND company_id = v_company_id;
    SELECT id INTO v_uom_box FROM units_of_measure WHERE code = 'BOX' AND company_id = v_company_id;
    SELECT id INTO v_uom_bundle FROM units_of_measure WHERE code = 'BUNDLE' AND company_id = v_company_id;

    -- Get Category IDs
    SELECT id INTO v_cat_mold FROM item_categories WHERE code = 'MOLD' AND company_id = v_company_id;
    SELECT id INTO v_cat_glass FROM item_categories WHERE code = 'GLASS' AND company_id = v_company_id;
    SELECT id INTO v_cat_mat FROM item_categories WHERE code = 'MAT' AND company_id = v_company_id;
    SELECT id INTO v_cat_back FROM item_categories WHERE code = 'BACK' AND company_id = v_company_id;
    SELECT id INTO v_cat_hard FROM item_categories WHERE code = 'HARD' AND company_id = v_company_id;
    SELECT id INTO v_cat_fin FROM item_categories WHERE code = 'FIN' AND company_id = v_company_id;
    SELECT id INTO v_cat_pack FROM item_categories WHERE code = 'PACK' AND company_id = v_company_id;
    SELECT id INTO v_cat_supply FROM item_categories WHERE code = 'SUPPLY' AND company_id = v_company_id;

    -- Insert sample items
    INSERT INTO items (company_id, item_code, item_name, item_name_cn, description, category_id, uom_id, item_type, purchase_price, sales_price, cost_price, is_stock_item, is_active)
    VALUES
        -- Moldings (Wood Frame Moldings)
        (v_company_id, 'MOLD-W-001', 'Oak Molding 1"', '橡木线条 1英寸', 'Natural oak molding 1 inch width', v_cat_mold, v_uom_ft, 'raw_material', 45.00, 75.00, 42.00, true, true),
        (v_company_id, 'MOLD-W-002', 'Walnut Molding 1.5"', '胡桃木线条 1.5英寸', 'Dark walnut molding 1.5 inch width', v_cat_mold, v_uom_ft, 'raw_material', 65.00, 105.00, 62.00, true, true),
        (v_company_id, 'MOLD-W-003', 'Cherry Molding 2"', '樱桃木线条 2英寸', 'Cherry wood molding 2 inch width', v_cat_mold, v_uom_ft, 'raw_material', 75.00, 125.00, 72.00, true, true),
        (v_company_id, 'MOLD-M-001', 'Gold Metal Molding 0.75"', '金色金属线条 0.75英寸', 'Gold finish metal molding 0.75 inch', v_cat_mold, v_uom_ft, 'raw_material', 35.00, 60.00, 32.00, true, true),
        (v_company_id, 'MOLD-M-002', 'Silver Metal Molding 1"', '银色金属线条 1英寸', 'Silver finish metal molding 1 inch', v_cat_mold, v_uom_ft, 'raw_material', 40.00, 68.00, 37.00, true, true),
        (v_company_id, 'MOLD-M-003', 'Black Metal Molding 1.25"', '黑色金属线条 1.25英寸', 'Matte black metal molding 1.25 inch', v_cat_mold, v_uom_ft, 'raw_material', 42.00, 70.00, 39.00, true, true),

        -- Glass Sheets (Various Sizes in Inches)
        (v_company_id, 'GLASS-8X10', 'Glass Sheet 8x10"', '玻璃板 8x10英寸', 'Clear glass sheet 8 x 10 inches', v_cat_glass, v_uom_sheet, 'raw_material', 25.00, 45.00, 23.00, true, true),
        (v_company_id, 'GLASS-11X14', 'Glass Sheet 11x14"', '玻璃板 11x14英寸', 'Clear glass sheet 11 x 14 inches', v_cat_glass, v_uom_sheet, 'raw_material', 35.00, 60.00, 32.00, true, true),
        (v_company_id, 'GLASS-16X20', 'Glass Sheet 16x20"', '玻璃板 16x20英寸', 'Clear glass sheet 16 x 20 inches', v_cat_glass, v_uom_sheet, 'raw_material', 55.00, 95.00, 52.00, true, true),
        (v_company_id, 'GLASS-18X24', 'Glass Sheet 18x24"', '玻璃板 18x24英寸', 'Clear glass sheet 18 x 24 inches', v_cat_glass, v_uom_sheet, 'raw_material', 65.00, 110.00, 62.00, true, true),
        (v_company_id, 'GLASS-24X36', 'Glass Sheet 24x36"', '玻璃板 24x36英寸', 'Clear glass sheet 24 x 36 inches', v_cat_glass, v_uom_sheet, 'raw_material', 95.00, 160.00, 92.00, true, true),
        (v_company_id, 'GLASS-UV-16X20', 'UV Glass 16x20"', '防紫外线玻璃 16x20英寸', 'UV protection glass 16 x 20 inches', v_cat_glass, v_uom_sheet, 'raw_material', 85.00, 145.00, 82.00, true, true),
        (v_company_id, 'GLASS-UV-24X36', 'UV Glass 24x36"', '防紫外线玻璃 24x36英寸', 'UV protection glass 24 x 36 inches', v_cat_glass, v_uom_sheet, 'raw_material', 135.00, 225.00, 132.00, true, true),

        -- Matboards
        (v_company_id, 'MAT-WHT-32X40', 'White Matboard 32x40"', '白色卡纸板 32x40英寸', 'White matboard 32 x 40 inches', v_cat_mat, v_uom_sheet, 'raw_material', 85.00, 145.00, 82.00, true, true),
        (v_company_id, 'MAT-BLK-32X40', 'Black Matboard 32x40"', '黑色卡纸板 32x40英寸', 'Black matboard 32 x 40 inches', v_cat_mat, v_uom_sheet, 'raw_material', 85.00, 145.00, 82.00, true, true),
        (v_company_id, 'MAT-CRM-32X40', 'Cream Matboard 32x40"', '米色卡纸板 32x40英寸', 'Cream matboard 32 x 40 inches', v_cat_mat, v_uom_sheet, 'raw_material', 85.00, 145.00, 82.00, true, true),
        (v_company_id, 'MAT-GRY-32X40', 'Gray Matboard 32x40"', '灰色卡纸板 32x40英寸', 'Gray matboard 32 x 40 inches', v_cat_mat, v_uom_sheet, 'raw_material', 85.00, 145.00, 82.00, true, true),

        -- Backing Boards
        (v_company_id, 'BACK-8X10', 'Backing Board 8x10"', '背板 8x10英寸', 'Foam core backing 8 x 10 inches', v_cat_back, v_uom_sheet, 'raw_material', 15.00, 28.00, 14.00, true, true),
        (v_company_id, 'BACK-11X14', 'Backing Board 11x14"', '背板 11x14英寸', 'Foam core backing 11 x 14 inches', v_cat_back, v_uom_sheet, 'raw_material', 20.00, 35.00, 18.00, true, true),
        (v_company_id, 'BACK-16X20', 'Backing Board 16x20"', '背板 16x20英寸', 'Foam core backing 16 x 20 inches', v_cat_back, v_uom_sheet, 'raw_material', 30.00, 52.00, 28.00, true, true),
        (v_company_id, 'BACK-24X36', 'Backing Board 24x36"', '背板 24x36英寸', 'Foam core backing 24 x 36 inches', v_cat_back, v_uom_sheet, 'raw_material', 50.00, 85.00, 48.00, true, true),

        -- Hardware & Accessories
        (v_company_id, 'HARD-HANG-WIRE', 'Hanging Wire', '挂画钢丝', 'Frame hanging wire 50ft roll', v_cat_hard, v_uom_pcs, 'raw_material', 35.00, 60.00, 32.00, true, true),
        (v_company_id, 'HARD-D-RINGS', 'D-Rings', 'D型挂环', 'Metal D-rings for hanging (100pcs)', v_cat_hard, v_uom_box, 'raw_material', 45.00, 75.00, 42.00, true, true),
        (v_company_id, 'HARD-SPRINGS', 'Frame Springs', '画框弹簧', 'Metal frame springs (500pcs)', v_cat_hard, v_uom_box, 'raw_material', 55.00, 95.00, 52.00, true, true),
        (v_company_id, 'HARD-CORNERS', 'Corner Brackets', '角铁', 'Metal corner brackets (100pcs)', v_cat_hard, v_uom_box, 'raw_material', 65.00, 110.00, 62.00, true, true),

        -- Packaging Materials
        (v_company_id, 'PACK-CORNER', 'Corner Protectors', '护角', 'Foam corner protectors (100pcs)', v_cat_pack, v_uom_box, 'raw_material', 45.00, 75.00, 42.00, true, true),
        (v_company_id, 'PACK-BUBBLE', 'Bubble Wrap', '气泡膜', 'Bubble wrap 12" x 100ft roll', v_cat_pack, v_uom_pcs, 'raw_material', 85.00, 145.00, 82.00, true, true),
        (v_company_id, 'PACK-KRAFT', 'Kraft Paper', '牛皮纸', 'Brown kraft paper 36" x 200ft', v_cat_pack, v_uom_pcs, 'raw_material', 95.00, 160.00, 92.00, true, true),

        -- Supplies
        (v_company_id, 'SUPPLY-GLUE', 'Wood Glue', '木胶', 'Wood glue for frame assembly 16oz', v_cat_supply, v_uom_pcs, 'raw_material', 35.00, 60.00, 32.00, true, true),
        (v_company_id, 'SUPPLY-TAPE', 'Framing Tape', '装框胶带', 'Double-sided framing tape 1" x 50ft', v_cat_supply, v_uom_pcs, 'raw_material', 25.00, 45.00, 23.00, true, true),
        (v_company_id, 'SUPPLY-POINTS', 'Glazier Points', '玻璃固定钉', 'Metal glazier points (1000pcs)', v_cat_supply, v_uom_box, 'raw_material', 40.00, 68.00, 37.00, true, true);
END $$;

-- ============================================================================
-- SEED DATA: Create Packages for All Items (REQUIRED AFTER MIGRATION)
-- ============================================================================

DO $$
DECLARE
    v_company_id UUID := '00000000-0000-0000-0000-000000000001';
    v_item RECORD;
    v_package_id UUID;
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
          AND (i.package_id IS NULL OR i.setup_complete = FALSE)
    LOOP
        -- Create base package using UOM name and code
        INSERT INTO item_packaging (
            company_id,
            item_id,
            pack_type,
            pack_name,
            qty_per_pack,
            uom_id,
            barcode,
            is_default,
            is_active
        ) VALUES (
            v_company_id,
            v_item.id,
            v_item.uom_code,  -- Use UOM code as pack_type (e.g., 'PCS', 'FT', 'SHEET')
            v_item.uom_name,  -- Use UOM name as pack_name (e.g., 'Pieces', 'Feet', 'Sheet')
            1.0,
            v_item.uom_id,
            v_item.item_code,
            true,
            true
        )
        RETURNING id INTO v_package_id;

        -- Link item to its base package and mark as complete
        UPDATE items
        SET package_id = v_package_id,
            setup_complete = TRUE
        WHERE id = v_item.id;

        v_items_processed := v_items_processed + 1;
    END LOOP;

    RAISE NOTICE '============================================';
    RAISE NOTICE 'Package setup complete!';
    RAISE NOTICE 'Items processed: %', v_items_processed;
    RAISE NOTICE 'Total items with packages: %', (SELECT COUNT(*) FROM items WHERE setup_complete = TRUE AND company_id = v_company_id);
    RAISE NOTICE '============================================';
END $$;

-- ============================================================================
-- SEED DATA: Warehouses
-- ============================================================================

INSERT INTO warehouses (id, company_id, business_unit_id, warehouse_code, warehouse_name, warehouse_type, address_line1, city, state, country, postal_code, contact_person, phone, email, is_active, is_van)
VALUES
    -- Main Office Warehouses
    ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000100', 'WH-BULACAN', 'Bulacan', 'main', 'JP Laurel Ave', 'Malolos City', 'Region III', 'Philippines', '8000', 'Juan Dela Cruz', '+63-917-111-2222', 'taguig.wh@achlers.com', true, false),
    ('00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000101', 'WH-BAMBANG', 'Bambang', 'main', '123 Lopez St.', 'Manila', 'NCR', 'Philippines', '9000', 'Maria Santos', '+63-917-222-3333', 'pasay.wh@achlers.com', true, false),
    ('00000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000102', 'WH-SANTOS', 'Abad Santos', 'store', '456 Juan Luna St.', 'Pasig City', 'NCR', 'Philippines', '9500', 'Miguel Flores', '+63-917-333-4444', 'pasig@achlers.com', true, false);
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
            v_company_id, '00000000-0000-0000-0000-000000000100', 'CUST-001', 'SM Retail Corporation', 'company', '123-456-789-000',
            'purchasing@smretail.com.ph', '+63-82-227-1234', 'www.smretail.com.ph',
            'SM City Davao', 'J.P. Laurel Avenue', 'Davao City', 'Davao del Sur', 'Philippines', '8000',
            'SM City Davao', 'J.P. Laurel Avenue', 'Davao City', 'Davao del Sur', 'Philippines', '8000',
            'net_30', 500000.00, 30,
            'Maria Santos', '+63-917-123-4567', 'maria.santos@smretail.com.ph',
            true, v_user_id, v_user_id
        ),
        (
            v_company_id, '00000000-0000-0000-0000-000000000100', 'CUST-002', 'Gaisano Capital', 'company', '234-567-890-000',
            'procurement@gaisano.com', '+63-88-856-7890', 'www.gaisano.com',
            'Gaisano Mall of Davao', 'JP Laurel Avenue', 'Davao City', 'Davao del Sur', 'Philippines', '8000',
            'Gaisano Mall of Davao', 'JP Laurel Avenue', 'Davao City', 'Davao del Sur', 'Philippines', '8000',
            'net_60', 800000.00, 60,
            'Juan Dela Cruz', '+63-917-234-5678', 'juan.delacruz@gaisano.com',
            true, v_user_id, v_user_id
        ),
        (
            v_company_id, '00000000-0000-0000-0000-000000000100', 'CUST-003', 'NCCC Mall', 'company', '345-678-901-000',
            'buyer@nccc.com.ph', '+63-82-305-5000', 'www.nccc.com.ph',
            'NCCC Mall Davao', 'Ma-a Road', 'Davao City', 'Davao del Sur', 'Philippines', '8000',
            'NCCC Mall Davao', 'Ma-a Road', 'Davao City', 'Davao del Sur', 'Philippines', '8000',
            'net_30', 600000.00, 30,
            'Ana Reyes', '+63-917-345-6789', 'ana.reyes@nccc.com.ph',
            true, v_user_id, v_user_id
        ),
        (
            v_company_id, '00000000-0000-0000-0000-000000000100', 'CUST-004', 'Robinsons Supermarket', 'company', '456-789-012-000',
            'supply@robinsons.com.ph', '+63-82-221-2000', 'www.robinsons.com.ph',
            'Robinsons Place Davao', 'Roxas Avenue', 'Davao City', 'Davao del Sur', 'Philippines', '8000',
            'Robinsons Place Davao', 'Roxas Avenue', 'Davao City', 'Davao del Sur', 'Philippines', '8000',
            'net_45', 700000.00, 45,
            'Carlos Ramos', '+63-917-456-7890', 'carlos.ramos@robinsons.com.ph',
            true, v_user_id, v_user_id
        ),
        (
            v_company_id, '00000000-0000-0000-0000-000000000100', 'CUST-005', 'Puregold Price Club', 'company', '567-890-123-000',
            'orders@puregold.com.ph', '+63-82-234-5000', 'www.puregold.com.ph',
            'Puregold Davao', 'McArthur Highway', 'Davao City', 'Davao del Sur', 'Philippines', '8000',
            'Puregold Davao', 'McArthur Highway', 'Davao City', 'Davao del Sur', 'Philippines', '8000',
            'net_30', 450000.00, 30,
            'Lisa Garcia', '+63-917-567-8901', 'lisa.garcia@puregold.com.ph',
            true, v_user_id, v_user_id
        ),

        -- Government Customers
        (
            v_company_id, '00000000-0000-0000-0000-000000000100', 'CUST-GOV-001', 'Department of Education - Davao Division', 'government', 'GOV-123-456',
            'deped.davao@deped.gov.ph', '+63-82-227-6051', 'davao.deped.gov.ph',
            'DepEd Division Office', 'E. Quirino Avenue', 'Davao City', 'Davao del Sur', 'Philippines', '8000',
            'DepEd Division Office', 'E. Quirino Avenue', 'Davao City', 'Davao del Sur', 'Philippines', '8000',
            'net_60', 1000000.00, 60,
            'Dr. Roberto Cruz', '+63-917-678-9012', 'roberto.cruz@deped.gov.ph',
            true, v_user_id, v_user_id
        ),
        (
            v_company_id, '00000000-0000-0000-0000-000000000100', 'CUST-GOV-002', 'Davao City Government', 'government', 'GOV-234-567',
            'procurement@davaocity.gov.ph', '+63-82-227-1000', 'www.davaocity.gov.ph',
            'Davao City Hall', 'San Pedro Street', 'Davao City', 'Davao del Sur', 'Philippines', '8000',
            'Davao City Hall', 'San Pedro Street', 'Davao City', 'Davao del Sur', 'Philippines', '8000',
            'net_90', 2000000.00, 90,
            'Engr. Pedro Gonzales', '+63-917-789-0123', 'pedro.gonzales@davaocity.gov.ph',
            true, v_user_id, v_user_id
        ),

        -- Individual Customers (Walk-in/Retail)
        (
            v_company_id, '00000000-0000-0000-0000-000000000100', 'CUST-IND-001', 'John Paul Rivera', 'individual', NULL,
            'jp.rivera@email.com', '+63-917-890-1234', NULL,
            'Phase 1, Block 3, Lot 5', 'Ecoland Subdivision', 'Davao City', 'Davao del Sur', 'Philippines', '8000',
            'Phase 1, Block 3, Lot 5', 'Ecoland Subdivision', 'Davao City', 'Davao del Sur', 'Philippines', '8000',
            'cash', 50000.00, 0,
            NULL, NULL, NULL,
            true, v_user_id, v_user_id
        ),
        (
            v_company_id, '00000000-0000-0000-0000-000000000100', 'CUST-IND-002', 'Sarah Mae Santos', 'individual', NULL,
            'sarah.santos@email.com', '+63-917-901-2345', NULL,
            '123 Palma Gil Street', 'Poblacion District', 'Davao City', 'Davao del Sur', 'Philippines', '8000',
            '123 Palma Gil Street', 'Poblacion District', 'Davao City', 'Davao del Sur', 'Philippines', '8000',
            'due_on_receipt', 30000.00, 0,
            NULL, NULL, NULL,
            true, v_user_id, v_user_id
        ),
        (
            v_company_id, '00000000-0000-0000-0000-000000000100', 'CUST-IND-003', 'Michael Angelo Torres', 'individual', NULL,
            'miguel.torres@email.com', '+63-917-012-3456', NULL,
            '456 Quirino Avenue', 'Matina District', 'Davao City', 'Davao del Sur', 'Philippines', '8000',
            '456 Quirino Avenue', 'Matina District', 'Davao City', 'Davao del Sur', 'Philippines', '8000',
            'cash', 25000.00, 0,
            NULL, NULL, NULL,
            true, v_user_id, v_user_id
        ),

        -- Additional Company Customers (Regional)
        (
            v_company_id, '00000000-0000-0000-0000-000000000100', 'CUST-006', 'Cagayan de Oro Trading Corp', 'company', '678-901-234-000',
            'orders@cdotrading.com', '+63-88-858-1234', 'www.cdotrading.com',
            'Carmen Business Park', 'Corrales Avenue', 'Cagayan de Oro', 'Misamis Oriental', 'Philippines', '9000',
            'Carmen Business Park', 'Corrales Avenue', 'Cagayan de Oro', 'Misamis Oriental', 'Philippines', '9000',
            'net_30', 400000.00, 30,
            'Dante Villaruel', '+63-918-123-4567', 'dante.v@cdotrading.com',
            true, v_user_id, v_user_id
        ),
        (
            v_company_id, '00000000-0000-0000-0000-000000000100', 'CUST-007', 'General Santos Wholesale Center', 'company', '789-012-345-000',
            'wholesale@gensan.com', '+63-83-552-3456', 'www.gensanwholesale.com',
            'National Highway', 'Calumpang', 'General Santos', 'South Cotabato', 'Philippines', '9500',
            'National Highway', 'Calumpang', 'General Santos', 'South Cotabato', 'Philippines', '9500',
            'net_45', 550000.00, 45,
            'Gloria Mercado', '+63-918-234-5678', 'gloria.m@gensan.com',
            true, v_user_id, v_user_id
        ),

        -- Inactive Customer (for testing)
        (
            v_company_id, '00000000-0000-0000-0000-000000000100', 'CUST-008', 'Inactive Trading Inc', 'company', '890-123-456-000',
            'contact@inactive.com', '+63-82-000-0000', NULL,
            'Old Business District', 'Building 1', 'Davao City', 'Davao del Sur', 'Philippines', '8000',
            'Old Business District', 'Building 1', 'Davao City', 'Davao del Sur', 'Philippines', '8000',
            'net_30', 100000.00, 30,
            'Inactive Contact', '+63-917-000-0000', 'inactive@test.com',
            false, v_user_id, v_user_id
        ),

        -- Downtown Branch Customers
        (
            v_company_id, '00000000-0000-0000-0000-000000000101', 'CUST-DTN-001', 'Metro Department Store', 'company', '111-222-333-000',
            'sales@metrodept.com', '+63-82-301-2345', 'www.metrodept.com',
            'Downtown Plaza', 'Rizal Avenue', 'Davao City', 'Davao del Sur', 'Philippines', '8000',
            'Downtown Plaza', 'Rizal Avenue', 'Davao City', 'Davao del Sur', 'Philippines', '8000',
            'net_30', 300000.00, 30,
            'Rosa Martinez', '+63-917-111-2222', 'rosa.martinez@metrodept.com',
            true, v_user_id, v_user_id
        ),
        (
            v_company_id, '00000000-0000-0000-0000-000000000101', 'CUST-DTN-002', 'City Mall Retail', 'company', '222-333-444-000',
            'procurement@citymall.ph', '+63-82-302-3456', 'www.citymall.ph',
            'City Center', 'C.M. Recto Street', 'Davao City', 'Davao del Sur', 'Philippines', '8000',
            'City Center', 'C.M. Recto Street', 'Davao City', 'Davao del Sur', 'Philippines', '8000',
            'net_60', 450000.00, 60,
            'Pedro Gonzales', '+63-917-222-3333', 'pedro.gonzales@citymall.ph',
            true, v_user_id, v_user_id
        ),
        (
            v_company_id, '00000000-0000-0000-0000-000000000101', 'CUST-DTN-003', 'Urban Boutique', 'retail', '333-444-555-000',
            'orders@urbanboutique.com', '+63-82-303-4567', NULL,
            'Fashion District', '2nd Floor, Edificio Building', 'Davao City', 'Davao del Sur', 'Philippines', '8000',
            'Fashion District', '2nd Floor, Edificio Building', 'Davao City', 'Davao del Sur', 'Philippines', '8000',
            'net_15', 150000.00, 15,
            'Linda Cruz', '+63-917-333-4444', 'linda.cruz@urbanboutique.com',
            true, v_user_id, v_user_id
        ),
        (
            v_company_id, '00000000-0000-0000-0000-000000000101', 'CUST-DTN-004', 'Downtown General Store', 'retail', '444-555-666-000',
            'manager@dtgenstore.com', '+63-82-304-5678', NULL,
            'Main Street', 'Corner Quezon Avenue', 'Davao City', 'Davao del Sur', 'Philippines', '8000',
            'Main Street', 'Corner Quezon Avenue', 'Davao City', 'Davao del Sur', 'Philippines', '8000',
            'net_30', 200000.00, 30,
            'Anna Reyes', '+63-917-444-5555', 'anna.reyes@dtgenstore.com',
            true, v_user_id, v_user_id
        ),

        -- Warehouse Business Unit Customers (Wholesale/Distributors)
        (
            v_company_id, '00000000-0000-0000-0000-000000000102', 'CUST-WHS-001', 'Mindanao Wholesale Distributors', 'wholesale', '555-666-777-000',
            'orders@mindanaowholesale.com', '+63-82-401-2345', 'www.mindanaowholesale.com',
            'Industrial Park', 'Warehouse Complex A', 'Davao City', 'Davao del Sur', 'Philippines', '8000',
            'Industrial Park', 'Warehouse Complex A', 'Davao City', 'Davao del Sur', 'Philippines', '8000',
            'net_90', 1000000.00, 90,
            'Roberto Santos', '+63-917-555-6666', 'roberto.santos@mindanaowholesale.com',
            true, v_user_id, v_user_id
        ),
        (
            v_company_id, '00000000-0000-0000-0000-000000000102', 'CUST-WHS-002', 'Southern Philippines Trading', 'wholesale', '666-777-888-000',
            'purchasing@southernph.com', '+63-82-402-3456', 'www.southernph.com',
            'Port Area', 'Building 5', 'Davao City', 'Davao del Sur', 'Philippines', '8000',
            'Port Area', 'Building 5', 'Davao City', 'Davao del Sur', 'Philippines', '8000',
            'net_60', 750000.00, 60,
            'Carmen Lopez', '+63-917-666-7777', 'carmen.lopez@southernph.com',
            true, v_user_id, v_user_id
        ),
        (
            v_company_id, '00000000-0000-0000-0000-000000000102', 'CUST-WHS-003', 'Pacific Rim Importers', 'wholesale', '777-888-999-000',
            'sales@pacificrim.ph', '+63-82-403-4567', 'www.pacificrim.ph',
            'Free Trade Zone', 'Gate 3', 'Davao City', 'Davao del Sur', 'Philippines', '8000',
            'Free Trade Zone', 'Gate 3', 'Davao City', 'Davao del Sur', 'Philippines', '8000',
            'net_90', 1200000.00, 90,
            'Michael Tan', '+63-917-777-8888', 'michael.tan@pacificrim.ph',
            true, v_user_id, v_user_id
        ),
        (
            v_company_id, '00000000-0000-0000-0000-000000000102', 'CUST-WHS-004', 'Visayas-Mindanao Supply Chain', 'wholesale', '888-999-000-111',
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
    v_company_id UUID := '00000000-0000-0000-0000-000000000001';
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
INSERT INTO "auth"."users"("instance_id","id","aud","role","email","encrypted_password","email_confirmed_at","invited_at","confirmation_token","confirmation_sent_at","recovery_token","recovery_sent_at","email_change_token_new","email_change","email_change_sent_at","last_sign_in_at","raw_app_meta_data","raw_user_meta_data","is_super_admin","created_at","updated_at","phone","phone_confirmed_at","phone_change","phone_change_token","phone_change_sent_at","email_change_token_current","email_change_confirm_status","banned_until","reauthentication_token","reauthentication_sent_at","is_sso_user","deleted_at","is_anonymous")
VALUES
('00000000-0000-0000-0000-000000000000','5fa2a5a4-14ca-4afb-bfeb-abc345335a1f','authenticated','authenticated','cashier@pragmatica.com','$2a$10$av68P//OXhBrmx9R0WRL3.8DdVeIlcy.Wcf/yNgriwFcah51r500u','2025-11-06 07:07:59.211291+00',NULL,'',NULL,'',NULL,'','',NULL,'2025-11-06 07:07:59.218139+00','{"provider": "email", "providers": ["email"]}','{"sub": "5fa2a5a4-14ca-4afb-bfeb-abc345335a1f", "email": "cashier@pragmatica.com", "email_verified": true, "phone_verified": false}',NULL,'2025-11-06 07:07:59.200435+00','2025-11-06 07:07:59.22046+00',NULL,NULL,'','',NULL,'',0,NULL,'',NULL,FALSE,NULL,FALSE);

INSERT INTO "public"."users"("id","company_id","username","email","first_name","last_name","phone","is_active","last_login_at","created_at","updated_at","deleted_at","van_warehouse_id")
VALUES
('5745e13c-ab07-48b7-9db7-24372b16f5a9','00000000-0000-0000-0000-000000000001','demo','demo@pragmatica.com','Demo','User',NULL,TRUE,NULL,'2025-11-06 07:17:41.17002','2025-11-06 07:17:41.17002',NULL,'00000000-0000-0000-0000-000000000013'),
('5fa2a5a4-14ca-4afb-bfeb-abc345335a1f','00000000-0000-0000-0000-000000000001','cashier','cashier@pragmatica.com','Store','Cashier',NULL,TRUE,NULL,'2025-11-06 07:17:41.17002','2025-11-06 07:17:41.17002',NULL,'00000000-0000-0000-0000-000000000013');

INSERT INTO "auth"."users"("instance_id","id","aud","role","email","encrypted_password","email_confirmed_at","invited_at","confirmation_token","confirmation_sent_at","recovery_token","recovery_sent_at","email_change_token_new","email_change","email_change_sent_at","last_sign_in_at","raw_app_meta_data","raw_user_meta_data","is_super_admin","created_at","updated_at","phone","phone_confirmed_at","phone_change","phone_change_token","phone_change_sent_at","email_change_token_current","email_change_confirm_status","banned_until","reauthentication_token","reauthentication_sent_at","is_sso_user","deleted_at","is_anonymous")
VALUES
('00000000-0000-0000-0000-000000000000','bcb8f5df-b678-4c22-ba71-59b33ba06227','authenticated','authenticated','mflores@pragmatica.com','$2a$10$av68P//OXhBrmx9R0WRL3.8DdVeIlcy.Wcf/yNgriwFcah51r500u','2025-11-06 07:07:59.211291+00',NULL,'',NULL,'',NULL,'','',NULL,'2025-11-06 07:07:59.218139+00','{"provider": "email", "providers": ["email"]}','{"sub": "bcb8f5df-b678-4c22-ba71-59b33ba06227", "email": "mflores@pragmatica.com", "email_verified": true, "phone_verified": false}',NULL,'2025-11-06 07:07:59.200435+00','2025-11-06 07:07:59.22046+00',NULL,NULL,'','',NULL,'',0,NULL,'',NULL,FALSE,NULL,FALSE);
INSERT INTO "public"."users"("id","company_id","username","email","first_name","last_name","phone","is_active","last_login_at","created_at","updated_at","deleted_at","van_warehouse_id")
VALUES
('bcb8f5df-b678-4c22-ba71-59b33ba06227','00000000-0000-0000-0000-000000000001','Miguel','mflores@pragmatica.com','Miguel','Flores',NULL,TRUE,NULL,'2025-11-06 07:17:41.17002','2025-11-06 07:17:41.17002',NULL,'00000000-0000-0000-0000-000000000013');

-- ============================================================================
-- SEED DATA: Grant Default BU Access to Users
-- ============================================================================

INSERT INTO user_business_unit_access (user_id, business_unit_id, role, is_default, is_current, granted_at)
VALUES
  -- Regular user access to all three business units
  ('5745e13c-ab07-48b7-9db7-24372b16f5a9', '00000000-0000-0000-0000-000000000100', 'admin', true, true, now()),
  ('5745e13c-ab07-48b7-9db7-24372b16f5a9', '00000000-0000-0000-0000-000000000101', 'admin', false, false, now()),
  ('5745e13c-ab07-48b7-9db7-24372b16f5a9', '00000000-0000-0000-0000-000000000102', 'admin', false, false, now()),
  ('5fa2a5a4-14ca-4afb-bfeb-abc345335a1f', '00000000-0000-0000-0000-000000000102', 'admin', false, true, now()),
  ('bcb8f5df-b678-4c22-ba71-59b33ba06227', '00000000-0000-0000-0000-000000000102', 'admin', false, true, now());

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
  '00000000-0000-0000-0000-000000000001', -- Demo Company
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
  AND r.company_id = '00000000-0000-0000-0000-000000000001'
  AND p.resource = 'dashboard'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Items (inventory viewing for POS)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Cashier'
  AND r.company_id = '00000000-0000-0000-0000-000000000001'
  AND p.resource = 'items'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Sales Orders (for POS transactions)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Cashier'
  AND r.company_id = '00000000-0000-0000-0000-000000000001'
  AND p.resource = 'sales_orders'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Customers (for creating walk-in customers)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Cashier'
  AND r.company_id = '00000000-0000-0000-0000-000000000001'
  AND p.resource = 'customers'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Sales Invoices (for POS)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Cashier'
  AND r.company_id = '00000000-0000-0000-0000-000000000001'
  AND p.resource = 'sales_invoices'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Stock Requests (Warehouse dashboard)
INSERT INTO permissions (resource, description, can_view, can_create, can_edit, can_delete)
VALUES ('stock_requests', 'Manage stock requests', true, true, true, true)
ON CONFLICT (resource) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.resource = 'stock_requests'
WHERE r.name = 'Super Admin'
  AND r.company_id = '00000000-0000-0000-0000-000000000001'
ON CONFLICT (role_id, permission_id) DO NOTHING;

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
  AND r.company_id = '00000000-0000-0000-0000-000000000001'
  AND NOT EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = '5745e13c-ab07-48b7-9db7-24372b16f5a9'
      AND ur.role_id = r.id
      AND ur.business_unit_id IS NULL
  );

-- Assign Cashier role to cashier user
INSERT INTO user_roles (user_id, role_id, business_unit_id, created_at)
SELECT
  '5fa2a5a4-14ca-4afb-bfeb-abc345335a1f',
  r.id,
  '00000000-0000-0000-0000-000000000102',
  NOW()
FROM roles r
WHERE r.name = 'Cashier'
  AND r.company_id = '00000000-0000-0000-0000-000000000001'
ON CONFLICT (user_id, role_id, business_unit_id) DO NOTHING;

-- Assign Admin role to mflores user for Main Office
INSERT INTO user_roles (user_id, role_id, business_unit_id, created_at)
SELECT
  'bcb8f5df-b678-4c22-ba71-59b33ba06227',
  r.id,
  '00000000-0000-0000-0000-000000000102',
  NOW()
FROM roles r
WHERE r.name = 'Admin'
  AND r.company_id = '00000000-0000-0000-0000-000000000001'
ON CONFLICT (user_id, role_id, business_unit_id) DO NOTHING;

-- ============================================================================
-- SEED DATA: Suppliers
-- ============================================================================

DO $$
DECLARE
    v_company_id UUID := '00000000-0000-0000-0000-000000000001';
    v_user_id UUID := '5745e13c-ab07-48b7-9db7-24372b16f5a9';
BEGIN
    INSERT INTO suppliers (
        company_id, business_unit_id, supplier_code, supplier_name, contact_person, email, phone, mobile, website, tax_id,
        billing_address_line1, billing_city, billing_state, billing_country, billing_postal_code,
        payment_terms, credit_limit, current_balance, status, notes,
        created_by, updated_by
    ) VALUES
        -- Frame Material Suppliers
        (
            v_company_id, '00000000-0000-0000-0000-000000000100', 'SUP-001', 'Philippine Wood Products Inc.', 'Roberto Santos', 'roberto@philwoodproducts.ph', '+63-82-234-5678', '+63-917-234-5678', 'www.philwoodproducts.ph', '123-456-789-001',
            'Toril Industrial Area', 'Davao City', 'Davao del Sur', 'Philippines', '8000',
            'net_30', 2000000.00, 0, 'active', 'Main supplier for wood moldings and profiles',
            v_user_id, v_user_id
        ),
        (
            v_company_id, '00000000-0000-0000-0000-000000000100', 'SUP-002', 'Mindanao Glass & Glazing Corp', 'Maria Gonzales', 'maria@mindanaoglass.ph', '+63-82-345-6789', '+63-917-345-6789', 'www.mindanaoglass.ph', '234-567-890-002',
            'Km 10, Sasa Industrial Park', 'Davao City', 'Davao del Sur', 'Philippines', '8000',
            'net_45', 3000000.00, 0, 'active', 'Glass sheets and UV protection glass supplier',
            v_user_id, v_user_id
        ),
        (
            v_company_id, '00000000-0000-0000-0000-000000000100', 'SUP-003', 'Artboard Supplies Mindanao', 'Juan Dela Cruz', 'juan@artboardsupplies.ph', '+63-82-456-7890', '+63-917-456-7890', 'www.artboardsupplies.ph', '345-678-901-003',
            'MacArthur Highway, Matina', 'Davao City', 'Davao del Sur', 'Philippines', '8000',
            'net_30', 2500000.00, 0, 'active', 'Matboards, backing boards, and mounting supplies',
            v_user_id, v_user_id
        ),
        (
            v_company_id, '00000000-0000-0000-0000-000000000100', 'SUP-004', 'Metal Frames Philippines', 'Pedro Mercado', 'pedro@metalframes.ph', '+63-83-552-3456', '+63-918-567-8901', 'www.metalframes.ph', '456-789-012-004',
            'National Highway, Calumpang', 'General Santos City', 'South Cotabato', 'Philippines', '9500',
            'net_60', 1500000.00, 0, 'active', 'Metal moldings and frame hardware supplier',
            v_user_id, v_user_id
        ),
        -- Packaging and Hardware
        (
            v_company_id, '00000000-0000-0000-0000-000000000100', 'SUP-005', 'Packaging Solutions Davao', 'Ana Reyes', 'ana@packagingsolutions.ph', '+63-82-678-9012', '+63-917-678-9012', 'www.packagingsolutions.ph', '567-890-123-005',
            'Panacan Industrial Area', 'Davao City', 'Davao del Sur', 'Philippines', '8000',
            'net_15', 300000.00, 0, 'active', 'Bubble wrap, corner protectors, and packaging materials',
            v_user_id, v_user_id
        ),
        (
            v_company_id, '00000000-0000-0000-0000-000000000100', 'SUP-006', 'Frame Hardware Depot', 'Carlos Ramos', 'carlos@framehardware.ph', '+63-82-789-0123', '+63-917-789-0123', 'www.framehardware.ph', '678-901-234-006',
            'Sasa Industrial Road', 'Davao City', 'Davao del Sur', 'Philippines', '8000',
            'cod', 100000.00, 0, 'active', 'D-rings, springs, hanging wire, and frame accessories',
            v_user_id, v_user_id
        ),
        -- Inactive Supplier
        (
            v_company_id, '00000000-0000-0000-0000-000000000100', 'SUP-007', 'Old Frame Trading Co.', 'Miguel Torres', 'miguel@oldframes.ph', '+63-82-000-0000', NULL, NULL, '789-012-345-007',
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
-- DISABLED: This section is commented out because it uses the OLD variant-based system
-- After inventory normalization migration, packages are created directly for items
-- See "SEED DATA: Create Packages for All Items" section above
-- ============================================================================

/*
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
        (v_company_id, '00000000-0000-0000-0000-000000000100', 'EMP-001', 'Juan', 'Dela Cruz', 'juan.delacruz@example.com', '+63-917-1234567',
         'admin', 'Management', '2024-01-01', 5.00,
         'Davao City', 'Davao Region', true, v_user_id, v_user_id, '5745e13c-ab07-48b7-9db7-24372b16f5a9'),

        -- Managers
        (v_company_id, '00000000-0000-0000-0000-000000000100', 'EMP-002', 'Maria', 'Santos', 'maria.santos@example.com', '+63-917-2345678',
         'manager', 'Sales', '2024-01-15', 3.00,
         'Cagayan de Oro City', 'Northern Mindanao', true, v_user_id, v_user_id, NULL),

        (v_company_id, '00000000-0000-0000-0000-000000000100', 'EMP-003', 'Pedro', 'Reyes', 'pedro.reyes@example.com', '+63-917-3456789',
         'manager', 'Sales', '2024-02-01', 3.00,
         'General Santos City', 'SOCCSKSARGEN', true, v_user_id, v_user_id, NULL),
        -- Sales Agents
        (v_company_id, '00000000-0000-0000-0000-000000000100', 'EMP-004', 'Ana', 'Garcia', 'ana.garcia@example.com', '+63-917-4567890',
         'sales_agent', 'Sales', '2024-03-01', 5.00,
         'Davao City', 'Davao Region', true, v_user_id, v_user_id, NULL),
        (v_company_id, '00000000-0000-0000-0000-000000000100', 'EMP-005', 'Roberto', 'Cruz', 'roberto.cruz@example.com', '+63-917-5678901',
         'sales_agent', 'Sales', '2024-03-01', 5.00,
         'Tagum City', 'Davao Region', true, v_user_id, v_user_id, NULL),

        (v_company_id, '00000000-0000-0000-0000-000000000100', 'EMP-006', 'Linda', 'Ramos', 'linda.ramos@example.com', '+63-917-6789012',
         'sales_agent', 'Sales', '2024-03-15', 6.00,
         'Cagayan de Oro City', 'Northern Mindanao', true, v_user_id, v_user_id, NULL),

        (v_company_id, '00000000-0000-0000-0000-000000000100', 'EMP-007', 'Carlos', 'Mendoza', 'carlos.mendoza@example.com', '+63-917-7890123',
         'sales_agent', 'Sales', '2024-04-01', 5.50,
         'Iligan City', 'Northern Mindanao', true, v_user_id, v_user_id, NULL),

        (v_company_id, '00000000-0000-0000-0000-000000000100', 'EMP-008', 'Sofia', 'Torres', 'sofia.torres@example.com', '+63-917-8901234',
         'sales_agent', 'Sales', '2024-04-01', 7.00,
         'General Santos City', 'SOCCSKSARGEN', true, v_user_id, v_user_id, NULL),

        (v_company_id, '00000000-0000-0000-0000-000000000100', 'EMP-009', 'Miguel', 'Flores', 'miguel.flores@example.com', '+63-917-9012345',
         'sales_agent', 'Sales', '2024-04-15', 5.00,
         'Zamboanga City', 'Zamboanga Peninsula', true, v_user_id, v_user_id, 'bcb8f5df-b678-4c22-ba71-59b33ba06227'),

        (v_company_id, '00000000-0000-0000-0000-000000000100', 'EMP-010', 'Elena', 'Diaz', 'elena.diaz@example.com', '+63-917-0123456',
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
-- The cashier user account (cashier@pragmatica.com) is created above with:
--   - auth.users record
--   - public.users record
--   - business_unit_access (with is_current = true for JWT)
--   - user_roles assignment
--
-- Login credentials:
--   Email: cashier@pragmatica.com
--   Password: password (default bcrypt hash in seed data)
--
-- The cashier has access to:
--   - Dashboard (view only)
--   - Inventory > Items (view only)
--   - Sales > Point of Sale, POS Transactions, Customers, Sales Orders, Invoices

-- Purpose: Backfill MAIN locations and item_location rows from item_warehouse totals

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
  'crate',
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

-- Re-seed item_location from item_warehouse (MAIN location as source of truth)
DELETE FROM item_location il
USING item_warehouse iw
WHERE il.company_id = iw.company_id
  AND il.item_id = iw.item_id
  AND il.warehouse_id = iw.warehouse_id
  AND il.deleted_at IS NULL
  AND iw.deleted_at IS NULL;

INSERT INTO item_location (
  company_id,
  item_id,
  warehouse_id,
  location_id,
  qty_on_hand,
  qty_reserved,
  created_at,
  updated_at
)
SELECT
  iw.company_id,
  iw.item_id,
  iw.warehouse_id,
  wl.id,
  iw.current_stock,
  iw.reserved_stock,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM item_warehouse iw
JOIN warehouse_locations wl
  ON wl.warehouse_id = iw.warehouse_id
 AND wl.code = 'MAIN'
WHERE iw.deleted_at IS NULL
  AND wl.deleted_at IS NULL
ON CONFLICT (company_id, item_id, warehouse_id, location_id)
DO UPDATE SET
  qty_on_hand = EXCLUDED.qty_on_hand,
  qty_reserved = EXCLUDED.qty_reserved,
  updated_at = CURRENT_TIMESTAMP;
