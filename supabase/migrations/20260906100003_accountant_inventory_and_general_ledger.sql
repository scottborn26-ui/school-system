CREATE TABLE public.inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'General',
  unit text NOT NULL DEFAULT 'pieces',
  quantity_on_hand numeric NOT NULL DEFAULT 0 CHECK (quantity_on_hand >= 0),
  reorder_level numeric NOT NULL DEFAULT 0 CHECK (reorder_level >= 0),
  unit_cost numeric NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
  supplier text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_items TO authenticated;
GRANT ALL ON public.inventory_items TO service_role;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY inventory_items_select ON public.inventory_items FOR SELECT TO authenticated
  USING (public.is_school_member(school_id) OR public.is_super_admin());
CREATE POLICY inventory_items_insert ON public.inventory_items FOR INSERT TO authenticated
  WITH CHECK (public.has_school_role(school_id, ARRAY['admin','accountant','principal','deputy']::public.app_role[]) OR public.is_super_admin());
CREATE POLICY inventory_items_update ON public.inventory_items FOR UPDATE TO authenticated
  USING (public.has_school_role(school_id, ARRAY['admin','accountant','principal','deputy']::public.app_role[]) OR public.is_super_admin())
  WITH CHECK (public.has_school_role(school_id, ARRAY['admin','accountant','principal','deputy']::public.app_role[]) OR public.is_super_admin());
CREATE POLICY inventory_items_delete ON public.inventory_items FOR DELETE TO authenticated
  USING (public.has_school_role(school_id, ARRAY['admin','accountant','principal','deputy']::public.app_role[]) OR public.is_super_admin());
CREATE TRIGGER trg_inventory_items_updated BEFORE UPDATE ON public.inventory_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.inventory_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  transaction_type text NOT NULL CHECK (transaction_type IN ('purchase','issue','adjustment')),
  quantity numeric NOT NULL CHECK (quantity <> 0),
  unit_cost numeric NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
  transaction_date date NOT NULL DEFAULT current_date,
  reference text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_transactions TO authenticated;
GRANT ALL ON public.inventory_transactions TO service_role;
ALTER TABLE public.inventory_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY inventory_transactions_select ON public.inventory_transactions FOR SELECT TO authenticated
  USING (public.is_school_member(school_id) OR public.is_super_admin());
CREATE POLICY inventory_transactions_insert ON public.inventory_transactions FOR INSERT TO authenticated
  WITH CHECK (public.has_school_role(school_id, ARRAY['admin','accountant','principal','deputy']::public.app_role[]) OR public.is_super_admin());
CREATE POLICY inventory_transactions_update ON public.inventory_transactions FOR UPDATE TO authenticated
  USING (public.has_school_role(school_id, ARRAY['admin','accountant','principal','deputy']::public.app_role[]) OR public.is_super_admin())
  WITH CHECK (public.has_school_role(school_id, ARRAY['admin','accountant','principal','deputy']::public.app_role[]) OR public.is_super_admin());
CREATE POLICY inventory_transactions_delete ON public.inventory_transactions FOR DELETE TO authenticated
  USING (public.has_school_role(school_id, ARRAY['admin','accountant','principal','deputy']::public.app_role[]) OR public.is_super_admin());

CREATE OR REPLACE FUNCTION public.apply_inventory_transaction()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  quantity_delta numeric;
BEGIN
  quantity_delta := CASE
    WHEN NEW.transaction_type = 'purchase' THEN abs(NEW.quantity)
    WHEN NEW.transaction_type = 'issue' THEN -abs(NEW.quantity)
    ELSE NEW.quantity
  END;

  UPDATE public.inventory_items
  SET quantity_on_hand = quantity_on_hand + quantity_delta
  WHERE id = NEW.item_id AND school_id = NEW.school_id
    AND quantity_on_hand + quantity_delta >= 0;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inventory transaction would create a negative stock balance';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_apply_inventory_transaction
  AFTER INSERT ON public.inventory_transactions
  FOR EACH ROW EXECUTE FUNCTION public.apply_inventory_transaction();

CREATE TABLE public.general_ledger_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  entry_date date NOT NULL DEFAULT current_date,
  account_code text NOT NULL,
  account_name text NOT NULL,
  entry_type text NOT NULL CHECK (entry_type IN ('debit','credit')),
  amount numeric NOT NULL CHECK (amount > 0),
  description text NOT NULL,
  reference text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.general_ledger_entries TO authenticated;
GRANT ALL ON public.general_ledger_entries TO service_role;
ALTER TABLE public.general_ledger_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY general_ledger_entries_select ON public.general_ledger_entries FOR SELECT TO authenticated
  USING (public.is_school_member(school_id) OR public.is_super_admin());
CREATE POLICY general_ledger_entries_insert ON public.general_ledger_entries FOR INSERT TO authenticated
  WITH CHECK (public.has_school_role(school_id, ARRAY['admin','accountant','principal','deputy']::public.app_role[]) OR public.is_super_admin());
CREATE POLICY general_ledger_entries_update ON public.general_ledger_entries FOR UPDATE TO authenticated
  USING (public.has_school_role(school_id, ARRAY['admin','accountant','principal','deputy']::public.app_role[]) OR public.is_super_admin())
  WITH CHECK (public.has_school_role(school_id, ARRAY['admin','accountant','principal','deputy']::public.app_role[]) OR public.is_super_admin());
CREATE POLICY general_ledger_entries_delete ON public.general_ledger_entries FOR DELETE TO authenticated
  USING (public.has_school_role(school_id, ARRAY['admin','accountant','principal','deputy']::public.app_role[]) OR public.is_super_admin());
