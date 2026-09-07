CREATE OR REPLACE FUNCTION public.reverse_journal_entry(_journal_entry_id uuid, _narration text DEFAULT NULL)
RETURNS public.journal_entries LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  original public.journal_entries;
  reversal public.journal_entries;
  line record;
  debit_total numeric;
  credit_total numeric;
BEGIN
  SELECT * INTO original
  FROM public.journal_entries
  WHERE id = _journal_entry_id
  FOR UPDATE;

  IF original.id IS NULL THEN
    RAISE EXCEPTION 'Journal entry not found';
  END IF;
  IF original.status <> 'posted' THEN
    RAISE EXCEPTION 'Only posted entries can be reversed';
  END IF;

  INSERT INTO public.journal_entries (
    school_id,
    entry_number,
    entry_date,
    term_id,
    academic_year_id,
    source,
    source_reference_id,
    narration,
    status,
    created_by
  )
  VALUES (
    original.school_id,
    public.next_journal_entry_number(original.school_id),
    current_date,
    original.term_id,
    original.academic_year_id,
    'other',
    original.id,
    coalesce(_narration, 'Reversal of ' || original.entry_number),
    'draft',
    auth.uid()
  )
  RETURNING * INTO reversal;

  FOR line IN
    SELECT * FROM public.journal_entry_lines WHERE journal_entry_id = original.id
  LOOP
    INSERT INTO public.journal_entry_lines (
      school_id,
      journal_entry_id,
      account_id,
      debit_amount,
      credit_amount,
      description
    )
    VALUES (
      line.school_id,
      reversal.id,
      line.account_id,
      line.credit_amount,
      line.debit_amount,
      'Reversal'
    );
  END LOOP;

  SELECT coalesce(sum(debit_amount), 0), coalesce(sum(credit_amount), 0)
  INTO debit_total, credit_total
  FROM public.journal_entry_lines
  WHERE journal_entry_id = reversal.id;

  IF debit_total = 0 OR debit_total <> credit_total THEN
    RAISE EXCEPTION 'Reversal entry is not balanced';
  END IF;

  UPDATE public.journal_entries
  SET status = 'posted',
      posted_by = auth.uid(),
      posted_at = now(),
      updated_at = now()
  WHERE id = reversal.id
  RETURNING * INTO reversal;

  UPDATE public.journal_entries
  SET status = 'reversed', updated_at = now()
  WHERE id = original.id;

  RETURN reversal;
END;
$$;
