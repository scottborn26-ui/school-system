-- Allow school administrators to assign and clear class teachers on streams.
DROP POLICY IF EXISTS streams_admin_update ON public.streams;
CREATE POLICY streams_admin_update ON public.streams FOR UPDATE TO authenticated
USING (
  public.is_super_admin()
  OR public.is_school_admin(school_id)
)
WITH CHECK (
  public.is_super_admin()
  OR public.is_school_admin(school_id)
);
