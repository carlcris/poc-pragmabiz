-- Receiving inbox: one paginated list of everything a business unit receives,
-- load lists (supplier shipments) and delivery notes (branch transfers),
-- mapped onto shared receiving stages.
--
-- Stage mapping:
--   expected          load list confirmed / in_transit
--   ready             load list arrived; delivery note dispatched, receiving not started
--   in_progress       load list receiving; delivery note dispatched, receiving started
--   awaiting_approval load list pending_approval
--   completed         load list received; delivery note received
--
-- SECURITY INVOKER: table RLS applies to every row read here. The API decides
-- which document kinds the caller may see and passes them as flags.
BEGIN;

CREATE OR REPLACE FUNCTION public.list_receiving_inbox(
  p_company_id UUID,
  p_business_unit_id UUID,
  p_include_load_lists BOOLEAN,
  p_include_delivery_notes BOOLEAN,
  p_stage TEXT,
  p_kind TEXT,
  p_search TEXT,
  p_limit INTEGER,
  p_offset INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_search TEXT := NULLIF(BTRIM(COALESCE(p_search, '')), '');
  v_pattern TEXT;
  v_result JSONB;
BEGIN
  IF p_stage NOT IN ('to_receive', 'ready', 'in_progress', 'expected', 'awaiting_approval', 'completed', 'all') THEN
    RAISE EXCEPTION 'RECEIVING_INBOX_INVALID_STAGE';
  END IF;

  IF p_kind NOT IN ('all', 'load_list', 'delivery_note') THEN
    RAISE EXCEPTION 'RECEIVING_INBOX_INVALID_KIND';
  END IF;

  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 50 OR p_offset IS NULL OR p_offset < 0 THEN
    RAISE EXCEPTION 'RECEIVING_INBOX_INVALID_PAGE';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM user_business_unit_access AS access
    WHERE access.user_id = (SELECT auth.uid())
      AND access.business_unit_id = p_business_unit_id
  ) THEN
    RAISE EXCEPTION 'RECEIVING_INBOX_BUSINESS_UNIT_DENIED';
  END IF;

  IF v_search IS NOT NULL THEN
    v_pattern := '%' || replace(replace(replace(v_search, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  END IF;

  WITH inbox AS (
    SELECT
      'load_list'::TEXT AS kind,
      ll.id,
      ll.ll_number AS code,
      supplier.supplier_name AS counterparty_name,
      ll.status::TEXT AS status,
      CASE ll.status::TEXT
        WHEN 'confirmed' THEN 'expected'
        WHEN 'in_transit' THEN 'expected'
        WHEN 'arrived' THEN 'ready'
        WHEN 'receiving' THEN 'in_progress'
        WHEN 'pending_approval' THEN 'awaiting_approval'
        ELSE 'completed'
      END AS stage,
      ll.estimated_arrival_date::TIMESTAMPTZ AS expected_at,
      ll.received_date::TIMESTAMPTZ AS completed_at
    FROM load_lists AS ll
    LEFT JOIN suppliers AS supplier ON supplier.id = ll.supplier_id
    WHERE p_include_load_lists
      AND ll.company_id = p_company_id
      AND ll.destination_business_unit_id = p_business_unit_id
      AND ll.deleted_at IS NULL
      AND ll.status::TEXT IN ('confirmed', 'in_transit', 'arrived', 'receiving', 'pending_approval', 'received')
      AND (
        v_pattern IS NULL
        OR ll.ll_number ILIKE v_pattern
        OR ll.supplier_ll_number ILIKE v_pattern
        OR ll.container_number ILIKE v_pattern
        OR supplier.supplier_name ILIKE v_pattern
      )

    UNION ALL

    SELECT
      'delivery_note'::TEXT AS kind,
      dn.id,
      dn.dn_no AS code,
      source_unit.name AS counterparty_name,
      dn.status::TEXT AS status,
      CASE
        WHEN dn.status::TEXT = 'received' THEN 'completed'
        WHEN dn.receiving_started_at IS NOT NULL THEN 'in_progress'
        ELSE 'ready'
      END AS stage,
      dn.dispatched_at AS expected_at,
      dn.received_at AS completed_at
    FROM delivery_notes AS dn
    LEFT JOIN business_units AS source_unit ON source_unit.id = dn.fulfilling_business_unit_id
    WHERE p_include_delivery_notes
      AND dn.company_id = p_company_id
      AND dn.requesting_business_unit_id = p_business_unit_id
      AND dn.deleted_at IS NULL
      AND dn.status::TEXT IN ('dispatched', 'received')
      AND (
        v_pattern IS NULL
        OR dn.dn_no ILIKE v_pattern
        OR source_unit.name ILIKE v_pattern
      )
  ),
  -- Counts cover every permitted kind and stage (search applied) so the
  -- filter controls can show counts for choices other than the active one.
  stage_counts AS (
    SELECT stage, kind, COUNT(*)::INTEGER AS row_count
    FROM inbox
    GROUP BY stage, kind
  ),
  filtered AS (
    SELECT
      inbox.kind,
      inbox.id,
      inbox.code,
      inbox.counterparty_name,
      inbox.status,
      inbox.stage,
      inbox.expected_at,
      inbox.completed_at,
      CASE inbox.stage
        WHEN 'in_progress' THEN 1
        WHEN 'ready' THEN 2
        WHEN 'awaiting_approval' THEN 3
        WHEN 'expected' THEN 4
        ELSE 5
      END AS stage_rank
    FROM inbox
    WHERE (p_kind = 'all' OR inbox.kind = p_kind)
      AND (
        p_stage = 'all'
        OR inbox.stage = p_stage
        OR (p_stage = 'to_receive' AND inbox.stage IN ('ready', 'in_progress'))
      )
  ),
  page AS (
    SELECT
      filtered.kind,
      filtered.id,
      filtered.code,
      filtered.counterparty_name,
      filtered.status,
      filtered.stage,
      filtered.expected_at,
      filtered.completed_at,
      filtered.stage_rank
    FROM filtered
    ORDER BY
      filtered.stage_rank,
      CASE WHEN filtered.stage = 'completed' THEN filtered.completed_at END DESC NULLS LAST,
      filtered.expected_at ASC NULLS LAST,
      filtered.code,
      filtered.id
    LIMIT p_limit
    OFFSET p_offset
  ),
  -- Line counts and progress are computed only for the returned page.
  -- Load lists in progress count GRN lines with an entry on the latest GRN;
  -- delivery notes report scanned vs dispatched units, where scanned units
  -- include unexpected items that were not rejected or voided.
  page_rows AS (
    SELECT
      page.kind,
      page.id,
      page.code,
      page.counterparty_name,
      page.status,
      page.stage,
      page.expected_at,
      page.completed_at,
      page.stage_rank,
      CASE page.kind
        WHEN 'load_list' THEN COALESCE(grn_progress.line_count, ll_lines.line_count)
        ELSE dn_progress.line_count
      END AS line_count,
      CASE page.kind
        WHEN 'load_list' THEN grn_progress.done_qty
        ELSE dn_progress.done_qty + COALESCE(dn_unexpected.scanned_qty, 0)
      END AS done_qty,
      CASE page.kind
        WHEN 'load_list' THEN grn_progress.total_qty
        ELSE dn_progress.total_qty
      END AS total_qty
    FROM page
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::INTEGER AS line_count
      FROM load_list_items AS ll_line
      WHERE ll_line.load_list_id = page.id
    ) AS ll_lines ON page.kind = 'load_list'
    LEFT JOIN LATERAL (
      SELECT
        COUNT(*)::INTEGER AS line_count,
        COUNT(*) FILTER (WHERE grn_line.received_qty > 0 OR grn_line.damaged_qty > 0)::NUMERIC AS done_qty,
        COUNT(*)::NUMERIC AS total_qty
      FROM grn_items AS grn_line
      WHERE grn_line.grn_id = (
        SELECT grn.id
        FROM grns AS grn
        WHERE grn.load_list_id = page.id
          AND grn.deleted_at IS NULL
        ORDER BY grn.created_at DESC
        LIMIT 1
      )
      HAVING COUNT(*) > 0
    ) AS grn_progress ON page.kind = 'load_list' AND page.stage = 'in_progress'
    LEFT JOIN LATERAL (
      SELECT
        COUNT(*)::INTEGER AS line_count,
        COALESCE(SUM(dn_line.received_qty), 0)::NUMERIC AS done_qty,
        COALESCE(SUM(dn_line.dispatched_qty), 0)::NUMERIC AS total_qty
      FROM delivery_note_items AS dn_line
      WHERE dn_line.company_id = p_company_id
        AND dn_line.dn_id = page.id
    ) AS dn_progress ON page.kind = 'delivery_note'
    LEFT JOIN LATERAL (
      SELECT SUM(dn_exception.accepted_qty)::NUMERIC AS scanned_qty
      FROM delivery_note_receiving_exceptions AS dn_exception
      WHERE dn_exception.company_id = p_company_id
        AND dn_exception.dn_id = page.id
        AND dn_exception.status IN ('pending_review', 'accepted', 'resolved')
    ) AS dn_unexpected ON page.kind = 'delivery_note'
  )
  SELECT jsonb_build_object(
    'rows', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'kind', page_rows.kind,
          'id', page_rows.id,
          'code', page_rows.code,
          'counterpartyName', page_rows.counterparty_name,
          'status', page_rows.status,
          'stage', page_rows.stage,
          'expectedAt', page_rows.expected_at,
          'completedAt', page_rows.completed_at,
          'lineCount', page_rows.line_count,
          'doneQty', page_rows.done_qty,
          'totalQty', page_rows.total_qty
        )
        ORDER BY
          page_rows.stage_rank,
          CASE WHEN page_rows.stage = 'completed' THEN page_rows.completed_at END DESC NULLS LAST,
          page_rows.expected_at ASC NULLS LAST,
          page_rows.code,
          page_rows.id
      )
      FROM page_rows
    ), '[]'::JSONB),
    'total', (SELECT COUNT(*) FROM filtered),
    'stageCounts', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object('stage', stage_counts.stage, 'kind', stage_counts.kind, 'count', stage_counts.row_count)
      )
      FROM stage_counts
    ), '[]'::JSONB)
  )
  INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.list_receiving_inbox(UUID, UUID, BOOLEAN, BOOLEAN, TEXT, TEXT, TEXT, INTEGER, INTEGER)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_receiving_inbox(UUID, UUID, BOOLEAN, BOOLEAN, TEXT, TEXT, TEXT, INTEGER, INTEGER)
  TO authenticated;

COMMIT;
