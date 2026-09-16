UPDATE public.message_templates
SET body_template = CASE category
  WHEN 'academic_report' THEN 'Please find {{student_name}}''s academic report for {{term}} {{year}}. Mean: {{mean_grade}}. Position: {{class_position}}/{{class_total_students}}.'
  WHEN 'fee_balance' THEN 'Fee balance for {{student_name}}: {{fee_balance}} outstanding of {{total_fees}}. Paid: {{amount_paid}}. Due: {{due_date}}.'
  WHEN 'general_update' THEN '{{message_body}}'
  WHEN 'attendance_alert' THEN '{{student_name}} was marked {{status}} on {{date}}.'
END,
updated_at = now()
WHERE body_template IS NULL
   OR lower(trim(body_template)) = 'undefined';