ALTER TABLE public.staff
  ADD COLUMN IF NOT EXISTS assigned_grades public.cbe_grade[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS class_teacher_grade public.cbe_grade;

UPDATE public.staff
SET assigned_grades = ARRAY[assigned_grade]::public.cbe_grade[]
WHERE assigned_grade IS NOT NULL
  AND cardinality(assigned_grades) = 0;

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
  generated_staff_number text;
  school_code text;
  year_code text;
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

  SELECT rpad(upper(left(regexp_replace(COALESCE(NULLIF(s.short_name, ''), s.name), '[^A-Za-z]', '', 'g'), 3)), 3, 'X')
  INTO school_code FROM public.schools s WHERE s.id = _school_id;
  IF school_code IS NULL THEN RAISE EXCEPTION 'School could not be found'; END IF;

  SELECT COALESCE((regexp_match(ay.name, '((19|20)[0-9]{2})'))[1], to_char(current_date, 'YYYY'))
  INTO year_code FROM public.academic_years ay
  WHERE ay.school_id = _school_id AND ay.is_current AND NOT ay.is_archived
  ORDER BY ay.start_date DESC LIMIT 1;
  year_code := COALESCE(year_code, to_char(current_date, 'YYYY'));

  selected_grades := ARRAY(
    SELECT value::public.cbe_grade
    FROM jsonb_array_elements_text(COALESCE(_staff->'assigned_grades', '[]'::jsonb)) AS item(value)
  );
  IF cardinality(selected_grades) = 0 AND NULLIF(_staff->>'assigned_grade', '') IS NOT NULL THEN
    selected_grades := ARRAY[(_staff->>'assigned_grade')::public.cbe_grade];
  END IF;

  LOOP
    generated_staff_number := school_code || year_code || lpad(floor(random() * 1000)::integer::text, 3, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.staff WHERE school_id = _school_id AND staff_number = generated_staff_number);
  END LOOP;

  INSERT INTO public.staff (
    school_id, user_id, staff_number, full_name, tsc_number, national_id, gender, job_title,
    employment_type, phone, email, employment_date, assigned_grade, assigned_grades, class_teacher_grade, status, is_archived,
    must_change_password, invited_at, account_status, credentials_expires_at
  ) VALUES (
    _school_id, _user_id, generated_staff_number, _staff->>'full_name',
    NULLIF(_staff->>'tsc_number', ''), NULLIF(_staff->>'national_id', ''), NULLIF(_staff->>'gender', ''),
    NULLIF(_staff->>'job_title', ''), NULLIF(_staff->>'employment_type', ''), NULLIF(_staff->>'phone', ''),
    lower(_staff->>'email'), NULLIF(_staff->>'employment_date', '')::date,
    selected_grades[1], selected_grades, NULLIF(_staff->>'class_teacher_grade', '')::public.cbe_grade,
    'active', false, true, now(), 'active', now() + interval '48 hours'
  ) RETURNING id INTO staff_id;

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

CREATE OR REPLACE FUNCTION public.link_teacher_account()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE teacher_staff public.staff%ROWTYPE;
BEGIN
  SELECT * INTO teacher_staff FROM public.staff
  WHERE lower(email) = lower(NEW.email) AND is_archived = false AND status = 'active'
    AND cardinality(assigned_grades) > 0
  ORDER BY created_at LIMIT 1;
  IF teacher_staff.id IS NOT NULL THEN
    UPDATE public.staff SET user_id = NEW.id, updated_at = now() WHERE id = teacher_staff.id;
    INSERT INTO public.user_school_memberships (user_id, school_id) VALUES (NEW.id, teacher_staff.school_id)
      ON CONFLICT (user_id, school_id) DO UPDATE SET is_active = true;
    UPDATE public.user_roles SET is_active = true WHERE user_id = NEW.id AND school_id = teacher_staff.school_id AND role = 'teacher';
    IF NOT FOUND THEN INSERT INTO public.user_roles (user_id, school_id, role) VALUES (NEW.id, teacher_staff.school_id, 'teacher'); END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP POLICY IF EXISTS "learners_scoped_read" ON public.learners;
CREATE POLICY "learners_scoped_read" ON public.learners FOR SELECT TO authenticated USING (
  public.is_super_admin() OR (
    public.is_school_member(school_id) AND (
      NOT EXISTS (
        SELECT 1
        FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.school_id = learners.school_id
          AND ur.is_active = true
          AND ur.role IN ('teacher'::public.app_role, 'class_teacher'::public.app_role)
      )
      OR current_grade IN (
        SELECT unnest(s.assigned_grades)
        FROM public.staff s
        WHERE s.user_id = auth.uid() AND s.school_id = learners.school_id
          AND s.is_archived = false AND s.status = 'active'
      )
    )
  )
);

REVOKE ALL ON FUNCTION public.create_staff_account(uuid, uuid, uuid, jsonb, public.app_role) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_staff_account(uuid, uuid, uuid, jsonb, public.app_role) TO service_role;

CREATE OR REPLACE FUNCTION public.delete_staff_account(_school_id uuid, _staff_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.is_super_admin() OR public.is_school_admin(_school_id)) THEN
    RAISE EXCEPTION 'Only a principal or deputy can permanently delete staff accounts';
  END IF;

  DELETE FROM public.teacher_allocations
  WHERE staff_id = _staff_id AND school_id = _school_id;

  DELETE FROM public.timetable_slots
  WHERE staff_id = _staff_id;

  DELETE FROM public.staff
  WHERE id = _staff_id AND school_id = _school_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'The staff member could not be found';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_staff_account(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_staff_account(uuid, uuid) TO service_role;