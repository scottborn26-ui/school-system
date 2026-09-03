-- School administrators must be able to admit learners through bulk import.
DROP POLICY IF EXISTS learners_admin_insert ON public.learners;
CREATE POLICY learners_admin_insert ON public.learners FOR INSERT TO authenticated
WITH CHECK (
  public.is_super_admin()
  OR public.is_school_admin(school_id)
);

DROP POLICY IF EXISTS learners_admin_update ON public.learners;
CREATE POLICY learners_admin_update ON public.learners FOR UPDATE TO authenticated
USING (
  public.is_super_admin()
  OR public.is_school_admin(school_id)
)
WITH CHECK (
  public.is_super_admin()
  OR public.is_school_admin(school_id)
);
