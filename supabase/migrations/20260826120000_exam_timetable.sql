-- One-off exam sessions are separate from recurring lesson timetable slots.
CREATE TABLE public.exam_timetable_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  assessment_id uuid NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  grade public.cbe_grade NOT NULL,
  session_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  venue text,
  invigilator_id uuid REFERENCES public.staff(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_time > start_time)
);

CREATE INDEX exam_timetable_school_date_idx ON public.exam_timetable_sessions(school_id, session_date, start_time);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exam_timetable_sessions TO authenticated;
GRANT ALL ON public.exam_timetable_sessions TO service_role;
ALTER TABLE public.exam_timetable_sessions ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_exam_timetable_admin(_school_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_super_admin() OR public.has_school_role(
    _school_id, ARRAY['admin','principal','deputy','exam_officer']::public.app_role[]
  );
$$;
GRANT EXECUTE ON FUNCTION public.is_exam_timetable_admin(uuid) TO authenticated, service_role;

CREATE POLICY exam_timetable_admin_select ON public.exam_timetable_sessions FOR SELECT TO authenticated
USING (public.is_exam_timetable_admin(school_id) OR (
  status = 'published' AND EXISTS (
    SELECT 1 FROM public.staff st
    JOIN public.teacher_allocations ta ON ta.staff_id = st.id
    WHERE st.user_id = auth.uid() AND st.school_id = exam_timetable_sessions.school_id
      AND st.is_archived = false AND st.status = 'active' AND ta.is_active
      AND ta.stream_id IN (SELECT id FROM public.streams WHERE grade = exam_timetable_sessions.grade)
  )
));
CREATE POLICY exam_timetable_admin_insert ON public.exam_timetable_sessions FOR INSERT TO authenticated
WITH CHECK (public.is_exam_timetable_admin(school_id));
CREATE POLICY exam_timetable_admin_update ON public.exam_timetable_sessions FOR UPDATE TO authenticated
USING (public.is_exam_timetable_admin(school_id))
WITH CHECK (public.is_exam_timetable_admin(school_id));
CREATE POLICY exam_timetable_admin_delete ON public.exam_timetable_sessions FOR DELETE TO authenticated
USING (public.is_exam_timetable_admin(school_id));

CREATE OR REPLACE FUNCTION public.validate_exam_timetable_session()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.assessment_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.assessments a
    WHERE a.id = NEW.assessment_id AND a.school_id = NEW.school_id AND a.grade = NEW.grade
  ) THEN
    RAISE EXCEPTION 'The assessment must belong to the selected school and grade';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.exam_timetable_sessions existing
    WHERE existing.school_id = NEW.school_id AND existing.id <> NEW.id
      AND existing.grade = NEW.grade AND existing.session_date = NEW.session_date
      AND NEW.start_time < existing.end_time AND NEW.end_time > existing.start_time
  ) THEN RAISE EXCEPTION 'This grade already has an overlapping exam session'; END IF;
  IF NEW.venue IS NOT NULL AND btrim(NEW.venue) <> '' AND EXISTS (
    SELECT 1 FROM public.exam_timetable_sessions existing
    WHERE existing.school_id = NEW.school_id AND existing.id <> NEW.id
      AND lower(btrim(existing.venue)) = lower(btrim(NEW.venue))
      AND existing.session_date = NEW.session_date
      AND NEW.start_time < existing.end_time AND NEW.end_time > existing.start_time
  ) THEN RAISE EXCEPTION 'This venue is already booked for the selected time'; END IF;
  IF NEW.invigilator_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.exam_timetable_sessions existing
    WHERE existing.school_id = NEW.school_id AND existing.id <> NEW.id
      AND existing.invigilator_id = NEW.invigilator_id
      AND existing.session_date = NEW.session_date
      AND NEW.start_time < existing.end_time AND NEW.end_time > existing.start_time
  ) THEN RAISE EXCEPTION 'This invigilator is already booked for the selected time'; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER exam_timetable_session_validation
BEFORE INSERT OR UPDATE ON public.exam_timetable_sessions
FOR EACH ROW EXECUTE FUNCTION public.validate_exam_timetable_session();
CREATE TRIGGER exam_timetable_sessions_updated
BEFORE UPDATE ON public.exam_timetable_sessions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
