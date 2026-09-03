DROP POLICY IF EXISTS fi_insert ON public.fee_items;
CREATE POLICY fi_insert ON public.fee_items FOR INSERT TO authenticated
  WITH CHECK (
    public.has_school_role(
      school_id,
      ARRAY['admin','principal','deputy']::public.app_role[]
    )
    OR public.is_super_admin()
  );

DROP POLICY IF EXISTS fi_update ON public.fee_items;
CREATE POLICY fi_update ON public.fee_items FOR UPDATE TO authenticated
  USING (
    public.has_school_role(
      school_id,
      ARRAY['admin','principal','deputy']::public.app_role[]
    )
    OR public.is_super_admin()
  )
  WITH CHECK (
    public.has_school_role(
      school_id,
      ARRAY['admin','principal','deputy']::public.app_role[]
    )
    OR public.is_super_admin()
  );

DROP POLICY IF EXISTS inv_insert ON public.invoices;
CREATE POLICY inv_insert ON public.invoices FOR INSERT TO authenticated
  WITH CHECK (
    public.has_school_role(
      school_id,
      ARRAY['admin','principal','deputy']::public.app_role[]
    )
    OR public.is_super_admin()
  );

DROP POLICY IF EXISTS inv_update ON public.invoices;
CREATE POLICY inv_update ON public.invoices FOR UPDATE TO authenticated
  USING (
    public.has_school_role(
      school_id,
      ARRAY['admin','principal','deputy']::public.app_role[]
    )
    OR public.is_super_admin()
  )
  WITH CHECK (
    public.has_school_role(
      school_id,
      ARRAY['admin','principal','deputy']::public.app_role[]
    )
    OR public.is_super_admin()
  );

DROP POLICY IF EXISTS ii_insert ON public.invoice_items;
CREATE POLICY ii_insert ON public.invoice_items FOR INSERT TO authenticated
  WITH CHECK (
    public.has_school_role(
      school_id,
      ARRAY['admin','principal','deputy']::public.app_role[]
    )
    OR public.is_super_admin()
  );

DROP POLICY IF EXISTS ii_update ON public.invoice_items;
CREATE POLICY ii_update ON public.invoice_items FOR UPDATE TO authenticated
  USING (
    public.has_school_role(
      school_id,
      ARRAY['admin','principal','deputy']::public.app_role[]
    )
    OR public.is_super_admin()
  )
  WITH CHECK (
    public.has_school_role(
      school_id,
      ARRAY['admin','principal','deputy']::public.app_role[]
    )
    OR public.is_super_admin()
  );

DROP POLICY IF EXISTS pay_insert ON public.payments;
CREATE POLICY pay_insert ON public.payments FOR INSERT TO authenticated
  WITH CHECK (
    public.has_school_role(
      school_id,
      ARRAY['admin','principal','deputy']::public.app_role[]
    )
    OR public.is_super_admin()
  );

DROP POLICY IF EXISTS pay_update ON public.payments;
CREATE POLICY pay_update ON public.payments FOR UPDATE TO authenticated
  USING (
    public.has_school_role(
      school_id,
      ARRAY['admin','principal','deputy']::public.app_role[]
    )
    OR public.is_super_admin()
  )
  WITH CHECK (
    public.has_school_role(
      school_id,
      ARRAY['admin','principal','deputy']::public.app_role[]
    )
    OR public.is_super_admin()
  );

DROP POLICY IF EXISTS inv_delete ON public.invoices;
CREATE POLICY inv_delete ON public.invoices FOR DELETE TO authenticated
  USING (
    public.has_school_role(
      school_id,
      ARRAY['admin','principal','deputy']::public.app_role[]
    )
    OR public.is_super_admin()
  );

DROP POLICY IF EXISTS ii_delete ON public.invoice_items;
CREATE POLICY ii_delete ON public.invoice_items FOR DELETE TO authenticated
  USING (
    public.has_school_role(
      school_id,
      ARRAY['admin','principal','deputy']::public.app_role[]
    )
    OR public.is_super_admin()
  );

DROP POLICY IF EXISTS fi_delete ON public.fee_items;
CREATE POLICY fi_delete ON public.fee_items FOR DELETE TO authenticated
  USING (
    public.has_school_role(
      school_id,
      ARRAY['admin','principal','deputy']::public.app_role[]
    )
    OR public.is_super_admin()
  );