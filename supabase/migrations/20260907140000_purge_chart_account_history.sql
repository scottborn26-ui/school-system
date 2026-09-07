CREATE OR REPLACE FUNCTION public.delete_chart_of_account(_school_id uuid, _account_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  affected_count integer;
  unbalanced_count integer;
BEGIN
  IF NOT (public.has_school_role(_school_id, ARRAY['admin','accountant','principal','deputy']::public.app_role[]) OR public.is_super_admin()) THEN
    RAISE EXCEPTION 'You are not allowed to delete accounts for this school';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.chart_of_accounts
    WHERE id = _account_id AND school_id = _school_id
  ) THEN
    RAISE EXCEPTION 'Account not found for this school';
  END IF;

  CREATE TEMP TABLE entries_to_delete (
    id uuid PRIMARY KEY
  ) ON COMMIT DROP;

  INSERT INTO entries_to_delete (id)
  SELECT DISTINCT journal_entry_id
  FROM public.journal_entry_lines
  WHERE account_id = _account_id AND school_id = _school_id;

  LOOP
    INSERT INTO entries_to_delete (id)
    SELECT je.id
    FROM public.journal_entries je
    WHERE je.school_id = _school_id
      AND (
        je.source_reference_id IN (SELECT id FROM entries_to_delete)
        OR je.reversed_by_entry_id IN (SELECT id FROM entries_to_delete)
      )
    ON CONFLICT DO NOTHING;

    GET DIAGNOSTICS affected_count = ROW_COUNT;
    EXIT WHEN affected_count = 0;
  END LOOP;

  DELETE FROM public.journal_entries
  WHERE school_id = _school_id
    AND id IN (SELECT id FROM entries_to_delete);

  UPDATE public.chart_of_accounts
  SET parent_account_id = NULL, updated_at = now()
  WHERE school_id = _school_id AND parent_account_id = _account_id;

  DELETE FROM public.chart_of_accounts
  WHERE id = _account_id AND school_id = _school_id;

  SELECT count(*) INTO unbalanced_count
  FROM (
    SELECT je.id
    FROM public.journal_entries je
    LEFT JOIN public.journal_entry_lines jel ON jel.journal_entry_id = je.id
    WHERE je.school_id = _school_id AND je.status = 'posted'
    GROUP BY je.id
    HAVING coalesce(sum(jel.debit_amount), 0) <> coalesce(sum(jel.credit_amount), 0)
  ) unbalanced;

  IF unbalanced_count > 0 THEN
    RAISE EXCEPTION 'Deletion would leave unbalanced journal entries';
  END IF;
END;
$$;
