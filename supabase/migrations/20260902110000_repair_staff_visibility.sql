-- Restore staff visibility when an older database is missing the role helper.
CREATE OR REPLACE FUNCTION public.has_school_role(
  _school_id uuid,
  _roles public.app_role[]
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles r
    WHERE r.user_id = auth.uid()
      AND r.school_id = _school_id
      AND r.is_active = true
      AND r.role = ANY(_roles)
  );
$$;

GRANT EXECUTE ON FUNCTION public.has_school_role(uuid, public.app_role[])
  TO authenticated, service_role;

DROP POLICY IF EXISTS staff_scoped_read ON public.staff;
CREATE POLICY staff_scoped_read ON public.staff FOR SELECT TO authenticated
USING (
  public.is_super_admin()
  OR public.has_school_role(school_id, ARRAY['principal','deputy']::public.app_role[])
  OR user_id = auth.uid()
);
