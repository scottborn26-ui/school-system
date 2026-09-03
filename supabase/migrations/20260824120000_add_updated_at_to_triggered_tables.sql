-- Add the timestamp column expected by existing update triggers.
ALTER TABLE public.learner_guardians
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.enrollments
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.learner_status_history
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
