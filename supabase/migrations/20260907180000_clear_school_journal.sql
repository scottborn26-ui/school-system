CREATE OR REPLACE FUNCTION public.clear_school_journal(_school_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  deleted_count integer;
BEGIN
  IF NOT (
    public.has_school_role(_school_id, ARRAY['admin','accountant','principal','deputy']::public.app_role[])
    OR public.is_super_admin()
  ) THEN
    RAISE EXCEPTION 'You do not have permission to clear this school journal';
  END IF;

  DELETE FROM public.journal_entries
  WHERE school_id = _school_id;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  DELETE FROM public.journal_entry_number_sequences
  WHERE school_id = _school_id;

  RETURN deleted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.clear_school_journal(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.clear_school_journal(uuid) TO authenticated;