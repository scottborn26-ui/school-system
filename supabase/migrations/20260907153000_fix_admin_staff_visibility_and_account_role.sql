DROP POLICY IF EXISTS staff_scoped_read ON public.staff;
CREATE POLICY staff_scoped_read ON public.staff FOR SELECT TO authenticated
USING (
  public.is_super_admin()
  OR public.has_school_role(school_id, ARRAY['admin','principal','deputy']::public.app_role[])
  OR user_id = auth.uid()
);

UPDATE public.staff s
SET account_role = ur.role::text,
    updated_at = now()
FROM public.user_roles ur
WHERE ur.user_id = s.user_id
  AND ur.school_id = s.school_id
  AND ur.is_active = true
  AND (s.account_role IS NULL OR s.account_role <> ur.role::text);
