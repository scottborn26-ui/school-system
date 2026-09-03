CREATE OR REPLACE FUNCTION public.delete_staff_account(
  _school_id uuid,
  _staff_id uuid,
  _actor_id uuid
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _actor_id
      AND school_id = _school_id
      AND role IN ('principal', 'deputy')
      AND is_active
  ) THEN
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

REVOKE ALL ON FUNCTION public.delete_staff_account(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_staff_account(uuid, uuid, uuid) TO service_role;

NOTIFY pgrst, 'reload schema';