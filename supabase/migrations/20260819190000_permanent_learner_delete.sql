-- Permanent learner deletion for administrators only.
-- This intentionally removes all learner-linked financial and academic history.
CREATE OR REPLACE FUNCTION public.delete_learner_permanently(
  _school_id uuid,
  _learner_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  learner_name text;
BEGIN
  IF NOT (public.is_super_admin() OR public.is_school_admin(_school_id)) THEN
    RAISE EXCEPTION 'Only a school administrator can permanently delete a learner';
  END IF;

  SELECT concat(first_name, ' ', last_name)
  INTO learner_name
  FROM public.learners
  WHERE id = _learner_id AND school_id = _school_id;

  IF learner_name IS NULL THEN
    RAISE EXCEPTION 'Learner not found in this school';
  END IF;

  INSERT INTO public.audit_logs (school_id, actor_id, actor_name, action, entity, entity_id, reason, before_data)
  SELECT _school_id, auth.uid(), p.full_name, 'permanent_delete', 'learner', _learner_id,
    'Administrator permanently deleted learner and all linked records', to_jsonb(l)
  FROM public.learners l
  LEFT JOIN public.profiles p ON p.id = auth.uid()
  WHERE l.id = _learner_id AND l.school_id = _school_id;

  DELETE FROM public.learner_guardians WHERE school_id = _school_id AND learner_id = _learner_id;
  DELETE FROM public.enrollments WHERE school_id = _school_id AND learner_id = _learner_id;
  DELETE FROM public.learner_status_history WHERE school_id = _school_id AND learner_id = _learner_id;
  DELETE FROM public.student_class_history WHERE school_id = _school_id AND learner_id = _learner_id;
  DELETE FROM public.student_status_history WHERE school_id = _school_id AND learner_id = _learner_id;
  DELETE FROM public.student_exit_records WHERE school_id = _school_id AND learner_id = _learner_id;
  DELETE FROM public.student_documents WHERE school_id = _school_id AND learner_id = _learner_id;
  DELETE FROM public.attendance_records WHERE school_id = _school_id AND learner_id = _learner_id;
  DELETE FROM public.marks WHERE school_id = _school_id AND learner_id = _learner_id;
  DELETE FROM public.report_cards WHERE school_id = _school_id AND learner_id = _learner_id;
  DELETE FROM public.ledger_entries WHERE school_id = _school_id AND learner_id = _learner_id;
  DELETE FROM public.payments WHERE school_id = _school_id AND learner_id = _learner_id;
  DELETE FROM public.invoices WHERE school_id = _school_id AND learner_id = _learner_id;
  DELETE FROM public.learners WHERE id = _learner_id AND school_id = _school_id;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_learner_permanently(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_learner_permanently(uuid, uuid) TO authenticated, service_role;
