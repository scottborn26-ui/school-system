-- Platform-config admins can read the overview data shown in the command center.
DO $$
BEGIN
  IF to_regclass('public.platform_subscriptions') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'platform_subscriptions' AND policyname = 'platform_admins_read_subscriptions'
  ) THEN
    CREATE POLICY platform_admins_read_subscriptions ON public.platform_subscriptions
      FOR SELECT TO authenticated USING (public.is_platform_admin());
  END IF;

  IF to_regclass('public.platform_audit_logs') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'platform_audit_logs' AND policyname = 'platform_admins_read_audit_logs'
  ) THEN
    CREATE POLICY platform_admins_read_audit_logs ON public.platform_audit_logs
      FOR SELECT TO authenticated USING (public.is_platform_admin());
  END IF;

  IF to_regclass('public.platform_service_health') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'platform_service_health' AND policyname = 'platform_admins_read_service_health'
  ) THEN
    CREATE POLICY platform_admins_read_service_health ON public.platform_service_health
      FOR SELECT TO authenticated USING (public.is_platform_admin());
  END IF;
END $$;
