CREATE OR REPLACE FUNCTION public.create_staff_account(
  _school_id uuid,
  _user_id uuid,
  _staff jsonb,
  _role public.app_role
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  staff_id uuid;
BEGIN
  IF NOT (public.is_super_admin() OR public.is_school_admin(_school_id)) THEN
    RAISE EXCEPTION 'Only a principal or deputy can create staff accounts';
  END IF;

  IF EXISTS (SELECT 1 FROM public.staff WHERE lower(email) = lower(_staff->>'email')) THEN
    RAISE EXCEPTION 'That email is already used by a staff record';
  END IF;

  INSERT INTO public.staff (
    school_id, user_id, staff_number, full_name, tsc_number, national_id,
    gender, job_title, employment_type, phone, email, employment_date,
    assigned_grade, status, is_archived
  ) VALUES (
    _school_id, _user_id, _staff->>'staff_number', _staff->>'full_name',
    NULLIF(_staff->>'tsc_number', ''), NULLIF(_staff->>'national_id', ''),
    NULLIF(_staff->>'gender', ''), NULLIF(_staff->>'job_title', ''),
    NULLIF(_staff->>'employment_type', ''), NULLIF(_staff->>'phone', ''),
    lower(_staff->>'email'), NULLIF(_staff->>'employment_date', '')::date,
    NULLIF(_staff->>'assigned_grade', '')::public.cbe_grade, 'active', false
  ) RETURNING id INTO staff_id;

  INSERT INTO public.user_school_memberships (user_id, school_id, is_active)
  VALUES (_user_id, _school_id, true);
  INSERT INTO public.user_roles (user_id, school_id, role, is_active)
  VALUES (_user_id, _school_id, _role, true);
  RETURN staff_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_staff_account(uuid, uuid, jsonb, public.app_role) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_staff_account(uuid, uuid, jsonb, public.app_role) TO service_role;

CREATE OR REPLACE FUNCTION public.sync_staff_account_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.user_id IS NOT NULL AND (NEW.is_archived OR NEW.status <> 'active') THEN
    UPDATE public.user_school_memberships SET is_active = false WHERE user_id = NEW.user_id AND school_id = NEW.school_id;
    UPDATE public.user_roles SET is_active = false WHERE user_id = NEW.user_id AND school_id = NEW.school_id;
  ELSIF NEW.user_id IS NOT NULL AND NOT NEW.is_archived AND NEW.status = 'active' THEN
    UPDATE public.user_school_memberships SET is_active = true WHERE user_id = NEW.user_id AND school_id = NEW.school_id;
    UPDATE public.user_roles SET is_active = true WHERE user_id = NEW.user_id AND school_id = NEW.school_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS staff_account_status_sync ON public.staff;
CREATE TRIGGER staff_account_status_sync
AFTER UPDATE OF status, is_archived ON public.staff
FOR EACH ROW EXECUTE FUNCTION public.sync_staff_account_status();

CREATE OR REPLACE FUNCTION public.prevent_linked_staff_email_change()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.user_id IS NOT NULL AND lower(COALESCE(NEW.email, '')) <> lower(COALESCE(OLD.email, '')) THEN
    RAISE EXCEPTION 'A staff member with a linked login account cannot change email';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS staff_linked_email_immutable ON public.staff;
CREATE TRIGGER staff_linked_email_immutable
BEFORE UPDATE OF email ON public.staff
FOR EACH ROW EXECUTE FUNCTION public.prevent_linked_staff_email_change();