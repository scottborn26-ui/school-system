-- The existing schools table is the tenant registry in this application.
ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS curriculum_type text NOT NULL DEFAULT 'cbc_cbe',
  ADD COLUMN IF NOT EXISTS brand_colors jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS storage_used_mb integer NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS schools_slug_unique
  ON public.schools (lower(slug)) WHERE slug IS NOT NULL;

CREATE TABLE public.subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  price numeric(12,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  currency text NOT NULL DEFAULT 'KES',
  billing_cycle text NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'annual')),
  max_students integer NOT NULL CHECK (max_students > 0),
  enabled_modules jsonb NOT NULL DEFAULT '[]'::jsonb,
  storage_limit_mb integer NOT NULL CHECK (storage_limit_mb > 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.tenant_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.subscription_plans(id),
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  renewal_date date,
  status text NOT NULL DEFAULT 'trialing' CHECK (status IN ('trialing', 'active', 'past_due', 'cancelled')),
  payment_status text NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX tenant_subscriptions_current_idx
  ON public.tenant_subscriptions (tenant_id) WHERE status IN ('trialing', 'active', 'past_due');

CREATE TABLE public.platform_admins (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  email text NOT NULL,
  role text NOT NULL DEFAULT 'super_admin' CHECK (role IN ('super_admin', 'support_admin')),
  two_factor_enabled boolean NOT NULL DEFAULT false,
  last_login timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.tenant_modules (
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

CREATE TABLE public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  raised_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  subject text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved')),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE TABLE public.billing_invoices (
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

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_super_admin() OR EXISTS (
    SELECT 1 FROM public.platform_admins
    WHERE id = auth.uid() AND role IN ('super_admin', 'support_admin')
  );
$$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscription_plans, public.tenant_subscriptions,
  public.platform_admins, public.tenant_modules, public.support_tickets, public.billing_invoices TO authenticated;

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY subscription_plans_platform_admin ON public.subscription_plans FOR ALL TO authenticated
  USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());
CREATE POLICY tenant_subscriptions_platform_admin ON public.tenant_subscriptions FOR ALL TO authenticated
  USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());
CREATE POLICY platform_admins_platform_admin ON public.platform_admins FOR ALL TO authenticated
  USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());
CREATE POLICY tenant_modules_platform_admin ON public.tenant_modules FOR ALL TO authenticated
  USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());
CREATE POLICY support_tickets_platform_admin ON public.support_tickets FOR ALL TO authenticated
  USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());
CREATE POLICY billing_invoices_platform_admin ON public.billing_invoices FOR ALL TO authenticated
  USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());

INSERT INTO public.subscription_plans (name, price, max_students, enabled_modules, storage_limit_mb)
VALUES
  ('Basic', 2500, 250, '["attendance", "messaging"]'::jsonb, 10240),
  ('Standard', 7500, 1000, '["attendance", "messaging", "exams", "library", "billing"]'::jsonb, 51200),
  ('Premium', 15000, 5000, '["attendance", "messaging", "exams", "library", "billing", "transport"]'::jsonb, 204800)
ON CONFLICT (name) DO NOTHING;
