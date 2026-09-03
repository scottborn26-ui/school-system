DROP POLICY IF EXISTS "staff_attendance_self_insert" ON public.staff_attendance;
CREATE POLICY "staff_attendance_self_insert" ON public.staff_attendance FOR INSERT TO authenticated
WITH CHECK (
  public.is_super_admin()
  OR public.has_school_role(school_id, ARRAY['admin','principal','deputy']::public.app_role[])
  OR EXISTS (
    SELECT 1 FROM public.staff s
    WHERE s.id = staff_id AND s.user_id = auth.uid() AND s.school_id = staff_attendance.school_id
  )
);

DROP POLICY IF EXISTS "staff_attendance_update" ON public.staff_attendance;
CREATE POLICY "staff_attendance_update" ON public.staff_attendance FOR UPDATE TO authenticated
USING (
  public.is_super_admin()
  OR public.has_school_role(school_id, ARRAY['admin','principal','deputy']::public.app_role[])
)
WITH CHECK (
  public.is_super_admin()
  OR public.has_school_role(school_id, ARRAY['admin','principal','deputy']::public.app_role[])
);