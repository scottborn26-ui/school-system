-- Delete a learning area and its dependent curriculum records atomically.
CREATE OR REPLACE FUNCTION public.delete_learning_area(_learning_area_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_school_id uuid;
BEGIN
  SELECT school_id INTO target_school_id
  FROM public.learning_areas
  WHERE id = _learning_area_id;

  IF target_school_id IS NULL THEN
    RAISE EXCEPTION 'Learning area not found';
  END IF;

  IF NOT (public.is_super_admin() OR public.is_school_admin(target_school_id)) THEN
    RAISE EXCEPTION 'Only school leadership can delete learning areas';
  END IF;

  DELETE FROM public.timetable_slots
  WHERE school_id = target_school_id AND learning_area_id = _learning_area_id;

  DELETE FROM public.teacher_allocations
  WHERE school_id = target_school_id AND learning_area_id = _learning_area_id;

  DELETE FROM public.assessments
  WHERE school_id = target_school_id AND learning_area_id = _learning_area_id;

  DELETE FROM public.subject_combination_learning_areas
  WHERE learning_area_id = _learning_area_id;

  DELETE FROM public.learning_areas
  WHERE id = _learning_area_id AND school_id = target_school_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Learning area could not be deleted';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_learning_area(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_learning_area(uuid) TO authenticated;