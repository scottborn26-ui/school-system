DROP POLICY IF EXISTS "schools_update" ON public.schools;
DROP POLICY IF EXISTS schools_update ON public.schools;

CREATE POLICY schools_update ON public.schools
  FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.is_school_admin(id))
  WITH CHECK (public.is_super_admin() OR public.is_school_admin(id));
