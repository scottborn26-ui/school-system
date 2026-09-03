-- Grade-wide assessments resolve their streams dynamically, but the grade must be configured.
CREATE OR REPLACE FUNCTION public.validate_assessment_stream_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.stream_id IS NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.streams
      WHERE school_id = NEW.school_id
        AND grade = NEW.grade
        AND is_active
    ) THEN
      RAISE EXCEPTION 'The selected grade must have at least one active stream before an assessment can be created';
    END IF;
  ELSIF NOT EXISTS (
    SELECT 1
    FROM public.streams
    WHERE id = NEW.stream_id
      AND school_id = NEW.school_id
      AND grade = NEW.grade
      AND is_active
  ) THEN
    RAISE EXCEPTION 'The selected assessment stream must belong to the same school and grade';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_assessment_stream_scope ON public.assessments;
CREATE TRIGGER trg_validate_assessment_stream_scope
  BEFORE INSERT OR UPDATE OF school_id, grade, stream_id ON public.assessments
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_assessment_stream_scope();
