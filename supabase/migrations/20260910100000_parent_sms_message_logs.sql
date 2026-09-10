CREATE TABLE public.sms_message_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  guardian_id uuid NOT NULL REFERENCES public.guardians(id) ON DELETE CASCADE,
  batch_id uuid NOT NULL,
  recipient_phone text NOT NULL,
  message text NOT NULL,
  status text NOT NULL CHECK (status IN ('sent', 'failed')),
  provider text NOT NULL DEFAULT 'sozuri',
  provider_status integer,
  provider_response jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX sms_message_logs_school_idx ON public.sms_message_logs (school_id, created_at DESC);
CREATE INDEX sms_message_logs_batch_idx ON public.sms_message_logs (batch_id);

GRANT SELECT, INSERT ON public.sms_message_logs TO authenticated;
GRANT ALL ON public.sms_message_logs TO service_role;

ALTER TABLE public.sms_message_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY sms_message_logs_member_read ON public.sms_message_logs
  FOR SELECT TO authenticated
  USING (public.is_super_admin() OR public.is_school_member(school_id));

CREATE POLICY sms_message_logs_member_insert ON public.sms_message_logs
  FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.is_school_member(school_id));
