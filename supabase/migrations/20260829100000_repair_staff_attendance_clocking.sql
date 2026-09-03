CREATE OR REPLACE FUNCTION public.clock_staff_in(_school_id uuid, _reason text DEFAULT NULL)
RETURNS public.staff_attendance
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  staff_row public.staff%ROWTYPE;
  result_row public.staff_attendance%ROWTYPE;
  school_timezone text;
  local_date date;
  local_time time;
  late_cutoff time;
BEGIN
  SELECT * INTO staff_row
  FROM public.staff
  WHERE school_id = _school_id
    AND user_id = auth.uid()
    AND is_archived = false
    AND status = 'active'
  LIMIT 1;

  IF staff_row.id IS NULL THEN
    RAISE EXCEPTION 'No active staff record found';
  END IF;

  SELECT COALESCE(timezone, 'Africa/Nairobi')
  INTO school_timezone
  FROM public.school_settings
  WHERE school_id = _school_id;

  school_timezone := COALESCE(school_timezone, 'Africa/Nairobi');
  local_date := (now() AT TIME ZONE school_timezone)::date;
  local_time := (now() AT TIME ZONE school_timezone)::time;
  late_cutoff := (
    SELECT staff_attendance_start_time
      + make_interval(mins => staff_attendance_grace_minutes)
    FROM public.school_settings
    WHERE school_id = _school_id
  );

  INSERT INTO public.staff_attendance (
    school_id,
    staff_id,
    attendance_date,
    clock_in_time,
    status,
    reason
  )
  VALUES (
    _school_id,
    staff_row.id,
    local_date,
    now(),
    CASE WHEN late_cutoff IS NOT NULL AND local_time > late_cutoff THEN 'late' ELSE 'present' END,
    NULLIF(trim(_reason), '')
  )
  ON CONFLICT (school_id, staff_id, attendance_date)
  DO UPDATE SET
    clock_in_time = COALESCE(public.staff_attendance.clock_in_time, EXCLUDED.clock_in_time),
    status = CASE
      WHEN public.staff_attendance.status = 'present' AND EXCLUDED.status = 'late' THEN 'late'
      ELSE public.staff_attendance.status
    END,
    reason = COALESCE(public.staff_attendance.reason, EXCLUDED.reason),
    updated_at = now()
  RETURNING * INTO result_row;

  RETURN result_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.clock_staff_out(_school_id uuid)
RETURNS public.staff_attendance
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result_row public.staff_attendance%ROWTYPE;
  school_timezone text;
BEGIN
  SELECT COALESCE(timezone, 'Africa/Nairobi')
  INTO school_timezone
  FROM public.school_settings
  WHERE school_id = _school_id;

  school_timezone := COALESCE(school_timezone, 'Africa/Nairobi');

  UPDATE public.staff_attendance AS attendance
  SET clock_out_time = COALESCE(attendance.clock_out_time, now()),
      hours_worked = ROUND(
        (EXTRACT(EPOCH FROM (COALESCE(attendance.clock_out_time, now()) - attendance.clock_in_time)) / 3600)::numeric,
        2
      ),
      updated_at = now()
  FROM public.staff AS staff
  WHERE attendance.school_id = _school_id
    AND attendance.staff_id = staff.id
    AND staff.user_id = auth.uid()
    AND staff.is_archived = false
    AND staff.status = 'active'
    AND attendance.attendance_date = (now() AT TIME ZONE school_timezone)::date
    AND attendance.clock_in_time IS NOT NULL
  RETURNING attendance.* INTO result_row;

  IF result_row.id IS NULL THEN
    RAISE EXCEPTION 'Clock in before clocking out';
  END IF;

  RETURN result_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.clock_staff_in(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.clock_staff_out(uuid) TO authenticated;
