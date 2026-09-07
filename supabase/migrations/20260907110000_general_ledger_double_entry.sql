CREATE TABLE public.chart_of_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  account_code text NOT NULL,
  account_name text NOT NULL,
  account_type text NOT NULL CHECK (account_type IN ('asset','liability','equity','revenue','expense')),
  parent_account_id uuid REFERENCES public.chart_of_accounts(id),
  normal_balance text NOT NULL CHECK (normal_balance IN ('debit','credit')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, account_code)
);

CREATE TABLE public.journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  entry_number text NOT NULL,
  entry_date date NOT NULL DEFAULT current_date,
  term_id uuid REFERENCES public.terms(id),
  academic_year_id uuid REFERENCES public.academic_years(id),
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','fees_module','inventory_module','payroll_module','other')),
  source_reference_id uuid,
  narration text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','posted','reversed')),
  created_by uuid,
  posted_by uuid,
  posted_at timestamptz,
  reversed_by_entry_id uuid REFERENCES public.journal_entries(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, entry_number)
);

CREATE TABLE public.journal_entry_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  journal_entry_id uuid NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.chart_of_accounts(id),
  debit_amount numeric NOT NULL DEFAULT 0 CHECK (debit_amount >= 0),
  credit_amount numeric NOT NULL DEFAULT 0 CHECK (credit_amount >= 0),
  description text,
  department_id uuid,
  cost_center_id uuid,
  CHECK ((debit_amount = 0 AND credit_amount > 0) OR (credit_amount = 0 AND debit_amount > 0))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.chart_of_accounts, public.journal_entries, public.journal_entry_lines TO authenticated;
GRANT ALL ON public.chart_of_accounts, public.journal_entries, public.journal_entry_lines TO service_role;
ALTER TABLE public.chart_of_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entry_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY coa_select ON public.chart_of_accounts FOR SELECT TO authenticated USING (public.is_school_member(school_id) OR public.is_super_admin());
CREATE POLICY coa_write ON public.chart_of_accounts FOR ALL TO authenticated USING (public.has_school_role(school_id, ARRAY['admin','accountant','principal','deputy']::public.app_role[]) OR public.is_super_admin()) WITH CHECK (public.has_school_role(school_id, ARRAY['admin','accountant','principal','deputy']::public.app_role[]) OR public.is_super_admin());
CREATE POLICY je_select ON public.journal_entries FOR SELECT TO authenticated USING (public.is_school_member(school_id) OR public.is_super_admin());
CREATE POLICY je_write ON public.journal_entries FOR ALL TO authenticated USING (public.has_school_role(school_id, ARRAY['admin','accountant','principal','deputy']::public.app_role[]) OR public.is_super_admin()) WITH CHECK (public.has_school_role(school_id, ARRAY['admin','accountant','principal','deputy']::public.app_role[]) OR public.is_super_admin());
CREATE POLICY jel_select ON public.journal_entry_lines FOR SELECT TO authenticated USING (public.is_school_member(school_id) OR public.is_super_admin());
CREATE POLICY jel_write ON public.journal_entry_lines FOR ALL TO authenticated USING (public.has_school_role(school_id, ARRAY['admin','accountant','principal','deputy']::public.app_role[]) OR public.is_super_admin()) WITH CHECK (public.has_school_role(school_id, ARRAY['admin','accountant','principal','deputy']::public.app_role[]) OR public.is_super_admin());

CREATE OR REPLACE FUNCTION public.prevent_posted_journal_edit()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status = 'posted' AND (NEW.status <> 'reversed' OR NEW.narration <> OLD.narration) THEN
    RAISE EXCEPTION 'Posted journal entries are immutable; create a reversal instead';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_immutable_posted_journal BEFORE UPDATE ON public.journal_entries FOR EACH ROW EXECUTE FUNCTION public.prevent_posted_journal_edit();
CREATE OR REPLACE FUNCTION public.prevent_posted_line_edit()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE journal_id uuid;
BEGIN
  journal_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.journal_entry_id ELSE NEW.journal_entry_id END;
  IF EXISTS (SELECT 1 FROM public.journal_entries WHERE id = journal_id AND status = 'posted') THEN
    RAISE EXCEPTION 'Posted journal lines are immutable';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;
CREATE TRIGGER trg_immutable_posted_lines BEFORE INSERT OR UPDATE OR DELETE ON public.journal_entry_lines FOR EACH ROW EXECUTE FUNCTION public.prevent_posted_line_edit();

CREATE OR REPLACE FUNCTION public.next_journal_entry_number(_school_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE next_number integer;
BEGIN
  SELECT count(*) + 1 INTO next_number FROM public.journal_entries WHERE school_id = _school_id;
  RETURN 'JE-' || to_char(current_date, 'YYYY') || '-' || lpad(next_number::text, 4, '0');
END;
$$;

CREATE OR REPLACE FUNCTION public.post_journal_entry(_journal_entry_id uuid)
RETURNS public.journal_entries LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE entry_row public.journal_entries; debit_total numeric; credit_total numeric;
BEGIN
  SELECT * INTO entry_row FROM public.journal_entries WHERE id = _journal_entry_id FOR UPDATE;
  IF entry_row.id IS NULL THEN RAISE EXCEPTION 'Journal entry not found'; END IF;
  IF entry_row.status <> 'draft' THEN RAISE EXCEPTION 'Only draft entries can be posted'; END IF;
  SELECT coalesce(sum(debit_amount), 0), coalesce(sum(credit_amount), 0) INTO debit_total, credit_total FROM public.journal_entry_lines WHERE journal_entry_id = _journal_entry_id;
  IF debit_total = 0 OR debit_total <> credit_total THEN RAISE EXCEPTION 'Journal entry is not balanced'; END IF;
  UPDATE public.journal_entries SET status = 'posted', posted_by = auth.uid(), posted_at = now(), updated_at = now() WHERE id = _journal_entry_id RETURNING * INTO entry_row;
  RETURN entry_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.reverse_journal_entry(_journal_entry_id uuid, _narration text DEFAULT NULL)
RETURNS public.journal_entries LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE original public.journal_entries; reversal public.journal_entries; line record;
BEGIN
  SELECT * INTO original FROM public.journal_entries WHERE id = _journal_entry_id FOR UPDATE;
  IF original.status <> 'posted' THEN RAISE EXCEPTION 'Only posted entries can be reversed'; END IF;
  INSERT INTO public.journal_entries (school_id, entry_number, entry_date, term_id, academic_year_id, source, source_reference_id, narration, status, created_by)
  VALUES (original.school_id, public.next_journal_entry_number(original.school_id), current_date, original.term_id, original.academic_year_id, 'other', original.id, coalesce(_narration, 'Reversal of ' || original.entry_number), 'draft', auth.uid()) RETURNING * INTO reversal;
  FOR line IN SELECT * FROM public.journal_entry_lines WHERE journal_entry_id = original.id LOOP
    INSERT INTO public.journal_entry_lines (school_id, journal_entry_id, account_id, debit_amount, credit_amount, description)
    VALUES (line.school_id, reversal.id, line.account_id, line.credit_amount, line.debit_amount, 'Reversal');
  END LOOP;
  UPDATE public.journal_entries
  SET status = 'posted', posted_by = auth.uid(), posted_at = now(), updated_at = now()
  WHERE id = reversal.id
  RETURNING * INTO reversal;
  UPDATE public.journal_entries SET status = 'reversed', updated_at = now() WHERE id = original.id;
  RETURN reversal;
END;
$$;

CREATE OR REPLACE FUNCTION public.seed_school_chart_of_accounts(_school_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE inserted_count integer;
BEGIN
  INSERT INTO public.chart_of_accounts (school_id, account_code, account_name, account_type, normal_balance) VALUES
    (_school_id, '1100', 'Cash and bank', 'asset', 'debit'),
    (_school_id, '1200', 'Accounts receivable', 'asset', 'debit'),
    (_school_id, '1300', 'Inventory', 'asset', 'debit'),
    (_school_id, '2100', 'Accounts payable', 'liability', 'credit'),
    (_school_id, '3100', 'Accumulated funds', 'equity', 'credit'),
    (_school_id, '4100', 'Tuition and school fees', 'revenue', 'credit'),
    (_school_id, '5100', 'Teaching supplies', 'expense', 'debit'),
    (_school_id, '5200', 'Utilities and maintenance', 'expense', 'debit')
  ON CONFLICT (school_id, account_code) DO NOTHING;
  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count;
END;
$$;
