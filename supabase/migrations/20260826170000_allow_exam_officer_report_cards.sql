-- Exam officers may generate and maintain draft report cards.
DROP POLICY IF EXISTS rc_teacher_select ON public.report_cards;
CREATE POLICY rc_teacher_select ON public.report_cards FOR SELECT TO authenticated
USING (
  public.is_super_admin()
  OR public.is_exam_officer(school_id)
  OR public.teacher_can_access_learner(school_id, learner_id, 'view_results')
);

DROP POLICY IF EXISTS rc_teacher_insert ON public.report_cards;
CREATE POLICY rc_teacher_insert ON public.report_cards FOR INSERT TO authenticated
WITH CHECK (
  public.is_super_admin()
  OR public.is_exam_officer(school_id)
  OR public.teacher_can_access_learner(school_id, learner_id, 'generate_report_cards')
);

DROP POLICY IF EXISTS rc_teacher_update ON public.report_cards;
CREATE POLICY rc_teacher_update ON public.report_cards FOR UPDATE TO authenticated
USING (
  public.is_super_admin()
  OR public.is_exam_officer(school_id)
  OR public.teacher_can_access_learner(school_id, learner_id, 'generate_report_cards')
)
WITH CHECK (
  public.is_super_admin()
  OR public.is_exam_officer(school_id)
  OR public.teacher_can_access_learner(school_id, learner_id, 'generate_report_cards')
);