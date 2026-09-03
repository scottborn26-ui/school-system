ALTER TABLE public.school_grade_offerings
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DROP POLICY IF EXISTS school_grade_offerings_admin_insert ON public.school_grade_offerings;
CREATE POLICY school_grade_offerings_admin_insert
ON public.school_grade_offerings FOR INSERT TO authenticated
WITH CHECK (
  public.is_super_admin()
  OR public.has_school_role(school_id, ARRAY['principal', 'deputy']::public.app_role[])
);

DROP POLICY IF EXISTS school_grade_offerings_admin_update ON public.school_grade_offerings;
CREATE POLICY school_grade_offerings_admin_update
ON public.school_grade_offerings FOR UPDATE TO authenticated
USING (
  public.is_super_admin()
  OR public.has_school_role(school_id, ARRAY['principal', 'deputy']::public.app_role[])
)
WITH CHECK (
  public.is_super_admin()
  OR public.has_school_role(school_id, ARRAY['principal', 'deputy']::public.app_role[])
);