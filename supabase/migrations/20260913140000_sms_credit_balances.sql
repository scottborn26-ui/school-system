CREATE TABLE public.sms_credit_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  balance numeric NOT NULL DEFAULT 0 CHECK (balance >= 0),
  updated_by uuid REFERENCES auth.users(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id)
);

GRANT SELECT ON public.sms_credit_balances TO authenticated;
GRANT INSERT, UPDATE ON public.sms_credit_balances TO authenticated;
GRANT ALL ON public.sms_credit_balances TO service_role;
ALTER TABLE public.sms_credit_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY sms_credit_balances_read ON public.sms_credit_balances FOR SELECT TO authenticated
  USING (public.is_school_member(school_id) OR public.is_super_admin());
CREATE POLICY sms_credit_balances_write ON public.sms_credit_balances FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin());
CREATE POLICY sms_credit_balances_update ON public.sms_credit_balances FOR UPDATE TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE TRIGGER trg_sms_credit_balances_updated
  BEFORE UPDATE ON public.sms_credit_balances
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX sms_credit_balances_school_idx ON public.sms_credit_balances (school_id);
