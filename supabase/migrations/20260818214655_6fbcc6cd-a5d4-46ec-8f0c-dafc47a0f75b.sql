DROP POLICY IF EXISTS schools_read ON public.schools;
CREATE POLICY schools_read ON public.schools FOR SELECT TO authenticated
USING (is_super_admin() OR is_school_member(id) OR created_by = auth.uid());