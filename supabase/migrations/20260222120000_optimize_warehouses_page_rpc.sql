-- Optimize warehouse listing endpoint by pushing filtering, shaping, and pagination to DB level.

DROP FUNCTION IF EXISTS public.get_warehouses(
  UUID,
  UUID[],
  TEXT,
  TEXT,
  BOOLEAN,
  INTEGER,
  INTEGER
);

CREATE OR REPLACE FUNCTION public.get_warehouses(
  p_company_id UUID,
  p_accessible_business_unit_ids UUID[] DEFAULT NULL,
  p_search TEXT DEFAULT NULL,
  p_country TEXT DEFAULT NULL,
  p_is_active BOOLEAN DEFAULT NULL,
  p_page INTEGER DEFAULT 1,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  "companyId" UUID,
  "businessUnitId" UUID,
  code TEXT,
  name TEXT,
  description TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  "postalCode" TEXT,
  country TEXT,
  phone TEXT,
  email TEXT,
  "managerName" TEXT,
  "isActive" BOOLEAN,
  "isVan" BOOLEAN,
  "createdAt" TIMESTAMPTZ,
  "updatedAt" TIMESTAMPTZ,
  total_count BIGINT
)
LANGUAGE sql
STABLE
AS $$
WITH filtered AS (
  SELECT
    w.id,
    w.company_id AS "companyId",
    w.business_unit_id AS "businessUnitId",
    w.warehouse_code AS code,
    w.warehouse_name AS name,
    ''::TEXT AS description,
    TRIM(
      CONCAT(
        COALESCE(w.address_line1, ''),
        CASE
          WHEN w.address_line2 IS NOT NULL AND BTRIM(w.address_line2) <> '' THEN ' ' || w.address_line2
          ELSE ''
        END
      )
    ) AS address,
    COALESCE(w.city, '') AS city,
    COALESCE(w.state, '') AS state,
    COALESCE(w.postal_code, '') AS "postalCode",
    COALESCE(w.country, '') AS country,
    COALESCE(w.phone, '') AS phone,
    COALESCE(w.email, '') AS email,
    NULLIF(w.contact_person, '') AS "managerName",
    COALESCE(w.is_active, true) AS "isActive",
    COALESCE(w.is_van, false) AS "isVan",
    w.created_at AS "createdAt",
    COALESCE(w.updated_at, w.created_at) AS "updatedAt"
  FROM public.warehouses w
  WHERE w.company_id = p_company_id
    AND w.deleted_at IS NULL
    AND (
      p_accessible_business_unit_ids IS NULL
      OR cardinality(p_accessible_business_unit_ids) = 0
      OR w.business_unit_id IS NULL
      OR w.business_unit_id = ANY(p_accessible_business_unit_ids)
    )
    AND (
      p_search IS NULL
      OR p_search = ''
      OR w.warehouse_code ILIKE ('%' || p_search || '%')
      OR w.warehouse_name ILIKE ('%' || p_search || '%')
      OR COALESCE(w.city, '') ILIKE ('%' || p_search || '%')
    )
    AND (
      p_country IS NULL
      OR p_country = ''
      OR COALESCE(w.country, '') ILIKE ('%' || p_country || '%')
    )
    AND (p_is_active IS NULL OR COALESCE(w.is_active, true) = p_is_active)
)
SELECT
  f.id,
  f."companyId",
  f."businessUnitId",
  f.code,
  f.name,
  f.description,
  f.address,
  f.city,
  f.state,
  f."postalCode",
  f.country,
  f.phone,
  f.email,
  f."managerName",
  f."isActive",
  f."isVan",
  f."createdAt",
  f."updatedAt",
  COUNT(*) OVER() AS total_count
FROM filtered f
ORDER BY f.code ASC
OFFSET (GREATEST(p_page, 1) - 1) * GREATEST(p_limit, 1)
LIMIT GREATEST(p_limit, 1);
$$;
