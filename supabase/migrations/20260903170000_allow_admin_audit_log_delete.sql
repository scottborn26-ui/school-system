-- Allow authorized audit administrators to remove audit entries.
DROP POLICY IF EXISTS audit_logs_admin_delete ON public.audit_logs;
CREATE POLICY audit_logs_admin_delete ON public.audit_logs FOR DELETE TO authenticated
USING (
  public.is_super_admin()
  OR public.has_school_role(school_id, ARRAY['principal']::public.app_role[])
);
