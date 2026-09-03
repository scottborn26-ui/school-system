ALTER TABLE public.staff
  ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS invited_at timestamptz,
  ADD COLUMN IF NOT EXISTS account_status text NOT NULL DEFAULT 'pending';

ALTER TABLE public.staff DROP CONSTRAINT IF EXISTS staff_account_status_check;
ALTER TABLE public.staff ADD CONSTRAINT staff_account_status_check
  CHECK (account_status IN ('pending', 'active', 'disabled'));
CREATE UNIQUE INDEX IF NOT EXISTS staff_user_id_key ON public.staff(user_id) WHERE user_id IS NOT NULL;

DROP POLICY IF EXISTS staff_select_own ON public.staff;
CREATE POLICY staff_select_own ON public.staff FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS staff_update_own_password_flag ON public.staff;
CREATE POLICY staff_update_own_password_flag ON public.staff FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.create_staff_account(_school_id uuid, _user_id uuid, _staff jsonb, _role public.app_role)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE staff_id uuid;
BEGIN
  IF NOT (public.is_super_admin() OR public.is_school_admin(_school_id)) THEN
    RAISE EXCEPTION 'Only a principal or deputy can create staff accounts';
  END IF;
  IF EXISTS (SELECT 1 FROM public.staff WHERE lower(email) = lower(_staff->>'email')) THEN
    RAISE EXCEPTION 'That email is already used by a staff record';
  END IF;
  INSERT INTO public.staff (
    school_id, user_id, staff_number, full_name, tsc_number, national_id, gender, job_title,
    employment_type, phone, email, employment_date, assigned_grade, status, is_archived,
    must_change_password, invited_at, account_status
  ) VALUES (
    _school_id, _user_id, _staff->>'staff_number', _staff->>'full_name',
    NULLIF(_staff->>'tsc_number', ''), NULLIF(_staff->>'national_id', ''), NULLIF(_staff->>'gender', ''),
    NULLIF(_staff->>'job_title', ''), NULLIF(_staff->>'employment_type', ''), NULLIF(_staff->>'phone', ''),
    lower(_staff->>'email'), NULLIF(_staff->>'employment_date', '')::date,
    NULLIF(_staff->>'assigned_grade', '')::public.cbe_grade, 'active', false, true, now(), 'active'
  ) RETURNING id INTO staff_id;
  INSERT INTO public.user_school_memberships (user_id, school_id, is_active) VALUES (_user_id, _school_id, true);
  INSERT INTO public.user_roles (user_id, school_id, role, is_active) VALUES (_user_id, _school_id, _role, true);
  RETURN staff_id;
END;
$$;
REVOKE ALL ON FUNCTION public.create_staff_account(uuid, uuid, jsonb, public.app_role) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_staff_account(uuid, uuid, jsonb, public.app_role) TO service_role;