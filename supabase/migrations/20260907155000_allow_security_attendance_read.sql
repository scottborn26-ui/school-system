DROP POLICY IF EXISTS "staff_attendance_read" ON public.staff_attendance;
CREATE POLICY "staff_attendance_read" ON public.staff_attendance FOR SELECT TO authenticated
USING (
  public.is_super_admin()
  OR public.has_school_role(school_id, ARRAY['admin','principal','deputy','security']::public.app_role[])
  OR EXISTS (
    SELECT 1
    FROM public.staff s
    WHERE s.id = staff_attendance.staff_id
      AND s.user_id = auth.uid()
  )
);
