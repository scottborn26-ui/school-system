-- Senior School configuration and Grade 9 transition records.
-- All records are school-scoped so curriculum configuration cannot cross tenants.

CREATE TABLE public.senior_pathways (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text NOT NULL,
  description text,
  grades public.cbe_grade[] NOT NULL DEFAULT ARRAY['G10','G11','G12']::public.cbe_grade[],
  is_active boolean NOT NULL DEFAULT true,
  effective_from date,
  effective_to date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, code)
);

CREATE TABLE public.pathway_tracks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  pathway_id uuid NOT NULL REFERENCES public.senior_pathways(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pathway_id, code)
);

CREATE TABLE public.pathway_strands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  track_id uuid NOT NULL REFERENCES public.pathway_tracks(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (track_id, code)
);

CREATE TABLE public.senior_learning_area_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  learning_area_id uuid NOT NULL REFERENCES public.learning_areas(id) ON DELETE CASCADE,
  pathway_id uuid REFERENCES public.senior_pathways(id) ON DELETE CASCADE,
  track_id uuid REFERENCES public.pathway_tracks(id) ON DELETE CASCADE,
  strand_id uuid REFERENCES public.pathway_strands(id) ON DELETE CASCADE,
  is_compulsory boolean NOT NULL DEFAULT false,
  min_selections integer NOT NULL DEFAULT 0 CHECK (min_selections >= 0),
  max_selections integer CHECK (max_selections IS NULL OR max_selections >= min_selections),
  assessment_type text NOT NULL DEFAULT 'numeric',
  grading_system text NOT NULL DEFAULT 'percentage',
  weighting numeric CHECK (weighting IS NULL OR weighting >= 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (learning_area_id, pathway_id, track_id, strand_id)
);

ALTER TABLE public.learning_areas
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS education_level public.cbe_level,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

CREATE TABLE public.student_pathway_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  learner_id uuid NOT NULL REFERENCES public.learners(id) ON DELETE CASCADE,
  academic_year_id uuid REFERENCES public.academic_years(id) ON DELETE SET NULL,
  preference_rank integer NOT NULL CHECK (preference_rank BETWEEN 1 AND 3),
  pathway_id uuid NOT NULL REFERENCES public.senior_pathways(id),
  track_id uuid REFERENCES public.pathway_tracks(id),
  strand_id uuid REFERENCES public.pathway_strands(id),
  preferred_learning_area_ids uuid[] NOT NULL DEFAULT '{}',
  parent_input text,
  teacher_recommendation text,
  counselling_notes text,
  career_aspirations text,
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('draft','submitted','approved','declined')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (learner_id, academic_year_id, preference_rank)
);

CREATE TABLE public.student_pathway_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  learner_id uuid NOT NULL REFERENCES public.learners(id) ON DELETE CASCADE,
  academic_year_id uuid NOT NULL REFERENCES public.academic_years(id) ON DELETE CASCADE,
  grade public.cbe_grade NOT NULL,
  pathway_id uuid NOT NULL REFERENCES public.senior_pathways(id),
  track_id uuid REFERENCES public.pathway_tracks(id),
  strand_id uuid REFERENCES public.pathway_strands(id),
  status text NOT NULL DEFAULT 'current' CHECK (status IN ('current','previous','superseded')),
  approved_by uuid,
  approved_at timestamptz,
  change_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX student_pathway_one_current
  ON public.student_pathway_assignments (learner_id, academic_year_id) WHERE status = 'current';

CREATE TABLE public.student_learning_area_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  learner_id uuid NOT NULL REFERENCES public.learners(id) ON DELETE CASCADE,
  assignment_id uuid NOT NULL REFERENCES public.student_pathway_assignments(id) ON DELETE CASCADE,
  learning_area_id uuid NOT NULL REFERENCES public.learning_areas(id),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (assignment_id, learning_area_id)
);

CREATE TABLE public.tvet_transitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  learner_id uuid NOT NULL REFERENCES public.learners(id) ON DELETE CASCADE,
  completion_grade public.cbe_grade NOT NULL DEFAULT 'G9',
  completion_year integer NOT NULL,
  institution_name text,
  institution_id text,
  course_trade text,
  training_area text,
  qualification_level text,
  intake_period text,
  admission_status text NOT NULL DEFAULT 'pending' CHECK (admission_status IN ('pending','applied','admitted','declined','enrolled')),
  reporting_date date,
  funding_sponsorship text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX senior_pathways_school_idx ON public.senior_pathways (school_id, is_active);
CREATE INDEX pathway_tracks_pathway_idx ON public.pathway_tracks (pathway_id, is_active);
CREATE INDEX pathway_strands_track_idx ON public.pathway_strands (track_id, is_active);
CREATE INDEX senior_rules_school_idx ON public.senior_learning_area_rules (school_id, is_active);
CREATE INDEX pathway_assignments_learner_idx ON public.student_pathway_assignments (learner_id, created_at DESC);
CREATE INDEX tvet_transitions_learner_idx ON public.tvet_transitions (learner_id, completion_year DESC);

INSERT INTO public.senior_pathways (school_id, name, code, description)
SELECT s.id, pathway.name, pathway.code, pathway.description
FROM public.schools s
CROSS JOIN (VALUES
  ('STEM', 'STEM', 'Science, Technology, Engineering and Mathematics'),
  ('Social Sciences', 'SOCIAL_SCIENCES', 'Languages, humanities, business and social studies'),
  ('Arts and Sports Science', 'ARTS_SPORTS', 'Creative, performing and sports sciences')
) AS pathway(name, code, description)
ON CONFLICT (school_id, code) DO NOTHING;

CREATE OR REPLACE FUNCTION public.validate_senior_school_tenant_links()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME = 'pathway_tracks' AND NOT EXISTS (
    SELECT 1 FROM public.senior_pathways WHERE id = NEW.pathway_id AND school_id = NEW.school_id
  ) THEN RAISE EXCEPTION 'Pathway must belong to the same school'; END IF;
  IF TG_TABLE_NAME = 'pathway_strands' AND NOT EXISTS (
    SELECT 1 FROM public.pathway_tracks WHERE id = NEW.track_id AND school_id = NEW.school_id
  ) THEN RAISE EXCEPTION 'Track must belong to the same school'; END IF;
  IF TG_TABLE_NAME = 'senior_learning_area_rules' AND (
    (NEW.pathway_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.senior_pathways WHERE id = NEW.pathway_id AND school_id = NEW.school_id)) OR
    (NEW.track_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.pathway_tracks WHERE id = NEW.track_id AND school_id = NEW.school_id)) OR
    (NEW.strand_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.pathway_strands WHERE id = NEW.strand_id AND school_id = NEW.school_id))
  ) THEN RAISE EXCEPTION 'Senior School rule references another school'; END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_pathway_tracks_tenant BEFORE INSERT OR UPDATE ON public.pathway_tracks
  FOR EACH ROW EXECUTE FUNCTION public.validate_senior_school_tenant_links();
CREATE TRIGGER trg_pathway_strands_tenant BEFORE INSERT OR UPDATE ON public.pathway_strands
  FOR EACH ROW EXECUTE FUNCTION public.validate_senior_school_tenant_links();
CREATE TRIGGER trg_senior_rules_tenant BEFORE INSERT OR UPDATE ON public.senior_learning_area_rules
  FOR EACH ROW EXECUTE FUNCTION public.validate_senior_school_tenant_links();

GRANT SELECT, INSERT, UPDATE ON public.senior_pathways, public.pathway_tracks, public.pathway_strands,
  public.senior_learning_area_rules, public.student_pathway_preferences,
  public.student_pathway_assignments, public.student_learning_area_enrollments, public.tvet_transitions
  TO authenticated;
GRANT ALL ON public.senior_pathways, public.pathway_tracks, public.pathway_strands,
  public.senior_learning_area_rules, public.student_pathway_preferences,
  public.student_pathway_assignments, public.student_learning_area_enrollments, public.tvet_transitions
  TO service_role;

ALTER TABLE public.senior_pathways ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pathway_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pathway_strands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.senior_learning_area_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_pathway_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_pathway_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_learning_area_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tvet_transitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY senior_pathways_select ON public.senior_pathways FOR SELECT TO authenticated
  USING (public.is_school_member(school_id) OR public.is_super_admin());
CREATE POLICY senior_pathways_write ON public.senior_pathways FOR ALL TO authenticated
  USING (public.is_school_admin(school_id) OR public.is_super_admin())
  WITH CHECK (public.is_school_admin(school_id) OR public.is_super_admin());

CREATE POLICY pathway_tracks_select ON public.pathway_tracks FOR SELECT TO authenticated
  USING (public.is_school_member(school_id) OR public.is_super_admin());
CREATE POLICY pathway_tracks_write ON public.pathway_tracks FOR ALL TO authenticated
  USING (public.is_school_admin(school_id) OR public.is_super_admin())
  WITH CHECK (public.is_school_admin(school_id) OR public.is_super_admin());

CREATE POLICY pathway_strands_select ON public.pathway_strands FOR SELECT TO authenticated
  USING (public.is_school_member(school_id) OR public.is_super_admin());
CREATE POLICY pathway_strands_write ON public.pathway_strands FOR ALL TO authenticated
  USING (public.is_school_admin(school_id) OR public.is_super_admin())
  WITH CHECK (public.is_school_admin(school_id) OR public.is_super_admin());

CREATE POLICY senior_rules_select ON public.senior_learning_area_rules FOR SELECT TO authenticated
  USING (public.is_school_member(school_id) OR public.is_super_admin());
CREATE POLICY senior_rules_write ON public.senior_learning_area_rules FOR ALL TO authenticated
  USING (public.is_school_admin(school_id) OR public.is_super_admin())
  WITH CHECK (public.is_school_admin(school_id) OR public.is_super_admin());

CREATE POLICY pathway_preferences_select ON public.student_pathway_preferences FOR SELECT TO authenticated
  USING (public.is_school_member(school_id) OR public.is_super_admin());
CREATE POLICY pathway_preferences_write ON public.student_pathway_preferences FOR ALL TO authenticated
  USING (public.is_school_admin(school_id) OR public.is_super_admin())
  WITH CHECK (public.is_school_admin(school_id) OR public.is_super_admin());

CREATE POLICY pathway_assignments_select ON public.student_pathway_assignments FOR SELECT TO authenticated
  USING (public.is_school_member(school_id) OR public.is_super_admin());
CREATE POLICY pathway_assignments_write ON public.student_pathway_assignments FOR ALL TO authenticated
  USING (public.is_school_admin(school_id) OR public.is_super_admin())
  WITH CHECK (public.is_school_admin(school_id) OR public.is_super_admin());

CREATE POLICY learning_area_enrollments_select ON public.student_learning_area_enrollments FOR SELECT TO authenticated
  USING (public.is_school_member(school_id) OR public.is_super_admin());
CREATE POLICY learning_area_enrollments_write ON public.student_learning_area_enrollments FOR ALL TO authenticated
  USING (public.is_school_admin(school_id) OR public.is_super_admin())
  WITH CHECK (public.is_school_admin(school_id) OR public.is_super_admin());

CREATE POLICY tvet_transitions_select ON public.tvet_transitions FOR SELECT TO authenticated
  USING (public.is_school_member(school_id) OR public.is_super_admin());
CREATE POLICY tvet_transitions_write ON public.tvet_transitions FOR ALL TO authenticated
  USING (public.is_school_admin(school_id) OR public.is_super_admin())
  WITH CHECK (public.is_school_admin(school_id) OR public.is_super_admin());

CREATE TRIGGER trg_senior_pathways_updated BEFORE UPDATE ON public.senior_pathways
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_pathway_tracks_updated BEFORE UPDATE ON public.pathway_tracks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_pathway_strands_updated BEFORE UPDATE ON public.pathway_strands
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_tvet_transitions_updated BEFORE UPDATE ON public.tvet_transitions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();