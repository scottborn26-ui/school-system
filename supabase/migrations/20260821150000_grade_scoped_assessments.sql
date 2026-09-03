-- Grade-scoped assessments resolve streams dynamically through the learner's current stream.
-- Existing stream-scoped assessments remain valid and continue to be readable.
DROP POLICY IF EXISTS as_teacher_insert ON public.assessments;
CREATE POLICY as_teacher_insert ON public.assessments FOR INSERT TO authenticated
WITH CHECK (
  public.is_super_admin()
  OR public.is_school_admin(school_id)
  OR (
    created_by = auth.uid()
    AND public.teacher_has_permission(school_id, 'enter_marks', academic_year_id, grade, NULL, learning_area_id)
    AND EXISTS (
      SELECT 1
      FROM public.staff st
      JOIN public.teacher_allocations ta ON ta.staff_id = st.id
      JOIN public.streams stream ON stream.id = ta.stream_id
      WHERE st.user_id = auth.uid()
        AND st.school_id = assessments.school_id
        AND st.is_archived = false
        AND st.status = 'active'
        AND ta.school_id = assessments.school_id
        AND ta.is_active
        AND ta.learning_area_id = assessments.learning_area_id
        AND stream.grade = assessments.grade
        AND (assessments.stream_id IS NULL OR ta.stream_id = assessments.stream_id)
    )
  )
);

DROP POLICY IF EXISTS as_teacher_update ON public.assessments;
CREATE POLICY as_teacher_update ON public.assessments FOR UPDATE TO authenticated
USING (
  public.is_super_admin()
  OR public.is_school_admin(school_id)
  OR (created_by = auth.uid() AND public.teacher_has_permission(school_id, 'edit_marks', academic_year_id, grade, NULL, learning_area_id))
)
WITH CHECK (
  public.is_super_admin()
  OR public.is_school_admin(school_id)
  OR (created_by = auth.uid() AND public.teacher_has_permission(school_id, 'edit_marks', academic_year_id, grade, NULL, learning_area_id))
);

GRANT DELETE ON public.assessments TO authenticated;
DROP POLICY IF EXISTS as_delete ON public.assessments;
CREATE POLICY as_delete ON public.assessments FOR DELETE TO authenticated
USING (public.is_super_admin() OR public.is_school_admin(school_id));