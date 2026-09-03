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