-- Service health records used by the Super Admin system telemetry page.
CREATE TABLE IF NOT EXISTS public.platform_service_health (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_name text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'operational' CHECK (status IN ('operational', 'degraded', 'outage')),
  uptime_percent numeric(6,3) NOT NULL DEFAULT 99.980,
  response_ms integer NOT NULL DEFAULT 0 CHECK (response_ms >= 0),
  last_incident_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS platform_service_health_status_idx ON public.platform_service_health(status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_service_health TO authenticated;
ALTER TABLE public.platform_service_health ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'platform_service_health' AND policyname = 'super_admin_service_health_access') THEN
    CREATE POLICY super_admin_service_health_access ON public.platform_service_health
      FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
  END IF;
END $$;

INSERT INTO public.platform_service_health (service_name, status, uptime_percent, response_ms)
VALUES
  ('Supabase PostgreSQL', 'operational', 99.990, 42),
  ('Authentication gateway', 'operational', 99.980, 86),
  ('Storage and media', 'operational', 99.970, 118),
  ('Payment webhooks', 'operational', 99.950, 132),
  ('Email and SMS delivery', 'operational', 99.940, 164)
ON CONFLICT (service_name) DO NOTHING;
