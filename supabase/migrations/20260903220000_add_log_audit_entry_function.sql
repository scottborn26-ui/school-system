CREATE OR REPLACE FUNCTION public.log_audit_entry(
  _school_id uuid,
  _action text,
  _module text,
  _entity_type text,
  _entity_id uuid,
  _actor_id uuid,
  _new_values jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_logs (
    school_id,
    actor_id,
    action,
    entity,
    entity_id,
    after_data
  )
  VALUES (
    _school_id,
    COALESCE(_actor_id, auth.uid()),
    _action,
    COALESCE(NULLIF(_module, ''), _entity_type),
    _entity_id,
    _new_values
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_audit_entry(
  uuid, text, text, text, uuid, uuid, jsonb
) TO authenticated, service_role;