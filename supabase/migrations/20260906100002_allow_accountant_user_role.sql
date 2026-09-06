ALTER TABLE public.user_roles
  DROP CONSTRAINT IF EXISTS user_roles_supported_role;

ALTER TABLE public.user_roles
  ADD CONSTRAINT user_roles_supported_role CHECK (
    role::text IN (
      'super_admin',
      'admin',
      'exam_officer',
      'accountant',
      'principal',
      'deputy',
      'teacher',
      'class_teacher',
      'parent',
      'student'
    )
  );