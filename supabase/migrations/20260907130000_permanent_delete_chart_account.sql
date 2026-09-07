CREATE OR REPLACE FUNCTION public.delete_chart_of_account(_school_id uuid, _account_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.has_school_role(_school_id, ARRAY['admin','accountant','principal','deputy']::public.app_role[]) OR public.is_super_admin()) THEN
    RAISE EXCEPTION 'You are not allowed to delete accounts for this school';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.chart_of_accounts
    WHERE id = _account_id AND school_id = _school_id
  ) THEN
    RAISE EXCEPTION 'Account not found for this school';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.journal_entry_lines
    WHERE account_id = _account_id
  ) THEN
    RAISE EXCEPTION 'This account has journal history and cannot be permanently deleted';
  END IF;

  DELETE FROM public.chart_of_accounts
  WHERE id = _account_id AND school_id = _school_id;
END;
$$;
