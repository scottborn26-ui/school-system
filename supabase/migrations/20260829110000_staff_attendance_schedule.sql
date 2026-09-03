ALTER TABLE public.school_settings
  ADD COLUMN IF NOT EXISTS staff_attendance_end_time time NOT NULL DEFAULT '17:00';

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
  attendance_enabled boolean;
BEGIN
    SELECT COALESCE(timezone, 'Africa/Nairobi'), COALESCE(staff_attendance_enabled, true)
    INTO school_timezone, attendance_enabled
  FROM public.school_settings
  WHERE school_id = _school_id;

  IF NOT attendance_enabled THEN
    RAISE EXCEPTION 'Staff attendance clocking is disabled by the school administrator';
  END IF;

  local_date := (now() AT TIME ZONE COALESCE(school_timezone, 'Africa/Nairobi'))::date;
  local_time := (now() AT TIME ZONE COALESCE(school_timezone, 'Africa/Nairobi'))::time;
  late_cutoff := (SELECT staff_attendance_start_time + make_interval(mins => staff_attendance_grace_minutes)
                  FROM public.school_settings WHERE school_id = _school_id);

  SELECT * INTO staff_row FROM public.staff
  WHERE school_id = _school_id AND user_id = auth.uid()
    AND is_archived = false AND status = 'active' LIMIT 1;
  IF staff_row.id IS NULL THEN RAISE EXCEPTION 'No active staff record found'; END IF;

  INSERT INTO public.staff_attendance (school_id, staff_id, attendance_date, clock_in_time, status, reason)
  VALUES (_school_id, staff_row.id, local_date, now(),
          CASE WHEN late_cutoff IS NOT NULL AND local_time > late_cutoff THEN 'late' ELSE 'present' END,
          NULLIF(trim(_reason), ''))
  ON CONFLICT (school_id, staff_id, attendance_date) DO UPDATE SET
    clock_in_time = COALESCE(public.staff_attendance.clock_in_time, EXCLUDED.clock_in_time),
    status = CASE WHEN public.staff_attendance.status = 'present' AND EXCLUDED.status = 'late' THEN 'late' ELSE public.staff_attendance.status END,
    reason = COALESCE(public.staff_attendance.reason, EXCLUDED.reason), updated_at = now()
  RETURNING * INTO result_row;
  RETURN result_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.clock_staff_in(uuid, text) TO authenticated;

DROP POLICY IF EXISTS "staff_attendance_self_insert" ON public.staff_attendance;
CREATE POLICY "staff_attendance_self_insert" ON public.staff_attendance FOR INSERT TO authenticated
WITH CHECK (
  public.is_super_admin()
  OR public.has_school_role(school_id, ARRAY['admin','principal','deputy']::public.app_role[])
  OR EXISTS (
    SELECT 1 FROM public.staff s
    WHERE s.id = staff_id AND s.user_id = auth.uid() AND s.school_id = staff_attendance.school_id
  )
);

DROP POLICY IF EXISTS "staff_attendance_update" ON public.staff_attendance;
CREATE POLICY "staff_attendance_update" ON public.staff_attendance FOR UPDATE TO authenticated
USING (
  public.is_super_admin()
  OR public.has_school_role(school_id, ARRAY['admin','principal','deputy']::public.app_role[])
)
WITH CHECK (
  public.is_super_admin()
  OR public.has_school_role(school_id, ARRAY['admin','principal','deputy']::public.app_role[])
);
