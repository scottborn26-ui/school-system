-- Repair for databases where the teacher RBAC migration is already applied.
-- Staff accounts may only be created or edited by school administrators.
DROP POLICY IF EXISTS staff_member_insert ON public.staff;
CREATE POLICY staff_admin_insert ON public.staff FOR INSERT TO authenticated
WITH CHECK (
  public.is_super_admin()
  OR public.has_school_role(school_id, ARRAY['principal','deputy']::public.app_role[])
);

DROP POLICY IF EXISTS staff_admin_update ON public.staff;
CREATE POLICY staff_admin_update ON public.staff FOR UPDATE TO authenticated
USING (
  public.is_super_admin()
  OR public.has_school_role(school_id, ARRAY['principal','deputy']::public.app_role[])
)
WITH CHECK (
  public.is_super_admin()
  OR public.has_school_role(school_id, ARRAY['principal','deputy']::public.app_role[])
);