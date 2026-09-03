-- Allow finance officers to permanently remove an incorrectly recorded payment.
GRANT DELETE ON public.payments TO authenticated;

CREATE POLICY "pay_delete" ON public.payments FOR DELETE TO authenticated
  USING (
    public.has_school_role(school_id, ARRAY['principal','deputy','bursar']::public.app_role[])
    OR public.is_super_admin()
  );