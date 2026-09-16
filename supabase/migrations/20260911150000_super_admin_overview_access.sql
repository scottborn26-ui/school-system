-- Platform admins need read access to cross-tenant overview data.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'schools'
      AND policyname = 'platform_admins_read_all_schools'
  ) THEN
    CREATE POLICY platform_admins_read_all_schools ON public.schools
      FOR SELECT TO authenticated USING (public.is_platform_admin());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'learners'
      AND policyname = 'platform_admins_read_all_learners'
  ) THEN
    CREATE POLICY platform_admins_read_all_learners ON public.learners
      FOR SELECT TO authenticated USING (public.is_platform_admin());
  END IF;
END $$;