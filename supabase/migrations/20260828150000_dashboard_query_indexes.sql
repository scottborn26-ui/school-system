CREATE INDEX IF NOT EXISTS invoices_dashboard_term_idx
  ON public.invoices (school_id, term_id, status, due_date);

CREATE INDEX IF NOT EXISTS payments_dashboard_term_idx
  ON public.payments (school_id, term_id, is_reversed, paid_at);

CREATE INDEX IF NOT EXISTS fee_items_dashboard_term_idx
  ON public.fee_items (school_id, term_id, is_active, grade);

CREATE INDEX IF NOT EXISTS assessments_dashboard_term_idx
  ON public.assessments (school_id, term_id, assessment_date, status);

CREATE INDEX IF NOT EXISTS marks_dashboard_assessment_idx
  ON public.marks (school_id, assessment_id, learner_id);

CREATE INDEX IF NOT EXISTS teacher_allocations_dashboard_staff_idx
  ON public.teacher_allocations (school_id, staff_id, is_active, stream_id);