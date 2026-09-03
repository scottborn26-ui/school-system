-- Let class teachers discover the streams they own in learner views.
DROP POLICY IF EXISTS streams_scoped_read ON public.streams;
CREATE POLICY streams_scoped_read ON public.streams FOR SELECT TO authenticated
USING (
  public.is_super_admin()
  OR public.is_exam_officer(school_id)
  OR (
    public.is_school_member(school_id)
    AND EXISTS (
      SELECT 1
      FROM public.staff st
      WHERE st.user_id = auth.uid()
        AND st.school_id = streams.school_id
        AND st.id = streams.class_teacher_id
        AND st.is_archived = false
        AND st.status = 'active'
    )
  )
  OR (
    public.is_school_member(school_id)
    AND EXISTS (
      SELECT 1
      FROM public.staff st
      JOIN public.teacher_allocations ta ON ta.staff_id = st.id
      WHERE st.user_id = auth.uid()
        AND st.school_id = streams.school_id
        AND ta.stream_id = streams.id
        AND ta.is_active
    )
  )
);
