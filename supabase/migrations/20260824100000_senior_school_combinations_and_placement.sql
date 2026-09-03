-- Extend the existing Senior School model without replacing the school's
-- already-configured pathways, tracks, strands, or learning areas.

CREATE TABLE public.subject_combinations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  pathway_id uuid NOT NULL REFERENCES public.senior_pathways(id) ON DELETE RESTRICT,
  track_id uuid NOT NULL REFERENCES public.pathway_tracks(id) ON DELETE RESTRICT,
  name text NOT NULL,
  code text NOT NULL,
  description text,
  minimum_subjects integer NOT NULL DEFAULT 1 CHECK (minimum_subjects > 0),
  maximum_subjects integer NOT NULL DEFAULT 1 CHECK (maximum_subjects >= minimum_subjects),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, code)
);

CREATE TABLE public.subject_combination_learning_areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_combination_id uuid NOT NULL REFERENCES public.subject_combinations(id) ON DELETE CASCADE,
  learning_area_id uuid NOT NULL REFERENCES public.learning_areas(id) ON DELETE RESTRICT,
  is_core boolean NOT NULL DEFAULT false,
  is_optional boolean NOT NULL DEFAULT false,
  UNIQUE (subject_combination_id, learning_area_id),
  CHECK (NOT (is_core AND is_optional))
);

ALTER TABLE public.learners
  ADD COLUMN IF NOT EXISTS senior_school_pathway_id uuid REFERENCES public.senior_pathways(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS senior_school_track_id uuid REFERENCES public.pathway_tracks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS senior_school_combination_id uuid REFERENCES public.subject_combinations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pathway_selection_status text NOT NULL DEFAULT 'not_started'
    CHECK (pathway_selection_status IN ('not_started', 'draft', 'submitted', 'approved', 'changed')),
  ADD COLUMN IF NOT EXISTS pathway_selected_at timestamptz;

ALTER TABLE public.student_pathway_assignments
  ADD COLUMN IF NOT EXISTS subject_combination_id uuid REFERENCES public.subject_combinations(id) ON DELETE RESTRICT;

CREATE TABLE public.senior_pathway_change_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  learner_id uuid NOT NULL REFERENCES public.learners(id) ON DELETE CASCADE,
  previous_assignment_id uuid REFERENCES public.student_pathway_assignments(id) ON DELETE SET NULL,
  new_assignment_id uuid REFERENCES public.student_pathway_assignments(id) ON DELETE SET NULL,
  previous_pathway_id uuid REFERENCES public.senior_pathways(id) ON DELETE SET NULL,
  new_pathway_id uuid REFERENCES public.senior_pathways(id) ON DELETE SET NULL,
  reason text NOT NULL,
  changed_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX subject_combinations_track_idx
  ON public.subject_combinations (school_id, pathway_id, track_id, status);
CREATE INDEX combination_learning_areas_area_idx
  ON public.subject_combination_learning_areas (learning_area_id);
CREATE INDEX learners_senior_pathway_idx
  ON public.learners (school_id, senior_school_pathway_id, current_grade);

-- Representative starter configuration only; schools can revise it without
-- an application deployment as their curriculum is finalized.
INSERT INTO public.pathway_tracks (school_id, pathway_id, name, code, description)
SELECT p.school_id, p.id, track.name, track.code, track.description
FROM public.senior_pathways p
JOIN (VALUES
  ('STEM', 'PURE_SCIENCES', 'Pure Sciences', 'Mathematics and natural sciences'),
  ('STEM', 'APPLIED_SCIENCES', 'Applied Sciences', 'Technology and applied sciences'),
  ('SOCIAL_SCIENCES', 'HUMANITIES_BUSINESS', 'Humanities and Business', 'Humanities, languages and business'),
  ('ARTS_SPORTS', 'ARTS_SPORTS', 'Arts and Sports', 'Creative, performing arts and sports')
) AS track(pathway_code, code, name, description) ON track.pathway_code = p.code
ON CONFLICT (pathway_id, code) DO NOTHING;

INSERT INTO public.learning_areas (school_id, name, code, grades, is_core, education_level)
SELECT s.id, area.name, area.code, ARRAY['G10','G11','G12']::public.cbe_grade[], area.is_core,
  'senior_school'::public.cbe_level
FROM public.schools s
CROSS JOIN (VALUES
  ('Mathematics', 'MATH', true), ('English', 'ENG', true),
  ('Kiswahili', 'KIS', true), ('Physics', 'PHY', false),
  ('Chemistry', 'CHEM', false), ('Biology', 'BIO', false),
  ('Business Studies', 'BUS', false), ('Computer Science', 'CS', false),
  ('Music', 'MUS', false), ('Sports Science', 'SPORT', false)
) AS area(name, code, is_core)
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.validate_senior_combination_links()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.senior_pathways p
    JOIN public.pathway_tracks t ON t.pathway_id = p.id
    WHERE p.id = NEW.pathway_id AND t.id = NEW.track_id
      AND p.school_id = NEW.school_id AND t.school_id = NEW.school_id
  ) THEN
    RAISE EXCEPTION 'Subject combination pathway and track must belong to the same school';
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_subject_combinations_tenant
  BEFORE INSERT OR UPDATE ON public.subject_combinations
  FOR EACH ROW EXECUTE FUNCTION public.validate_senior_combination_links();

CREATE OR REPLACE FUNCTION public.validate_senior_assignment_links()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.grade NOT IN ('G10', 'G11', 'G12') THEN
    RAISE EXCEPTION 'Senior School assignments are only valid for Grades 10 to 12';
  END IF;
  IF NEW.subject_combination_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.subject_combinations c
    WHERE c.id = NEW.subject_combination_id AND c.school_id = NEW.school_id
      AND c.pathway_id = NEW.pathway_id AND c.track_id = NEW.track_id
      AND c.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Subject combination must belong to the selected pathway and track';
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_senior_assignment_links
  BEFORE INSERT OR UPDATE ON public.student_pathway_assignments
  FOR EACH ROW EXECUTE FUNCTION public.validate_senior_assignment_links();

CREATE OR REPLACE FUNCTION public.assign_senior_school_placement(
  _school_id uuid,
  _learner_id uuid,
  _academic_year_id uuid,
  _pathway_id uuid,
  _track_id uuid,
  _combination_id uuid,
  _stream_id uuid,
  _learning_area_ids uuid[],
  _reason text DEFAULT 'Grade 9 transition'
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  assignment_id uuid;
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

  INSERT INTO public.student_pathway_assignments (
    school_id, learner_id, academic_year_id, grade, pathway_id, track_id,
    subject_combination_id, status, approved_by, approved_at, change_reason
  ) VALUES (
    _school_id, _learner_id, _academic_year_id, 'G10', _pathway_id, _track_id,
    _combination_id, 'current', auth.uid(), now(), _reason
  ) RETURNING id INTO assignment_id;

  INSERT INTO public.student_learning_area_enrollments
    (school_id, learner_id, assignment_id, learning_area_id)
  SELECT _school_id, _learner_id, v.assignment_id, area_id
  FROM (SELECT assignment_id) AS v
  CROSS JOIN unnest(_learning_area_ids) AS area_id
  ON CONFLICT (assignment_id, learning_area_id) DO NOTHING;

  UPDATE public.learners
  SET current_grade = 'G10', current_stream_id = _stream_id,
      senior_school_pathway_id = _pathway_id, senior_school_track_id = _track_id,
      senior_school_combination_id = _combination_id,
      pathway_selection_status = 'approved', pathway_selected_at = now()
  WHERE id = _learner_id AND school_id = _school_id;
  RETURN assignment_id;
END; $$;

GRANT SELECT, INSERT, UPDATE ON public.subject_combinations,
  public.subject_combination_learning_areas, public.senior_pathway_change_audit TO authenticated;
GRANT ALL ON public.subject_combinations,
  public.subject_combination_learning_areas, public.senior_pathway_change_audit TO service_role;
GRANT EXECUTE ON FUNCTION public.assign_senior_school_placement(uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid[], text) TO authenticated;

ALTER TABLE public.subject_combinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subject_combination_learning_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.senior_pathway_change_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY subject_combinations_select ON public.subject_combinations FOR SELECT TO authenticated
  USING (public.is_school_member(school_id) OR public.is_super_admin());
CREATE POLICY subject_combinations_write ON public.subject_combinations FOR ALL TO authenticated
  USING (public.is_school_admin(school_id) OR public.is_super_admin())
  WITH CHECK (public.is_school_admin(school_id) OR public.is_super_admin());
CREATE POLICY combination_learning_areas_select ON public.subject_combination_learning_areas FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.subject_combinations c WHERE c.id = subject_combination_id
    AND (public.is_school_member(c.school_id) OR public.is_super_admin())));
CREATE POLICY combination_learning_areas_write ON public.subject_combination_learning_areas FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.subject_combinations c WHERE c.id = subject_combination_id
    AND (public.is_school_admin(c.school_id) OR public.is_super_admin())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.subject_combinations c WHERE c.id = subject_combination_id
    AND (public.is_school_admin(c.school_id) OR public.is_super_admin())));
CREATE POLICY pathway_change_audit_select ON public.senior_pathway_change_audit FOR SELECT TO authenticated
  USING (public.is_school_member(school_id) OR public.is_super_admin());
CREATE POLICY pathway_change_audit_insert ON public.senior_pathway_change_audit FOR INSERT TO authenticated
  WITH CHECK (public.is_school_admin(school_id) OR public.is_super_admin());

CREATE TRIGGER trg_subject_combinations_updated BEFORE UPDATE ON public.subject_combinations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();