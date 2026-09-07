UPDATE public.staff
SET account_role = ur.role::text,
    updated_at = now()
FROM public.user_roles ur
WHERE ur.user_id = public.staff.user_id
  AND ur.school_id = public.staff.school_id
  AND ur.is_active = true
  AND public.staff.account_role IS NULL;

INSERT INTO public.user_school_memberships (user_id, school_id, is_active)
SELECT DISTINCT s.user_id, s.school_id, true
FROM public.staff s
WHERE s.user_id IS NOT NULL
  AND s.school_id IS NOT NULL
  AND s.is_archived = false
  AND s.account_status = 'active'
  AND NOT EXISTS (
    SELECT 1
    FROM public.user_school_memberships m
    WHERE m.user_id = s.user_id AND m.school_id = s.school_id
  );

INSERT INTO public.user_roles (user_id, school_id, role, is_active)
SELECT s.user_id, s.school_id, s.account_role::public.app_role, true
FROM public.staff s
WHERE s.user_id IS NOT NULL
  AND s.school_id IS NOT NULL
  AND s.is_archived = false
  AND s.account_status = 'active'
  AND s.account_role IN (
    'admin', 'accountant', 'exam_officer', 'principal', 'deputy',
    'teacher', 'class_teacher', 'security'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.user_roles r
    WHERE r.user_id = s.user_id
      AND r.school_id = s.school_id
      AND r.role::text = s.account_role
  );
