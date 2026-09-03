-- Exam officers need school-wide stream visibility for assessment approvals.
DROP POLICY IF EXISTS streams_scoped_read ON public.streams;
CREATE POLICY streams_scoped_read ON public.streams FOR SELECT TO authenticated
USING (
  public.is_super_admin()
  OR public.is_exam_officer(school_id)
  OR (
    public.is_school_member(school_id)
    AND EXISTS (
      SELECT 1 FROM public.staff st
      JOIN public.teacher_allocations ta ON ta.staff_id = st.id
      WHERE st.user_id = auth.uid()
        AND st.school_id = streams.school_id
        AND st.is_archived = false
        AND st.status = 'active'
        AND ta.stream_id = streams.id
        AND ta.is_active
    )
  )
);

-- Exam officers need marks visibility to show assessment completion progress.
DROP POLICY IF EXISTS mk_teacher_select ON public.marks;
CREATE POLICY mk_teacher_select ON public.marks FOR SELECT TO authenticated
USING (
  public.is_super_admin()
  OR public.is_exam_officer(school_id)
  OR EXISTS (
    SELECT 1 FROM public.assessments a
    WHERE a.id = marks.assessment_id
      AND public.teacher_can_access_learner(marks.school_id, marks.learner_id, 'view_results', a.learning_area_id)
  )
);

-- Exam officers may enter and amend marks during assessment administration.
DROP POLICY IF EXISTS mk_teacher_insert ON public.marks;
CREATE POLICY mk_teacher_insert ON public.marks FOR INSERT TO authenticated
WITH CHECK (
  (public.is_super_admin() OR public.is_exam_officer(school_id)
   OR EXISTS (
     SELECT 1 FROM public.assessments a
     WHERE a.id = marks.assessment_id
       AND a.status IN ('draft','submitted')
       AND public.teacher_can_access_learner(marks.school_id, marks.learner_id, 'enter_marks', a.learning_area_id)
   ))
  AND (entered_by IS NULL OR entered_by = auth.uid())
);

DROP POLICY IF EXISTS mk_teacher_update ON public.marks;
CREATE POLICY mk_teacher_update ON public.marks FOR UPDATE TO authenticated
USING (
  public.is_super_admin()
  OR public.is_exam_officer(school_id)
  OR (
    (entered_by = auth.uid() OR EXISTS (
      SELECT 1 FROM public.assessments a
      WHERE a.id = marks.assessment_id
        AND public.teacher_can_access_learner(marks.school_id, marks.learner_id, 'edit_marks', a.learning_area_id)
    ))
    AND EXISTS (SELECT 1 FROM public.assessments a WHERE a.id = marks.assessment_id AND a.status IN ('draft','submitted'))
  )
)
WITH CHECK (public.is_super_admin() OR public.is_exam_officer(school_id) OR entered_by = auth.uid());