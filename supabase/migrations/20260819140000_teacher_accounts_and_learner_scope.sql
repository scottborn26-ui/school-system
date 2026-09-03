ALTER TABLE public.staff
  ADD COLUMN IF NOT EXISTS assigned_grade public.cbe_grade;

CREATE INDEX IF NOT EXISTS staff_teacher_email_idx
  ON public.staff (lower(email))
  WHERE email IS NOT NULL AND is_archived = false;

-- Link a teacher who signs up with the email entered by the principal.
CREATE OR REPLACE FUNCTION public.link_teacher_account()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  teacher_staff public.staff%ROWTYPE;
BEGIN
  SELECT * INTO teacher_staff
  FROM public.staff
  WHERE lower(email) = lower(NEW.email)
    AND is_archived = false
    AND status = 'active'
    AND assigned_grade IS NOT NULL
  ORDER BY created_at
  LIMIT 1;

  IF teacher_staff.id IS NOT NULL THEN
    UPDATE public.staff
    SET user_id = NEW.id, updated_at = now()
    WHERE id = teacher_staff.id;

    INSERT INTO public.user_school_memberships (user_id, school_id)
    VALUES (NEW.id, teacher_staff.school_id)
    ON CONFLICT (user_id, school_id) DO UPDATE SET is_active = true;

    UPDATE public.user_roles
    SET is_active = true
    WHERE user_id = NEW.id
      AND school_id = teacher_staff.school_id
      AND role = 'teacher';

    IF NOT FOUND THEN
      INSERT INTO public.user_roles (user_id, school_id, role)
      VALUES (NEW.id, teacher_staff.school_id, 'teacher');
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_teacher_link ON auth.users;
CREATE TRIGGER on_auth_user_teacher_link
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.link_teacher_account();

DROP POLICY IF EXISTS "learners_member_read" ON public.learners;
DROP POLICY IF EXISTS "learners_scoped_read" ON public.learners;
CREATE POLICY "learners_scoped_read" ON public.learners
FOR SELECT TO authenticated
USING (
  public.is_super_admin()
  OR (
    public.is_school_member(school_id)
    AND (
      NOT public.has_school_role(school_id, ARRAY['teacher','class_teacher']::public.app_role[])
      OR current_grade IN (
        SELECT s.assigned_grade
        FROM public.staff s
        WHERE s.user_id = auth.uid()
          AND s.school_id = learners.school_id
          AND s.is_archived = false
          AND s.status = 'active'
          AND s.assigned_grade IS NOT NULL
      )
    )
  )
);
