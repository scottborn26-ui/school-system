CREATE OR REPLACE FUNCTION public.create_user_notification(
  _school_id uuid,
  _user_id uuid,
  _type text,
  _title text,
  _message text,
  _related_link text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _user_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.notifications (school_id, user_id, type, title, message, related_link)
  VALUES (_school_id, _user_id, _type, _title, _message, _related_link);
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_exam_session_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  assessment_title text;
  staff_user_id uuid;
  notification_title text;
  notification_message text;
BEGIN
  IF NEW.status <> 'published' OR (
    TG_OP = 'UPDATE' AND OLD.status = NEW.status AND OLD.invigilator_id IS NOT DISTINCT FROM NEW.invigilator_id
    AND OLD.session_date IS NOT DISTINCT FROM NEW.session_date
    AND OLD.start_time IS NOT DISTINCT FROM NEW.start_time
    AND OLD.end_time IS NOT DISTINCT FROM NEW.end_time
  ) THEN
    RETURN NEW;
  END IF;

  SELECT title INTO assessment_title FROM public.assessments WHERE id = NEW.assessment_id;
  notification_title := CASE WHEN NEW.invigilator_id IS NOT NULL AND (
    TG_OP = 'INSERT' OR OLD.invigilator_id IS DISTINCT FROM NEW.invigilator_id
  ) THEN 'You have been assigned an invigilation' ELSE 'Exam timetable updated' END;
  notification_message := COALESCE(assessment_title, 'Exam') || ' for ' || NEW.grade::text ||
    ' is scheduled for ' || NEW.session_date::text || ' at ' || NEW.start_time::text || '.';

  IF NEW.invigilator_id IS NOT NULL THEN
    SELECT user_id INTO staff_user_id FROM public.staff WHERE id = NEW.invigilator_id;
    PERFORM public.create_user_notification(NEW.school_id, staff_user_id, 'academic', notification_title, notification_message, '/exam-timetable');
  END IF;

  FOR staff_user_id IN
    SELECT DISTINCT st.user_id
    FROM public.staff st
    LEFT JOIN public.teacher_allocations ta ON ta.staff_id = st.id AND ta.is_active
    LEFT JOIN public.streams streams ON streams.id = ta.stream_id OR streams.class_teacher_id = st.id
    WHERE st.school_id = NEW.school_id AND st.user_id IS NOT NULL
      AND st.status = 'active' AND NOT st.is_archived
      AND streams.grade = NEW.grade
  LOOP
    PERFORM public.create_user_notification(NEW.school_id, staff_user_id, 'academic', 'Exam timetable updated', notification_message, '/exam-timetable');
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER exam_session_notification
  AFTER INSERT OR UPDATE ON public.exam_timetable_sessions
  FOR EACH ROW EXECUTE FUNCTION public.notify_exam_session_event();

CREATE OR REPLACE FUNCTION public.notify_assessment_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  staff_user_id uuid;
  notification_message text;
BEGIN
  IF NEW.status NOT IN ('approved', 'locked') OR (
    TG_OP = 'UPDATE' AND OLD.status IS NOT DISTINCT FROM NEW.status
  ) THEN
    RETURN NEW;
  END IF;

  notification_message := NEW.title || ' results are now available.';
  FOR staff_user_id IN
    SELECT DISTINCT l.user_id
    FROM public.learners l
    WHERE l.school_id = NEW.school_id AND l.user_id IS NOT NULL
      AND l.current_grade = NEW.grade AND NOT l.is_archived
  LOOP
    PERFORM public.create_user_notification(NEW.school_id, staff_user_id, 'academic', 'Assessment results published', notification_message, '/marks');
  END LOOP;

  FOR staff_user_id IN
    SELECT DISTINCT g.user_id
    FROM public.learners l
    JOIN public.learner_guardians lg ON lg.learner_id = l.id
    JOIN public.guardians g ON g.id = lg.guardian_id
    WHERE l.school_id = NEW.school_id AND g.user_id IS NOT NULL
      AND l.current_grade = NEW.grade AND NOT l.is_archived
  LOOP
    PERFORM public.create_user_notification(NEW.school_id, staff_user_id, 'academic', 'Assessment results published', notification_message, '/marks');
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER assessment_notification
  AFTER UPDATE OF status ON public.assessments
  FOR EACH ROW EXECUTE FUNCTION public.notify_assessment_event();

CREATE OR REPLACE FUNCTION public.notify_mark_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  learner_name text;
  assessment_title text;
  recipient_user_id uuid;
BEGIN
  SELECT concat_ws(' ', first_name, last_name) INTO learner_name FROM public.learners WHERE id = NEW.learner_id;
  SELECT title INTO assessment_title FROM public.assessments WHERE id = NEW.assessment_id;
  IF TG_OP = 'INSERT' THEN
    FOR recipient_user_id IN
      SELECT user_id FROM public.learners WHERE id = NEW.learner_id AND user_id IS NOT NULL
      UNION
      SELECT g.user_id
      FROM public.learner_guardians lg
      JOIN public.guardians g ON g.id = lg.guardian_id
      WHERE lg.learner_id = NEW.learner_id AND g.user_id IS NOT NULL
    LOOP
      PERFORM public.create_user_notification(NEW.school_id, recipient_user_id, 'academic', 'New mark recorded', COALESCE(assessment_title, 'Assessment') || ' mark recorded for ' || learner_name || '.', '/marks');
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER mark_notification
  AFTER INSERT ON public.marks
  FOR EACH ROW EXECUTE FUNCTION public.notify_mark_event();

CREATE OR REPLACE FUNCTION public.notify_payment_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  learner_name text;
  recipient_user_id uuid;
BEGIN
  SELECT concat_ws(' ', first_name, last_name) INTO learner_name FROM public.learners WHERE id = NEW.learner_id;
  FOR recipient_user_id IN
    SELECT user_id FROM public.learners WHERE id = NEW.learner_id AND user_id IS NOT NULL
    UNION
    SELECT g.user_id
    FROM public.learner_guardians lg
    JOIN public.guardians g ON g.id = lg.guardian_id
    WHERE lg.learner_id = NEW.learner_id AND g.user_id IS NOT NULL
  LOOP
    PERFORM public.create_user_notification(NEW.school_id, recipient_user_id, 'fee', 'Fee payment received', 'Payment of ' || NEW.amount::text || ' received for ' || learner_name || '.', '/finance');
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER payment_notification
  AFTER INSERT ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.notify_payment_event();

CREATE OR REPLACE FUNCTION public.notify_invoice_due_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recipient_user_id uuid;
  learner_name text;
BEGIN
  IF NEW.due_date IS NULL OR NEW.due_date > CURRENT_DATE THEN
    RETURN NEW;
  END IF;
  SELECT concat_ws(' ', first_name, last_name) INTO learner_name FROM public.learners WHERE id = NEW.learner_id;
  FOR recipient_user_id IN
    SELECT user_id FROM public.learners WHERE id = NEW.learner_id AND user_id IS NOT NULL
    UNION
    SELECT g.user_id
    FROM public.learner_guardians lg
    JOIN public.guardians g ON g.id = lg.guardian_id
    WHERE lg.learner_id = NEW.learner_id AND g.user_id IS NOT NULL
  LOOP
    PERFORM public.create_user_notification(NEW.school_id, recipient_user_id, 'fee', 'Fee payment overdue', 'Invoice ' || NEW.invoice_number || ' for ' || learner_name || ' is overdue.', '/finance');
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER invoice_due_notification
  AFTER INSERT OR UPDATE OF due_date, status ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.notify_invoice_due_event();

CREATE OR REPLACE FUNCTION public.notify_learner_profile_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recipient_user_id uuid;
BEGIN
  IF TG_OP = 'UPDATE' AND to_jsonb(NEW) - 'updated_at' IS NOT DISTINCT FROM to_jsonb(OLD) - 'updated_at' THEN
    RETURN NEW;
  END IF;
  FOR recipient_user_id IN
    SELECT g.user_id
    FROM public.learner_guardians lg
    JOIN public.guardians g ON g.id = lg.guardian_id
    WHERE lg.learner_id = NEW.id AND g.user_id IS NOT NULL
  LOOP
    PERFORM public.create_user_notification(NEW.school_id, recipient_user_id, 'system', 'Student profile updated', 'The profile for ' || concat_ws(' ', NEW.first_name, NEW.last_name) || ' was updated.', '/learners/' || NEW.id);
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER learner_profile_notification
  AFTER UPDATE ON public.learners
  FOR EACH ROW EXECUTE FUNCTION public.notify_learner_profile_event();

GRANT EXECUTE ON FUNCTION public.create_user_notification(uuid, uuid, text, text, text, text) TO authenticated, service_role;