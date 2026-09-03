-- Repair helper for teacher rows after the account-creation function is deployed.
-- It links every active, grade-assigned staff row to an existing Auth user
-- with the same email, including reused emails across grades.
DO $$
DECLARE
  staff_row public.staff%ROWTYPE;
  existing_user_id uuid;
BEGIN
  FOR staff_row IN
    SELECT *
    FROM public.staff
    WHERE email IS NOT NULL
      AND assigned_grade IS NOT NULL
      AND is_archived = false
      AND status = 'active'
  LOOP
    SELECT id INTO existing_user_id
    FROM auth.users
    WHERE lower(email) = lower(staff_row.email)
    LIMIT 1;

    IF existing_user_id IS NOT NULL THEN
      UPDATE public.staff
      SET user_id = existing_user_id, updated_at = now()
      WHERE id = staff_row.id;

      INSERT INTO public.user_school_memberships (user_id, school_id, is_active)
      VALUES (existing_user_id, staff_row.school_id, true)
      ON CONFLICT (user_id, school_id) DO UPDATE SET is_active = true;

      UPDATE public.user_roles
      SET is_active = true
      WHERE user_id = existing_user_id
        AND school_id = staff_row.school_id
        AND role = 'teacher';

      IF NOT FOUND THEN
        INSERT INTO public.user_roles (user_id, school_id, role, is_active)
        VALUES (existing_user_id, staff_row.school_id, 'teacher', true);
      END IF;
    END IF;
  END LOOP;
END;
$$;
