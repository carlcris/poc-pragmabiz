-- Create realtime in-app notifications for active actionable reorder alerts only.

BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_reorder_alert_key
  ON public.notifications(user_id, ((metadata ->> 'reorderAlertKey')))
  WHERE type = 'reorder_alert'
    AND metadata ? 'reorderAlertKey';

CREATE INDEX IF NOT EXISTS idx_notifications_reorder_alert_company_item
  ON public.notifications(company_id, ((metadata ->> 'itemId')))
  WHERE type = 'reorder_alert'
    AND metadata ? 'itemId';

CREATE OR REPLACE FUNCTION public.sync_reorder_alert_notifications_internal(
  p_company_id UUID,
  p_item_ids UUID[] DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_changed_count INTEGER := 0;
  v_item_id_texts TEXT[];
BEGIN
  IF p_company_id IS NULL THEN
    RETURN 0;
  END IF;

  IF p_item_ids IS NOT NULL THEN
    SELECT
      ARRAY_AGG(DISTINCT item_id ORDER BY item_id),
      ARRAY_AGG(DISTINCT item_id::TEXT ORDER BY item_id::TEXT)
    INTO p_item_ids, v_item_id_texts
    FROM UNNEST(p_item_ids) AS item_id
    WHERE item_id IS NOT NULL;

    IF COALESCE(ARRAY_LENGTH(p_item_ids, 1), 0) = 0 THEN
      RETURN 0;
    END IF;
  END IF;

  IF CURRENT_SETTING('app.skip_reorder_notification_sync', TRUE) = 'true' THEN
    RETURN 0;
  END IF;

  IF auth.uid() IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM public.users u
       WHERE u.id = auth.uid()
         AND u.company_id = p_company_id
         AND u.deleted_at IS NULL
     ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF TO_REGCLASS('pg_temp.tmp_active_reorder_notifications') IS NOT NULL THEN
    DROP TABLE pg_temp.tmp_active_reorder_notifications;
  END IF;

  CREATE TEMP TABLE tmp_active_reorder_notifications (
    reorder_alert_key TEXT PRIMARY KEY,
    item_id UUID NOT NULL,
    item_name TEXT NOT NULL,
    total_available_stock NUMERIC NOT NULL,
    reorder_point NUMERIC NOT NULL,
    severity TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    metadata JSONB NOT NULL
  ) ON COMMIT DROP;

  INSERT INTO tmp_active_reorder_notifications (
    reorder_alert_key,
    item_id,
    item_name,
    total_available_stock,
    reorder_point,
    severity,
    title,
    message,
    metadata
  )
  WITH active_season AS (
    SELECT rs.id, rs.code, rs.name
    FROM public.reorder_seasons rs
    WHERE rs.company_id = p_company_id
      AND rs.is_active = TRUE
      AND rs.deleted_at IS NULL
      AND CURRENT_DATE BETWEEN rs.effective_from AND rs.effective_to
    ORDER BY rs.priority DESC, rs.effective_from DESC, rs.created_at DESC
    LIMIT 1
  ),
  stock_agg AS (
    SELECT
      i.id AS item_id,
      SUM(COALESCE(iw.current_stock, 0)) AS total_current_stock,
      SUM(COALESCE(iw.available_stock, COALESCE(iw.current_stock, 0) - COALESCE(iw.reserved_stock, 0), 0)) AS total_available_stock
    FROM public.items i
    INNER JOIN public.warehouses w
      ON w.company_id = i.company_id
     AND w.deleted_at IS NULL
    LEFT JOIN public.item_warehouse iw
      ON iw.company_id = i.company_id
     AND iw.item_id = i.id
     AND iw.warehouse_id = w.id
     AND iw.deleted_at IS NULL
    WHERE i.company_id = p_company_id
      AND i.deleted_at IS NULL
      AND COALESCE(i.is_active, TRUE) = TRUE
      AND (p_item_ids IS NULL OR i.id = ANY(p_item_ids))
    GROUP BY i.id
  ),
  effective_items AS (
    SELECT
      i.id,
      i.item_code,
      i.item_name,
      COALESCE(sa.total_available_stock, 0) AS total_available_stock,
      COALESCE(sip.base_reorder_level, i.reorder_level, 0) AS reorder_point,
      COALESCE(sip.base_reorder_quantity, i.reorder_quantity, 0) AS reorder_quantity,
      COALESCE(sip.base_reorder_level, i.reorder_level, 0) * 0.5 AS minimum_level,
      CASE WHEN sip.id IS NOT NULL THEN 'season_override' ELSE 'item_default' END AS policy_source,
      active_season.id AS season_id
    FROM public.items i
    LEFT JOIN stock_agg sa ON sa.item_id = i.id
    LEFT JOIN active_season ON TRUE
    LEFT JOIN public.reorder_season_item_policies sip
      ON sip.company_id = i.company_id
     AND sip.item_id = i.id
     AND sip.season_id = active_season.id
     AND sip.is_active = TRUE
     AND sip.deleted_at IS NULL
    WHERE i.company_id = p_company_id
      AND i.deleted_at IS NULL
      AND COALESCE(i.is_active, TRUE) = TRUE
      AND (p_item_ids IS NULL OR i.id = ANY(p_item_ids))
  ),
  alerts AS (
    SELECT
      ei.*,
      CASE
        WHEN ei.total_available_stock <= 0 THEN 'critical'
        WHEN ei.total_available_stock <= ei.reorder_point * 0.5 THEN 'critical'
        ELSE 'warning'
      END AS alert_severity
    FROM effective_items ei
    WHERE ei.reorder_point > 0
      AND ei.total_available_stock < ei.reorder_point
  ),
  active_alerts AS (
    SELECT a.*
    FROM alerts a
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.reorder_alert_acknowledgments raa
      WHERE raa.company_id = p_company_id
        AND raa.item_id = a.id
        AND raa.deleted_at IS NULL
        AND raa.policy_source = a.policy_source
        AND raa.season_id IS NOT DISTINCT FROM a.season_id
        AND raa.reorder_point = a.reorder_point
        AND raa.reorder_quantity = a.reorder_quantity
        AND raa.minimum_level = a.minimum_level
        AND raa.severity = a.alert_severity
        AND raa.acknowledged_available_stock = a.total_available_stock
    )
  ),
  prepared AS (
    SELECT
      p_company_id::TEXT || ':' || a.id::TEXT AS reorder_alert_key,
      a.id AS item_id,
      a.item_name::TEXT AS item_name,
      a.total_available_stock,
      a.reorder_point,
      a.alert_severity AS severity,
      'reorder_alert'::TEXT AS title,
      'reorder_alert'::TEXT AS message
    FROM active_alerts a
  )
  SELECT
    p.reorder_alert_key,
    p.item_id,
    p.item_name,
    p.total_available_stock,
    p.reorder_point,
    p.severity,
    p.title,
    p.message,
    JSONB_BUILD_OBJECT(
      'category', 'reorder_alert',
      'reorderAlertKey', p.reorder_alert_key,
      'itemId', p.item_id,
      'itemName', p.item_name,
      'severity', p.severity,
      'availableStock', p.total_available_stock,
      'reorderPoint', p.reorder_point,
      'scope', 'all_warehouses',
      'alertStatus', 'active'
    )
  FROM prepared p;

  WITH eligible_users AS MATERIALIZED (
    SELECT u.id
    FROM public.users u
    WHERE u.company_id = p_company_id
      AND u.is_active = TRUE
      AND u.deleted_at IS NULL
      AND public.user_has_permission(
        u.id,
        'reorder_management',
        'view',
        NULL
      )
  ),
  deleted AS (
    DELETE FROM public.notifications n
    WHERE n.company_id = p_company_id
      AND n.type = 'reorder_alert'
      AND n.metadata ? 'reorderAlertKey'
      AND (
        p_item_ids IS NULL
        OR n.metadata ->> 'itemId' = ANY(v_item_id_texts)
      )
      AND (
        NOT EXISTS (
          SELECT 1
          FROM tmp_active_reorder_notifications active_alerts
          WHERE active_alerts.reorder_alert_key = n.metadata ->> 'reorderAlertKey'
        )
        OR NOT EXISTS (
          SELECT 1
          FROM eligible_users
          WHERE eligible_users.id = n.user_id
        )
      )
    RETURNING 1
  ),
  upserted AS (
    INSERT INTO public.notifications (
      company_id,
      business_unit_id,
      user_id,
      title,
      message,
      type,
      metadata
    )
    SELECT
      p_company_id,
      NULL::UUID,
      eligible_users.id,
      active_alerts.title,
      active_alerts.message,
      'reorder_alert',
      active_alerts.metadata
    FROM tmp_active_reorder_notifications active_alerts
    CROSS JOIN eligible_users
    ON CONFLICT (user_id, ((metadata ->> 'reorderAlertKey')))
      WHERE type = 'reorder_alert'
        AND metadata ? 'reorderAlertKey'
    DO UPDATE SET
      title = EXCLUDED.title,
      message = EXCLUDED.message,
      metadata = EXCLUDED.metadata,
      business_unit_id = NULL
    WHERE public.notifications.title IS DISTINCT FROM EXCLUDED.title
       OR public.notifications.message IS DISTINCT FROM EXCLUDED.message
       OR public.notifications.metadata IS DISTINCT FROM EXCLUDED.metadata
       OR public.notifications.business_unit_id IS NOT NULL
    RETURNING 1
  )
  SELECT
    (SELECT COUNT(*) FROM deleted) + (SELECT COUNT(*) FROM upserted)
  INTO v_changed_count;

  RETURN COALESCE(v_changed_count, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_reorder_alert_notifications(
  p_company_id UUID
)
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.sync_reorder_alert_notifications_internal(p_company_id, NULL);
$$;

CREATE OR REPLACE FUNCTION public.sync_reorder_alert_notifications_from_row()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_company_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_company_id := OLD.company_id;
  ELSE
    v_company_id := NEW.company_id;
  END IF;

  IF v_company_id IS NOT NULL THEN
    PERFORM public.sync_reorder_alert_notifications(v_company_id);
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_reorder_notifications_from_inserted_acknowledgments()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_scope RECORD;
BEGIN
  FOR v_scope IN
    SELECT
      company_id,
      ARRAY_AGG(DISTINCT item_id ORDER BY item_id) AS item_ids
    FROM new_acknowledgments
    WHERE company_id IS NOT NULL
      AND item_id IS NOT NULL
    GROUP BY company_id
  LOOP
    PERFORM public.sync_reorder_alert_notifications_internal(
      v_scope.company_id,
      v_scope.item_ids
    );
  END LOOP;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_reorder_notifications_from_updated_acknowledgments()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_scope RECORD;
BEGIN
  FOR v_scope IN
    WITH changed_rows AS (
      SELECT
        old_ack.company_id,
        old_ack.item_id
      FROM old_acknowledgments old_ack
      INNER JOIN new_acknowledgments new_ack ON new_ack.id = old_ack.id
      WHERE ROW(
        old_ack.company_id,
        old_ack.item_id,
        old_ack.policy_source,
        old_ack.season_id,
        old_ack.reorder_point,
        old_ack.reorder_quantity,
        old_ack.minimum_level,
        old_ack.severity,
        old_ack.acknowledged_available_stock,
        old_ack.deleted_at
      ) IS DISTINCT FROM ROW(
        new_ack.company_id,
        new_ack.item_id,
        new_ack.policy_source,
        new_ack.season_id,
        new_ack.reorder_point,
        new_ack.reorder_quantity,
        new_ack.minimum_level,
        new_ack.severity,
        new_ack.acknowledged_available_stock,
        new_ack.deleted_at
      )

      UNION

      SELECT
        new_ack.company_id,
        new_ack.item_id
      FROM old_acknowledgments old_ack
      INNER JOIN new_acknowledgments new_ack ON new_ack.id = old_ack.id
      WHERE ROW(
        old_ack.company_id,
        old_ack.item_id,
        old_ack.policy_source,
        old_ack.season_id,
        old_ack.reorder_point,
        old_ack.reorder_quantity,
        old_ack.minimum_level,
        old_ack.severity,
        old_ack.acknowledged_available_stock,
        old_ack.deleted_at
      ) IS DISTINCT FROM ROW(
        new_ack.company_id,
        new_ack.item_id,
        new_ack.policy_source,
        new_ack.season_id,
        new_ack.reorder_point,
        new_ack.reorder_quantity,
        new_ack.minimum_level,
        new_ack.severity,
        new_ack.acknowledged_available_stock,
        new_ack.deleted_at
      )
    )
    SELECT
      company_id,
      ARRAY_AGG(DISTINCT item_id ORDER BY item_id) AS item_ids
    FROM changed_rows
    WHERE company_id IS NOT NULL
      AND item_id IS NOT NULL
    GROUP BY company_id
  LOOP
    PERFORM public.sync_reorder_alert_notifications_internal(
      v_scope.company_id,
      v_scope.item_ids
    );
  END LOOP;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_reorder_notifications_from_deleted_acknowledgments()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_scope RECORD;
BEGIN
  FOR v_scope IN
    SELECT
      company_id,
      ARRAY_AGG(DISTINCT item_id ORDER BY item_id) AS item_ids
    FROM old_acknowledgments
    WHERE company_id IS NOT NULL
      AND item_id IS NOT NULL
    GROUP BY company_id
  LOOP
    PERFORM public.sync_reorder_alert_notifications_internal(
      v_scope.company_id,
      v_scope.item_ids
    );
  END LOOP;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_reorder_notifications_from_inserted_stock_rows()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_scope RECORD;
BEGIN
  FOR v_scope IN
    SELECT
      company_id,
      ARRAY_AGG(DISTINCT item_id ORDER BY item_id) AS item_ids
    FROM new_stock_rows
    WHERE company_id IS NOT NULL
      AND item_id IS NOT NULL
    GROUP BY company_id
  LOOP
    PERFORM public.sync_reorder_alert_notifications_internal(
      v_scope.company_id,
      v_scope.item_ids
    );
  END LOOP;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_reorder_notifications_from_updated_stock_rows()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_scope RECORD;
BEGIN
  FOR v_scope IN
    WITH changed_rows AS (
      SELECT
        old_stock.company_id,
        old_stock.item_id
      FROM old_stock_rows old_stock
      INNER JOIN new_stock_rows new_stock ON new_stock.id = old_stock.id
      WHERE ROW(
        old_stock.company_id,
        old_stock.item_id,
        old_stock.current_stock,
        old_stock.reserved_stock,
        old_stock.is_active,
        old_stock.deleted_at
      ) IS DISTINCT FROM ROW(
        new_stock.company_id,
        new_stock.item_id,
        new_stock.current_stock,
        new_stock.reserved_stock,
        new_stock.is_active,
        new_stock.deleted_at
      )

      UNION

      SELECT
        new_stock.company_id,
        new_stock.item_id
      FROM old_stock_rows old_stock
      INNER JOIN new_stock_rows new_stock ON new_stock.id = old_stock.id
      WHERE ROW(
        old_stock.company_id,
        old_stock.item_id,
        old_stock.current_stock,
        old_stock.reserved_stock,
        old_stock.is_active,
        old_stock.deleted_at
      ) IS DISTINCT FROM ROW(
        new_stock.company_id,
        new_stock.item_id,
        new_stock.current_stock,
        new_stock.reserved_stock,
        new_stock.is_active,
        new_stock.deleted_at
      )
    )
    SELECT
      company_id,
      ARRAY_AGG(DISTINCT item_id ORDER BY item_id) AS item_ids
    FROM changed_rows
    WHERE company_id IS NOT NULL
      AND item_id IS NOT NULL
    GROUP BY company_id
  LOOP
    PERFORM public.sync_reorder_alert_notifications_internal(
      v_scope.company_id,
      v_scope.item_ids
    );
  END LOOP;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_reorder_notifications_from_deleted_stock_rows()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_scope RECORD;
BEGIN
  FOR v_scope IN
    SELECT
      company_id,
      ARRAY_AGG(DISTINCT item_id ORDER BY item_id) AS item_ids
    FROM old_stock_rows
    WHERE company_id IS NOT NULL
      AND item_id IS NOT NULL
    GROUP BY company_id
  LOOP
    PERFORM public.sync_reorder_alert_notifications_internal(
      v_scope.company_id,
      v_scope.item_ids
    );
  END LOOP;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trigger_item_warehouse_sync_reorder_notifications
  ON public.item_warehouse;

DROP TRIGGER IF EXISTS trigger_item_warehouse_sync_reorder_notifications_insert
  ON public.item_warehouse;
CREATE TRIGGER trigger_item_warehouse_sync_reorder_notifications_insert
AFTER INSERT ON public.item_warehouse
REFERENCING NEW TABLE AS new_stock_rows
FOR EACH STATEMENT
EXECUTE FUNCTION public.sync_reorder_notifications_from_inserted_stock_rows();

DROP TRIGGER IF EXISTS trigger_item_warehouse_sync_reorder_notifications_update
  ON public.item_warehouse;
CREATE TRIGGER trigger_item_warehouse_sync_reorder_notifications_update
AFTER UPDATE ON public.item_warehouse
REFERENCING OLD TABLE AS old_stock_rows NEW TABLE AS new_stock_rows
FOR EACH STATEMENT
EXECUTE FUNCTION public.sync_reorder_notifications_from_updated_stock_rows();

DROP TRIGGER IF EXISTS trigger_item_warehouse_sync_reorder_notifications_delete
  ON public.item_warehouse;
CREATE TRIGGER trigger_item_warehouse_sync_reorder_notifications_delete
AFTER DELETE ON public.item_warehouse
REFERENCING OLD TABLE AS old_stock_rows
FOR EACH STATEMENT
EXECUTE FUNCTION public.sync_reorder_notifications_from_deleted_stock_rows();

DROP TRIGGER IF EXISTS trigger_items_sync_reorder_notifications ON public.items;
CREATE TRIGGER trigger_items_sync_reorder_notifications
AFTER UPDATE OF reorder_level, reorder_quantity, is_active, deleted_at
ON public.items
FOR EACH ROW
EXECUTE FUNCTION public.sync_reorder_alert_notifications_from_row();

DROP TRIGGER IF EXISTS trigger_reorder_seasons_sync_notifications ON public.reorder_seasons;
CREATE TRIGGER trigger_reorder_seasons_sync_notifications
AFTER INSERT OR UPDATE OF effective_from, effective_to, priority, is_active, deleted_at OR DELETE
ON public.reorder_seasons
FOR EACH ROW
EXECUTE FUNCTION public.sync_reorder_alert_notifications_from_row();

DROP TRIGGER IF EXISTS trigger_reorder_policy_sync_notifications ON public.reorder_season_item_policies;
CREATE TRIGGER trigger_reorder_policy_sync_notifications
AFTER INSERT OR UPDATE OF reorder_level, reorder_quantity, qty_per_unit, is_active, deleted_at OR DELETE
ON public.reorder_season_item_policies
FOR EACH ROW
EXECUTE FUNCTION public.sync_reorder_alert_notifications_from_row();

DROP TRIGGER IF EXISTS trigger_reorder_acknowledgments_sync_notifications_insert
  ON public.reorder_alert_acknowledgments;
CREATE TRIGGER trigger_reorder_acknowledgments_sync_notifications_insert
AFTER INSERT ON public.reorder_alert_acknowledgments
REFERENCING NEW TABLE AS new_acknowledgments
FOR EACH STATEMENT
EXECUTE FUNCTION public.sync_reorder_notifications_from_inserted_acknowledgments();

DROP TRIGGER IF EXISTS trigger_reorder_acknowledgments_sync_notifications_update
  ON public.reorder_alert_acknowledgments;
CREATE TRIGGER trigger_reorder_acknowledgments_sync_notifications_update
AFTER UPDATE ON public.reorder_alert_acknowledgments
REFERENCING OLD TABLE AS old_acknowledgments NEW TABLE AS new_acknowledgments
FOR EACH STATEMENT
EXECUTE FUNCTION public.sync_reorder_notifications_from_updated_acknowledgments();

DROP TRIGGER IF EXISTS trigger_reorder_acknowledgments_sync_notifications_delete
  ON public.reorder_alert_acknowledgments;
CREATE TRIGGER trigger_reorder_acknowledgments_sync_notifications_delete
AFTER DELETE ON public.reorder_alert_acknowledgments
REFERENCING OLD TABLE AS old_acknowledgments
FOR EACH STATEMENT
EXECUTE FUNCTION public.sync_reorder_notifications_from_deleted_acknowledgments();

REVOKE ALL ON FUNCTION public.sync_reorder_alert_notifications_internal(UUID, UUID[])
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_reorder_notifications_from_inserted_acknowledgments()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_reorder_notifications_from_updated_acknowledgments()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_reorder_notifications_from_deleted_acknowledgments()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_reorder_notifications_from_inserted_stock_rows()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_reorder_notifications_from_updated_stock_rows()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_reorder_notifications_from_deleted_stock_rows()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_reorder_alert_notifications(UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_reorder_alert_notifications(UUID) TO authenticated;

COMMIT;
