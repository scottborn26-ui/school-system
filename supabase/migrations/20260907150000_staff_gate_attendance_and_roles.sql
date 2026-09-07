ALTER TABLE public.staff
  ADD COLUMN IF NOT EXISTS account_role text;

UPDATE public.staff s
SET account_role = ur.role::text
FROM public.user_roles ur
WHERE ur.user_id = s.user_id
  AND ur.school_id = s.school_id
  AND ur.is_active
  AND s.account_role IS NULL;

ALTER TABLE public.staff_attendance
  ADD COLUMN IF NOT EXISTS check_in_by uuid REFERENCES public.staff(id),
  ADD COLUMN IF NOT EXISTS check_out_by uuid REFERENCES public.staff(id);

ALTER TABLE public.staff_attendance
  DROP CONSTRAINT IF EXISTS staff_attendance_status_check;
ALTER TABLE public.staff_attendance
  ADD CONSTRAINT staff_attendance_status_check CHECK (status IN ('present','late','absent','on_leave','excused','half_day'));

DROP POLICY IF EXISTS "staff_attendance_update" ON public.staff_attendance;
CREATE POLICY "staff_attendance_update" ON public.staff_attendance FOR UPDATE TO authenticated
USING (public.is_super_admin() OR public.has_school_role(school_id, ARRAY['admin']::public.app_role[]))
WITH CHECK (public.is_super_admin() OR public.has_school_role(school_id, ARRAY['admin']::public.app_role[]));

CREATE TABLE IF NOT EXISTS public.attendance_settings (
  school_id uuid PRIMARY KEY REFERENCES public.schools(id) ON DELETE CASCADE,
  late_cutoff_time time NOT NULL DEFAULT '08:00',
  absent_auto_mark_time time NOT NULL DEFAULT '10:00'
);

INSERT INTO public.attendance_settings (school_id)
SELECT id FROM public.schools
ON CONFLICT (school_id) DO NOTHING;

ALTER TABLE public.attendance_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS attendance_settings_read ON public.attendance_settings;
CREATE POLICY attendance_settings_read ON public.attendance_settings FOR SELECT TO authenticated
USING (public.is_super_admin() OR public.has_school_role(school_id, ARRAY['admin','principal','deputy','security']::public.app_role[]));
DROP POLICY IF EXISTS attendance_settings_write ON public.attendance_settings;
CREATE POLICY attendance_settings_write ON public.attendance_settings FOR ALL TO authenticated
USING (public.is_super_admin() OR public.has_school_role(school_id, ARRAY['admin','principal','deputy']::public.app_role[]))
WITH CHECK (public.is_super_admin() OR public.has_school_role(school_id, ARRAY['admin','principal','deputy']::public.app_role[]));

CREATE TABLE IF NOT EXISTS public.attendance_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  attendance_id uuid NOT NULL REFERENCES public.staff_attendance(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id),
  action text NOT NULL,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.attendance_audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS attendance_audit_read ON public.attendance_audit_log;
CREATE POLICY attendance_audit_read ON public.attendance_audit_log FOR SELECT TO authenticated
USING (public.is_super_admin() OR public.has_school_role(school_id, ARRAY['admin','principal','deputy']::public.app_role[]));

CREATE OR REPLACE FUNCTION public.log_staff_attendance_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.attendance_audit_log (school_id, attendance_id, actor_id, action, before_data, after_data)
  VALUES (NEW.school_id, NEW.id, auth.uid(), TG_OP, to_jsonb(OLD), to_jsonb(NEW));
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS staff_attendance_audit_trigger ON public.staff_attendance;
CREATE TRIGGER staff_attendance_audit_trigger
AFTER UPDATE ON public.staff_attendance
FOR EACH ROW EXECUTE FUNCTION public.log_staff_attendance_change();

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
BEGIN
  IF NOT public.has_school_role(_school_id, ARRAY['security']::public.app_role[]) THEN
    RAISE EXCEPTION 'Only an assigned security guard can use gate attendance';
  END IF;
  IF _action NOT IN ('in', 'out') THEN RAISE EXCEPTION 'Invalid attendance action'; END IF;

  SELECT id INTO guard_id FROM public.staff
  WHERE school_id = _school_id AND user_id = auth.uid() AND is_archived = false AND status = 'active'
  LIMIT 1;
  IF guard_id IS NULL THEN RAISE EXCEPTION 'No active security staff record found'; END IF;

  IF NOT EXISTS (SELECT 1 FROM public.staff WHERE id = _staff_id AND school_id = _school_id AND is_archived = false AND status = 'active') THEN
    RAISE EXCEPTION 'Staff member not found';
  END IF;

  SELECT COALESCE(timezone, 'Africa/Nairobi') INTO school_timezone FROM public.school_settings WHERE school_id = _school_id;
  school_timezone := COALESCE(school_timezone, 'Africa/Nairobi');
  local_date := (now() AT TIME ZONE school_timezone)::date;
  local_time := (now() AT TIME ZONE school_timezone)::time;
  SELECT COALESCE(a.late_cutoff_time, s.staff_attendance_start_time + make_interval(mins => s.staff_attendance_grace_minutes))
  INTO late_cutoff
  FROM public.school_settings s
  LEFT JOIN public.attendance_settings a ON a.school_id = s.school_id
  WHERE s.school_id = _school_id;

  IF _action = 'in' THEN
    INSERT INTO public.staff_attendance (school_id, staff_id, attendance_date, clock_in_time, check_in_by, status)
    VALUES (_school_id, _staff_id, local_date, now(), guard_id, CASE WHEN local_time > late_cutoff THEN 'late' ELSE 'present' END)
    ON CONFLICT (school_id, staff_id, attendance_date) DO UPDATE SET
      clock_in_time = COALESCE(public.staff_attendance.clock_in_time, EXCLUDED.clock_in_time),
      check_in_by = COALESCE(public.staff_attendance.check_in_by, EXCLUDED.check_in_by),
      status = CASE WHEN public.staff_attendance.status = 'absent' THEN EXCLUDED.status ELSE public.staff_attendance.status END,
      updated_at = now();
  ELSE
    UPDATE public.staff_attendance
    SET clock_out_time = COALESCE(clock_out_time, now()), check_out_by = COALESCE(check_out_by, guard_id),
        hours_worked = CASE WHEN clock_in_time IS NULL THEN hours_worked ELSE ROUND((EXTRACT(EPOCH FROM (COALESCE(clock_out_time, now()) - clock_in_time)) / 3600)::numeric, 2) END,
        updated_at = now()
    WHERE school_id = _school_id AND staff_id = _staff_id AND attendance_date = local_date AND clock_in_time IS NOT NULL;
    IF NOT FOUND THEN RAISE EXCEPTION 'Staff member must be checked in before checking out'; END IF;
  END IF;

  SELECT * INTO result_row FROM public.staff_attendance
  WHERE school_id = _school_id AND staff_id = _staff_id AND attendance_date = local_date;
  RETURN result_row;
END;
$$;
GRANT EXECUTE ON FUNCTION public.gate_clock_staff(uuid, uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.list_gate_staff(_school_id uuid)
RETURNS TABLE (id uuid, full_name text, job_title text, photo_url text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_school_role(_school_id, ARRAY['security']::public.app_role[]) THEN
    RAISE EXCEPTION 'Only an assigned security guard can view gate staff';
  END IF;
  RETURN QUERY
  SELECT s.id, s.full_name, s.job_title, s.photo_url
  FROM public.staff s
  WHERE s.school_id = _school_id AND s.is_archived = false AND s.status = 'active'
  ORDER BY s.full_name;
END;
$$;
GRANT EXECUTE ON FUNCTION public.list_gate_staff(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_staff_attendance_absent()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE marked integer := 0;
BEGIN
  INSERT INTO public.staff_attendance (school_id, staff_id, attendance_date, status)
  SELECT s.school_id, s.id, (now() AT TIME ZONE COALESCE(ss.timezone, 'Africa/Nairobi'))::date, 'absent'
  FROM public.staff s
  LEFT JOIN public.school_settings ss ON ss.school_id = s.school_id
  LEFT JOIN public.attendance_settings aset ON aset.school_id = s.school_id
  WHERE s.is_archived = false AND s.status = 'active'
    AND (now() AT TIME ZONE COALESCE(ss.timezone, 'Africa/Nairobi'))::time >= COALESCE(aset.absent_auto_mark_time, '10:00')
  ON CONFLICT (school_id, staff_id, attendance_date) DO NOTHING;
  GET DIAGNOSTICS marked = ROW_COUNT;
  RETURN marked;
END;
$$;
GRANT EXECUTE ON FUNCTION public.mark_staff_attendance_absent() TO service_role;

CREATE OR REPLACE FUNCTION public.sync_staff_account_role()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.staff SET account_role = NEW.role::text, updated_at = now()
  WHERE user_id = NEW.user_id AND school_id = NEW.school_id;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS sync_staff_account_role_trigger ON public.user_roles;
CREATE TRIGGER sync_staff_account_role_trigger
AFTER INSERT OR UPDATE OF role, is_active ON public.user_roles
FOR EACH ROW WHEN (NEW.is_active) EXECUTE FUNCTION public.sync_staff_account_role();

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    PERFORM cron.schedule('mark-staff-attendance-absences', '*/15 * * * *', $job$SELECT public.mark_staff_attendance_absent();$job$)
    WHERE NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'mark-staff-attendance-absences');
  END IF;
END $$;
