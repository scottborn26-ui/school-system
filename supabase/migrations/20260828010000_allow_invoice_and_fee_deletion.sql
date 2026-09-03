-- Allow finance officers to remove incorrect invoices and fee items.
GRANT DELETE ON public.invoices, public.invoice_items, public.fee_items TO authenticated;

CREATE POLICY "inv_delete" ON public.invoices FOR DELETE TO authenticated
  USING (
    public.has_school_role(school_id, ARRAY['principal','deputy','bursar']::public.app_role[])
    OR public.is_super_admin()
  );

CREATE POLICY "ii_delete" ON public.invoice_items FOR DELETE TO authenticated
  USING (
    public.has_school_role(school_id, ARRAY['principal','deputy','bursar']::public.app_role[])
    OR public.is_super_admin()
  );

CREATE POLICY "fi_delete" ON public.fee_items FOR DELETE TO authenticated
  USING (
    public.has_school_role(school_id, ARRAY['principal','deputy','bursar']::public.app_role[])
    OR public.is_super_admin()
  );