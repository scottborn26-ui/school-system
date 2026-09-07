CREATE TABLE IF NOT EXISTS public.journal_entry_number_sequences (
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  entry_year integer NOT NULL,
  last_number integer NOT NULL,
  PRIMARY KEY (school_id, entry_year)
);

GRANT SELECT, INSERT, UPDATE ON public.journal_entry_number_sequences TO service_role;

CREATE OR REPLACE FUNCTION public.next_journal_entry_number(_school_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  current_year integer := extract(year FROM current_date)::integer;
  allocated_number integer;
BEGIN
  INSERT INTO public.journal_entry_number_sequences (school_id, entry_year, last_number)
  SELECT _school_id, current_year,
    coalesce(max(substring(entry_number FROM '[0-9]+$')::integer), 0) + 1
  FROM public.journal_entries
  WHERE school_id = _school_id
    AND entry_number LIKE 'JE-' || current_year::text || '-%'
  ON CONFLICT (school_id, entry_year) DO UPDATE
    SET last_number = journal_entry_number_sequences.last_number + 1
  RETURNING last_number INTO allocated_number;

  RETURN 'JE-' || current_year::text || '-' || lpad(allocated_number::text, 4, '0');
END;
$$;