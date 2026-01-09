
CREATE OR REPLACE FUNCTION create_item_with_packages(
  p_company_id UUID,
  p_user_id UUID,
  p_item_code VARCHAR(100),
  p_item_name VARCHAR(255),
  p_item_name_cn VARCHAR(255) DEFAULT NULL,
  p_item_description TEXT DEFAULT NULL,
  p_item_type VARCHAR(50) DEFAULT 'finished_good',
  p_base_package_name VARCHAR(200) DEFAULT 'Each',
  p_base_package_type VARCHAR(100) DEFAULT 'base',
  p_base_uom_id UUID DEFAULT NULL,
  p_standard_cost DECIMAL(20,4) DEFAULT 0,
  p_list_price DECIMAL(20,4) DEFAULT 0,
  p_additional_packages JSONB DEFAULT '[]'::JSONB
)
RETURNS TABLE(
  item_id UUID,
  base_package_id UUID,
  message TEXT
) AS $$
DECLARE
  v_item_id UUID;
  v_base_package_id UUID;
  v_package JSONB;
  v_new_package_id UUID;
  v_package_count INTEGER;
BEGIN
  -- Validate inputs
  IF p_company_id IS NULL THEN
    RAISE EXCEPTION 'company_id is required';
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id is required';
  END IF;

  IF p_item_code IS NULL OR p_item_code = '' THEN
    RAISE EXCEPTION 'item_code is required';
  END IF;

  IF p_item_name IS NULL OR p_item_name = '' THEN
    RAISE EXCEPTION 'item_name is required';
  END IF;

  -- Step 1: Create item (package_id NULL, setup_complete FALSE)
  INSERT INTO items (
    company_id,
    item_code,
    item_name,
    item_name_cn,
    description,
    item_type,
    standard_cost,
    list_price,
    package_id,
    setup_complete,
    created_by,
    updated_by
  ) VALUES (
    p_company_id,
    p_item_code,
    p_item_name,
    COALESCE(p_item_name_cn, p_item_name),
    p_item_description,
    p_item_type,
    p_standard_cost,
    p_list_price,
    NULL,        -- Will be set after creating package
    FALSE,       -- Not ready for transactions yet
    p_user_id,
    p_user_id
  )
  RETURNING id INTO v_item_id;

  -- Step 2: Create base package (qty_per_pack = 1.0)
  INSERT INTO item_packaging (
    company_id,
    item_id,
    pack_type,
    pack_name,
    qty_per_pack,
    uom_id,
    is_default,
    is_active,
    created_by,
    updated_by
  ) VALUES (
    p_company_id,
    v_item_id,
    p_base_package_type,
    p_base_package_name,
    1.0,                    -- Base package always = 1
    p_base_uom_id,
    TRUE,                   -- Is default
    TRUE,                   -- Is active
    p_user_id,
    p_user_id
  )
  RETURNING id INTO v_base_package_id;

  v_package_count := 1;  -- Start with base package

  -- Step 3: Create additional packages (if provided)
  IF jsonb_array_length(p_additional_packages) > 0 THEN
    FOR v_package IN SELECT * FROM jsonb_array_elements(p_additional_packages)
    LOOP
      -- Validate required fields
      IF v_package->>'pack_type' IS NULL OR v_package->>'pack_type' = '' THEN
        RAISE EXCEPTION 'pack_type is required for additional packages';
      END IF;

      IF v_package->>'pack_name' IS NULL OR v_package->>'pack_name' = '' THEN
        RAISE EXCEPTION 'pack_name is required for additional packages';
      END IF;

      IF v_package->>'qty_per_pack' IS NULL THEN
        RAISE EXCEPTION 'qty_per_pack is required for additional packages';
      END IF;

      INSERT INTO item_packaging (
        company_id,
        item_id,
        pack_type,
        pack_name,
        qty_per_pack,
        uom_id,
        barcode,
        is_active,
        created_by,
        updated_by
      ) VALUES (
        p_company_id,
        v_item_id,
        v_package->>'pack_type',
        v_package->>'pack_name',
        (v_package->>'qty_per_pack')::DECIMAL(20,4),
        NULLIF(v_package->>'uom_id', '')::UUID,
        v_package->>'barcode',
        COALESCE((v_package->>'is_active')::BOOLEAN, TRUE),
        p_user_id,
        p_user_id
      )
      RETURNING id INTO v_new_package_id;

      v_package_count := v_package_count + 1;
    END LOOP;
  END IF;

  -- Step 4: Update item with base package and mark setup complete
  UPDATE items
  SET package_id = v_base_package_id,
      setup_complete = TRUE,
      updated_at = NOW(),
      updated_by = p_user_id
  WHERE id = v_item_id;

  -- Return results
  RETURN QUERY SELECT
    v_item_id,
    v_base_package_id,
    FORMAT('Item created with %s package(s)', v_package_count);
END;
$$ LANGUAGE plpgsql;
