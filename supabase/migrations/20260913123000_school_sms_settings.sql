CREATE TABLE public.school_sms_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'sozuri',
  project_id text NOT NULL,
  api_key_encrypted text NOT NULL,
  endpoint_url text NOT NULL DEFAULT 'https://sozuri.net/api/v1/messaging',
  last_balance numeric,
  last_synced_at timestamptz,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id)
);

GRANT SELECT ON public.school_sms_settings TO authenticated;
GRANT INSERT, UPDATE ON public.school_sms_settings TO authenticated;
GRANT ALL ON public.school_sms_settings TO service_role;
ALTER TABLE public.school_sms_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY school_sms_settings_read ON public.school_sms_settings FOR SELECT TO authenticated
  USING (public.is_school_member(school_id) OR public.is_super_admin());
CREATE POLICY school_sms_settings_write ON public.school_sms_settings FOR INSERT TO authenticated
  WITH CHECK (public.has_school_role(school_id, ARRAY['admin','accountant','principal','deputy']::public.app_role[]) OR public.is_super_admin());
CREATE POLICY school_sms_settings_update ON public.school_sms_settings FOR UPDATE TO authenticated
  USING (public.has_school_role(school_id, ARRAY['admin','accountant','principal','deputy']::public.app_role[]) OR public.is_super_admin())
  WITH CHECK (public.has_school_role(school_id, ARRAY['admin','accountant','principal','deputy']::public.app_role[]) OR public.is_super_admin());

CREATE TRIGGER trg_school_sms_settings_updated
  BEFORE UPDATE ON public.school_sms_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX school_sms_settings_school_idx ON public.school_sms_settings (school_id);
