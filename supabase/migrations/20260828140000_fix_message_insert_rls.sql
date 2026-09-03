-- Repairs the policies after the message tables have already been created.
-- Do not rerun the table-creation migration.
DROP POLICY IF EXISTS messages_participant_select ON public.messages;
DROP POLICY IF EXISTS messages_member_insert ON public.messages;
DROP POLICY IF EXISTS message_recipients_participant_select ON public.message_recipients;
DROP POLICY IF EXISTS message_recipients_sender_insert ON public.message_recipients;

CREATE OR REPLACE FUNCTION public.user_can_access_message(_message_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.messages m
    WHERE m.id = _message_id AND m.sender_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.message_recipients mr
    WHERE mr.message_id = _message_id AND mr.recipient_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.user_is_message_sender(_message_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.messages m
    WHERE m.id = _message_id AND m.sender_id = auth.uid()
  );
$$;

CREATE POLICY messages_participant_select
ON public.messages
FOR SELECT
TO authenticated
USING (public.user_can_access_message(id));

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

GRANT EXECUTE ON FUNCTION public.user_can_access_message(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_is_message_sender(uuid) TO authenticated;