-- Ensure recorded payments update statements and balances, including existing rows.
CREATE OR REPLACE FUNCTION public.post_payment_ledger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.ledger_entries (
      school_id, learner_id, term_id, entry_date, entry_type,
      source, source_id, description, amount
    )
    VALUES (
      NEW.school_id, NEW.learner_id, NEW.term_id, NEW.paid_at::date,
      'credit', 'payment', NEW.id,
      'Receipt ' || NEW.receipt_number || ' (' || NEW.method || ')', NEW.amount
    );
  ELSIF TG_OP = 'UPDATE' AND NOT OLD.is_reversed AND NEW.is_reversed THEN
    INSERT INTO public.ledger_entries (
      school_id, learner_id, term_id, entry_date, entry_type,
      source, source_id, description, amount
    )
    VALUES (
      NEW.school_id, NEW.learner_id, NEW.term_id, current_date,
      'debit', 'reversal', NEW.id,
      'Reversed receipt ' || NEW.receipt_number, NEW.amount
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_payments_ledger ON public.payments;
CREATE TRIGGER trg_payments_ledger
AFTER INSERT OR UPDATE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.post_payment_ledger();

INSERT INTO public.ledger_entries (
  school_id, learner_id, term_id, entry_date, entry_type,
  source, source_id, description, amount
)
SELECT
  p.school_id, p.learner_id, p.term_id, p.paid_at::date, 'credit',
  'payment', p.id,
  'Receipt ' || p.receipt_number || ' (' || p.method || ')', p.amount
FROM public.payments p
WHERE NOT EXISTS (
  SELECT 1
  FROM public.ledger_entries l
  WHERE l.source = 'payment'
    AND l.source_id = p.id
);