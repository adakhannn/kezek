-- M1.1 Branches map: ensure lat/lon columns and keep them in sync with coords (EWKT).
-- coords format: SRID=4326;POINT(lon lat). We do not require PostGIS for this migration.

-- 1. Add lat/lon if missing (Supabase types already expect them)
ALTER TABLE public.branches
    ADD COLUMN IF NOT EXISTS lat numeric(10, 7),
    ADD COLUMN IF NOT EXISTS lon numeric(11, 7);

COMMENT ON COLUMN public.branches.lat IS 'Широта WGS84, синхронизируется из coords (EWKT)';
COMMENT ON COLUMN public.branches.lon IS 'Долгота WGS84, синхронизируется из coords (EWKT)';

-- 2. Backfill lat/lon from coords (EWKT string: SRID=4326;POINT(lon lat))
UPDATE public.branches
SET
    lon = (regexp_match(trim(coords::text), 'POINT\s*\(\s*(-?[\d.]+)\s+(-?[\d.]+)\s*\)'))[1]::numeric,
    lat = (regexp_match(trim(coords::text), 'POINT\s*\(\s*(-?[\d.]+)\s+(-?[\d.]+)\s*\)'))[2]::numeric
WHERE coords IS NOT NULL
  AND trim(coords::text) <> ''
  AND (lat IS NULL OR lon IS NULL);

-- 3. Trigger: keep lat/lon in sync on INSERT/UPDATE of coords
CREATE OR REPLACE FUNCTION public.branches_sync_lat_lon_from_coords()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_coords text;
    m text[];
BEGIN
    v_coords := nullif(trim(NEW.coords::text), '');
    IF v_coords IS NULL THEN
        NEW.lat := NULL;
        NEW.lon := NULL;
        RETURN NEW;
    END IF;
    m := regexp_match(v_coords, 'POINT\s*\(\s*(-?[\d.]+)\s+(-?[\d.]+)\s*\)');
    IF m IS NOT NULL AND array_length(m, 1) >= 2 THEN
        NEW.lon := m[1]::numeric;
        NEW.lat := m[2]::numeric;
    ELSE
        NEW.lat := NULL;
        NEW.lon := NULL;
    END IF;
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.branches_sync_lat_lon_from_coords() IS 'Синхронизирует branches.lat/lon из branches.coords (EWKT) при INSERT/UPDATE';

DROP TRIGGER IF EXISTS branches_sync_lat_lon_trigger ON public.branches;
CREATE TRIGGER branches_sync_lat_lon_trigger
    BEFORE INSERT OR UPDATE OF coords
    ON public.branches
    FOR EACH ROW
    EXECUTE FUNCTION public.branches_sync_lat_lon_from_coords();
