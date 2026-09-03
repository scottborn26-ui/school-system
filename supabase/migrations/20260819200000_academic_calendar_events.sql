-- Extend the academic calendar with mid-term breaks and school events.
ALTER TABLE public.terms
  ADD COLUMN IF NOT EXISTS midterm_start_date date,
  ADD COLUMN IF NOT EXISTS midterm_end_date date;

CREATE TABLE IF NOT EXISTS public.academic_calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  academic_year_id uuid NOT NULL REFERENCES public.academic_years(id) ON DELETE CASCADE,
  title text NOT NULL,
  event_type text NOT NULL DEFAULT 'other',
  start_date date NOT NULL,
  end_date date,
  notes text,
  all_day boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT academic_calendar_events_dates CHECK (end_date IS NULL OR end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS academic_calendar_events_year_dates_idx
  ON public.academic_calendar_events (school_id, academic_year_id, start_date);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.academic_calendar_events TO authenticated;
GRANT ALL ON public.academic_calendar_events TO service_role;
ALTER TABLE public.academic_calendar_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS academic_calendar_events_read ON public.academic_calendar_events;
CREATE POLICY academic_calendar_events_read ON public.academic_calendar_events
  FOR SELECT TO authenticated
  USING (public.is_super_admin() OR public.is_school_member(school_id));

DROP POLICY IF EXISTS academic_calendar_events_insert ON public.academic_calendar_events;
CREATE POLICY academic_calendar_events_insert ON public.academic_calendar_events
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_super_admin()
    OR (public.is_school_admin(school_id) AND created_by = auth.uid())
  );

DROP POLICY IF EXISTS academic_calendar_events_update ON public.academic_calendar_events;
CREATE POLICY academic_calendar_events_update ON public.academic_calendar_events
  FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.is_school_admin(school_id))
  WITH CHECK (public.is_super_admin() OR public.is_school_admin(school_id));

DROP POLICY IF EXISTS academic_calendar_events_delete ON public.academic_calendar_events;
CREATE POLICY academic_calendar_events_delete ON public.academic_calendar_events
  FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.is_school_admin(school_id));

DROP TRIGGER IF EXISTS academic_calendar_events_updated_at ON public.academic_calendar_events;
CREATE TRIGGER academic_calendar_events_updated_at
  BEFORE UPDATE ON public.academic_calendar_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
