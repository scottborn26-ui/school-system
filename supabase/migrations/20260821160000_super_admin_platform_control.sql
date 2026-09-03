CREATE TABLE public.platform_school_settings (
  school_id uuid PRIMARY KEY REFERENCES public.schools(id) ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'basic' CHECK (plan IN ('basic', 'premium', 'enterprise')),
  storage_limit_mb integer NOT NULL DEFAULT 10240 CHECK (storage_limit_mb > 0),
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

CREATE TABLE public.platform_features (
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  feature_key text NOT NULL CHECK (feature_key IN ('attendance', 'billing', 'exams', 'library', 'transport', 'messaging')),
  is_enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id),
  PRIMARY KEY (school_id, feature_key)
);

CREATE TABLE public.platform_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL REFERENCES auth.users(id),
  action text NOT NULL,
  school_id uuid REFERENCES public.schools(id) ON DELETE SET NULL,
  entity text NOT NULL,
  entity_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX platform_audit_logs_created_at_idx ON public.platform_audit_logs (created_at DESC);
CREATE INDEX platform_audit_logs_school_id_idx ON public.platform_audit_logs (school_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_school_settings, public.platform_features TO authenticated;
GRANT SELECT, INSERT ON public.platform_audit_logs TO authenticated;
GRANT ALL ON public.platform_school_settings, public.platform_features, public.platform_audit_logs TO service_role;

ALTER TABLE public.platform_school_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY platform_settings_super_admin ON public.platform_school_settings
  FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY platform_features_super_admin ON public.platform_features
  FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY platform_audit_read_super_admin ON public.platform_audit_logs
  FOR SELECT TO authenticated USING (public.is_super_admin());
CREATE POLICY platform_audit_insert_super_admin ON public.platform_audit_logs
  FOR INSERT TO authenticated WITH CHECK (public.is_super_admin() AND actor_id = auth.uid());

CREATE OR REPLACE FUNCTION public.platform_audit_school_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.is_super_admin() THEN
    INSERT INTO public.platform_audit_logs (actor_id, action, school_id, entity, entity_id, metadata)
    VALUES (auth.uid(), TG_OP, COALESCE(NEW.id, OLD.id), 'school', COALESCE(NEW.id, OLD.id),
      jsonb_build_object('status', COALESCE(NEW.status::text, OLD.status::text)));
  END IF;
  RETURN COALESCE(NEW, OLD);
END; $$;

CREATE TRIGGER platform_school_change_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.schools
  FOR EACH ROW EXECUTE FUNCTION public.platform_audit_school_change();