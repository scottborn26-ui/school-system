-- Allow the administrator-only permanent learner deletion function to remove
-- lifecycle history. Direct authenticated deletes remain blocked by RLS because
-- these tables intentionally have no DELETE policy.
DROP TRIGGER IF EXISTS student_class_history_no_delete ON public.student_class_history;
DROP TRIGGER IF EXISTS student_status_history_no_delete ON public.student_status_history;
DROP TRIGGER IF EXISTS student_exit_records_no_delete ON public.student_exit_records;