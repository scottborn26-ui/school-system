CREATE OR REPLACE FUNCTION public.delete_report_card_permanently(
  _school_id uuid,
  _report_card_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  report_card_data jsonb;
BEGIN
  IF NOT (
    public.is_super_admin()
    OR public.is_school_admin(_school_id)
    OR public.is_exam_officer(_school_id)
  ) THEN
    RAISE EXCEPTION 'Only an administrator or exam officer can permanently delete a report card';
  END IF;

  SELECT to_jsonb(report_cards)
  INTO report_card_data
  FROM public.report_cards
  WHERE id = _report_card_id AND school_id = _school_id;

  IF report_card_data IS NULL THEN
    RAISE EXCEPTION 'Report card not found in this school';
  END IF;

  INSERT INTO public.audit_logs (
    school_id, actor_id, actor_name, action, entity, entity_id, reason, before_data
  )
  SELECT
    _school_id, auth.uid(), profiles.full_name, 'permanent_delete', 'report_card',
    _report_card_id, 'Administrator or exam officer permanently deleted report card',
    report_card_data
  FROM public.profiles
  WHERE profiles.id = auth.uid();

  DELETE FROM public.report_cards
  WHERE id = _report_card_id AND school_id = _school_id;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_report_card_permanently(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_report_card_permanently(uuid, uuid) TO authenticated, service_role;

-- Recover totals for cards created before total_points was consistently persisted.
UPDATE public.report_cards AS report_card
SET total_points = totals.total_points
FROM (
  SELECT report_card_inner.id,
    COALESCE(SUM((area->>'points')::integer), 0)::integer AS total_points
  FROM public.report_cards AS report_card_inner
  CROSS JOIN LATERAL jsonb_array_elements(report_card_inner.payload->'areas') AS area
  WHERE report_card_inner.total_points IS NULL OR report_card_inner.total_points = 0
  GROUP BY report_card_inner.id
) AS totals
WHERE report_card.id = totals.id;