ALTER TABLE public.sms_credit_balances
  ADD COLUMN business_number text NOT NULL DEFAULT '4029323',
  ADD COLUMN account_number text NOT NULL DEFAULT 'shnscott technologies';
