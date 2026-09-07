CREATE OR REPLACE FUNCTION public.gate_clock_staff(
  _school_id uuid,
  _staff_id uuid,
  _action text
) RETURNS public.staff_attendance
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  guard_id uuid;
  result_row public.staff_attendance%ROWTYPE;
  school_timezone text;
  local_date date;
  local_time time;
  late_cutoff time;
  attendance_enabled boolean;
BEGIN
  IF NOT public.has_school_role(_school_id, ARRAY['security']::public.app_role[]) THEN
    RAISE EXCEPTION 'Only an assigned security guard can use gate attendance';
  END IF;
  IF _action NOT IN ('in', 'out') THEN
    RAISE EXCEPTION 'Invalid attendance action';
  END IF;

  SELECT id INTO guard_id
  FROM public.staff
  WHERE school_id = _school_id
    AND user_id = auth.uid()
    AND is_archived = false
    AND status = 'active'
    AND account_status = 'active'
  LIMIT 1;
  IF guard_id IS NULL THEN
    RAISE EXCEPTION 'No active security staff record found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.staff
    WHERE id = _staff_id
      AND school_id = _school_id
      AND is_archived = false
      AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Staff member not found';
  END IF;

  SELECT
    COALESCE(timezone, 'Africa/Nairobi'),
    COALESCE(staff_attendance_enabled, true),
    COALESCE(staff_attendance_start_time, '08:00'::time)
      + make_interval(mins => COALESCE(staff_attendance_grace_minutes, 15))
  INTO school_timezone, attendance_enabled, late_cutoff
  FROM public.school_settings
  WHERE school_id = _school_id;

  school_timezone := COALESCE(school_timezone, 'Africa/Nairobi');
  IF NOT COALESCE(attendance_enabled, true) THEN
    RAISE EXCEPTION 'Staff attendance clocking is disabled by the school administrator';
  END IF;

  local_date := (now() AT TIME ZONE school_timezone)::date;
  local_time := (now() AT TIME ZONE school_timezone)::time;

  IF _action = 'in' THEN
    INSERT INTO public.staff_attendance (
      school_id, staff_id, attendance_date, clock_in_time, check_in_by, status
    ) VALUES (
      _school_id,
      _staff_id,
      local_date,
      now(),
      guard_id,
      CASE WHEN local_time > late_cutoff THEN 'late' ELSE 'present' END
    )
    ON CONFLICT (school_id, staff_id, attendance_date) DO UPDATE SET
      clock_in_time = COALESCE(public.staff_attendance.clock_in_time, EXCLUDED.clock_in_time),
      check_in_by = COALESCE(public.staff_attendance.check_in_by, EXCLUDED.check_in_by),
      status = CASE
        WHEN public.staff_attendance.status = 'absent' THEN EXCLUDED.status
        ELSE public.staff_attendance.status
      END,
      updated_at = now();
  ELSE
    UPDATE public.staff_attendance
    SET clock_out_time = COALESCE(clock_out_time, now()),
        check_out_by = COALESCE(check_out_by, guard_id),
        hours_worked = CASE
          WHEN clock_in_time IS NULL THEN hours_worked
          ELSE ROUND((EXTRACT(EPOCH FROM (COALESCE(clock_out_time, now()) - clock_in_time)) / 3600)::numeric, 2)
        END,
        updated_at = now()
    WHERE school_id = _school_id
      AND staff_id = _staff_id
      AND attendance_date = local_date
      AND clock_in_time IS NOT NULL;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Staff member must be checked in before checking out';
    END IF;
  END IF;

  SELECT * INTO result_row
  FROM public.staff_attendance
  WHERE school_id = _school_id
    AND staff_id = _staff_id
    AND attendance_date = local_date;
  RETURN result_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.gate_clock_staff(uuid, uuid, text) TO authenticated;
