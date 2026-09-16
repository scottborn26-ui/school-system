-- Platform configuration workspace: singleton defaults plus catalog and override records.
CREATE TABLE IF NOT EXISTS public.platform_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  platform_name text NOT NULL DEFAULT 'SHANSCOTT School Management',
  support_email text NOT NULL DEFAULT '',
  default_currency text NOT NULL DEFAULT 'KES',
  default_timezone text NOT NULL DEFAULT 'Africa/Nairobi',
  default_trial_length_days integer NOT NULL DEFAULT 14 CHECK (default_trial_length_days >= 0),
  default_plan text NOT NULL DEFAULT 'basic',
  maintenance_enabled boolean NOT NULL DEFAULT false,
  maintenance_message text NOT NULL DEFAULT '',
  maintenance_starts_at timestamptz,
  maintenance_ends_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

CREATE TABLE IF NOT EXISTS public.modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text NOT NULL DEFAULT '',
  default_enabled boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'beta', 'deprecated')),
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tenant_module_settings (
  tenant_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  module_id uuid NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  enabled_at timestamptz,
  enabled_by uuid REFERENCES auth.users(id),
  PRIMARY KEY (tenant_id, module_id)
);

CREATE TABLE IF NOT EXISTS public.storage_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  applies_to text NOT NULL DEFAULT 'all' CHECK (applies_to IN ('all', 'plan_tier', 'specific_tenant')),
  plan_tier text,
  tenant_id uuid REFERENCES public.schools(id) ON DELETE CASCADE,
  max_storage_gb numeric(10,2) NOT NULL CHECK (max_storage_gb > 0),
  max_upload_size_mb integer NOT NULL CHECK (max_upload_size_mb > 0),
  retention_days integer NOT NULL CHECK (retention_days >= 0),
  overflow_action text NOT NULL DEFAULT 'block' CHECK (overflow_action IN ('block', 'charge', 'archive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tenant_configurations (
  tenant_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  config_key text NOT NULL,
  config_value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id),
  PRIMARY KEY (tenant_id, config_key)
);

CREATE TABLE IF NOT EXISTS public.integration_settings (
  provider text PRIMARY KEY CHECK (provider IN ('mpesa', 'stripe_bank', 'email', 'sms')),
  credentials jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'disconnected' CHECK (status IN ('connected', 'disconnected', 'error')),
  last_verified_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

-- Keep this migration runnable when the earlier platform-core migration was skipped.
CREATE TABLE IF NOT EXISTS public.platform_admins (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  email text NOT NULL,
  role text NOT NULL DEFAULT 'super_admin' CHECK (role IN ('super_admin', 'support_admin')),
  two_factor_enabled boolean NOT NULL DEFAULT false,
  last_login timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tenant_modules (
  tenant_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  module_name text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, module_name)
);

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_super_admin() OR EXISTS (
    SELECT 1 FROM public.platform_admins
    WHERE id = auth.uid() AND role IN ('super_admin', 'support_admin')
  );
$$;

CREATE INDEX IF NOT EXISTS tenant_module_settings_module_idx ON public.tenant_module_settings(module_id, enabled);
CREATE INDEX IF NOT EXISTS tenant_configurations_key_idx ON public.tenant_configurations(config_key);
CREATE INDEX IF NOT EXISTS storage_policies_scope_idx ON public.storage_policies(applies_to, plan_tier, tenant_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_settings, public.modules, public.tenant_module_settings,
  public.storage_policies, public.tenant_configurations, public.integration_settings TO authenticated;

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_module_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storage_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_settings ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['platform_settings', 'modules', 'tenant_module_settings', 'storage_policies', 'tenant_configurations', 'integration_settings'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = table_name AND policyname = table_name || '_platform_admin') THEN
      EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin())', table_name || '_platform_admin', table_name);
    END IF;
  END LOOP;
END $$;

INSERT INTO public.platform_settings (id)
VALUES (true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.modules (name, description, default_enabled, status)
VALUES
  ('Registrar', 'Admissions, learner records, and school identity.', true, 'active'),
  ('Accountant / Bursar', 'Fees, invoices, receipts, and ledger operations.', true, 'active'),
  ('Library', 'Catalog, circulation, and resource tracking.', false, 'active'),
  ('Examinations', 'Assessment schedules, marks, and reporting.', true, 'active'),
  ('Messaging', 'School, staff, learner, and parent communications.', true, 'active'),
  ('Transport', 'Routes, vehicles, and transport assignments.', false, 'beta')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.tenant_module_settings (tenant_id, module_id, enabled, enabled_at)
SELECT s.id, m.id, COALESCE(tm.enabled, m.default_enabled), CASE WHEN COALESCE(tm.enabled, m.default_enabled) THEN now() ELSE NULL END
FROM public.schools s
CROSS JOIN public.modules m
LEFT JOIN public.tenant_modules tm ON tm.tenant_id = s.id AND lower(tm.module_name) = lower(m.name)
ON CONFLICT (tenant_id, module_id) DO NOTHING;

INSERT INTO public.integration_settings (provider)
VALUES ('mpesa'), ('stripe_bank'), ('email'), ('sms')
ON CONFLICT (provider) DO NOTHING;
