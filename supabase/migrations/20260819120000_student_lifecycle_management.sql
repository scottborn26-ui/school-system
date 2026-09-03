-- Permanent learner profile and lifecycle history.
ALTER TYPE public.learner_status ADD VALUE IF NOT EXISTS 'expelled';
ALTER TYPE public.learner_status ADD VALUE IF NOT EXISTS 'deceased';

ALTER TABLE public.learners
  ADD COLUMN IF NOT EXISTS admission_year integer,
  ADD COLUMN IF NOT EXISTS entry_grade public.cbe_grade,
  ADD COLUMN IF NOT EXISTS entry_stream_id uuid REFERENCES public.streams(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS previous_school text,
  ADD COLUMN IF NOT EXISTS admission_reason text,
  ADD COLUMN IF NOT EXISTS admission_type text,
  ADD COLUMN IF NOT EXISTS sponsorship_information text,
  ADD COLUMN IF NOT EXISTS blood_group text,
  ADD COLUMN IF NOT EXISTS allergies text,
  ADD COLUMN IF NOT EXISTS medical_conditions text,
  ADD COLUMN IF NOT EXISTS special_needs text,
  ADD COLUMN IF NOT EXISTS doctor_contact text,
  ADD COLUMN IF NOT EXISTS medical_notes text;

CREATE TABLE public.student_class_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  learner_id uuid NOT NULL REFERENCES public.learners(id) ON DELETE CASCADE,
  enrollment_id uuid REFERENCES public.enrollments(id) ON DELETE SET NULL,
  academic_year_id uuid REFERENCES public.academic_years(id) ON DELETE SET NULL,
  grade public.cbe_grade NOT NULL,
  stream_id uuid REFERENCES public.streams(id) ON DELETE SET NULL,
  class_teacher_id uuid REFERENCES public.staff(id) ON DELETE SET NULL,
  enrollment_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date,
  status text NOT NULL DEFAULT 'active',
  promotion_status text,
  remarks text,
  movement_reason text,
  moved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.student_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  learner_id uuid NOT NULL REFERENCES public.learners(id) ON DELETE CASCADE,
  previous_status public.learner_status,
  new_status public.learner_status NOT NULL,
  effective_date date NOT NULL DEFAULT CURRENT_DATE,
  reason text,
  notes text,
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.student_exit_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  learner_id uuid NOT NULL REFERENCES public.learners(id) ON DELETE CASCADE,
  exit_date date NOT NULL,
  exit_type text NOT NULL,
  reason text,
  destination_school text,
  last_grade public.cbe_grade,
  last_stream_id uuid REFERENCES public.streams(id) ON DELETE SET NULL,
  academic_year_id uuid REFERENCES public.academic_years(id) ON DELETE SET NULL,
  clearance_status text NOT NULL DEFAULT 'pending',
  outstanding_balance numeric(12,2),
  leaving_certificate_number text,
  final_remarks text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.student_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  learner_id uuid NOT NULL REFERENCES public.learners(id) ON DELETE CASCADE,
  document_type text NOT NULL,
  file_name text NOT NULL,
  storage_path text NOT NULL,
  notes text,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  is_archived boolean NOT NULL DEFAULT false
);

CREATE INDEX student_class_history_learner_idx ON public.student_class_history (learner_id, enrollment_date DESC);
CREATE INDEX student_status_history_learner_idx ON public.student_status_history (learner_id, changed_at DESC);
CREATE INDEX student_exit_records_learner_idx ON public.student_exit_records (learner_id, exit_date DESC);
CREATE INDEX student_documents_learner_idx ON public.student_documents (learner_id, created_at DESC);

-- History is append-only. Corrections are represented by a new row and an audit entry.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['student_class_history','student_status_history','student_exit_records','student_documents']
  LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY "%s_member_read" ON public.%I FOR SELECT TO authenticated USING (public.is_super_admin() OR public.is_school_member(school_id))', t, t);
    EXECUTE format('CREATE POLICY "%s_member_insert" ON public.%I FOR INSERT TO authenticated WITH CHECK (public.is_super_admin() OR public.is_school_member(school_id))', t, t);
    EXECUTE format('CREATE POLICY "%s_admin_update" ON public.%I FOR UPDATE TO authenticated USING (public.is_super_admin() OR public.is_school_member(school_id)) WITH CHECK (public.is_super_admin() OR public.is_school_member(school_id))', t, t);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.prevent_student_history_delete()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Student lifecycle history cannot be deleted';
END; $$;

CREATE TRIGGER student_class_history_no_delete BEFORE DELETE ON public.student_class_history FOR EACH ROW EXECUTE FUNCTION public.prevent_student_history_delete();
CREATE TRIGGER student_status_history_no_delete BEFORE DELETE ON public.student_status_history FOR EACH ROW EXECUTE FUNCTION public.prevent_student_history_delete();
CREATE TRIGGER student_exit_records_no_delete BEFORE DELETE ON public.student_exit_records FOR EACH ROW EXECUTE FUNCTION public.prevent_student_history_delete();