CREATE OR REPLACE FUNCTION public.create_staff_account(
  _school_id uuid,
  _user_id uuid,
  _actor_id uuid,
  _staff jsonb,
  _role public.app_role
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  staff_id uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _actor_id
      AND school_id = _school_id
      AND role IN ('principal', 'deputy')
      AND is_active
  ) THEN
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

  INSERT INTO public.user_school_memberships (user_id, school_id, is_active)
  VALUES (_user_id, _school_id, true)
  ON CONFLICT (user_id, school_id) DO UPDATE SET is_active = true;

  INSERT INTO public.user_roles (user_id, school_id, role, is_active)
  VALUES (_user_id, _school_id, _role, true)
  ON CONFLICT (user_id, school_id, role) DO UPDATE SET is_active = true;

  RETURN staff_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_staff_account(uuid, uuid, uuid, jsonb, public.app_role) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_staff_account(uuid, uuid, uuid, jsonb, public.app_role) TO service_role;
