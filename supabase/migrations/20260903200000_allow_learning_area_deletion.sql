-- Allow school leadership to remove unlinked learning areas.
GRANT DELETE ON public.learning_areas TO authenticated;

CREATE POLICY learning_areas_delete ON public.learning_areas FOR DELETE TO authenticated
  USING (public.is_school_admin(school_id) OR public.is_super_admin());