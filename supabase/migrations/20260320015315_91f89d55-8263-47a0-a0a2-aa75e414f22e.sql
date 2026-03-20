
-- Fix search_path on get_level_from_xp
CREATE OR REPLACE FUNCTION public.get_level_from_xp(_xp integer)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN _xp >= 2000 THEN 6
    WHEN _xp >= 1000 THEN 5
    WHEN _xp >= 600 THEN 4
    WHEN _xp >= 300 THEN 3
    WHEN _xp >= 100 THEN 2
    ELSE 1
  END
$$;
