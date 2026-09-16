CREATE TABLE public.message_settings (
  school_id uuid PRIMARY KEY REFERENCES public.schools(id) ON DELETE CASCADE,
  school_display_name text,
  sms_sender_id text,
  school_phone text,
  school_email text,
  footer_note text NOT NULL DEFAULT 'This is an automated message from SHANSCOTT.',
  do_not_reply boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('academic_report', 'fee_balance', 'general_update', 'attendance_alert')),
  channel text NOT NULL DEFAULT 'sms' CHECK (channel IN ('sms', 'email', 'both')),
  subject text,
  body_template text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, category, channel)
);

CREATE TABLE public.message_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  learner_id uuid REFERENCES public.learners(id) ON DELETE SET NULL,
  guardian_id uuid REFERENCES public.guardians(id) ON DELETE SET NULL,
  category text NOT NULL,
  channel text NOT NULL,
  rendered_body text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  sent_at timestamptz,
  error_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.message_settings, public.message_templates, public.message_logs TO authenticated;
GRANT ALL ON public.message_settings, public.message_templates, public.message_logs TO service_role;
ALTER TABLE public.message_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY message_settings_read ON public.message_settings FOR SELECT TO authenticated
  USING (public.is_school_member(school_id) OR public.is_super_admin());
CREATE POLICY message_settings_write ON public.message_settings FOR ALL TO authenticated
  USING (public.has_school_role(school_id, ARRAY['admin','principal','deputy']::public.app_role[]) OR public.is_super_admin())
  WITH CHECK (public.has_school_role(school_id, ARRAY['admin','principal','deputy']::public.app_role[]) OR public.is_super_admin());
CREATE POLICY message_templates_read ON public.message_templates FOR SELECT TO authenticated
  USING (public.is_school_member(school_id) OR public.is_super_admin());
CREATE POLICY message_templates_write ON public.message_templates FOR ALL TO authenticated
  USING (public.has_school_role(school_id, ARRAY['admin','principal','deputy']::public.app_role[]) OR public.is_super_admin())
  WITH CHECK (public.has_school_role(school_id, ARRAY['admin','principal','deputy']::public.app_role[]) OR public.is_super_admin());
CREATE POLICY message_logs_read ON public.message_logs FOR SELECT TO authenticated
  USING (public.is_school_member(school_id) OR public.is_super_admin());
CREATE POLICY message_logs_insert ON public.message_logs FOR INSERT TO authenticated
  WITH CHECK (public.is_school_member(school_id) OR public.is_super_admin());

CREATE TRIGGER trg_message_settings_updated BEFORE UPDATE ON public.message_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_message_templates_updated BEFORE UPDATE ON public.message_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX message_logs_school_created_idx ON public.message_logs (school_id, created_at DESC);

INSERT INTO public.message_templates (school_id, category, channel, subject, body_template)
SELECT schools.id, defaults.category, 'sms', defaults.subject, defaults.body_template
FROM public.schools AS schools
CROSS JOIN (VALUES
  ('academic_report', 'Academic report for {{student_name}}', 'Please find {{student_name}}''s academic report for {{term}} {{year}}. Mean: {{mean_grade}}. Position: {{class_position}}/{{class_total_students}}.'),
  ('fee_balance', 'Fee balance for {{student_name}}', 'Fee balance for {{student_name}}: {{fee_balance}} outstanding of {{total_fees}}. Paid: {{amount_paid}}. Due: {{due_date}}.'),
  ('general_update', 'School update', '{{message_body}}'),
  ('attendance_alert', 'Attendance alert for {{student_name}}', '{{student_name}} was marked {{status}} on {{date}}.')
) AS defaults(category, subject, body_template)
ON CONFLICT (school_id, category, channel) DO NOTHING;

INSERT INTO public.message_settings (school_id, school_display_name, school_phone, school_email)
SELECT id, name, phone, email FROM public.schools
ON CONFLICT (school_id) DO NOTHING;