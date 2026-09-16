-- School accounts may read only the singleton platform maintenance state.
-- The client explicitly selects only these banner fields.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'platform_settings'
      AND policyname = 'platform_settings_authenticated_banner_read'
  ) THEN
    CREATE POLICY platform_settings_authenticated_banner_read
      ON public.platform_settings
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;
