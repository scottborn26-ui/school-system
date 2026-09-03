DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'app_role'
  ) THEN
    CREATE TYPE public.app_role AS ENUM (
      'super_admin',
      'admin',
      'principal',
      'deputy',
      'teacher',
      'class_teacher',
      'exam_officer',
      'registrar',
      'bursar',
      'parent',
      'student'
    );
  ELSE
    BEGIN
      ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'admin';
    EXCEPTION WHEN duplicate_object THEN
    END;
    BEGIN
      ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'exam_officer';
    EXCEPTION WHEN duplicate_object THEN
    END;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS school_id uuid,
  ADD COLUMN IF NOT EXISTS role public.app_role,
  ADD COLUMN IF NOT EXISTS is_active boolean,
  ADD COLUMN IF NOT EXISTS created_at timestamptz;

UPDATE public.user_roles
SET is_active = true
WHERE is_active IS NULL;

UPDATE public.user_roles
SET created_at = now()
WHERE created_at IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_roles'
      AND column_name = 'user_id'
      AND data_type <> 'uuid'
  ) THEN
    RAISE EXCEPTION 'public.user_roles.user_id must be uuid. Drop the RLS policies or rebuild the table before changing this column type.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_roles'
      AND column_name = 'school_id'
      AND data_type <> 'uuid'
  ) THEN
    RAISE EXCEPTION 'public.user_roles.school_id must be uuid. Drop the RLS policies or rebuild the table before changing this column type.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_roles'
      AND column_name = 'is_active'
      AND data_type <> 'boolean'
  ) THEN
    RAISE EXCEPTION 'public.user_roles.is_active must be boolean. Drop the RLS policies or rebuild the table before changing this column type.';
  END IF;
END $$;

ALTER TABLE public.user_roles
  ALTER COLUMN is_active SET DEFAULT true,
  ALTER COLUMN is_active SET NOT NULL,
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN created_at SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public' AND t.relname = 'user_roles' AND c.conname = 'user_roles_user_id_fkey'
  ) THEN
    ALTER TABLE public.user_roles
      ADD CONSTRAINT user_roles_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public' AND t.relname = 'user_roles' AND c.conname = 'user_roles_school_id_fkey'
  ) THEN
    ALTER TABLE public.user_roles
      ADD CONSTRAINT user_roles_school_id_fkey
      FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS user_roles_unique
ON public.user_roles (user_id, COALESCE(school_id, '00000000-0000-0000-0000-000000000000'::uuid), role);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
