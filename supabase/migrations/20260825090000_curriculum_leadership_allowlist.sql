-- Curriculum configuration is restricted to school leadership roles.
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'admin' AFTER 'super_admin';

CREATE OR REPLACE FUNCTION public.is_school_admin(_school_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.has_school_role(
    _school_id,
    ARRAY['admin','principal','deputy']::public.app_role[]
  );
$$;

DROP POLICY IF EXISTS la_select ON public.learning_areas;
CREATE POLICY la_select ON public.learning_areas FOR SELECT TO authenticated
  USING (public.is_school_admin(school_id) OR public.is_super_admin());

DROP POLICY IF EXISTS ta_select ON public.teacher_allocations;
CREATE POLICY ta_select ON public.teacher_allocations FOR SELECT TO authenticated
  USING (public.is_school_admin(school_id) OR public.is_super_admin());

DROP POLICY IF EXISTS senior_pathways_select ON public.senior_pathways;
CREATE POLICY senior_pathways_select ON public.senior_pathways FOR SELECT TO authenticated
  USING (public.is_school_admin(school_id) OR public.is_super_admin());
DROP POLICY IF EXISTS pathway_tracks_select ON public.pathway_tracks;
CREATE POLICY pathway_tracks_select ON public.pathway_tracks FOR SELECT TO authenticated
  USING (public.is_school_admin(school_id) OR public.is_super_admin());
DROP POLICY IF EXISTS pathway_strands_select ON public.pathway_strands;
CREATE POLICY pathway_strands_select ON public.pathway_strands FOR SELECT TO authenticated
  USING (public.is_school_admin(school_id) OR public.is_super_admin());
DROP POLICY IF EXISTS senior_rules_select ON public.senior_learning_area_rules;
CREATE POLICY senior_rules_select ON public.senior_learning_area_rules FOR SELECT TO authenticated
  USING (public.is_school_admin(school_id) OR public.is_super_admin());

DROP POLICY IF EXISTS subject_combinations_select ON public.subject_combinations;
CREATE POLICY subject_combinations_select ON public.subject_combinations FOR SELECT TO authenticated
  USING (public.is_school_admin(school_id) OR public.is_super_admin());
DROP POLICY IF EXISTS combination_learning_areas_select ON public.subject_combination_learning_areas;
CREATE POLICY combination_learning_areas_select ON public.subject_combination_learning_areas FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.subject_combinations c
    WHERE c.id = subject_combination_id
      AND (public.is_school_admin(c.school_id) OR public.is_super_admin())
  ));