CREATE INDEX IF NOT EXISTS staff_credentials_expiry_idx
  ON public.staff (credentials_expires_at)
  WHERE must_change_password = true;
