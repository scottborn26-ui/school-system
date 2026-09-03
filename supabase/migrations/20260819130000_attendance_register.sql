CREATE TABLE public.attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  academic_year_id uuid REFERENCES public.academic_years(id) ON DELETE SET NULL,
  term_id uuid REFERENCES public.terms(id) ON DELETE SET NULL,
  stream_id uuid NOT NULL REFERENCES public.streams(id) ON DELETE CASCADE,
  learner_id uuid NOT NULL REFERENCES public.learners(id) ON DELETE CASCADE,
  attendance_date date NOT NULL,
  status text NOT NULL DEFAULT 'present' CHECK (status IN ('present', 'absent', 'late', 'excused')),
  notes text,
  marked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, learner_id, attendance_date)
);

CREATE INDEX attendance_records_register_idx
  ON public.attendance_records (school_id, stream_id, attendance_date);

ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "attendance_select" ON public.attendance_records FOR SELECT TO authenticated
  USING (public.is_school_member(school_id) OR public.is_super_admin());
CREATE POLICY "attendance_insert" ON public.attendance_records FOR INSERT TO authenticated
  WITH CHECK (
    public.has_school_role(school_id, ARRAY['principal','deputy','teacher','class_teacher']::public.app_role[])
    OR public.is_super_admin()
  );
CREATE POLICY "attendance_update" ON public.attendance_records FOR UPDATE TO authenticated
  USING (
    public.has_school_role(school_id, ARRAY['principal','deputy','teacher','class_teacher']::public.app_role[])
    OR public.is_super_admin()
  )
  WITH CHECK (
    public.has_school_role(school_id, ARRAY['principal','deputy','teacher','class_teacher']::public.app_role[])
    OR public.is_super_admin()
  );
