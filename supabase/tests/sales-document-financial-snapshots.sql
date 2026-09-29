-- Financial integration regression suite. Run centrally AFTER applying migrations.
-- Requires an existing active actor with sales_orders create/edit permission and
-- a customer, active item, UOM and business unit from that actor's company.
-- Example (substitute actual IDs; use a disposable/local database owner session):
-- psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -v actor_id=... \
--   -v business_unit_id=... -v customer_id=... -v item_id=... -v uom_id=... \
--   -f supabase/tests/sales-document-financial-snapshots.sql
-- Fixtures bypass the acceptance workflow deliberately; this tests finances,
-- not authorization, inventory or acceptance. No fixtures are committed.
\set ON_ERROR_STOP on
BEGIN;
SELECT set_config('request.jwt.claim.sub', :'actor_id', true);
SELECT set_config('test.financial.business_unit_id', :'business_unit_id', true);
SELECT set_config('test.financial.customer_id', :'customer_id', true);
SELECT set_config('test.financial.item_id', :'item_id', true);
SELECT set_config('test.financial.uom_id', :'uom_id', true);

CREATE FUNCTION pg_temp.financial_line(p_quantity NUMERIC, p_rate NUMERIC,
  p_discount NUMERIC, p_tax NUMERIC, p_total NUMERIC)
RETURNS JSONB LANGUAGE SQL AS $$
  SELECT jsonb_build_object(
    'itemId', current_setting('test.financial.item_id'),
    'uomId', current_setting('test.financial.uom_id'),
    'description', 'Financial regression fixture',
    'quantity', p_quantity, 'rate', p_rate,
    'discountPercent', 0, 'discountAmount', p_discount,
    'taxPercent', CASE WHEN p_tax > 0 THEN 12 ELSE 0 END,
    'taxAmount', p_tax, 'lineTotal', p_total
  );
$$;

CREATE FUNCTION pg_temp.financial_size(p_quantity NUMERIC, p_amount NUMERIC,
  p_service NUMERIC DEFAULT 0)
RETURNS JSONB LANGUAGE SQL AS $$
  SELECT jsonb_build_object(
    'frameConfiguration', jsonb_build_object(
      'width', 10, 'height', 10, 'frameQuantity', p_quantity,
      'billingMode', 'chop_join', 'invoiceDisplayMode', 'components',
      'serviceFeeMode', 'per_order', 'serviceFeeAmount', p_service,
      'totalServiceFee', p_service
    ),
    'frameComponents', jsonb_build_array(jsonb_build_object(
      'componentType', 'molding', 'source', 'auto',
      'itemId', current_setting('test.financial.item_id'),
      'uomId', current_setting('test.financial.uom_id'),
      'qtyPerFrame', 1, 'totalQuantity', p_quantity,
      -- A formula rate deliberately differs from the saved commercial amount.
      'unitRate', 5, 'totalAmount', p_amount, 'roundingMode', 'none'
    ))
  );
$$;

CREATE FUNCTION pg_temp.financial_quote(p_items JSONB)
RETURNS UUID LANGUAGE SQL AS $$
  SELECT public.create_sales_quotation_transaction(
    p_customer_id := current_setting('test.financial.customer_id')::UUID,
    p_quotation_date := CURRENT_DATE,
    p_valid_until := CURRENT_DATE + 14,
    p_price_list_id := NULL,
    p_terms_conditions := '',
    p_notes := 'Financial snapshot regression fixture',
    p_business_unit_id := current_setting('test.financial.business_unit_id')::UUID,
    p_items := p_items
  );
$$;

CREATE FUNCTION pg_temp.financial_accept(p_quotation_id UUID)
RETURNS VOID LANGUAGE SQL AS $$
  UPDATE public.sales_quotations SET status = 'accepted',
    accepted_by_name = 'Financial test fixture', accepted_channel = 'in_person',
    accepted_at = NOW(), accepted_recorded_by = auth.uid()
  WHERE id = p_quotation_id;
$$;

CREATE FUNCTION pg_temp.financial_order_items(p_quotation_id UUID)
RETURNS JSONB LANGUAGE SQL AS $$
  SELECT jsonb_agg(jsonb_build_object(
    'quotationId', p_quotation_id, 'quotationItemId', item.id,
    'quantity', item.quantity
  ) || CASE WHEN sizes.selections IS NULL THEN '{}'::JSONB
    ELSE jsonb_build_object('frameSizeSelections', sizes.selections) END
    ORDER BY item.sort_order)
  FROM public.sales_quotation_items item
  LEFT JOIN LATERAL (
    SELECT jsonb_agg(jsonb_build_object('quotationConfigurationId', configuration.id,
      'quantity', configuration.frame_quantity) ORDER BY configuration.size_index) AS selections
    FROM public.sales_quotation_item_configurations configuration
    WHERE configuration.quotation_item_id = item.id AND configuration.deleted_at IS NULL
  ) sizes ON TRUE
  WHERE item.quotation_id = p_quotation_id AND item.deleted_at IS NULL;
$$;

CREATE FUNCTION pg_temp.financial_order(p_items JSONB)
RETURNS UUID LANGUAGE SQL AS $$
  SELECT public.create_sales_order_draft_transaction(
    current_setting('test.financial.customer_id')::UUID,
    CURRENT_DATE, CURRENT_DATE + 14,
    current_setting('test.financial.business_unit_id')::UUID,
    '', '', '', '', '', 'cash', 'Financial snapshot regression fixture', p_items
  );
$$;

CREATE FUNCTION pg_temp.financial_edit_order(p_order_id UUID, p_items JSONB)
RETURNS UUID LANGUAGE SQL AS $$
  SELECT public.update_sales_order_draft_transaction(
    p_order_id, current_setting('test.financial.customer_id')::UUID,
    CURRENT_DATE, CURRENT_DATE + 14, '', '', '', '', '', 'cash',
    'Notes-only financial edit', p_items
  );
$$;

CREATE FUNCTION pg_temp.assert_financial_order(p_id UUID, p_subtotal NUMERIC,
  p_discount NUMERIC, p_tax NUMERIC, p_total NUMERIC)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE v_header RECORD; v_lines RECORD;
BEGIN
  SELECT subtotal, discount_amount, tax_amount, total_amount INTO STRICT v_header
  FROM public.sales_orders WHERE id = p_id;
  SELECT SUM(item.line_total + item.discount_amount + parts.discount_amount - item.tax_amount) AS subtotal,
    SUM(item.discount_amount + parts.discount_amount) AS discount,
    SUM(item.tax_amount) AS tax, SUM(item.line_total) AS total
  INTO v_lines FROM public.sales_order_items item
  CROSS JOIN LATERAL (
    SELECT COALESCE(SUM(component.discount_amount), 0) AS discount_amount
    FROM public.sales_order_item_components component
    WHERE component.order_item_id = item.id AND component.deleted_at IS NULL
  ) parts
  WHERE item.order_id = p_id AND item.deleted_at IS NULL;
  IF ROW(v_header.subtotal, v_header.discount_amount, v_header.tax_amount, v_header.total_amount)
      IS DISTINCT FROM ROW(p_subtotal, p_discount, p_tax, p_total)
    OR ROW(v_lines.subtotal, v_lines.discount, v_lines.tax, v_lines.total)
      IS DISTINCT FROM ROW(p_subtotal, p_discount, p_tax, p_total) THEN
    RAISE EXCEPTION 'Order money mismatch: header %, lines %', v_header, v_lines;
  END IF;
END;
$$;

DO $test$
DECLARE
  v_quote UUID; v_order UUID; v_other_order UUID; v_partial_quote UUID;
  v_items JSONB; v_order_items JSONB; v_small JSONB; v_large JSONB;
  v_before JSONB; v_after JSONB; v_count BIGINT; v_total NUMERIC;
  v_header RECORD; v_line RECORD;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name IN ('sales_quotation_item_configurations', 'sales_order_item_configurations')
      AND column_name IN ('frame_rate', 'mat_unit_rate', 'glazing_unit_rate', 'backing_unit_rate', 'frame_quantity')
      AND numeric_scale <> 2
  ) THEN
    RAISE EXCEPTION 'New framing rates and quantities must use scale two';
  END IF;

  -- Exact line amount differs from 5 * 324.96 by one cent. The fixed discount
  -- is independent of discount_percent, which is deliberately zero.
  v_items := jsonb_build_array(pg_temp.financial_line(5, 324.96, 200, 0, 1424.79));
  v_quote := pg_temp.financial_quote(v_items);
  SELECT subtotal, discount_amount, tax_amount, total_amount INTO v_header
  FROM public.sales_quotations WHERE id = v_quote;
  IF ROW(v_header.subtotal, v_header.discount_amount, v_header.tax_amount, v_header.total_amount)
    IS DISTINCT FROM ROW(1624.79::NUMERIC, 200::NUMERIC, 0::NUMERIC, 1424.79::NUMERIC) THEN
    RAISE EXCEPTION 'Quotation create lost authoritative totals: %', v_header;
  END IF;

  -- Updating must aggregate exact totals too, including explicit tax snapshots.
  v_items := jsonb_build_array(pg_temp.financial_line(5, 324.96, 200, 170.97, 1595.76));
  PERFORM public.update_sales_quotation_transaction(v_quote, CURRENT_DATE,
    CURRENT_DATE + 14, '', 'Updated financial fixture', v_items);
  SELECT subtotal, discount_amount, tax_amount, total_amount INTO v_header
  FROM public.sales_quotations WHERE id = v_quote;
  IF ROW(v_header.subtotal, v_header.discount_amount, v_header.tax_amount, v_header.total_amount)
    IS DISTINCT FROM ROW(1624.79::NUMERIC, 200::NUMERIC, 170.97::NUMERIC, 1595.76::NUMERIC) THEN
    RAISE EXCEPTION 'Quotation update lost authoritative totals: %', v_header;
  END IF;

  -- Failure on the second line occurs AFTER soft-deleting the old line and
  -- inserting its replacement. The exception must restore the original rows.
  SELECT jsonb_agg(jsonb_build_array(id, line_total, discount_amount, tax_amount, deleted_at)
    ORDER BY id) INTO v_before FROM public.sales_quotation_items WHERE quotation_id = v_quote;
  BEGIN
    PERFORM public.update_sales_quotation_transaction(v_quote, CURRENT_DATE,
      CURRENT_DATE + 14, '', 'Must roll back',
      v_items || jsonb_build_array(pg_temp.financial_line(0, 1, 0, 0, 0)));
    RAISE EXCEPTION 'Expected quotation update failure';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Quotation item quantity must be greater than zero' THEN RAISE; END IF;
  END;
  SELECT jsonb_agg(jsonb_build_array(id, line_total, discount_amount, tax_amount, deleted_at)
    ORDER BY id) INTO v_after FROM public.sales_quotation_items WHERE quotation_id = v_quote;
  IF v_before IS DISTINCT FROM v_after THEN RAISE EXCEPTION 'Quotation update did not roll back'; END IF;
  SELECT total_amount INTO v_total FROM public.sales_quotations WHERE id = v_quote;
  IF v_total <> 1595.76 THEN RAISE EXCEPTION 'Quotation header did not roll back'; END IF;

  SELECT COUNT(*) INTO v_count FROM public.sales_quotations
  WHERE created_by = auth.uid() AND notes = 'Financial snapshot regression fixture';
  BEGIN
    PERFORM pg_temp.financial_quote(v_items || jsonb_build_array(pg_temp.financial_line(0, 1, 0, 0, 0)));
    RAISE EXCEPTION 'Expected quotation create failure';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Quotation item quantity must be greater than zero' THEN RAISE; END IF;
  END;
  IF (SELECT COUNT(*) FROM public.sales_quotations
      WHERE created_by = auth.uid() AND notes = 'Financial snapshot regression fixture') <> v_count THEN
    RAISE EXCEPTION 'Quotation create left a partial header';
  END IF;

  PERFORM pg_temp.financial_accept(v_quote);
  v_order_items := pg_temp.financial_order_items(v_quote);
  SELECT sales_order_id INTO v_order
  FROM public.convert_accepted_sales_quotation_to_order_transaction(v_quote,
    current_setting('test.financial.business_unit_id')::UUID);
  PERFORM pg_temp.assert_financial_order(v_order, 1624.79, 200, 170.97, 1595.76);
  PERFORM pg_temp.financial_edit_order(v_order, v_order_items);
  PERFORM pg_temp.assert_financial_order(v_order, 1624.79, 200, 170.97, 1595.76);
  SELECT rate, discount_percent INTO v_line FROM public.sales_order_items WHERE order_id = v_order;
  IF v_line.rate <> 324.96 OR v_line.discount_percent <> 0 THEN
    RAISE EXCEPTION 'Full conversion/edit changed quoted rate or percentage';
  END IF;

  -- Two sizes cost 100 and 300. A job-wide 40 discount and 43.20 tax allocate
  -- by commercial value, not frame count or the line's 200 average rate.
  v_items := jsonb_build_array(pg_temp.financial_line(2, 200, 40, 43.20, 403.20)
    || jsonb_build_object('frameSizes', jsonb_build_array(
      pg_temp.financial_size(1, 100), pg_temp.financial_size(1, 300))));
  v_quote := pg_temp.financial_quote(v_items);
  PERFORM pg_temp.financial_accept(v_quote);
  v_order_items := pg_temp.financial_order_items(v_quote);
  SELECT sales_order_id INTO v_order
  FROM public.convert_accepted_sales_quotation_to_order_transaction(v_quote,
    current_setting('test.financial.business_unit_id')::UUID);
  PERFORM pg_temp.assert_financial_order(v_order, 400, 40, 43.20, 403.20);
  PERFORM pg_temp.financial_edit_order(v_order, v_order_items);
  PERFORM pg_temp.assert_financial_order(v_order, 400, 40, 43.20, 403.20);

  v_partial_quote := pg_temp.financial_quote(v_items);
  PERFORM pg_temp.financial_accept(v_partial_quote);
  v_order_items := pg_temp.financial_order_items(v_partial_quote);
  v_small := jsonb_set(v_order_items, '{0,quantity}', '1');
  v_small := jsonb_set(v_small, '{0,frameSizeSelections}',
    jsonb_build_array(v_order_items #> '{0,frameSizeSelections,0}'));
  v_large := jsonb_set(v_order_items, '{0,quantity}', '1');
  v_large := jsonb_set(v_large, '{0,frameSizeSelections}',
    jsonb_build_array(v_order_items #> '{0,frameSizeSelections,1}'));
  v_order := pg_temp.financial_order(v_small);
  v_other_order := pg_temp.financial_order(v_large);
  PERFORM pg_temp.assert_financial_order(v_order, 100, 10, 10.80, 100.80);
  PERFORM pg_temp.assert_financial_order(v_other_order, 300, 30, 32.40, 302.40);
  -- Even when another order holds the other size, unchanged edits are stable.
  PERFORM pg_temp.financial_edit_order(v_order, v_small);
  PERFORM pg_temp.assert_financial_order(v_order, 100, 10, 10.80, 100.80);
  SELECT SUM(component.total_amount) INTO v_total
  FROM public.sales_order_item_components component
  JOIN public.sales_order_items item ON item.id = component.order_item_id
  WHERE item.order_id = v_order;
  IF v_total <> 100 THEN RAISE EXCEPTION 'Selected size snapshot differs from its line subtotal'; END IF;

  -- Failure after the existing item and its size have been replaced must restore
  -- monetary snapshots, child IDs, and the quotation's fulfillment allocation.
  SELECT jsonb_agg(jsonb_build_array(item.id, item.line_total, item.discount_amount,
    item.tax_amount, configuration.id, component.id, component.total_amount)
    ORDER BY item.id, configuration.id, component.id)
  INTO v_before FROM public.sales_order_items item
  JOIN public.sales_order_item_configurations configuration ON configuration.order_item_id = item.id
  JOIN public.sales_order_item_components component ON component.configuration_id = configuration.id
  WHERE item.order_id = v_order;
  BEGIN
    PERFORM pg_temp.financial_edit_order(v_order,
      v_small || jsonb_build_array(jsonb_build_object('quantity', 0)));
    RAISE EXCEPTION 'Expected sales order update failure';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'SALES_ORDER_ITEMS_REQUIRED' THEN RAISE; END IF;
  END;
  SELECT jsonb_agg(jsonb_build_array(item.id, item.line_total, item.discount_amount,
    item.tax_amount, configuration.id, component.id, component.total_amount)
    ORDER BY item.id, configuration.id, component.id)
  INTO v_after FROM public.sales_order_items item
  JOIN public.sales_order_item_configurations configuration ON configuration.order_item_id = item.id
  JOIN public.sales_order_item_components component ON component.configuration_id = configuration.id
  WHERE item.order_id = v_order;
  IF v_before IS DISTINCT FROM v_after THEN RAISE EXCEPTION 'Order update did not restore snapshots'; END IF;
  PERFORM pg_temp.assert_financial_order(v_order, 100, 10, 10.80, 100.80);
  SELECT SUM(fulfilled_qty) INTO v_total FROM public.sales_quotation_items
  WHERE quotation_id = v_partial_quote AND deleted_at IS NULL;
  IF v_total <> 2 THEN RAISE EXCEPTION 'Order update did not restore fulfillment'; END IF;

  -- A fractional selection uses rounded saved amounts plus the proportional
  -- saved service charge. Full-size amounts remain byte-for-byte monetary copies.
  v_quote := pg_temp.financial_quote(jsonb_build_array(
    pg_temp.financial_line(3, 0.43, 0.13, 0, 1.17)
    || jsonb_build_object('frameSizes', jsonb_build_array(pg_temp.financial_size(3, 1, 0.30)))));
  PERFORM pg_temp.financial_accept(v_quote);
  v_order_items := pg_temp.financial_order_items(v_quote);
  v_small := jsonb_set(jsonb_set(v_order_items, '{0,quantity}', '1'),
    '{0,frameSizeSelections,0,quantity}', '1');
  v_order := pg_temp.financial_order(v_small);
  -- 1/3 of 1.00 = 0.33; 1/3 of service 0.30 = 0.10; 10% fixed allocation = 0.04.
  PERFORM pg_temp.assert_financial_order(v_order, 0.43, 0.04, 0, 0.39);
  SELECT SUM(component.total_amount) INTO v_total
  FROM public.sales_order_item_components component
  JOIN public.sales_order_items item ON item.id = component.order_item_id
  WHERE item.order_id = v_order;
  IF v_total <> 0.33 THEN RAISE EXCEPTION 'Partial component was not rounded to cents'; END IF;
  SELECT SUM(configuration.total_service_fee) INTO v_total
  FROM public.sales_order_item_configurations configuration
  JOIN public.sales_order_items item ON item.id = configuration.order_item_id
  WHERE item.order_id = v_order;
  IF v_total <> 0.10 THEN RAISE EXCEPTION 'Partial service snapshot was not prorated'; END IF;
  PERFORM pg_temp.financial_edit_order(v_order, v_small);
  PERFORM pg_temp.assert_financial_order(v_order, 0.43, 0.04, 0, 0.39);

  -- Forced failure after the first complete line has been created in a new
  -- order. No header, component row or allocation may escape the subtransaction.
  SELECT COUNT(*) INTO v_count FROM public.sales_orders
  WHERE created_by = auth.uid() AND notes = 'Financial snapshot regression fixture';
  SELECT SUM(fulfilled_qty) INTO v_total FROM public.sales_quotation_items
  WHERE quotation_id = v_quote AND deleted_at IS NULL;
  BEGIN
    PERFORM pg_temp.financial_order(v_small || jsonb_build_array(jsonb_build_object('quantity', 0)));
    RAISE EXCEPTION 'Expected sales order create failure';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'SALES_ORDER_ITEMS_REQUIRED' THEN RAISE; END IF;
  END;
  IF (SELECT COUNT(*) FROM public.sales_orders
      WHERE created_by = auth.uid() AND notes = 'Financial snapshot regression fixture') <> v_count
    OR (SELECT SUM(fulfilled_qty) FROM public.sales_quotation_items
      WHERE quotation_id = v_quote AND deleted_at IS NULL) <> v_total THEN
    RAISE EXCEPTION 'Order create left a partial order/allocation';
  END IF;

  -- A configured line's exact total also survives full conversion when its
  -- rounded display average cannot reproduce the sum of its components.
  v_quote := pg_temp.financial_quote(jsonb_build_array(
    pg_temp.financial_line(3, 0.33, 0, 0, 1)
    || jsonb_build_object('frameSizes', jsonb_build_array(pg_temp.financial_size(3, 1)))));
  PERFORM pg_temp.financial_accept(v_quote);
  v_order_items := pg_temp.financial_order_items(v_quote);
  SELECT sales_order_id INTO v_order
  FROM public.convert_accepted_sales_quotation_to_order_transaction(v_quote,
    current_setting('test.financial.business_unit_id')::UUID);
  PERFORM pg_temp.assert_financial_order(v_order, 1, 0, 0, 1);
  PERFORM pg_temp.financial_edit_order(v_order, v_order_items);
  PERFORM pg_temp.assert_financial_order(v_order, 1, 0, 0, 1);

  -- Free/fully discounted frames must remain free, without a division by zero.
  v_quote := pg_temp.financial_quote(jsonb_build_array(
    pg_temp.financial_line(2, 100, 200, 0, 0)
    || jsonb_build_object('frameSizes', jsonb_build_array(pg_temp.financial_size(2, 200)))));
  PERFORM pg_temp.financial_accept(v_quote);
  v_small := jsonb_set(jsonb_set(pg_temp.financial_order_items(v_quote), '{0,quantity}', '1'),
    '{0,frameSizeSelections,0,quantity}', '1');
  v_order := pg_temp.financial_order(v_small);
  PERFORM pg_temp.assert_financial_order(v_order, 100, 100, 0, 0);
  PERFORM pg_temp.financial_edit_order(v_order, v_small);
  PERFORM pg_temp.assert_financial_order(v_order, 100, 100, 0, 0);

  -- Existing ordinary percentage discounts retain their tax-exclusive base.
  v_quote := pg_temp.financial_quote(jsonb_build_array(
    pg_temp.financial_line(2, 100, 20, 21.60, 201.60)
      || jsonb_build_object('discountPercent', 10)));
  PERFORM pg_temp.financial_accept(v_quote);
  v_small := jsonb_set(pg_temp.financial_order_items(v_quote), '{0,quantity}', '1');
  v_order := pg_temp.financial_order(v_small);
  PERFORM pg_temp.assert_financial_order(v_order, 100, 10, 10.80, 100.80);

  -- Component discounts belong to the quotation HEADER summary in addition to
  -- the parent fixed discount, while all component amounts are already net.
  -- Gross components 100 + 300, deductions 20 + 30, parent deduction 35.
  v_items := jsonb_build_array(pg_temp.financial_line(2, 175, 35, 37.80, 352.80)
    || jsonb_build_object('frameSizes', jsonb_build_array(
      jsonb_set(jsonb_set(pg_temp.financial_size(1, 80),
        '{frameComponents,0,discountAmount}', '20'), '{frameComponents,0,discountPercent}', '20'),
      jsonb_set(jsonb_set(pg_temp.financial_size(1, 270),
        '{frameComponents,0,discountAmount}', '30'), '{frameComponents,0,discountPercent}', '10'))));
  v_quote := pg_temp.financial_quote(v_items);
  SELECT subtotal, discount_amount, tax_amount, total_amount INTO v_header
  FROM public.sales_quotations WHERE id = v_quote;
  IF ROW(v_header.subtotal, v_header.discount_amount, v_header.tax_amount, v_header.total_amount)
    IS DISTINCT FROM ROW(400::NUMERIC, 85::NUMERIC, 37.80::NUMERIC, 352.80::NUMERIC) THEN
    RAISE EXCEPTION 'Quotation create omitted or double-subtracted component discounts: %', v_header;
  END IF;
  SELECT discount_amount, line_total INTO v_line FROM public.sales_quotation_items
  WHERE quotation_id = v_quote AND deleted_at IS NULL;
  IF v_line.discount_amount <> 35 OR v_line.line_total <> 352.80 THEN
    RAISE EXCEPTION 'Component summary changed parent-line money';
  END IF;

  -- Full conversion and repeated edits preserve component discounts separately
  -- from the parent discount, including when rates are geometry formulas.
  v_partial_quote := pg_temp.financial_quote(v_items);
  PERFORM pg_temp.financial_accept(v_partial_quote);
  v_order_items := pg_temp.financial_order_items(v_partial_quote);
  SELECT sales_order_id INTO v_order
  FROM public.convert_accepted_sales_quotation_to_order_transaction(v_partial_quote,
    current_setting('test.financial.business_unit_id')::UUID);
  PERFORM pg_temp.assert_financial_order(v_order, 400, 85, 37.80, 352.80);
  FOR v_count IN 1..2 LOOP
    PERFORM pg_temp.financial_edit_order(v_order, v_order_items);
    PERFORM pg_temp.assert_financial_order(v_order, 400, 85, 37.80, 352.80);
  END LOOP;
  IF EXISTS (
    SELECT 1 FROM public.sales_order_item_components component
    JOIN public.sales_order_items item ON item.id = component.order_item_id
    JOIN public.sales_quotation_item_components source ON source.id = component.quotation_component_id
    WHERE item.order_id = v_order
      AND (component.discount_amount <> source.discount_amount
        OR component.discount_percent <> source.discount_percent)
  ) THEN RAISE EXCEPTION 'Copied component discount differs from quotation'; END IF;

  SELECT jsonb_agg(jsonb_build_array(component.id, component.discount_amount,
    component.discount_percent, component.total_amount) ORDER BY component.id)
  INTO v_before FROM public.sales_order_item_components component
  JOIN public.sales_order_items item ON item.id = component.order_item_id
  WHERE item.order_id = v_order;
  BEGIN
    PERFORM pg_temp.financial_edit_order(v_order,
      v_order_items || jsonb_build_array(jsonb_build_object('quantity', 0)));
    RAISE EXCEPTION 'Expected discounted order update failure';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'SALES_ORDER_ITEMS_REQUIRED' THEN RAISE; END IF;
  END;
  SELECT jsonb_agg(jsonb_build_array(component.id, component.discount_amount,
    component.discount_percent, component.total_amount) ORDER BY component.id)
  INTO v_after FROM public.sales_order_item_components component
  JOIN public.sales_order_items item ON item.id = component.order_item_id
  WHERE item.order_id = v_order;
  IF v_before IS DISTINCT FROM v_after THEN RAISE EXCEPTION 'Order component discounts did not roll back'; END IF;
  PERFORM pg_temp.assert_financial_order(v_order, 400, 85, 37.80, 352.80);

  -- Replacement components carry 60 off instead of 50. Old soft-deleted
  -- component discounts must not be included, including after repeated saves.
  v_items := jsonb_set(v_items, '{0,frameSizes,0,frameComponents,0,discountAmount}', '30');
  v_items := jsonb_set(v_items, '{0,frameSizes,0,frameComponents,0,discountPercent}', '30');
  v_items := jsonb_set(v_items, '{0,frameSizes,0,frameComponents,0,totalAmount}', '70');
  v_items := jsonb_set(v_items, '{0,rate}', '170');
  v_items := jsonb_set(v_items, '{0,discountAmount}', '34');
  v_items := jsonb_set(v_items, '{0,taxAmount}', '36.72');
  v_items := jsonb_set(v_items, '{0,lineTotal}', '342.72');
  FOR v_count IN 1..2 LOOP
    PERFORM public.update_sales_quotation_transaction(v_quote, CURRENT_DATE,
      CURRENT_DATE + 14, '', 'Updated component discount fixture', v_items);
    SELECT subtotal, discount_amount, tax_amount, total_amount INTO v_header
    FROM public.sales_quotations WHERE id = v_quote;
    IF ROW(v_header.subtotal, v_header.discount_amount, v_header.tax_amount, v_header.total_amount)
      IS DISTINCT FROM ROW(400::NUMERIC, 94::NUMERIC, 36.72::NUMERIC, 342.72::NUMERIC) THEN
      RAISE EXCEPTION 'Quotation update included obsolete component discounts: %', v_header;
    END IF;
  END LOOP;
  -- A later invalid line must roll back the freshly inserted components too.
  SELECT jsonb_agg(jsonb_build_array(component.id, component.discount_amount,
    component.total_amount, component.deleted_at) ORDER BY component.id)
  INTO v_before FROM public.sales_quotation_item_components component
  JOIN public.sales_quotation_items item ON item.id = component.quotation_item_id
  WHERE item.quotation_id = v_quote;
  BEGIN
    PERFORM public.update_sales_quotation_transaction(v_quote, CURRENT_DATE,
      CURRENT_DATE + 14, '', 'Must roll back component discounts',
      v_items || jsonb_build_array(pg_temp.financial_line(0, 1, 0, 0, 0)));
    RAISE EXCEPTION 'Expected discounted component update failure';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Quotation item quantity must be greater than zero' THEN RAISE; END IF;
  END;
  SELECT jsonb_agg(jsonb_build_array(component.id, component.discount_amount,
    component.total_amount, component.deleted_at) ORDER BY component.id)
  INTO v_after FROM public.sales_quotation_item_components component
  JOIN public.sales_quotation_items item ON item.id = component.quotation_item_id
  WHERE item.quotation_id = v_quote;
  IF v_before IS DISTINCT FROM v_after THEN RAISE EXCEPTION 'Discounted components did not roll back'; END IF;
  SELECT subtotal, discount_amount, tax_amount, total_amount INTO v_header
  FROM public.sales_quotations WHERE id = v_quote;
  IF ROW(v_header.subtotal, v_header.discount_amount, v_header.tax_amount, v_header.total_amount)
    IS DISTINCT FROM ROW(400::NUMERIC, 94::NUMERIC, 36.72::NUMERIC, 342.72::NUMERIC) THEN
    RAISE EXCEPTION 'Discounted quotation header did not roll back';
  END IF;

  -- SO allocation reads ONLY the parent's 34 fixed discount, not the header's
  -- combined 94. The selected size is net 70: deduction 7, tax 7.56, due 70.56.
  PERFORM pg_temp.financial_accept(v_quote);
  v_order_items := pg_temp.financial_order_items(v_quote);
  v_small := jsonb_set(v_order_items, '{0,quantity}', '1');
  v_small := jsonb_set(v_small, '{0,frameSizeSelections}',
    jsonb_build_array(v_order_items #> '{0,frameSizeSelections,0}'));
  v_order := pg_temp.financial_order(v_small);
  SELECT discount_amount, tax_amount, line_total INTO v_line
  FROM public.sales_order_items WHERE order_id = v_order AND deleted_at IS NULL;
  IF ROW(v_line.discount_amount, v_line.tax_amount, v_line.line_total)
    IS DISTINCT FROM ROW(7::NUMERIC, 7.56::NUMERIC, 70.56::NUMERIC) THEN
    RAISE EXCEPTION 'SO allocation subtracted component discounts twice: %', v_line;
  END IF;
  PERFORM pg_temp.assert_financial_order(v_order, 100, 37, 7.56, 70.56);
  PERFORM pg_temp.financial_edit_order(v_order, v_small);
  PERFORM pg_temp.assert_financial_order(v_order, 100, 37, 7.56, 70.56);

  -- A partial size scales its stored discount to cents using the same fraction
  -- as its net amount; it does not re-price from unit_rate.
  v_quote := pg_temp.financial_quote(jsonb_build_array(
    pg_temp.financial_line(3, 0.33, 0, 0, 1)
    || jsonb_build_object('frameSizes', jsonb_build_array(
      jsonb_set(jsonb_set(pg_temp.financial_size(3, 1),
        '{frameComponents,0,discountAmount}', '0.30'),
        '{frameComponents,0,discountPercent}', '23.08')))));
  PERFORM pg_temp.financial_accept(v_quote);
  v_small := jsonb_set(jsonb_set(pg_temp.financial_order_items(v_quote), '{0,quantity}', '1'),
    '{0,frameSizeSelections,0,quantity}', '1');
  v_order := pg_temp.financial_order(v_small);
  PERFORM pg_temp.assert_financial_order(v_order, 0.43, 0.10, 0, 0.33);
  PERFORM pg_temp.financial_edit_order(v_order, v_small);
  PERFORM pg_temp.assert_financial_order(v_order, 0.43, 0.10, 0, 0.33);

  -- Framing stores a priced frame component as well. Its saved amount, rather
  -- than a material rate or a zero service fee, prices partial finished frames.
  v_items := jsonb_build_array(pg_temp.financial_line(2, 1000, 200, 0, 1800)
    || jsonb_build_object('frameSizes', jsonb_build_array(
      jsonb_set(jsonb_set(pg_temp.financial_size(2, 2000),
        '{frameConfiguration,billingMode}', '"framing"'),
        '{frameConfiguration,invoiceDisplayMode}', '"summary"'))));
  v_quote := pg_temp.financial_quote(v_items);
  SELECT SUM(component.total_amount) INTO v_total
  FROM public.sales_quotation_item_components component
  JOIN public.sales_quotation_items item ON item.id = component.quotation_item_id
  WHERE item.quotation_id = v_quote AND item.deleted_at IS NULL AND component.deleted_at IS NULL;
  IF v_total <> 2000 THEN RAISE EXCEPTION 'Framing snapshot was not persisted'; END IF;
  PERFORM pg_temp.financial_accept(v_quote);
  v_small := jsonb_set(jsonb_set(pg_temp.financial_order_items(v_quote), '{0,quantity}', '1'),
    '{0,frameSizeSelections,0,quantity}', '1');
  v_order := pg_temp.financial_order(v_small);
  PERFORM pg_temp.assert_financial_order(v_order, 1000, 100, 0, 900);
  PERFORM pg_temp.financial_edit_order(v_order, v_small);
  PERFORM pg_temp.assert_financial_order(v_order, 1000, 100, 0, 900);

  RAISE NOTICE 'Financial snapshot regression suite passed';
END;
$test$;
ROLLBACK;
