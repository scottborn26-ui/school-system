-- Ensure authenticated school users can create messages in their active school.
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS messages_participant_select ON public.messages;
DROP POLICY IF EXISTS messages_member_insert ON public.messages;

CREATE POLICY messages_participant_select
ON public.messages
FOR SELECT
TO authenticated
USING (
  sender_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.message_recipients AS mr
    WHERE mr.message_id = public.messages.id
      AND mr.recipient_id = auth.uid()
  )
);

CREATE POLICY messages_member_insert
ON public.messages
FOR INSERT
TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND (
    public.is_super_admin()
    OR public.is_school_member(school_id)
    OR EXISTS (
      SELECT 1
      FROM public.user_roles AS ur
      WHERE ur.user_id = auth.uid()
        AND ur.school_id = public.messages.school_id
        AND ur.is_active
        AND ur.role::text IN (
          'admin', 'principal', 'deputy', 'accountant', 'support_staff',
          'security', 'exam_officer', 'teacher', 'class_teacher',
          'parent', 'student'
        )
    )
  )
);

GRANT INSERT ON public.messages TO authenticated;

ALTER TABLE public.message_recipients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS message_recipients_participant_select ON public.message_recipients;
DROP POLICY IF EXISTS message_recipients_sender_insert ON public.message_recipients;
DROP POLICY IF EXISTS message_recipients_own_update ON public.message_recipients;

CREATE POLICY message_recipients_participant_select
ON public.message_recipients
FOR SELECT
TO authenticated
USING (
  recipient_id = auth.uid()
  OR public.user_is_message_sender(message_id)
);

CREATE POLICY message_recipients_sender_insert
ON public.message_recipients
FOR INSERT
TO authenticated
WITH CHECK (public.user_is_message_sender(message_id));

CREATE POLICY message_recipients_own_update
ON public.message_recipients
FOR UPDATE
TO authenticated
USING (recipient_id = auth.uid())
WITH CHECK (recipient_id = auth.uid());

GRANT SELECT, INSERT, UPDATE ON public.message_recipients TO authenticated;
