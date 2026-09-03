-- =========================
-- Counters (invoice/receipt numbering)
-- =========================
CREATE TABLE public.school_counters (
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  key text NOT NULL,
  seq integer NOT NULL DEFAULT 0,
  PRIMARY KEY (school_id, key)
);
GRANT SELECT ON public.school_counters TO authenticated;
GRANT ALL ON public.school_counters TO service_role;
ALTER TABLE public.school_counters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "counters_select" ON public.school_counters FOR SELECT TO authenticated
  USING (public.is_school_member(school_id) OR public.is_super_admin());

CREATE OR REPLACE FUNCTION public.next_counter(_school_id uuid, _key text, _prefix text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  IF NOT (public.is_school_member(_school_id) OR public.is_super_admin()) THEN
    RAISE EXCEPTION 'Not authorized for this school';
  END IF;
  INSERT INTO public.school_counters(school_id, key, seq) VALUES (_school_id, _key, 1)
  ON CONFLICT (school_id, key) DO UPDATE SET seq = public.school_counters.seq + 1
  RETURNING seq INTO n;
  RETURN _prefix || '-' || to_char(now(), 'YYYY') || '-' || lpad(n::text, 5, '0');
END; $$;

-- =========================
-- Learning areas
-- =========================
CREATE TABLE public.learning_areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text,
  grades public.cbe_grade[] NOT NULL DEFAULT '{}',
  is_core boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, name)
);
GRANT SELECT, INSERT, UPDATE ON public.learning_areas TO authenticated;
GRANT ALL ON public.learning_areas TO service_role;
ALTER TABLE public.learning_areas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "la_select" ON public.learning_areas FOR SELECT TO authenticated
  USING (public.is_school_member(school_id) OR public.is_super_admin());
CREATE POLICY "la_insert" ON public.learning_areas FOR INSERT TO authenticated
  WITH CHECK (public.is_school_admin(school_id) OR public.is_super_admin());
CREATE POLICY "la_update" ON public.learning_areas FOR UPDATE TO authenticated
  USING (public.is_school_admin(school_id) OR public.is_super_admin())
  WITH CHECK (public.is_school_admin(school_id) OR public.is_super_admin());
CREATE TRIGGER trg_learning_areas_updated BEFORE UPDATE ON public.learning_areas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================
-- Teacher allocations
-- =========================
CREATE TABLE public.teacher_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  academic_year_id uuid REFERENCES public.academic_years(id),
  staff_id uuid NOT NULL REFERENCES public.staff(id),
  stream_id uuid NOT NULL REFERENCES public.streams(id),
  learning_area_id uuid NOT NULL REFERENCES public.learning_areas(id),
  periods_per_week integer NOT NULL DEFAULT 4 CHECK (periods_per_week BETWEEN 1 AND 20),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (stream_id, learning_area_id)
);
GRANT SELECT, INSERT, UPDATE ON public.teacher_allocations TO authenticated;
GRANT ALL ON public.teacher_allocations TO service_role;
ALTER TABLE public.teacher_allocations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ta_select" ON public.teacher_allocations FOR SELECT TO authenticated
  USING (public.is_school_member(school_id) OR public.is_super_admin());
CREATE POLICY "ta_insert" ON public.teacher_allocations FOR INSERT TO authenticated
  WITH CHECK (public.is_school_admin(school_id) OR public.is_super_admin());
CREATE POLICY "ta_update" ON public.teacher_allocations FOR UPDATE TO authenticated
  USING (public.is_school_admin(school_id) OR public.is_super_admin())
  WITH CHECK (public.is_school_admin(school_id) OR public.is_super_admin());
CREATE TRIGGER trg_teacher_allocations_updated BEFORE UPDATE ON public.teacher_allocations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================
-- Timetable
-- =========================
CREATE TABLE public.timetable_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  period_index integer NOT NULL CHECK (period_index BETWEEN 1 AND 15),
  label text NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  is_break boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, period_index)
);
GRANT SELECT, INSERT, UPDATE ON public.timetable_periods TO authenticated;
GRANT ALL ON public.timetable_periods TO service_role;
ALTER TABLE public.timetable_periods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tp_select" ON public.timetable_periods FOR SELECT TO authenticated
  USING (public.is_school_member(school_id) OR public.is_super_admin());
CREATE POLICY "tp_insert" ON public.timetable_periods FOR INSERT TO authenticated
  WITH CHECK (public.is_school_admin(school_id) OR public.is_super_admin());
CREATE POLICY "tp_update" ON public.timetable_periods FOR UPDATE TO authenticated
  USING (public.is_school_admin(school_id) OR public.is_super_admin())
  WITH CHECK (public.is_school_admin(school_id) OR public.is_super_admin());
CREATE TRIGGER trg_timetable_periods_updated BEFORE UPDATE ON public.timetable_periods
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.timetables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  academic_year_id uuid REFERENCES public.academic_years(id),
  term_id uuid REFERENCES public.terms(id),
  version integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  notes text,
  published_at timestamptz,
  published_by uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.timetables TO authenticated;
GRANT ALL ON public.timetables TO service_role;
ALTER TABLE public.timetables ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tt_select" ON public.timetables FOR SELECT TO authenticated
  USING (public.is_school_member(school_id) OR public.is_super_admin());
CREATE POLICY "tt_insert" ON public.timetables FOR INSERT TO authenticated
  WITH CHECK (public.is_school_admin(school_id) OR public.is_super_admin());
CREATE POLICY "tt_update" ON public.timetables FOR UPDATE TO authenticated
  USING (public.is_school_admin(school_id) OR public.is_super_admin())
  WITH CHECK (public.is_school_admin(school_id) OR public.is_super_admin());
CREATE TRIGGER trg_timetables_updated BEFORE UPDATE ON public.timetables
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.timetable_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  timetable_id uuid NOT NULL REFERENCES public.timetables(id) ON DELETE CASCADE,
  stream_id uuid NOT NULL REFERENCES public.streams(id),
  learning_area_id uuid REFERENCES public.learning_areas(id),
  staff_id uuid REFERENCES public.staff(id),
  room_id uuid REFERENCES public.rooms(id),
  day_of_week integer NOT NULL CHECK (day_of_week BETWEEN 1 AND 5),
  period_index integer NOT NULL CHECK (period_index BETWEEN 1 AND 15),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (timetable_id, stream_id, day_of_week, period_index)
);
CREATE UNIQUE INDEX timetable_slots_teacher_unique
  ON public.timetable_slots (timetable_id, staff_id, day_of_week, period_index)
  WHERE staff_id IS NOT NULL;
CREATE UNIQUE INDEX timetable_slots_room_unique
  ON public.timetable_slots (timetable_id, room_id, day_of_week, period_index)
  WHERE room_id IS NOT NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.timetable_slots TO authenticated;
GRANT ALL ON public.timetable_slots TO service_role;
ALTER TABLE public.timetable_slots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ts_select" ON public.timetable_slots FOR SELECT TO authenticated
  USING (public.is_school_member(school_id) OR public.is_super_admin());
CREATE POLICY "ts_insert" ON public.timetable_slots FOR INSERT TO authenticated
  WITH CHECK ((public.is_school_admin(school_id) OR public.is_super_admin())
    AND EXISTS (SELECT 1 FROM public.timetables t WHERE t.id = timetable_id AND t.status = 'draft'));
CREATE POLICY "ts_update" ON public.timetable_slots FOR UPDATE TO authenticated
  USING ((public.is_school_admin(school_id) OR public.is_super_admin())
    AND EXISTS (SELECT 1 FROM public.timetables t WHERE t.id = timetable_id AND t.status = 'draft'))
  WITH CHECK (public.is_school_admin(school_id) OR public.is_super_admin());
CREATE POLICY "ts_delete" ON public.timetable_slots FOR DELETE TO authenticated
  USING ((public.is_school_admin(school_id) OR public.is_super_admin())
    AND EXISTS (SELECT 1 FROM public.timetables t WHERE t.id = timetable_id AND t.status = 'draft'));
CREATE TRIGGER trg_timetable_slots_updated BEFORE UPDATE ON public.timetable_slots
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================
-- Assessments and marks
-- =========================
CREATE TABLE public.assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  academic_year_id uuid REFERENCES public.academic_years(id),
  term_id uuid REFERENCES public.terms(id),
  grade public.cbe_grade NOT NULL,
  stream_id uuid REFERENCES public.streams(id),
  learning_area_id uuid NOT NULL REFERENCES public.learning_areas(id),
  title text NOT NULL,
  assessment_type text NOT NULL DEFAULT 'formative'
    CHECK (assessment_type IN ('formative','summative','kpsea','kjsea','project','observation')),
  entry_mode text NOT NULL DEFAULT 'numeric'
    CHECK (entry_mode IN ('numeric','kjsea_competency','kpsea_sections','observation')),
  max_score numeric NOT NULL DEFAULT 100 CHECK (max_score > 0),
  weight numeric NOT NULL DEFAULT 1 CHECK (weight >= 0),
  assessment_date date NOT NULL DEFAULT current_date,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','submitted','approved','locked')),
  created_by uuid,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.assessments TO authenticated;
GRANT ALL ON public.assessments TO service_role;
ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "as_select" ON public.assessments FOR SELECT TO authenticated
  USING (public.is_school_member(school_id) OR public.is_super_admin());
CREATE POLICY "as_insert" ON public.assessments FOR INSERT TO authenticated
  WITH CHECK (public.has_school_role(school_id, ARRAY['principal','deputy','teacher','class_teacher']::public.app_role[])
    OR public.is_super_admin());
CREATE POLICY "as_update" ON public.assessments FOR UPDATE TO authenticated
  USING (public.has_school_role(school_id, ARRAY['principal','deputy','teacher','class_teacher']::public.app_role[])
    OR public.is_super_admin())
  WITH CHECK (public.has_school_role(school_id, ARRAY['principal','deputy','teacher','class_teacher']::public.app_role[])
    OR public.is_super_admin());
CREATE TRIGGER trg_assessments_updated BEFORE UPDATE ON public.assessments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Only principals/deputies may approve or lock; teachers may only move draft<->submitted
CREATE OR REPLACE FUNCTION public.guard_assessment_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status IN ('approved','locked')
       AND NOT (public.is_school_admin(NEW.school_id) OR public.is_super_admin()) THEN
      RAISE EXCEPTION 'Only the principal or deputy can approve or lock an assessment';
    END IF;
    IF OLD.status = 'locked' AND NOT public.is_super_admin() THEN
      RAISE EXCEPTION 'A locked assessment cannot be reopened';
    END IF;
    IF NEW.status IN ('approved','locked') AND NEW.approved_at IS NULL THEN
      NEW.approved_at := now();
      NEW.approved_by := auth.uid();
    END IF;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_assessments_status BEFORE UPDATE ON public.assessments
  FOR EACH ROW EXECUTE FUNCTION public.guard_assessment_status();

CREATE TABLE public.marks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  assessment_id uuid NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  learner_id uuid NOT NULL REFERENCES public.learners(id),
  raw_score numeric,
  percentage numeric,
  level_code text,
  points integer,
  descriptor text,
  is_absent boolean NOT NULL DEFAULT false,
  is_exempt boolean NOT NULL DEFAULT false,
  comment text,
  entered_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (assessment_id, learner_id)
);
GRANT SELECT, INSERT, UPDATE ON public.marks TO authenticated;
GRANT ALL ON public.marks TO service_role;
ALTER TABLE public.marks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mk_select" ON public.marks FOR SELECT TO authenticated
  USING (public.is_school_member(school_id) OR public.is_super_admin());
CREATE POLICY "mk_insert" ON public.marks FOR INSERT TO authenticated
  WITH CHECK ((public.has_school_role(school_id, ARRAY['principal','deputy','teacher','class_teacher']::public.app_role[])
      OR public.is_super_admin())
    AND EXISTS (SELECT 1 FROM public.assessments a WHERE a.id = assessment_id AND a.status IN ('draft','submitted')));
CREATE POLICY "mk_update" ON public.marks FOR UPDATE TO authenticated
  USING ((public.has_school_role(school_id, ARRAY['principal','deputy','teacher','class_teacher']::public.app_role[])
      OR public.is_super_admin())
    AND EXISTS (SELECT 1 FROM public.assessments a WHERE a.id = assessment_id AND a.status IN ('draft','submitted')))
  WITH CHECK (public.has_school_role(school_id, ARRAY['principal','deputy','teacher','class_teacher']::public.app_role[])
      OR public.is_super_admin());
CREATE TRIGGER trg_marks_updated BEFORE UPDATE ON public.marks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Server-side validation + KJSEA/KPSEA derivation
CREATE OR REPLACE FUNCTION public.validate_mark()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a record; pct numeric;
BEGIN
  SELECT * INTO a FROM public.assessments WHERE id = NEW.assessment_id;
  IF a IS NULL THEN RAISE EXCEPTION 'Assessment not found'; END IF;
  IF a.status IN ('approved','locked') THEN
    RAISE EXCEPTION 'Marks for an approved or locked assessment cannot be changed';
  END IF;
  NEW.school_id := a.school_id;

  IF NEW.is_absent OR NEW.is_exempt THEN
    NEW.raw_score := NULL; NEW.percentage := NULL; NEW.points := NULL;
    NEW.level_code := NULL; NEW.descriptor := CASE WHEN NEW.is_absent THEN 'Absent' ELSE 'Exempt' END;
    RETURN NEW;
  END IF;

  IF NEW.raw_score IS NULL THEN
    NEW.percentage := NULL; NEW.points := NULL; NEW.level_code := NULL; NEW.descriptor := NULL;
    RETURN NEW;
  END IF;

  IF NEW.raw_score < 0 OR NEW.raw_score > a.max_score THEN
    RAISE EXCEPTION 'Score % is outside the valid range 0 to %', NEW.raw_score, a.max_score;
  END IF;

  pct := round((NEW.raw_score / a.max_score) * 100, 2);
  NEW.percentage := pct;

  IF a.entry_mode IN ('kjsea_competency','kpsea_sections') THEN
    SELECT code, pts, nm INTO NEW.level_code, NEW.points, NEW.descriptor FROM (
      VALUES
        ('EE1', 8, 'Exceeding Expectations 1', 90::numeric, 100::numeric),
        ('EE2', 7, 'Exceeding Expectations 2', 75, 89.999999),
        ('ME1', 6, 'Meeting Expectations 1', 58, 74.999999),
        ('ME2', 5, 'Meeting Expectations 2', 41, 57.999999),
        ('AE1', 4, 'Approaching Expectations 1', 31, 40.999999),
        ('AE2', 3, 'Approaching Expectations 2', 21, 30.999999),
        ('BE1', 2, 'Below Expectations 1', 11, 20.999999),
        ('BE2', 1, 'Below Expectations 2', 0, 10.999999)
    ) AS lv(code, pts, nm, lo, hi)
    WHERE pct >= lv.lo AND pct <= lv.hi LIMIT 1;
  ELSIF a.entry_mode = 'observation' THEN
    NEW.level_code := CASE WHEN pct >= 75 THEN 'EE' WHEN pct >= 50 THEN 'ME' WHEN pct >= 30 THEN 'AE' ELSE 'BE' END;
    NEW.descriptor := CASE NEW.level_code
      WHEN 'EE' THEN 'Exceeding Expectations' WHEN 'ME' THEN 'Meeting Expectations'
      WHEN 'AE' THEN 'Approaching Expectations' ELSE 'Below Expectations' END;
    NEW.points := NULL;
  ELSE
    NEW.level_code := NULL; NEW.points := NULL; NEW.descriptor := NULL;
  END IF;

  NEW.entered_by := COALESCE(NEW.entered_by, auth.uid());
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_marks_validate BEFORE INSERT OR UPDATE ON public.marks
  FOR EACH ROW EXECUTE FUNCTION public.validate_mark();

-- =========================
-- Finance
-- =========================
CREATE TABLE public.fee_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  grade public.cbe_grade,
  term_id uuid REFERENCES public.terms(id),
  amount numeric NOT NULL CHECK (amount >= 0),
  is_mandatory boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.fee_items TO authenticated;
GRANT ALL ON public.fee_items TO service_role;
ALTER TABLE public.fee_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fi_select" ON public.fee_items FOR SELECT TO authenticated
  USING (public.is_school_member(school_id) OR public.is_super_admin());
CREATE POLICY "fi_insert" ON public.fee_items FOR INSERT TO authenticated
  WITH CHECK (public.has_school_role(school_id, ARRAY['principal','deputy','bursar']::public.app_role[]) OR public.is_super_admin());
CREATE POLICY "fi_update" ON public.fee_items FOR UPDATE TO authenticated
  USING (public.has_school_role(school_id, ARRAY['principal','deputy','bursar']::public.app_role[]) OR public.is_super_admin())
  WITH CHECK (public.has_school_role(school_id, ARRAY['principal','deputy','bursar']::public.app_role[]) OR public.is_super_admin());
CREATE TRIGGER trg_fee_items_updated BEFORE UPDATE ON public.fee_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  learner_id uuid NOT NULL REFERENCES public.learners(id),
  academic_year_id uuid REFERENCES public.academic_years(id),
  term_id uuid REFERENCES public.terms(id),
  invoice_number text NOT NULL,
  issue_date date NOT NULL DEFAULT current_date,
  due_date date,
  total numeric NOT NULL DEFAULT 0 CHECK (total >= 0),
  status text NOT NULL DEFAULT 'issued' CHECK (status IN ('draft','issued','void')),
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, invoice_number)
);
GRANT SELECT, INSERT, UPDATE ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inv_select" ON public.invoices FOR SELECT TO authenticated
  USING (public.is_school_member(school_id) OR public.is_super_admin());
CREATE POLICY "inv_insert" ON public.invoices FOR INSERT TO authenticated
  WITH CHECK (public.has_school_role(school_id, ARRAY['principal','deputy','bursar']::public.app_role[]) OR public.is_super_admin());
CREATE POLICY "inv_update" ON public.invoices FOR UPDATE TO authenticated
  USING (public.has_school_role(school_id, ARRAY['principal','deputy','bursar']::public.app_role[]) OR public.is_super_admin())
  WITH CHECK (public.has_school_role(school_id, ARRAY['principal','deputy','bursar']::public.app_role[]) OR public.is_super_admin());
CREATE TRIGGER trg_invoices_updated BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity numeric NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_amount numeric NOT NULL CHECK (unit_amount >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.invoice_items TO authenticated;
GRANT ALL ON public.invoice_items TO service_role;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ii_select" ON public.invoice_items FOR SELECT TO authenticated
  USING (public.is_school_member(school_id) OR public.is_super_admin());
CREATE POLICY "ii_insert" ON public.invoice_items FOR INSERT TO authenticated
  WITH CHECK (public.has_school_role(school_id, ARRAY['principal','deputy','bursar']::public.app_role[]) OR public.is_super_admin());
CREATE POLICY "ii_update" ON public.invoice_items FOR UPDATE TO authenticated
  USING (public.has_school_role(school_id, ARRAY['principal','deputy','bursar']::public.app_role[]) OR public.is_super_admin())
  WITH CHECK (public.has_school_role(school_id, ARRAY['principal','deputy','bursar']::public.app_role[]) OR public.is_super_admin());

CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  learner_id uuid NOT NULL REFERENCES public.learners(id),
  invoice_id uuid REFERENCES public.invoices(id),
  term_id uuid REFERENCES public.terms(id),
  receipt_number text NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  method text NOT NULL DEFAULT 'mpesa' CHECK (method IN ('mpesa','bank','cash','cheque','bursary','waiver')),
  reference text,
  paid_at timestamptz NOT NULL DEFAULT now(),
  payer_name text,
  notes text,
  recorded_by uuid,
  is_reversed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, receipt_number)
);
GRANT SELECT, INSERT, UPDATE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pay_select" ON public.payments FOR SELECT TO authenticated
  USING (public.is_school_member(school_id) OR public.is_super_admin());
CREATE POLICY "pay_insert" ON public.payments FOR INSERT TO authenticated
  WITH CHECK (public.has_school_role(school_id, ARRAY['principal','deputy','bursar']::public.app_role[]) OR public.is_super_admin());
CREATE POLICY "pay_update" ON public.payments FOR UPDATE TO authenticated
  USING (public.has_school_role(school_id, ARRAY['principal','deputy','bursar']::public.app_role[]) OR public.is_super_admin())
  WITH CHECK (public.has_school_role(school_id, ARRAY['principal','deputy','bursar']::public.app_role[]) OR public.is_super_admin());
CREATE TRIGGER trg_payments_updated BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.ledger_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  learner_id uuid NOT NULL REFERENCES public.learners(id),
  term_id uuid REFERENCES public.terms(id),
  entry_date date NOT NULL DEFAULT current_date,
  entry_type text NOT NULL CHECK (entry_type IN ('debit','credit')),
  source text NOT NULL CHECK (source IN ('invoice','payment','adjustment','reversal')),
  source_id uuid,
  description text NOT NULL,
  amount numeric NOT NULL CHECK (amount >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.ledger_entries TO authenticated;
GRANT ALL ON public.ledger_entries TO service_role;
ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "le_select" ON public.ledger_entries FOR SELECT TO authenticated
  USING (public.is_school_member(school_id) OR public.is_super_admin());
CREATE POLICY "le_insert" ON public.ledger_entries FOR INSERT TO authenticated
  WITH CHECK (public.has_school_role(school_id, ARRAY['principal','deputy','bursar']::public.app_role[]) OR public.is_super_admin());

-- Invoices and payments post to the ledger automatically
CREATE OR REPLACE FUNCTION public.post_invoice_ledger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'issued' THEN
    INSERT INTO public.ledger_entries(school_id, learner_id, term_id, entry_date, entry_type, source, source_id, description, amount)
    VALUES (NEW.school_id, NEW.learner_id, NEW.term_id, NEW.issue_date, 'debit', 'invoice', NEW.id,
            'Invoice ' || NEW.invoice_number, NEW.total);
  ELSIF TG_OP = 'UPDATE' AND OLD.status <> 'issued' AND NEW.status = 'issued' THEN
    INSERT INTO public.ledger_entries(school_id, learner_id, term_id, entry_date, entry_type, source, source_id, description, amount)
    VALUES (NEW.school_id, NEW.learner_id, NEW.term_id, NEW.issue_date, 'debit', 'invoice', NEW.id,
            'Invoice ' || NEW.invoice_number, NEW.total);
  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'issued' AND NEW.status = 'void' THEN
    INSERT INTO public.ledger_entries(school_id, learner_id, term_id, entry_date, entry_type, source, source_id, description, amount)
    VALUES (NEW.school_id, NEW.learner_id, NEW.term_id, current_date, 'credit', 'reversal', NEW.id,
            'Voided invoice ' || NEW.invoice_number, OLD.total);
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_invoices_ledger AFTER INSERT OR UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.post_invoice_ledger();

CREATE OR REPLACE FUNCTION public.post_payment_ledger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.ledger_entries(school_id, learner_id, term_id, entry_date, entry_type, source, source_id, description, amount)
    VALUES (NEW.school_id, NEW.learner_id, NEW.term_id, NEW.paid_at::date, 'credit', 'payment', NEW.id,
            'Receipt ' || NEW.receipt_number || ' (' || NEW.method || ')', NEW.amount);
  ELSIF TG_OP = 'UPDATE' AND NOT OLD.is_reversed AND NEW.is_reversed THEN
    INSERT INTO public.ledger_entries(school_id, learner_id, term_id, entry_date, entry_type, source, source_id, description, amount)
    VALUES (NEW.school_id, NEW.learner_id, NEW.term_id, current_date, 'debit', 'reversal', NEW.id,
            'Reversed receipt ' || NEW.receipt_number, NEW.amount);
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_payments_ledger AFTER INSERT OR UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.post_payment_ledger();

-- =========================
-- Report cards (versioned, immutable once published)
-- =========================
CREATE TABLE public.report_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  learner_id uuid NOT NULL REFERENCES public.learners(id),
  academic_year_id uuid REFERENCES public.academic_years(id),
  term_id uuid REFERENCES public.terms(id),
  grade public.cbe_grade,
  version integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  total_points integer,
  mean_percentage numeric,
  class_position integer,
  class_size integer,
  class_teacher_comment text,
  head_teacher_comment text,
  published_at timestamptz,
  published_by uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (learner_id, term_id, version)
);
GRANT SELECT, INSERT, UPDATE ON public.report_cards TO authenticated;
GRANT ALL ON public.report_cards TO service_role;
ALTER TABLE public.report_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rc_select" ON public.report_cards FOR SELECT TO authenticated
  USING (public.is_school_member(school_id) OR public.is_super_admin());
CREATE POLICY "rc_insert" ON public.report_cards FOR INSERT TO authenticated
  WITH CHECK (public.has_school_role(school_id, ARRAY['principal','deputy','teacher','class_teacher']::public.app_role[]) OR public.is_super_admin());
CREATE POLICY "rc_update" ON public.report_cards FOR UPDATE TO authenticated
  USING (public.has_school_role(school_id, ARRAY['principal','deputy','teacher','class_teacher']::public.app_role[]) OR public.is_super_admin())
  WITH CHECK (public.has_school_role(school_id, ARRAY['principal','deputy','teacher','class_teacher']::public.app_role[]) OR public.is_super_admin());
CREATE TRIGGER trg_report_cards_updated BEFORE UPDATE ON public.report_cards
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.guard_report_card_immutability()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.status = 'published' THEN
    RAISE EXCEPTION 'A published report card is immutable — create a new version instead';
  END IF;
  IF NEW.status = 'published' THEN
    IF NOT (public.is_school_admin(NEW.school_id) OR public.is_super_admin()) THEN
      RAISE EXCEPTION 'Only the principal or deputy can publish a report card';
    END IF;
    NEW.published_at := COALESCE(NEW.published_at, now());
    NEW.published_by := COALESCE(NEW.published_by, auth.uid());
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_report_cards_immutable BEFORE UPDATE ON public.report_cards
  FOR EACH ROW EXECUTE FUNCTION public.guard_report_card_immutability();

-- Balance summary helper for statements
CREATE OR REPLACE FUNCTION public.learner_balance(_learner_id uuid)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(SUM(CASE WHEN entry_type = 'debit' THEN amount ELSE -amount END), 0)
  FROM public.ledger_entries WHERE learner_id = _learner_id;
$$;