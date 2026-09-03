-- One email remains one Supabase Auth login, but it may be reused on
-- multiple staff assignments, including assignments in multiple grades.
CREATE OR REPLACE FUNCTION public.link_staff_to_teacher_account(_staff_id uuid, _user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  staff_school_id uuid;
BEGIN
  SELECT school_id INTO staff_school_id
  FROM public.staff
  WHERE id = _staff_id
    AND is_archived = false
    AND status = 'active'
    AND assigned_grade IS NOT NULL;

  IF staff_school_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.staff
  SET user_id = _user_id, updated_at = now()
  WHERE id = _staff_id;

  INSERT INTO public.user_school_memberships (user_id, school_id)
  VALUES (_user_id, staff_school_id)
  ON CONFLICT (user_id, school_id) DO UPDATE SET is_active = true;

  UPDATE public.user_roles
  SET is_active = true
  WHERE user_id = _user_id
    AND school_id = staff_school_id
    AND role = 'teacher';

  IF NOT FOUND THEN
    INSERT INTO public.user_roles (user_id, school_id, role)
    VALUES (_user_id, staff_school_id, 'teacher');
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.link_teacher_account()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  matching_staff public.staff%ROWTYPE;
BEGIN
  FOR matching_staff IN
    SELECT *
    FROM public.staff
    WHERE lower(email) = lower(NEW.email)
      AND is_archived = false
      AND status = 'active'
      AND assigned_grade IS NOT NULL
  LOOP
    PERFORM public.link_staff_to_teacher_account(matching_staff.id, NEW.id);
  END LOOP;

  RETURN NEW;
END;
$$;

-- If the teacher already has an Auth account, adding another staff assignment
-- with the same email links it immediately.
CREATE OR REPLACE FUNCTION public.link_existing_teacher_account()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_user_id uuid;
BEGIN
  IF NEW.email IS NULL OR NEW.assigned_grade IS NULL
     OR NEW.is_archived OR NEW.status <> 'active' THEN
    RETURN NEW;
  END IF;

  SELECT id INTO existing_user_id
  FROM auth.users
  WHERE lower(email) = lower(NEW.email)
  LIMIT 1;

  IF existing_user_id IS NOT NULL THEN
    PERFORM public.link_staff_to_teacher_account(NEW.id, existing_user_id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_staff_teacher_account_link ON public.staff;
CREATE TRIGGER on_staff_teacher_account_link
  AFTER INSERT OR UPDATE OF email, assigned_grade, status, is_archived ON public.staff
  FOR EACH ROW EXECUTE FUNCTION public.link_existing_teacher_account();

-- Backfill all eligible existing staff rows whose email already belongs to an Auth user.
DO $$
DECLARE
  staff_row public.staff%ROWTYPE;
  existing_user_id uuid;
BEGIN
  FOR staff_row IN
    SELECT * FROM public.staff
    WHERE email IS NOT NULL
      AND assigned_grade IS NOT NULL
      AND is_archived = false
      AND status = 'active'
  LOOP
    SELECT id INTO existing_user_id
    FROM auth.users
    WHERE lower(email) = lower(staff_row.email)
    LIMIT 1;

    IF existing_user_id IS NOT NULL THEN
      PERFORM public.link_staff_to_teacher_account(staff_row.id, existing_user_id);
    END IF;
  END LOOP;
END;
$$;
