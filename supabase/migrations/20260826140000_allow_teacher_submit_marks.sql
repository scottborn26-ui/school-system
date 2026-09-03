-- Teachers may submit their own assessments, but cannot approve or lock them.
DROP POLICY IF EXISTS as_teacher_submit ON public.assessments;
CREATE POLICY as_teacher_submit ON public.assessments FOR UPDATE TO authenticated
USING (
  created_by = auth.uid()
  AND status IN ('draft', 'submitted')
  AND public.teacher_has_permission(school_id, 'enter_marks', academic_year_id, grade, stream_id, learning_area_id)
)
WITH CHECK (
  created_by = auth.uid()
  AND status IN ('draft', 'submitted')
  AND public.teacher_has_permission(school_id, 'enter_marks', academic_year_id, grade, stream_id, learning_area_id)
);
