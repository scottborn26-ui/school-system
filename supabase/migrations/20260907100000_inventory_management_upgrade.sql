ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS item_code text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS subcategory text,
  ADD COLUMN IF NOT EXISTS acquired_on date,
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS item_condition text NOT NULL DEFAULT 'good',
  ADD COLUMN IF NOT EXISTS is_capital_asset boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS depreciation_method text,
  ADD COLUMN IF NOT EXISTS useful_life_years numeric,
  ADD COLUMN IF NOT EXISTS salvage_value numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS serial_number text,
  ADD COLUMN IF NOT EXISTS asset_tag text,
  ADD COLUMN IF NOT EXISTS custodian text,
  ADD COLUMN IF NOT EXISTS photo_url text;

UPDATE public.inventory_items
SET item_code = COALESCE(item_code, 'INV-' || upper(substr(replace(id::text, '-', ''), 1, 8)))
WHERE item_code IS NULL;

ALTER TABLE public.inventory_items
  ALTER COLUMN item_code SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS inventory_items_school_item_code_key
  ON public.inventory_items (school_id, item_code);

ALTER TABLE public.inventory_items
  DROP CONSTRAINT IF EXISTS inventory_items_condition_check;
ALTER TABLE public.inventory_items
  ADD CONSTRAINT inventory_items_condition_check
  CHECK (item_condition IN ('new', 'good', 'fair', 'needs_repair', 'disposed'));

CREATE TABLE public.inventory_suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  contact_person text,
  phone text,
  email text,
  address text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_suppliers TO authenticated;
GRANT ALL ON public.inventory_suppliers TO service_role;
ALTER TABLE public.inventory_suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY inventory_suppliers_select ON public.inventory_suppliers FOR SELECT TO authenticated
  USING (public.is_school_member(school_id) OR public.is_super_admin());
CREATE POLICY inventory_suppliers_insert ON public.inventory_suppliers FOR INSERT TO authenticated
  WITH CHECK (public.has_school_role(school_id, ARRAY['admin','accountant','principal','deputy']::public.app_role[]) OR public.is_super_admin());
CREATE POLICY inventory_suppliers_update ON public.inventory_suppliers FOR UPDATE TO authenticated
  USING (public.has_school_role(school_id, ARRAY['admin','accountant','principal','deputy']::public.app_role[]) OR public.is_super_admin())
  WITH CHECK (public.has_school_role(school_id, ARRAY['admin','accountant','principal','deputy']::public.app_role[]) OR public.is_super_admin());
CREATE POLICY inventory_suppliers_delete ON public.inventory_suppliers FOR DELETE TO authenticated
  USING (public.has_school_role(school_id, ARRAY['admin','accountant','principal','deputy']::public.app_role[]) OR public.is_super_admin());
CREATE TRIGGER trg_inventory_suppliers_updated BEFORE UPDATE ON public.inventory_suppliers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.inventory_transactions
  ADD COLUMN IF NOT EXISTS supplier_id uuid REFERENCES public.inventory_suppliers(id),
  ADD COLUMN IF NOT EXISTS department text,
  ADD COLUMN IF NOT EXISTS requested_by text,
  ADD COLUMN IF NOT EXISTS approved_by text,
  ADD COLUMN IF NOT EXISTS attachment_url text;

CREATE TABLE public.inventory_stock_takes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  counted_quantity numeric NOT NULL CHECK (counted_quantity >= 0),
  system_quantity numeric NOT NULL CHECK (system_quantity >= 0),
  counted_on date NOT NULL DEFAULT current_date,
  counted_by text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_stock_takes TO authenticated;
GRANT ALL ON public.inventory_stock_takes TO service_role;
ALTER TABLE public.inventory_stock_takes ENABLE ROW LEVEL SECURITY;
CREATE POLICY inventory_stock_takes_select ON public.inventory_stock_takes FOR SELECT TO authenticated
  USING (public.is_school_member(school_id) OR public.is_super_admin());
CREATE POLICY inventory_stock_takes_insert ON public.inventory_stock_takes FOR INSERT TO authenticated
  WITH CHECK (public.has_school_role(school_id, ARRAY['admin','accountant','principal','deputy']::public.app_role[]) OR public.is_super_admin());
CREATE POLICY inventory_stock_takes_update ON public.inventory_stock_takes FOR UPDATE TO authenticated
  USING (public.has_school_role(school_id, ARRAY['admin','accountant','principal','deputy']::public.app_role[]) OR public.is_super_admin())
  WITH CHECK (public.has_school_role(school_id, ARRAY['admin','accountant','principal','deputy']::public.app_role[]) OR public.is_super_admin());
CREATE POLICY inventory_stock_takes_delete ON public.inventory_stock_takes FOR DELETE TO authenticated
  USING (public.has_school_role(school_id, ARRAY['admin','accountant','principal','deputy']::public.app_role[]) OR public.is_super_admin());

CREATE TABLE public.inventory_maintenance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  maintenance_date date NOT NULL DEFAULT current_date,
  description text NOT NULL,
  cost numeric NOT NULL DEFAULT 0 CHECK (cost >= 0),
  vendor text,
  next_due_on date,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_maintenance TO authenticated;
GRANT ALL ON public.inventory_maintenance TO service_role;
ALTER TABLE public.inventory_maintenance ENABLE ROW LEVEL SECURITY;
CREATE POLICY inventory_maintenance_select ON public.inventory_maintenance FOR SELECT TO authenticated
  USING (public.is_school_member(school_id) OR public.is_super_admin());
CREATE POLICY inventory_maintenance_insert ON public.inventory_maintenance FOR INSERT TO authenticated
  WITH CHECK (public.has_school_role(school_id, ARRAY['admin','accountant','principal','deputy']::public.app_role[]) OR public.is_super_admin());
CREATE POLICY inventory_maintenance_update ON public.inventory_maintenance FOR UPDATE TO authenticated
  USING (public.has_school_role(school_id, ARRAY['admin','accountant','principal','deputy']::public.app_role[]) OR public.is_super_admin())
  WITH CHECK (public.has_school_role(school_id, ARRAY['admin','accountant','principal','deputy']::public.app_role[]) OR public.is_super_admin());
CREATE POLICY inventory_maintenance_delete ON public.inventory_maintenance FOR DELETE TO authenticated
  USING (public.has_school_role(school_id, ARRAY['admin','accountant','principal','deputy']::public.app_role[]) OR public.is_super_admin());
