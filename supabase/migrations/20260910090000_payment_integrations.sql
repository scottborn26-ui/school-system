-- Per-school payment integrations (Option B: each school owns its provider account).
CREATE TYPE public.payment_provider AS ENUM ('mpesa', 'bank_jenga', 'bank_kcb', 'bank');
CREATE TYPE public.payment_environment AS ENUM ('sandbox', 'live');
CREATE TYPE public.payment_transaction_status AS ENUM ('pending', 'success', 'failed', 'unmatched', 'reconciled');

CREATE TABLE public.payment_provider_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  provider public.payment_provider NOT NULL,
  environment public.payment_environment NOT NULL DEFAULT 'sandbox',
  consumer_key text,
  consumer_secret text,
  api_key text,
  api_secret text,
  shortcode text,
  passkey text,
  account_number text,
  callback_base_url text NOT NULL,
  account_reference_format text NOT NULL DEFAULT '{admission_number}',
  is_active boolean NOT NULL DEFAULT false,
  last_error text,
  last_verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, provider)
);

CREATE TABLE public.payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id uuid REFERENCES public.learners(id),
  provider public.payment_provider NOT NULL,
  provider_transaction_id text,
  merchant_request_id text,
  checkout_request_id text,
  amount numeric NOT NULL CHECK (amount > 0),
  phone_number text,
  account_reference text,
  status public.payment_transaction_status NOT NULL DEFAULT 'pending',
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  matched_invoice_id uuid REFERENCES public.invoices(id),
  matched_payment_id uuid REFERENCES public.payments(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, provider, provider_transaction_id)
);

CREATE TABLE public.payment_config_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  config_id uuid REFERENCES public.payment_provider_configs(id) ON DELETE SET NULL,
  actor_id uuid REFERENCES auth.users(id),
  action text NOT NULL,
  changed_fields text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.payment_provider_configs TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.payment_transactions TO authenticated;
GRANT SELECT ON public.payment_config_audit_logs TO authenticated;
GRANT ALL ON public.payment_provider_configs, public.payment_transactions, public.payment_config_audit_logs TO service_role;

ALTER TABLE public.payment_provider_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_config_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY payment_config_read ON public.payment_provider_configs FOR SELECT TO authenticated
  USING (public.is_school_member(school_id) OR public.is_super_admin());
CREATE POLICY payment_config_write ON public.payment_provider_configs FOR INSERT TO authenticated
  WITH CHECK (public.has_school_role(school_id, ARRAY['admin','accountant','principal','deputy']::public.app_role[]) OR public.is_super_admin());
CREATE POLICY payment_config_update ON public.payment_provider_configs FOR UPDATE TO authenticated
  USING (public.has_school_role(school_id, ARRAY['admin','accountant','principal','deputy']::public.app_role[]) OR public.is_super_admin())
  WITH CHECK (public.has_school_role(school_id, ARRAY['admin','accountant','principal','deputy']::public.app_role[]) OR public.is_super_admin());
CREATE POLICY payment_transaction_read ON public.payment_transactions FOR SELECT TO authenticated
  USING (public.is_school_member(school_id) OR public.is_super_admin());
CREATE POLICY payment_transaction_write ON public.payment_transactions FOR INSERT TO authenticated
  WITH CHECK (public.has_school_role(school_id, ARRAY['admin','accountant','principal','deputy']::public.app_role[]) OR public.is_super_admin());
CREATE POLICY payment_transaction_update ON public.payment_transactions FOR UPDATE TO authenticated
  USING (public.has_school_role(school_id, ARRAY['admin','accountant','principal','deputy']::public.app_role[]) OR public.is_super_admin())
  WITH CHECK (public.has_school_role(school_id, ARRAY['admin','accountant','principal','deputy']::public.app_role[]) OR public.is_super_admin());
CREATE POLICY payment_config_audit_read ON public.payment_config_audit_logs FOR SELECT TO authenticated
  USING (public.is_school_member(school_id) OR public.is_super_admin());

CREATE TRIGGER trg_payment_configs_updated BEFORE UPDATE ON public.payment_provider_configs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_payment_transactions_updated BEFORE UPDATE ON public.payment_transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX payment_transactions_school_created_idx ON public.payment_transactions (school_id, created_at DESC);
CREATE INDEX payment_transactions_unmatched_idx ON public.payment_transactions (school_id, status) WHERE status = 'unmatched';

-- Match is deliberately performed in one transaction. Inserting into payments invokes
-- the existing payment ledger trigger and prevents browser-side ledger drift.
CREATE OR REPLACE FUNCTION public.match_payment_transaction(
  transaction_id uuid,
  learner_id_input uuid,
  invoice_id_input uuid DEFAULT NULL
) RETURNS public.payment_transactions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  tx public.payment_transactions;
  receipt text;
  payment_id uuid;
BEGIN
  SELECT * INTO tx FROM public.payment_transactions WHERE id = transaction_id FOR UPDATE;
  IF tx.id IS NULL THEN RAISE EXCEPTION 'Payment transaction not found'; END IF;
  IF NOT (public.has_school_role(tx.school_id, ARRAY['admin','accountant','principal','deputy']::public.app_role[]) OR public.is_super_admin()) THEN
    RAISE EXCEPTION 'Not authorised to match this transaction';
  END IF;
  IF tx.status IN ('reconciled', 'success') AND tx.matched_payment_id IS NOT NULL THEN RETURN tx; END IF;

  receipt := 'AUTO-' || upper(substr(replace(tx.id::text, '-', ''), 1, 12));
  INSERT INTO public.payments (school_id, learner_id, invoice_id, receipt_number, amount, method, reference, paid_at, notes, recorded_by)
  VALUES (tx.school_id, learner_id_input, invoice_id_input, receipt, tx.amount,
          CASE WHEN tx.provider = 'mpesa' THEN 'mpesa' ELSE 'bank' END,
          tx.provider_transaction_id, tx.created_at, 'Payment integration reconciliation', auth.uid())
  RETURNING id INTO payment_id;

  UPDATE public.payment_transactions
  SET student_id = learner_id_input, matched_invoice_id = invoice_id_input, matched_payment_id = payment_id,
      status = 'reconciled'
  WHERE id = tx.id
  RETURNING * INTO tx;
  RETURN tx;
END; $$;
GRANT EXECUTE ON FUNCTION public.match_payment_transaction(uuid, uuid, uuid) TO authenticated;
