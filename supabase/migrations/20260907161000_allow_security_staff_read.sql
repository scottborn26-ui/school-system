DROP POLICY IF EXISTS staff_scoped_read ON public.staff;
CREATE POLICY staff_scoped_read ON public.staff FOR SELECT TO authenticated
USING (
  public.is_super_admin()
  OR public.has_school_role(school_id, ARRAY['admin','principal','deputy','security']::public.app_role[])
  OR user_id = auth.uid()
);
