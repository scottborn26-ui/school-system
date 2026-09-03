-- Teacher RBAC and assignment-scoped access.
-- A teacher's effective scope is always the intersection of:
-- school membership, active staff link, active teacher allocation, and permission.

CREATE TABLE IF NOT EXISTS public.teacher_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  academic_year_id uuid REFERENCES public.academic_years(id) ON DELETE CASCADE,
  permission text NOT NULL CHECK (permission IN (
    'view_students', 'view_student_details', 'enter_marks', 'edit_marks',
    'view_results', 'mark_attendance', 'edit_attendance',
    'generate_report_cards', 'view_timetable'
  )),
  grade public.cbe_grade,
  stream_id uuid REFERENCES public.streams(id) ON DELETE CASCADE,
  learning_area_id uuid REFERENCES public.learning_areas(id) ON DELETE CASCADE,
  is_active boolean NOT NULL DEFAULT true,
  granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS teacher_permissions_scope_idx
  ON public.teacher_permissions (user_id, school_id, academic_year_id, permission, grade, stream_id, learning_area_id)
  WHERE is_active;

GRANT SELECT ON public.teacher_permissions TO authenticated;
GRANT ALL ON public.teacher_permissions TO service_role;
ALTER TABLE public.teacher_permissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS teacher_permissions_select ON public.teacher_permissions;
CREATE POLICY teacher_permissions_select ON public.teacher_permissions FOR SELECT TO authenticated
USING (
  public.is_super_admin()
  OR user_id = auth.uid()
  OR public.is_school_admin(school_id)
);
DROP POLICY IF EXISTS teacher_permissions_admin_insert ON public.teacher_permissions;
CREATE POLICY teacher_permissions_admin_insert ON public.teacher_permissions FOR INSERT TO authenticated
WITH CHECK (public.is_super_admin() OR public.is_school_admin(school_id));
DROP POLICY IF EXISTS teacher_permissions_admin_update ON public.teacher_permissions;
CREATE POLICY teacher_permissions_admin_update ON public.teacher_permissions FOR UPDATE TO authenticated
USING (public.is_super_admin() OR public.is_school_admin(school_id))
WITH CHECK (public.is_super_admin() OR public.is_school_admin(school_id));

CREATE OR REPLACE FUNCTION public.teacher_has_permission(
  _school_id uuid,
  _permission text,
  _academic_year_id uuid DEFAULT NULL,
  _grade public.cbe_grade DEFAULT NULL,
  _stream_id uuid DEFAULT NULL,
  _learning_area_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    public.is_super_admin()
    OR public.is_school_admin(_school_id)
    OR EXISTS (
      SELECT 1
      FROM public.user_school_memberships m
      JOIN public.staff st ON st.user_id = m.user_id AND st.school_id = m.school_id
      JOIN public.teacher_allocations ta ON ta.staff_id = st.id AND ta.school_id = st.school_id
      JOIN public.teacher_permissions p ON p.user_id = m.user_id AND p.school_id = m.school_id
      WHERE m.user_id = auth.uid()
        AND m.school_id = _school_id
        AND m.is_active
        AND st.is_archived = false
        AND st.status = 'active'
        AND ta.is_active
        AND p.is_active
        AND p.permission = _permission
        AND (p.academic_year_id IS NULL OR _academic_year_id IS NULL OR p.academic_year_id = _academic_year_id)
        AND (ta.academic_year_id IS NULL OR _academic_year_id IS NULL OR ta.academic_year_id = _academic_year_id)
        AND (_grade IS NULL OR p.grade IS NULL OR p.grade = _grade)
        AND (_stream_id IS NULL OR p.stream_id IS NULL OR p.stream_id = _stream_id)
        AND (_learning_area_id IS NULL OR p.learning_area_id IS NULL OR p.learning_area_id = ta.learning_area_id)
        AND (_stream_id IS NULL OR ta.stream_id = _stream_id)
        AND (_learning_area_id IS NULL OR ta.learning_area_id = _learning_area_id)
    );
$$;
GRANT EXECUTE ON FUNCTION public.teacher_has_permission(uuid, text, uuid, public.cbe_grade, uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.grant_default_teacher_permissions_for_user(
  _user_id uuid,
  _school_id uuid,
  _granted_by uuid
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  permission_name text;
BEGIN
  FOREACH permission_name IN ARRAY ARRAY[
    'view_students', 'view_student_details', 'enter_marks', 'view_results',
    'mark_attendance', 'edit_attendance', 'generate_report_cards', 'view_timetable'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.teacher_permissions p
      WHERE p.user_id = _user_id
        AND p.school_id = _school_id
        AND p.academic_year_id IS NULL
        AND p.permission = permission_name
        AND p.grade IS NULL AND p.stream_id IS NULL AND p.learning_area_id IS NULL
    ) THEN
      INSERT INTO public.teacher_permissions(user_id, school_id, permission, granted_by)
      VALUES (_user_id, _school_id, permission_name, _granted_by);
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.grant_default_teacher_permissions()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.role IN ('teacher', 'class_teacher') AND NEW.school_id IS NOT NULL THEN
    PERFORM public.grant_default_teacher_permissions_for_user(NEW.user_id, NEW.school_id, NEW.user_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_default_teacher_permissions ON public.user_roles;
CREATE TRIGGER trg_default_teacher_permissions
AFTER INSERT OR UPDATE OF role, is_active ON public.user_roles
FOR EACH ROW WHEN (NEW.is_active)
EXECUTE FUNCTION public.grant_default_teacher_permissions();

-- Seed permissions for teacher accounts that already exist.
DO $$
DECLARE role_row record;
BEGIN
  FOR role_row IN
    SELECT * FROM public.user_roles
    WHERE role IN ('teacher', 'class_teacher') AND is_active AND school_id IS NOT NULL
  LOOP
    PERFORM public.grant_default_teacher_permissions_for_user(role_row.user_id, role_row.school_id, role_row.user_id);
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.teacher_can_access_learner(
  _school_id uuid,
  _learner_id uuid,
  _permission text DEFAULT 'view_students',
  _learning_area_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.learners l
    WHERE l.id = _learner_id
      AND l.school_id = _school_id
      AND (
        public.is_super_admin()
        OR public.is_school_admin(_school_id)
        OR (
          public.teacher_has_permission(_school_id, _permission, NULL, l.current_grade, l.current_stream_id, _learning_area_id)
          AND EXISTS (
            SELECT 1
            FROM public.staff st
            JOIN public.teacher_allocations ta ON ta.staff_id = st.id
            WHERE st.user_id = auth.uid()
              AND st.school_id = _school_id
              AND st.is_archived = false
              AND st.status = 'active'
              AND ta.school_id = _school_id
              AND ta.is_active
              AND ta.stream_id = l.current_stream_id
              AND (_learning_area_id IS NULL OR ta.learning_area_id = _learning_area_id)
          )
        )
      )
  );
$$;
GRANT EXECUTE ON FUNCTION public.teacher_can_access_learner(uuid, uuid, text, uuid) TO authenticated, service_role;

-- Teachers can only see their own official allocations. Administrators control assignments.
DROP POLICY IF EXISTS ta_select ON public.teacher_allocations;
DROP POLICY IF EXISTS "ta_select" ON public.teacher_allocations;
CREATE POLICY ta_select ON public.teacher_allocations FOR SELECT TO authenticated
USING (
  public.is_super_admin()
  OR public.is_school_admin(school_id)
  OR EXISTS (
    SELECT 1 FROM public.staff st
    WHERE st.id = teacher_allocations.staff_id
      AND st.user_id = auth.uid()
      AND st.is_archived = false
      AND st.status = 'active'
  )
);

-- Streams are visible to teachers only when allocated to that stream.
DROP POLICY IF EXISTS streams_member_read ON public.streams;
CREATE POLICY streams_scoped_read ON public.streams FOR SELECT TO authenticated
USING (
  public.is_super_admin()
  OR public.is_school_admin(school_id)
  OR (
    public.is_school_member(school_id)
    AND EXISTS (
      SELECT 1 FROM public.staff st
      JOIN public.teacher_allocations ta ON ta.staff_id = st.id
      WHERE st.user_id = auth.uid()
        AND st.school_id = streams.school_id
        AND st.is_archived = false
        AND st.status = 'active'
        AND ta.stream_id = streams.id
        AND ta.is_active
    )
  )
);

-- Learner identity and details are assignment-scoped, including ID-based reads.
DROP POLICY IF EXISTS learners_member_read ON public.learners;
DROP POLICY IF EXISTS learners_scoped_read ON public.learners;
CREATE POLICY learners_teacher_scoped_read ON public.learners FOR SELECT TO authenticated
USING (
  public.is_super_admin()
  OR public.is_school_admin(school_id)
  OR (
    public.is_school_member(school_id)
    AND public.teacher_can_access_learner(school_id, id, 'view_students')
  )
);
DROP POLICY IF EXISTS learners_member_insert ON public.learners;
CREATE POLICY learners_admin_insert ON public.learners FOR INSERT TO authenticated
WITH CHECK (
  public.is_super_admin()
  OR public.has_school_role(school_id, ARRAY['principal','deputy','registrar']::public.app_role[])
);
DROP POLICY IF EXISTS learners_admin_update ON public.learners;
CREATE POLICY learners_admin_update ON public.learners FOR UPDATE TO authenticated
USING (
  public.is_super_admin()
  OR public.has_school_role(school_id, ARRAY['principal','deputy','registrar']::public.app_role[])
)
WITH CHECK (
  public.is_super_admin()
  OR public.has_school_role(school_id, ARRAY['principal','deputy','registrar']::public.app_role[])
);

-- Assessment creation/editing is subject- and stream-scoped for teachers.
DROP POLICY IF EXISTS as_insert ON public.assessments;
DROP POLICY IF EXISTS as_update ON public.assessments;
CREATE POLICY as_teacher_insert ON public.assessments FOR INSERT TO authenticated
WITH CHECK (
  public.is_super_admin()
  OR public.is_school_admin(school_id)
  OR (
    public.teacher_has_permission(school_id, 'enter_marks', academic_year_id, grade, stream_id, learning_area_id)
    AND EXISTS (
      SELECT 1 FROM public.staff st
      JOIN public.teacher_allocations ta ON ta.staff_id = st.id
      WHERE st.user_id = auth.uid() AND st.school_id = assessments.school_id
        AND st.is_archived = false AND st.status = 'active' AND ta.is_active
        AND ta.learning_area_id = assessments.learning_area_id
        AND (assessments.stream_id IS NULL OR ta.stream_id = assessments.stream_id)
    )
  )
);
CREATE POLICY as_teacher_update ON public.assessments FOR UPDATE TO authenticated
USING (
  public.is_super_admin()
  OR public.is_school_admin(school_id)
  OR (
    created_by = auth.uid()
    AND public.teacher_has_permission(school_id, 'enter_marks', academic_year_id, grade, stream_id, learning_area_id)
  )
)
WITH CHECK (
  public.is_super_admin()
  OR public.is_school_admin(school_id)
  OR created_by = auth.uid()
);

-- Marks: read only authorized learners; inserts require enter_marks; updates require ownership or edit_marks.
DROP POLICY IF EXISTS mk_select ON public.marks;
DROP POLICY IF EXISTS mk_insert ON public.marks;
DROP POLICY IF EXISTS mk_update ON public.marks;
CREATE POLICY mk_teacher_select ON public.marks FOR SELECT TO authenticated
USING (
  public.is_super_admin()
  OR public.is_school_admin(school_id)
  OR EXISTS (
    SELECT 1 FROM public.assessments a
    WHERE a.id = marks.assessment_id
      AND public.teacher_can_access_learner(marks.school_id, marks.learner_id, 'view_results', a.learning_area_id)
  )
);
CREATE POLICY mk_teacher_insert ON public.marks FOR INSERT TO authenticated
WITH CHECK (
  (public.is_super_admin() OR public.is_school_admin(school_id)
   OR EXISTS (
     SELECT 1 FROM public.assessments a
     WHERE a.id = marks.assessment_id
       AND a.status IN ('draft','submitted')
       AND public.teacher_can_access_learner(marks.school_id, marks.learner_id, 'enter_marks', a.learning_area_id)
   ))
  AND (entered_by IS NULL OR entered_by = auth.uid())
);
CREATE POLICY mk_teacher_update ON public.marks FOR UPDATE TO authenticated
USING (
  public.is_super_admin()
  OR public.is_school_admin(school_id)
  OR (
    (entered_by = auth.uid() OR EXISTS (
      SELECT 1 FROM public.assessments a
      WHERE a.id = marks.assessment_id
        AND public.teacher_can_access_learner(marks.school_id, marks.learner_id, 'edit_marks', a.learning_area_id)
    ))
    AND EXISTS (SELECT 1 FROM public.assessments a WHERE a.id = marks.assessment_id AND a.status IN ('draft','submitted'))
  )
)
WITH CHECK (public.is_super_admin() OR public.is_school_admin(school_id) OR entered_by = auth.uid());

-- Attendance is limited by the learner's assigned stream and attendance permissions.
DROP POLICY IF EXISTS attendance_select ON public.attendance_records;
DROP POLICY IF EXISTS attendance_insert ON public.attendance_records;
DROP POLICY IF EXISTS attendance_update ON public.attendance_records;
CREATE POLICY attendance_teacher_select ON public.attendance_records FOR SELECT TO authenticated
USING (
  public.is_super_admin()
  OR public.is_school_admin(school_id)
  OR public.teacher_can_access_learner(school_id, learner_id, 'view_students')
);
CREATE POLICY attendance_teacher_insert ON public.attendance_records FOR INSERT TO authenticated
WITH CHECK (
  public.is_super_admin()
  OR public.is_school_admin(school_id)
  OR (
    public.teacher_can_access_learner(school_id, learner_id, 'mark_attendance')
    AND EXISTS (SELECT 1 FROM public.learners l WHERE l.id = learner_id AND l.current_stream_id = attendance_records.stream_id)
  )
);
CREATE POLICY attendance_teacher_update ON public.attendance_records FOR UPDATE TO authenticated
USING (
  public.is_super_admin()
  OR public.is_school_admin(school_id)
  OR public.teacher_can_access_learner(school_id, learner_id, 'edit_attendance')
)
WITH CHECK (public.is_super_admin() OR public.is_school_admin(school_id) OR public.teacher_can_access_learner(school_id, learner_id, 'edit_attendance'));

-- Assessments and report cards cannot expose unauthorized student/class data.
DROP POLICY IF EXISTS as_select ON public.assessments;
CREATE POLICY as_teacher_select ON public.assessments FOR SELECT TO authenticated
USING (
  public.is_super_admin()
  OR public.is_school_admin(school_id)
  OR EXISTS (
    SELECT 1 FROM public.staff st
    JOIN public.teacher_allocations ta ON ta.staff_id = st.id
    WHERE st.user_id = auth.uid() AND st.school_id = assessments.school_id
      AND st.is_archived = false AND st.status = 'active' AND ta.is_active
      AND (assessments.stream_id IS NULL OR ta.stream_id = assessments.stream_id)
      AND ta.learning_area_id = assessments.learning_area_id
      AND (ta.academic_year_id IS NULL OR ta.academic_year_id = assessments.academic_year_id)
      AND public.teacher_has_permission(assessments.school_id, 'view_results', assessments.academic_year_id, assessments.grade, assessments.stream_id, assessments.learning_area_id)
  )
);

DROP POLICY IF EXISTS rc_select ON public.report_cards;
DROP POLICY IF EXISTS rc_insert ON public.report_cards;
DROP POLICY IF EXISTS rc_update ON public.report_cards;
CREATE POLICY rc_teacher_select ON public.report_cards FOR SELECT TO authenticated
USING (public.is_super_admin() OR public.is_school_admin(school_id) OR public.teacher_can_access_learner(school_id, learner_id, 'view_results'));
CREATE POLICY rc_teacher_insert ON public.report_cards FOR INSERT TO authenticated
WITH CHECK (public.is_super_admin() OR public.is_school_admin(school_id) OR public.teacher_can_access_learner(school_id, learner_id, 'generate_report_cards'));
CREATE POLICY rc_teacher_update ON public.report_cards FOR UPDATE TO authenticated
USING (public.is_super_admin() OR public.is_school_admin(school_id) OR public.teacher_can_access_learner(school_id, learner_id, 'generate_report_cards'))
WITH CHECK (public.is_super_admin() OR public.is_school_admin(school_id) OR public.teacher_can_access_learner(school_id, learner_id, 'generate_report_cards'));

-- Timetable reads are scoped to assigned streams or the teacher's own slots. Writes remain admin-only.
CREATE OR REPLACE FUNCTION public.teacher_can_access_timetable(_school_id uuid, _timetable_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.timetable_slots slot
    JOIN public.timetables tt ON tt.id = slot.timetable_id
    JOIN public.staff st ON st.user_id = auth.uid() AND st.school_id = _school_id
    WHERE tt.id = _timetable_id
      AND tt.school_id = _school_id
      AND st.is_archived = false
      AND st.status = 'active'
      AND EXISTS (
        SELECT 1 FROM public.teacher_allocations ta
        WHERE ta.staff_id = st.id
          AND ta.is_active
          AND (ta.stream_id = slot.stream_id OR slot.staff_id = st.id)
      )
      AND public.teacher_has_permission(_school_id, 'view_timetable', tt.academic_year_id)
  );
$$;
GRANT EXECUTE ON FUNCTION public.teacher_can_access_timetable(uuid, uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS tt_select ON public.timetables;
CREATE POLICY tt_teacher_select ON public.timetables FOR SELECT TO authenticated
USING (public.is_super_admin() OR public.is_school_admin(school_id) OR public.teacher_can_access_timetable(school_id, id));
DROP POLICY IF EXISTS ts_select ON public.timetable_slots;
CREATE POLICY ts_teacher_select ON public.timetable_slots FOR SELECT TO authenticated
USING (
  public.is_super_admin()
  OR public.is_school_admin(school_id)
  OR (
    public.teacher_has_permission(school_id, 'view_timetable', (SELECT academic_year_id FROM public.timetables WHERE id = timetable_id))
    AND EXISTS (
      SELECT 1 FROM public.staff st
      JOIN public.teacher_allocations ta ON ta.staff_id = st.id
      WHERE st.user_id = auth.uid() AND st.school_id = timetable_slots.school_id
        AND (ta.stream_id = timetable_slots.stream_id OR ta.staff_id = timetable_slots.staff_id)
        AND ta.is_active
    )
  )
);

-- Learning areas and staff records are also least-privilege resources.
DROP POLICY IF EXISTS learning_areas_member_read ON public.learning_areas;
CREATE POLICY learning_areas_scoped_read ON public.learning_areas FOR SELECT TO authenticated
USING (
  public.is_super_admin()
  OR public.is_school_admin(school_id)
  OR EXISTS (
    SELECT 1 FROM public.staff st
    JOIN public.teacher_allocations ta ON ta.staff_id = st.id
    WHERE st.user_id = auth.uid() AND st.school_id = learning_areas.school_id
      AND st.is_archived = false AND st.status = 'active'
      AND ta.learning_area_id = learning_areas.id AND ta.is_active
  )
);

DROP POLICY IF EXISTS staff_member_read ON public.staff;
CREATE POLICY staff_scoped_read ON public.staff FOR SELECT TO authenticated
USING (
  public.is_super_admin()
  OR public.is_school_admin(school_id)
  OR user_id = auth.uid()
);

DROP POLICY IF EXISTS staff_member_insert ON public.staff;
CREATE POLICY staff_admin_insert ON public.staff FOR INSERT TO authenticated
WITH CHECK (
  public.is_super_admin()
  OR public.has_school_role(school_id, ARRAY['principal','deputy']::public.app_role[])
);
DROP POLICY IF EXISTS staff_admin_update ON public.staff;
CREATE POLICY staff_admin_update ON public.staff FOR UPDATE TO authenticated
USING (
  public.is_super_admin()
  OR public.has_school_role(school_id, ARRAY['principal','deputy']::public.app_role[])
)
WITH CHECK (
  public.is_super_admin()
  OR public.has_school_role(school_id, ARRAY['principal','deputy']::public.app_role[])
);

-- Audit changes to marks and attendance with actor and timestamps.
CREATE TABLE IF NOT EXISTS public.student_record_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  entity text NOT NULL,
  entity_id uuid NOT NULL,
  action text NOT NULL,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.student_record_audit TO authenticated;
GRANT ALL ON public.student_record_audit TO service_role;
ALTER TABLE public.student_record_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY student_record_audit_read ON public.student_record_audit FOR SELECT TO authenticated
USING (public.is_super_admin() OR public.is_school_admin(school_id) OR actor_id = auth.uid());

CREATE OR REPLACE FUNCTION public.audit_student_record_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.student_record_audit(school_id, actor_id, entity, entity_id, action, before_data, after_data)
  VALUES (
    COALESCE(NEW.school_id, OLD.school_id), auth.uid(), TG_ARGV[0], COALESCE(NEW.id, OLD.id), TG_OP,
    CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) END,
    CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;
DROP TRIGGER IF EXISTS trg_marks_audit ON public.marks;
CREATE TRIGGER trg_marks_audit AFTER INSERT OR UPDATE OR DELETE ON public.marks
FOR EACH ROW EXECUTE FUNCTION public.audit_student_record_change('mark');
DROP TRIGGER IF EXISTS trg_attendance_audit ON public.attendance_records;
CREATE TRIGGER trg_attendance_audit AFTER INSERT OR UPDATE OR DELETE ON public.attendance_records
FOR EACH ROW EXECUTE FUNCTION public.audit_student_record_change('attendance');

-- Supabase Auth enforces one case-insensitive login per email at the database level.
-- Multiple staff assignment rows may intentionally point to that same user_id.
