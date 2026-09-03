-- Repair audit log deletion for all authorized school administrators.
DROP POLICY IF EXISTS audit_logs_admin_delete ON public.audit_logs;
CREATE POLICY audit_logs_admin_delete ON public.audit_logs FOR DELETE TO authenticated
USING (
  public.is_super_admin()
  OR public.is_school_admin(school_id)
);
