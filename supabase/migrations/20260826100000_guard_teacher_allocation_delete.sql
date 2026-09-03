CREATE OR REPLACE FUNCTION public.prevent_scheduled_teacher_allocation_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  scheduled_count integer;
BEGIN
  SELECT count(*) INTO scheduled_count
  FROM public.timetable_slots slot
  JOIN public.timetables timetable ON timetable.id = slot.timetable_id
  WHERE slot.school_id = OLD.school_id
    AND slot.stream_id = OLD.stream_id
    AND slot.learning_area_id = OLD.learning_area_id;

  IF scheduled_count > 0 THEN
    RAISE EXCEPTION 'This allocation has % scheduled periods this term - remove it from the timetable first', scheduled_count
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_scheduled_teacher_allocation_delete ON public.teacher_allocations;
CREATE TRIGGER trg_prevent_scheduled_teacher_allocation_delete
  BEFORE DELETE ON public.teacher_allocations
  FOR EACH ROW EXECUTE FUNCTION public.prevent_scheduled_teacher_allocation_delete();