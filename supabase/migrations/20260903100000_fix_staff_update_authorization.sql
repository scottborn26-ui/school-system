-- Keep staff updates aligned with the shared school-admin authorization rule.
DROP POLICY IF EXISTS staff_admin_update ON public.staff;
CREATE POLICY staff_admin_update ON public.staff FOR UPDATE TO authenticated
USING (
  public.is_super_admin()
  OR public.is_school_admin(school_id)
)
WITH CHECK (
  public.is_super_admin()
  OR public.is_school_admin(school_id)
);
