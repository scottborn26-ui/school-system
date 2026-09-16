-- Ensure the super-admin workspace has the tables and policies used by the UI.
-- Safe to run after either the original platform migrations or a partial database setup.

CREATE TABLE IF NOT EXISTS public.platform_subscriptions (
  school_id uuid PRIMARY KEY REFERENCES public.schools(id) ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'basic' CHECK (plan IN ('basic', 'standard', 'premium')),
  status text NOT NULL DEFAULT 'trialing' CHECK (status IN ('trialing', 'active', 'past_due', 'cancelled')),
  trial_ends_at timestamptz,
  renewal_date date,
  max_students integer NOT NULL DEFAULT 250 CHECK (max_students > 0),
  storage_limit_mb integer NOT NULL DEFAULT 10240 CHECK (storage_limit_mb > 0),
  modules jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

CREATE TABLE IF NOT EXISTS public.platform_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  audience text NOT NULL DEFAULT 'school_admins' CHECK (audience IN ('school_admins', 'all_users')),
  target text NOT NULL DEFAULT 'all',
  published_at timestamptz,
  expires_at timestamptz,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.platform_admins (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  email text NOT NULL,
  role text NOT NULL DEFAULT 'super_admin' CHECK (role IN ('super_admin', 'support_admin')),
  two_factor_enabled boolean NOT NULL DEFAULT false,
  last_login timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  raised_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  subject text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved')),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.billing_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL CHECK (amount >= 0),
  currency text NOT NULL DEFAULT 'KES',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'void')),
  due_date date NOT NULL,
  paid_at timestamptz,
  invoice_url text,
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

ALTER TABLE public.platform_announcements
  ADD COLUMN IF NOT EXISTS target text NOT NULL DEFAULT 'all',
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

CREATE INDEX IF NOT EXISTS platform_subscriptions_status_idx ON public.platform_subscriptions(status);
CREATE INDEX IF NOT EXISTS platform_announcements_created_at_idx ON public.platform_announcements(created_at DESC);
CREATE INDEX IF NOT EXISTS support_tickets_status_idx ON public.support_tickets(status, priority);
CREATE INDEX IF NOT EXISTS billing_invoices_tenant_idx ON public.billing_invoices(tenant_id, status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_subscriptions, public.platform_announcements,
  public.platform_admins, public.tenant_modules, public.support_tickets, public.billing_invoices TO authenticated;

ALTER TABLE public.platform_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_invoices ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'platform_subscriptions' AND policyname = 'super_admin_platform_subscriptions_access') THEN
    CREATE POLICY super_admin_platform_subscriptions_access ON public.platform_subscriptions FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'platform_announcements' AND policyname = 'super_admin_platform_announcements_access') THEN
    CREATE POLICY super_admin_platform_announcements_access ON public.platform_announcements FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin() AND created_by = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'platform_admins' AND policyname = 'super_admin_platform_admins_access') THEN
    CREATE POLICY super_admin_platform_admins_access ON public.platform_admins FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'tenant_modules' AND policyname = 'super_admin_tenant_modules_access') THEN
    CREATE POLICY super_admin_tenant_modules_access ON public.tenant_modules FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'support_tickets' AND policyname = 'super_admin_support_tickets_access') THEN
    CREATE POLICY super_admin_support_tickets_access ON public.support_tickets FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'billing_invoices' AND policyname = 'super_admin_billing_invoices_access') THEN
    CREATE POLICY super_admin_billing_invoices_access ON public.billing_invoices FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
  END IF;
END $$;

INSERT INTO public.platform_subscriptions (school_id, plan, status, max_students, storage_limit_mb)
SELECT id, 'basic', CASE WHEN status = 'active' THEN 'active' ELSE 'cancelled' END, 250, 10240
FROM public.schools
ON CONFLICT (school_id) DO NOTHING;

INSERT INTO public.tenant_modules (tenant_id, module_name, enabled)
SELECT s.id, module_name, true
FROM public.schools s
CROSS JOIN unnest(ARRAY['attendance', 'billing', 'exams', 'library', 'messaging', 'transport']) AS module_name
ON CONFLICT (tenant_id, module_name) DO NOTHING;
