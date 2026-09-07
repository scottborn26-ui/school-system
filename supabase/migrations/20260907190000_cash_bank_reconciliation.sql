CREATE TABLE public.cash_reconciliations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.chart_of_accounts(id),
  statement_date date NOT NULL,
  statement_balance numeric NOT NULL,
  notes text,
  reconciled_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.cash_reconciliations TO authenticated;
GRANT ALL ON public.cash_reconciliations TO service_role;
ALTER TABLE public.cash_reconciliations ENABLE ROW LEVEL SECURITY;

CREATE POLICY cash_reconciliations_select ON public.cash_reconciliations
  FOR SELECT TO authenticated
  USING (public.is_school_member(school_id) OR public.is_super_admin());
CREATE POLICY cash_reconciliations_insert ON public.cash_reconciliations
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_school_role(school_id, ARRAY['admin','accountant','principal','deputy']::public.app_role[])
    OR public.is_super_admin()
  );