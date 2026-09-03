ALTER TABLE public.school_settings
  ADD COLUMN IF NOT EXISTS staff_attendance_start_time time NOT NULL DEFAULT '08:00',
  ADD COLUMN IF NOT EXISTS staff_attendance_grace_minutes integer NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS staff_attendance_require_late_reason boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS staff_attendance_enabled boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.staff_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  staff_id uuid NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  attendance_date date NOT NULL,
  clock_in_time timestamptz,
  clock_out_time timestamptz,
  hours_worked numeric(5,2),
  status text NOT NULL DEFAULT 'present' CHECK (status IN ('present','late','absent','on_leave','half_day')),
  is_manual_override boolean NOT NULL DEFAULT false,
  edited_by uuid REFERENCES auth.users(id),
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, staff_id, attendance_date)
);

CREATE INDEX IF NOT EXISTS staff_attendance_school_date_idx
  ON public.staff_attendance (school_id, attendance_date);
CREATE INDEX IF NOT EXISTS staff_attendance_staff_date_idx
  ON public.staff_attendance (staff_id, attendance_date DESC);
GRANT SELECT, INSERT, UPDATE ON public.staff_attendance TO authenticated;
GRANT ALL ON public.staff_attendance TO service_role;
ALTER TABLE public.staff_attendance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_attendance_read" ON public.staff_attendance;
CREATE POLICY "staff_attendance_read" ON public.staff_attendance FOR SELECT TO authenticated
USING (
  public.is_super_admin()
  OR public.has_school_role(school_id, ARRAY['admin','principal','deputy']::public.app_role[])
  OR EXISTS (
    SELECT 1 FROM public.staff s
    WHERE s.id = staff_attendance.staff_id AND s.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "staff_attendance_self_insert" ON public.staff_attendance;
CREATE POLICY "staff_attendance_self_insert" ON public.staff_attendance FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.staff s WHERE s.id = staff_id AND s.user_id = auth.uid() AND s.school_id = staff_attendance.school_id)
);

DROP POLICY IF EXISTS "staff_attendance_update" ON public.staff_attendance;
CREATE POLICY "staff_attendance_update" ON public.staff_attendance FOR UPDATE TO authenticated
USING (
  public.is_super_admin()
  OR public.has_school_role(school_id, ARRAY['admin','principal','deputy']::public.app_role[])
  OR EXISTS (SELECT 1 FROM public.staff s WHERE s.id = staff_id AND s.user_id = auth.uid())
)
WITH CHECK (
  public.is_super_admin()
  OR public.has_school_role(school_id, ARRAY['admin','principal','deputy']::public.app_role[])
  OR EXISTS (SELECT 1 FROM public.staff s WHERE s.id = staff_id AND s.user_id = auth.uid())
);

CREATE OR REPLACE FUNCTION public.clock_staff_in(_school_id uuid, _reason text DEFAULT NULL)
RETURNS public.staff_attendance
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  staff_row public.staff%ROWTYPE;
  result_row public.staff_attendance%ROWTYPE;
  local_date date;
  local_time time;
  late_cutoff time;
BEGIN
  SELECT * INTO staff_row FROM public.staff
  WHERE school_id = _school_id AND user_id = auth.uid() AND is_archived = false AND status = 'active'
  LIMIT 1;
  IF staff_row.id IS NULL THEN RAISE EXCEPTION 'No active staff record found'; END IF;
  local_date := (now() AT TIME ZONE COALESCE((SELECT timezone FROM public.school_settings WHERE school_id = _school_id), 'Africa/Nairobi'))::date;
  local_time := (now() AT TIME ZONE COALESCE((SELECT timezone FROM public.school_settings WHERE school_id = _school_id), 'Africa/Nairobi'))::time;
  late_cutoff := (SELECT staff_attendance_start_time + make_interval(mins => staff_attendance_grace_minutes) FROM public.school_settings WHERE school_id = _school_id);
  INSERT INTO public.staff_attendance (school_id, staff_id, attendance_date, clock_in_time, status, reason)
  VALUES (_school_id, staff_row.id, local_date, now(), CASE WHEN late_cutoff IS NOT NULL AND local_time > late_cutoff THEN 'late' ELSE 'present' END, NULLIF(trim(_reason), ''))
  ON CONFLICT (school_id, staff_id, attendance_date) DO UPDATE SET clock_in_time = COALESCE(staff_attendance.clock_in_time, EXCLUDED.clock_in_time), status = CASE WHEN staff_attendance.status = 'present' AND EXCLUDED.status = 'late' THEN 'late' ELSE staff_attendance.status END, reason = COALESCE(staff_attendance.reason, EXCLUDED.reason), updated_at = now()
  RETURNING * INTO result_row;
  RETURN result_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.clock_staff_out(_school_id uuid)
RETURNS public.staff_attendance
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE result_row public.staff_attendance%ROWTYPE;
BEGIN
  UPDATE public.staff_attendance a SET clock_out_time = COALESCE(a.clock_out_time, now()), hours_worked = ROUND((EXTRACT(EPOCH FROM (COALESCE(a.clock_out_time, now()) - a.clock_in_time)) / 3600)::numeric, 2), updated_at = now()
  FROM public.staff s WHERE a.school_id = _school_id AND a.staff_id = s.id AND s.user_id = auth.uid() AND a.attendance_date = (now() AT TIME ZONE COALESCE((SELECT timezone FROM public.school_settings WHERE school_id = _school_id), 'Africa/Nairobi'))::date AND a.clock_in_time IS NOT NULL
  RETURNING a.* INTO result_row;
  IF result_row.id IS NULL THEN RAISE EXCEPTION 'Clock in before clocking out'; END IF;
  RETURN result_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.clock_staff_in(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.clock_staff_out(uuid) TO authenticated;