DROP FUNCTION IF EXISTS public.assign_senior_school_placement(
  uuid,
  uuid,
  uuid,
  uuid,
  uuid,
  uuid,
  uuid,
  uuid[],
  text
);

CREATE OR REPLACE FUNCTION public.assign_senior_school_placement(
  _school_id uuid,
  _learner_id uuid,
  _academic_year_id uuid,
  _pathway_id uuid,
  _track_id uuid,
  _strand_id uuid,
  _combination_id uuid,
  _next_grade public.cbe_grade,
  _stream_id uuid,
  _learning_area_ids uuid[],
  _reason text DEFAULT 'Grade 9 transition'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  assignment_id uuid;
  previous_assignment_id uuid;
  previous_pathway_id uuid;
BEGIN
  IF NOT (public.is_school_admin(_school_id) OR public.is_super_admin()) THEN
    RAISE EXCEPTION 'Not authorized for this school';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.learners
    WHERE id = _learner_id AND school_id = _school_id
      AND current_grade = 'G9' AND NOT is_archived
  ) THEN
    RAISE EXCEPTION 'Only an active Grade 9 learner can be placed into Senior School';
  END IF;

  IF _next_grade IS NULL THEN
    RAISE EXCEPTION 'Select the learner''s next grade';
  END IF;

  IF _stream_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.streams s
    WHERE s.id = _stream_id AND s.school_id = _school_id AND s.grade <> _next_grade
  ) THEN
    RAISE EXCEPTION 'Selected stream does not belong to the target grade';
  END IF;

  IF _learning_area_ids IS NULL OR cardinality(_learning_area_ids) = 0 THEN
    RAISE EXCEPTION 'At least one learning area is required';
  END IF;

  IF cardinality(_learning_area_ids) <> cardinality(ARRAY(SELECT DISTINCT area_id FROM unnest(_learning_area_ids) AS area_id)) THEN
    RAISE EXCEPTION 'Duplicate learning areas are not allowed';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM unnest(_learning_area_ids) AS requested(area_id)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.subject_combination_learning_areas ca
      WHERE ca.subject_combination_id = _combination_id
        AND ca.learning_area_id = requested.area_id
    )
  ) THEN
    RAISE EXCEPTION 'Learning area is not available in the selected subject combination';
  END IF;

  SELECT spa.id, spa.pathway_id
    INTO previous_assignment_id, previous_pathway_id
  FROM public.student_pathway_assignments spa
  WHERE spa.learner_id = _learner_id
    AND spa.school_id = _school_id
    AND spa.status = 'current'
  ORDER BY spa.approved_at DESC NULLS LAST, spa.created_at DESC
  LIMIT 1;

  WITH inserted_assignment AS (
    INSERT INTO public.student_pathway_assignments (
      school_id, learner_id, academic_year_id, grade, pathway_id, track_id, strand_id,
      subject_combination_id, status, approved_by, approved_at, change_reason
    ) VALUES (
      _school_id, _learner_id, _academic_year_id, _next_grade, _pathway_id, _track_id,
      _strand_id, _combination_id, 'current', auth.uid(), now(), _reason
    )
    RETURNING id AS assignment_id
  )
  INSERT INTO public.student_learning_area_enrollments (
    school_id, learner_id, assignment_id, learning_area_id
  )
  SELECT _school_id, _learner_id, ia.assignment_id, area_id
  FROM inserted_assignment ia
  CROSS JOIN unnest(_learning_area_ids) AS area_id
  ON CONFLICT (assignment_id, learning_area_id) DO NOTHING;

  SELECT id INTO assignment_id
  FROM public.student_pathway_assignments
  WHERE learner_id = _learner_id
    AND school_id = _school_id
    AND academic_year_id = _academic_year_id
    AND pathway_id = _pathway_id
    AND track_id = _track_id
    AND strand_id IS NOT DISTINCT FROM _strand_id
    AND subject_combination_id = _combination_id
    AND grade = _next_grade
    AND status = 'current'
  ORDER BY created_at DESC
  LIMIT 1;

  UPDATE public.learners
  SET current_grade = _next_grade,
      current_stream_id = _stream_id,
      senior_school_pathway_id = _pathway_id,
      senior_school_track_id = _track_id,
      senior_school_combination_id = _combination_id,
      pathway_selection_status = 'approved',
      pathway_selected_at = now()
  WHERE id = _learner_id AND school_id = _school_id;

  UPDATE public.student_class_history
  SET end_date = CURRENT_DATE,
      status = 'completed'
  WHERE learner_id = _learner_id
    AND school_id = _school_id
    AND status = 'active';

  INSERT INTO public.student_class_history (
    school_id,
    learner_id,
    academic_year_id,
    grade,
    stream_id,
    enrollment_date,
    status,
    promotion_status,
    movement_reason,
    remarks,
    moved_by
  ) VALUES (
    _school_id,
    _learner_id,
    _academic_year_id,
    _next_grade,
    _stream_id,
    CURRENT_DATE,
    'active',
    'transition',
    _reason,
    _reason,
    auth.uid()
  );

  INSERT INTO public.senior_pathway_change_audit (
    school_id,
    learner_id,
    previous_assignment_id,
    new_assignment_id,
    previous_pathway_id,
    new_pathway_id,
    reason,
    changed_by
  ) VALUES (
    _school_id,
    _learner_id,
    previous_assignment_id,
    assignment_id,
    previous_pathway_id,
    _pathway_id,
    COALESCE(_reason, 'Grade 9 transition'),
    auth.uid()
  );

  RETURN assignment_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.assign_senior_school_placement(
  uuid,
  uuid,
  uuid,
  uuid,
  uuid,
  uuid,
  uuid,
  public.cbe_grade,
  uuid,
  uuid[],
  text
) TO authenticated;
