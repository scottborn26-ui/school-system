-- Remove invoice ledger activity when an invoice is permanently deleted.
CREATE OR REPLACE FUNCTION public.remove_invoice_ledger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.ledger_entries
  WHERE school_id = OLD.school_id
    AND source_id = OLD.id
    AND source IN ('invoice', 'reversal');
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_remove_invoice_ledger ON public.invoices;
CREATE TRIGGER trg_remove_invoice_ledger
AFTER DELETE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.remove_invoice_ledger();

-- Clean ledger rows left by invoices deleted before this trigger existed.
DELETE FROM public.ledger_entries l
WHERE l.source IN ('invoice', 'reversal')
  AND NOT EXISTS (
    SELECT 1
    FROM public.invoices i
    WHERE i.id = l.source_id
  );