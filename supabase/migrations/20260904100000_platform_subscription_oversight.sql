CREATE TABLE public.platform_subscriptions (
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

CREATE TABLE public.platform_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  audience text NOT NULL DEFAULT 'school_admins' CHECK (audience IN ('school_admins', 'all_users')),
  published_at timestamptz,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_announcements ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_subscriptions, public.platform_announcements TO authenticated;

CREATE POLICY platform_subscriptions_super_admin ON public.platform_subscriptions
  FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY platform_announcements_super_admin ON public.platform_announcements
  FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin() AND created_by = auth.uid());

INSERT INTO public.platform_subscriptions (school_id, plan, status, max_students, storage_limit_mb)
SELECT id, 'basic', CASE WHEN status = 'active' THEN 'active' ELSE 'cancelled' END, 250, 10240
FROM public.schools
ON CONFLICT (school_id) DO NOTHING;