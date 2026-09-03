CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject text,
  body text NOT NULL,
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'important', 'urgent')),
  attachment_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.message_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_read boolean NOT NULL DEFAULT false,
  read_at timestamptz,
  UNIQUE (message_id, recipient_id)
);

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'system',
  title text NOT NULL,
  message text NOT NULL,
  related_link text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX messages_school_created_idx ON public.messages(school_id, created_at DESC);
CREATE INDEX message_recipients_user_read_idx ON public.message_recipients(recipient_id, is_read);
CREATE INDEX notifications_user_read_idx ON public.notifications(user_id, is_read, created_at DESC);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

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

CREATE POLICY messages_participant_select ON public.messages FOR SELECT TO authenticated
  USING (public.user_can_access_message(id));
CREATE POLICY messages_member_insert ON public.messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND public.is_school_member(school_id));

CREATE POLICY message_recipients_participant_select ON public.message_recipients FOR SELECT TO authenticated
  USING (recipient_id = auth.uid() OR public.user_is_message_sender(message_id));
CREATE POLICY message_recipients_sender_insert ON public.message_recipients FOR INSERT TO authenticated
  WITH CHECK (public.user_is_message_sender(message_id));
CREATE POLICY message_recipients_own_update ON public.message_recipients FOR UPDATE TO authenticated
  USING (recipient_id = auth.uid()) WITH CHECK (recipient_id = auth.uid());

CREATE POLICY notifications_own_select ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY notifications_own_update ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.notify_message_recipient()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  message_row public.messages;
  sender_name text;
BEGIN
  SELECT * INTO message_row FROM public.messages WHERE id = NEW.message_id;
  SELECT full_name INTO sender_name FROM public.profiles WHERE id = message_row.sender_id;
  INSERT INTO public.notifications (school_id, user_id, type, title, message, related_link)
  VALUES (
    message_row.school_id, NEW.recipient_id, 'message',
    COALESCE(sender_name, 'New message'),
    left(message_row.body, 160), '/messages?thread=' || message_row.sender_id
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER message_recipient_notification
  AFTER INSERT ON public.message_recipients
  FOR EACH ROW EXECUTE FUNCTION public.notify_message_recipient();

GRANT SELECT, INSERT ON public.messages TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.message_recipients TO authenticated;
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_can_access_message(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_is_message_sender(uuid) TO authenticated;