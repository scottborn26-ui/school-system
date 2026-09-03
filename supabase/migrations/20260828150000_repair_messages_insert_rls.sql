ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS messages_member_insert ON public.messages;

CREATE POLICY messages_member_insert
ON public.messages
FOR INSERT
TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND (
    public.is_school_member(school_id)
    OR public.has_school_role(
      school_id,
      ARRAY[
        'admin', 'principal', 'deputy', 'exam_officer',
        'teacher', 'class_teacher', 'registrar', 'bursar',
        'parent', 'student'
      ]::public.app_role[]
    )
    OR public.is_super_admin()
  )
);

GRANT INSERT ON public.messages TO authenticated;
