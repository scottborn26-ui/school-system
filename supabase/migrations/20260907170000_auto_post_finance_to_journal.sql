CREATE OR REPLACE FUNCTION public.create_finance_journal_entry(
  _school_id uuid,
  _source text,
  _source_reference_id uuid,
  _entry_date date,
  _term_id uuid,
  _narration text,
  _debit_code text,
  _credit_code text,
  _amount numeric
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  journal_id uuid;
  entry_number text;
  debit_account uuid;
  credit_account uuid;
BEGIN
  IF coalesce(_amount, 0) <= 0 THEN
    RETURN NULL;
  END IF;

  PERFORM public.seed_school_chart_of_accounts(_school_id);

  SELECT id INTO journal_id
  FROM public.journal_entries
  WHERE school_id = _school_id
    AND source = _source
    AND source_reference_id = _source_reference_id
  LIMIT 1;
  IF journal_id IS NOT NULL THEN
    RETURN journal_id;
  END IF;

  SELECT id INTO debit_account
  FROM public.chart_of_accounts
  WHERE school_id = _school_id AND account_code = _debit_code AND is_active;
  SELECT id INTO credit_account
  FROM public.chart_of_accounts
  WHERE school_id = _school_id AND account_code = _credit_code AND is_active;

  IF debit_account IS NULL OR credit_account IS NULL THEN
    RAISE EXCEPTION 'Seed the chart of accounts before recording finance transactions (needed % and %)', _debit_code, _credit_code;
  END IF;

  SELECT public.next_journal_entry_number(_school_id) INTO entry_number;
  INSERT INTO public.journal_entries (
    school_id, entry_number, entry_date, term_id, source,
    source_reference_id, narration, status, created_by
  ) VALUES (
    _school_id, entry_number, coalesce(_entry_date, current_date), _term_id, _source,
    _source_reference_id, _narration, 'draft', auth.uid()
  ) RETURNING id INTO journal_id;

  INSERT INTO public.journal_entry_lines
    (school_id, journal_entry_id, account_id, debit_amount, credit_amount, description)
  VALUES
    (_school_id, journal_id, debit_account, _amount, 0, _narration),
    (_school_id, journal_id, credit_account, 0, _amount, _narration);

  PERFORM public.post_journal_entry(journal_id);
  RETURN journal_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.auto_post_invoice_to_journal()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'issued' THEN
    PERFORM public.create_finance_journal_entry(
      NEW.school_id,
      'fees_module',
      NEW.id,
      NEW.issue_date,
      NEW.term_id,
      'Invoice ' || NEW.invoice_number,
      '1200',
      '4100',
      NEW.total
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_invoices_auto_journal ON public.invoices;
CREATE TRIGGER trg_invoices_auto_journal
AFTER INSERT ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.auto_post_invoice_to_journal();

CREATE OR REPLACE FUNCTION public.auto_post_payment_to_journal()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.create_finance_journal_entry(
    NEW.school_id,
    'fees_module',
    NEW.id,
    NEW.paid_at::date,
    NEW.term_id,
    'Receipt ' || NEW.receipt_number || ' (' || NEW.method || ')',
    '1100',
    '1200',
    NEW.amount
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_payments_auto_journal ON public.payments;
CREATE TRIGGER trg_payments_auto_journal
AFTER INSERT ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.auto_post_payment_to_journal();

CREATE OR REPLACE FUNCTION public.auto_post_inventory_to_journal()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  amount numeric := abs(NEW.quantity) * NEW.unit_cost;
  debit_code text;
  credit_code text;
  description text;
BEGIN
  IF NEW.transaction_type = 'purchase' THEN
    debit_code := '1300';
    credit_code := '2100';
    description := 'Inventory purchase';
  ELSIF NEW.transaction_type = 'issue' OR (NEW.transaction_type = 'adjustment' AND NEW.quantity < 0) THEN
    debit_code := '5100';
    credit_code := '1300';
    description := 'Inventory issue';
  ELSE
    debit_code := '1300';
    credit_code := '5100';
    description := 'Inventory adjustment';
  END IF;

  PERFORM public.create_finance_journal_entry(
    NEW.school_id,
    'inventory_module',
    NEW.id,
    NEW.transaction_date,
    NULL,
    description || coalesce(': ' || NEW.reference, ''),
    debit_code,
    credit_code,
    amount
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_inventory_transactions_auto_journal ON public.inventory_transactions;
CREATE TRIGGER trg_inventory_transactions_auto_journal
AFTER INSERT ON public.inventory_transactions
FOR EACH ROW EXECUTE FUNCTION public.auto_post_inventory_to_journal();

DO $$
DECLARE
  row_data record;
BEGIN
  FOR row_data IN SELECT * FROM public.invoices WHERE status = 'issued' LOOP
    PERFORM public.create_finance_journal_entry(
      row_data.school_id, 'fees_module', row_data.id, row_data.issue_date,
      row_data.term_id, 'Invoice ' || row_data.invoice_number,
      '1200', '4100', row_data.total
    );
  END LOOP;

  FOR row_data IN SELECT * FROM public.payments LOOP
    PERFORM public.create_finance_journal_entry(
      row_data.school_id, 'fees_module', row_data.id, row_data.paid_at::date,
      row_data.term_id, 'Receipt ' || row_data.receipt_number || ' (' || row_data.method || ')',
      '1100', '1200', row_data.amount
    );
  END LOOP;

  FOR row_data IN SELECT * FROM public.inventory_transactions LOOP
    IF row_data.transaction_type = 'purchase' THEN
      PERFORM public.create_finance_journal_entry(
        row_data.school_id, 'inventory_module', row_data.id, row_data.transaction_date,
        NULL, 'Inventory purchase' || coalesce(': ' || row_data.reference, ''),
        '1300', '2100', abs(row_data.quantity) * row_data.unit_cost
      );
    ELSIF row_data.transaction_type = 'issue' OR (row_data.transaction_type = 'adjustment' AND row_data.quantity < 0) THEN
      PERFORM public.create_finance_journal_entry(
        row_data.school_id, 'inventory_module', row_data.id, row_data.transaction_date,
        NULL, 'Inventory issue' || coalesce(': ' || row_data.reference, ''),
        '5100', '1300', abs(row_data.quantity) * row_data.unit_cost
      );
    ELSE
      PERFORM public.create_finance_journal_entry(
        row_data.school_id, 'inventory_module', row_data.id, row_data.transaction_date,
        NULL, 'Inventory adjustment' || coalesce(': ' || row_data.reference, ''),
        '1300', '5100', abs(row_data.quantity) * row_data.unit_cost
      );
    END IF;
  END LOOP;
END;
$$;