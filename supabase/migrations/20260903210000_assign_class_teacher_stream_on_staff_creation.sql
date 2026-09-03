-- Assign the selected stream while creating a staff account.
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
  selected_stream_id uuid;
  selected_grade public.cbe_grade;
  selected_grades public.cbe_grade[];
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _actor_id AND school_id = _school_id
      AND role IN ('principal', 'deputy') AND is_active
  ) THEN
    RAISE EXCEPTION 'Only a principal or deputy can create staff accounts';
  END IF;

  IF EXISTS (SELECT 1 FROM public.staff WHERE lower(email) = lower(_staff->>'email')) THEN
    RAISE EXCEPTION 'That email is already used by a staff record';
  END IF;

  selected_stream_id := NULLIF(_staff->>'class_teacher_stream_id', '')::uuid;
  selected_grade := NULLIF(_staff->>'class_teacher_grade', '')::public.cbe_grade;
  selected_grades := ARRAY(
    SELECT value::public.cbe_grade
    FROM jsonb_array_elements_text(COALESCE(_staff->'assigned_grades', '[]'::jsonb)) AS item(value)
  );
  IF cardinality(selected_grades) = 0 AND NULLIF(_staff->>'assigned_grade', '') IS NOT NULL THEN
    selected_grades := ARRAY[(_staff->>'assigned_grade')::public.cbe_grade];
  END IF;

  IF selected_stream_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.streams
    WHERE id = selected_stream_id AND school_id = _school_id
      AND is_active AND grade = selected_grade AND class_teacher_id IS NULL
  ) THEN
    RAISE EXCEPTION 'That stream already has a class teacher or does not match the selected grade';
  END IF;

  INSERT INTO public.staff (
    school_id, user_id, staff_number, full_name, tsc_number, national_id, gender, job_title,
    employment_type, phone, email, employment_date, assigned_grade, assigned_grades, class_teacher_grade, status, is_archived,
    must_change_password, invited_at, account_status, credentials_expires_at
  ) VALUES (
    _school_id, _user_id, NULL, _staff->>'full_name',
    NULLIF(_staff->>'tsc_number', ''), NULLIF(_staff->>'national_id', ''), NULLIF(_staff->>'gender', ''),
    NULLIF(_staff->>'job_title', ''), NULLIF(_staff->>'employment_type', ''), NULLIF(_staff->>'phone', ''),
    lower(_staff->>'email'), NULLIF(_staff->>'employment_date', '')::date,
    selected_grades[1], selected_grades,
    selected_grade, 'active', false, true, now(), 'active', now() + interval '48 hours'
  ) RETURNING id INTO staff_id;

  IF selected_stream_id IS NOT NULL THEN
    UPDATE public.streams
    SET class_teacher_id = staff_id, updated_at = now()
    WHERE id = selected_stream_id AND school_id = _school_id AND class_teacher_id IS NULL;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'That stream already has a class teacher';
    END IF;
  END IF;

  UPDATE public.user_school_memberships SET is_active = true WHERE user_id = _user_id AND school_id = _school_id;
  IF NOT FOUND THEN
    INSERT INTO public.user_school_memberships (user_id, school_id, is_active) VALUES (_user_id, _school_id, true);
  END IF;
  UPDATE public.user_roles SET is_active = true WHERE user_id = _user_id AND school_id = _school_id AND role = _role;
  IF NOT FOUND THEN
    INSERT INTO public.user_roles (user_id, school_id, role, is_active) VALUES (_user_id, _school_id, _role, true);
  END IF;
  RETURN staff_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_staff_account(uuid, uuid, uuid, jsonb, public.app_role) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_staff_account(uuid, uuid, uuid, jsonb, public.app_role) TO service_role;
