CREATE TABLE public.payment_receipt_sms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  payment_id uuid NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  recipient_count integer NOT NULL DEFAULT 0,
  error_message text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (payment_id)
);

GRANT SELECT, INSERT, UPDATE ON public.payment_receipt_sms TO authenticated;
GRANT ALL ON public.payment_receipt_sms TO service_role;
ALTER TABLE public.payment_receipt_sms ENABLE ROW LEVEL SECURITY;

CREATE POLICY payment_receipt_sms_read ON public.payment_receipt_sms FOR SELECT TO authenticated
  USING (public.is_school_member(school_id) OR public.is_super_admin());
CREATE POLICY payment_receipt_sms_insert ON public.payment_receipt_sms FOR INSERT TO authenticated
  WITH CHECK (public.is_school_member(school_id) OR public.is_super_admin());
CREATE POLICY payment_receipt_sms_update ON public.payment_receipt_sms FOR UPDATE TO authenticated
  USING (public.is_school_member(school_id) OR public.is_super_admin())
  WITH CHECK (public.is_school_member(school_id) OR public.is_super_admin());

CREATE INDEX payment_receipt_sms_school_idx ON public.payment_receipt_sms (school_id, created_at DESC);
