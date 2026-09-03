-- Finance users who can write records must also be able to read them.
DROP POLICY IF EXISTS pay_select ON public.payments;
CREATE POLICY pay_select ON public.payments FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR public.is_school_member(school_id)
    OR public.has_school_role(
      school_id,
      ARRAY['admin','principal','deputy']::public.app_role[]
    )
  );

DROP POLICY IF EXISTS inv_select ON public.invoices;
CREATE POLICY inv_select ON public.invoices FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR public.is_school_member(school_id)
    OR public.has_school_role(
      school_id,
      ARRAY['admin','principal','deputy']::public.app_role[]
    )
  );

DROP POLICY IF EXISTS le_select ON public.ledger_entries;
CREATE POLICY le_select ON public.ledger_entries FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR public.is_school_member(school_id)
    OR public.has_school_role(
      school_id,
      ARRAY['admin','principal','deputy']::public.app_role[]
    )
  );