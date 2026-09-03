-- Exam Officers own school-wide assessment administration. Teachers retain marks entry only.
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'admin';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'exam_officer';

CREATE OR REPLACE FUNCTION public.is_school_admin(_school_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_school_role(_school_id, ARRAY['admin','principal','deputy']::public.app_role[]);
$$;

CREATE OR REPLACE FUNCTION public.is_exam_officer(_school_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_super_admin()
    OR public.has_school_role(_school_id, ARRAY['admin','principal','deputy','exam_officer']::public.app_role[]);
$$;
GRANT EXECUTE ON FUNCTION public.is_exam_officer(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS as_teacher_insert ON public.assessments;
CREATE POLICY as_exam_officer_insert ON public.assessments FOR INSERT TO authenticated
WITH CHECK (public.is_exam_officer(school_id));

DROP POLICY IF EXISTS as_teacher_update ON public.assessments;
CREATE POLICY as_exam_officer_update ON public.assessments FOR UPDATE TO authenticated
USING (public.is_exam_officer(school_id))
WITH CHECK (public.is_exam_officer(school_id));

DROP POLICY IF EXISTS as_teacher_select ON public.assessments;
CREATE POLICY as_teacher_select ON public.assessments FOR SELECT TO authenticated
USING (
  public.is_exam_officer(school_id)
  OR EXISTS (
    SELECT 1
    FROM public.staff st
    JOIN public.teacher_allocations ta ON ta.staff_id = st.id
    WHERE st.user_id = auth.uid() AND st.school_id = assessments.school_id
      AND st.is_archived = false AND st.status = 'active' AND ta.is_active
      AND (assessments.stream_id IS NULL OR ta.stream_id = assessments.stream_id)
      AND ta.learning_area_id = assessments.learning_area_id
      AND (ta.academic_year_id IS NULL OR ta.academic_year_id = assessments.academic_year_id)
      AND public.teacher_has_permission(assessments.school_id, 'view_results', assessments.academic_year_id, assessments.grade, assessments.stream_id, assessments.learning_area_id)
  )
);

CREATE OR REPLACE FUNCTION public.guard_assessment_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status IN ('approved','locked')
       AND NOT public.is_exam_officer(NEW.school_id) THEN
      RAISE EXCEPTION 'Only an Exam Officer or administrator can approve or lock an assessment';
    END IF;
    IF OLD.status = 'locked' AND NOT public.is_super_admin() AND NOT public.is_exam_officer(NEW.school_id) THEN
      RAISE EXCEPTION 'A locked assessment cannot be reopened';
    END IF;
    IF NEW.status IN ('approved','locked') AND NEW.approved_at IS NULL THEN
      NEW.approved_at := now();
      NEW.approved_by := auth.uid();
    END IF;
  END IF;
  RETURN NEW;
END; $$;

DROP POLICY IF EXISTS as_delete ON public.assessments;
CREATE POLICY as_exam_officer_delete ON public.assessments FOR DELETE TO authenticated
USING (public.is_exam_officer(school_id));
