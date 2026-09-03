-- Close the remaining teacher-scope gaps around lesson attendance,
-- assessment ownership, marks, and timetable reads.

ALTER TABLE public.attendance_records
  ADD COLUMN IF NOT EXISTS timetable_slot_id uuid REFERENCES public.timetable_slots(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS teacher_allocation_id uuid REFERENCES public.teacher_allocations(id) ON DELETE SET NULL;

DROP INDEX IF EXISTS attendance_records_register_idx;
CREATE INDEX attendance_records_register_idx
  ON public.attendance_records (school_id, stream_id, attendance_date, timetable_slot_id);

ALTER TABLE public.attendance_records
  DROP CONSTRAINT IF EXISTS attendance_records_school_id_learner_id_attendance_date_key;
CREATE UNIQUE INDEX IF NOT EXISTS attendance_records_register_unique
  ON public.attendance_records (school_id, learner_id, attendance_date, COALESCE(timetable_slot_id, '00000000-0000-0000-0000-000000000000'::uuid));

CREATE OR REPLACE FUNCTION public.teacher_can_mark_attendance(
  _school_id uuid,
  _learner_id uuid,
  _timetable_slot_id uuid,
  _teacher_allocation_id uuid
)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    public.is_super_admin()
    OR public.is_school_admin(_school_id)
    OR EXISTS (
      SELECT 1
      FROM public.learners l
      JOIN public.staff st
        ON st.user_id = auth.uid()
       AND st.school_id = _school_id
       AND st.is_archived = false
       AND st.status = 'active'
      JOIN public.teacher_allocations ta
        ON ta.id = _teacher_allocation_id
       AND ta.staff_id = st.id
       AND ta.school_id = _school_id
       AND ta.is_active
      JOIN public.timetable_slots slot
        ON slot.id = _timetable_slot_id
       AND slot.school_id = _school_id
       AND slot.staff_id = st.id
       AND slot.stream_id = ta.stream_id
       AND slot.learning_area_id = ta.learning_area_id
      JOIN public.timetables tt
        ON tt.id = slot.timetable_id
       AND tt.school_id = _school_id
       AND tt.status = 'published'
      WHERE l.id = _learner_id
        AND l.school_id = _school_id
        AND l.current_stream_id = ta.stream_id
        AND public.teacher_has_permission(_school_id, 'mark_attendance', tt.academic_year_id, l.current_grade, ta.stream_id, ta.learning_area_id)
    );
$$;
GRANT EXECUTE ON FUNCTION public.teacher_can_mark_attendance(uuid, uuid, uuid, uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS attendance_teacher_insert ON public.attendance_records;
CREATE POLICY attendance_teacher_insert ON public.attendance_records FOR INSERT TO authenticated
WITH CHECK (
  public.is_super_admin()
  OR public.is_school_admin(school_id)
  OR (
    timetable_slot_id IS NOT NULL
    AND teacher_allocation_id IS NOT NULL
    AND marked_by = auth.uid()
    AND public.teacher_can_mark_attendance(school_id, learner_id, timetable_slot_id, teacher_allocation_id)
    AND stream_id = (SELECT current_stream_id FROM public.learners WHERE id = learner_id AND school_id = attendance_records.school_id)
  )
);

DROP POLICY IF EXISTS attendance_teacher_update ON public.attendance_records;
CREATE POLICY attendance_teacher_update ON public.attendance_records FOR UPDATE TO authenticated
USING (
  public.is_super_admin()
  OR public.is_school_admin(school_id)
  OR (marked_by = auth.uid() AND public.teacher_can_mark_attendance(school_id, learner_id, timetable_slot_id, teacher_allocation_id))
)
WITH CHECK (
  public.is_super_admin()
  OR public.is_school_admin(school_id)
  OR (
    marked_by = auth.uid()
    AND public.teacher_can_mark_attendance(school_id, learner_id, timetable_slot_id, teacher_allocation_id)
    AND stream_id = (SELECT current_stream_id FROM public.learners WHERE id = learner_id AND school_id = attendance_records.school_id)
  )
);

-- A teacher-created assessment must identify the stream whose allocation grants access.
DROP POLICY IF EXISTS as_teacher_insert ON public.assessments;
CREATE POLICY as_teacher_insert ON public.assessments FOR INSERT TO authenticated
WITH CHECK (
  public.is_super_admin()
  OR public.is_school_admin(school_id)
  OR (
    stream_id IS NOT NULL
    AND created_by = auth.uid()
    AND public.teacher_has_permission(school_id, 'enter_marks', academic_year_id, grade, stream_id, learning_area_id)
    AND EXISTS (
      SELECT 1
      FROM public.staff st
      JOIN public.teacher_allocations ta ON ta.staff_id = st.id
      WHERE st.user_id = auth.uid()
        AND st.school_id = assessments.school_id
        AND st.is_archived = false
        AND st.status = 'active'
        AND ta.school_id = assessments.school_id
        AND ta.is_active
        AND ta.stream_id = assessments.stream_id
        AND ta.learning_area_id = assessments.learning_area_id
    )
  )
);

-- A teacher may only read slots they personally teach in an assigned stream/subject.
CREATE OR REPLACE FUNCTION public.teacher_can_access_timetable(_school_id uuid, _timetable_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    public.is_super_admin()
    OR public.is_school_admin(_school_id)
    OR EXISTS (
      SELECT 1
      FROM public.timetable_slots slot
      JOIN public.timetables tt ON tt.id = slot.timetable_id
      JOIN public.staff st ON st.user_id = auth.uid() AND st.school_id = _school_id
      JOIN public.teacher_allocations ta
        ON ta.staff_id = st.id
       AND ta.stream_id = slot.stream_id
       AND ta.learning_area_id = slot.learning_area_id
       AND ta.is_active
      WHERE slot.timetable_id = _timetable_id
        AND slot.school_id = _school_id
        AND slot.staff_id = st.id
        AND st.is_archived = false
        AND st.status = 'active'
        AND public.teacher_has_permission(_school_id, 'view_timetable', tt.academic_year_id, NULL, ta.stream_id, ta.learning_area_id)
    );
$$;

DROP POLICY IF EXISTS ts_teacher_select ON public.timetable_slots;
CREATE POLICY ts_teacher_select ON public.timetable_slots FOR SELECT TO authenticated
USING (
  public.is_super_admin()
  OR public.is_school_admin(school_id)
  OR EXISTS (
    SELECT 1
    FROM public.staff st
    JOIN public.teacher_allocations ta
      ON ta.staff_id = st.id
     AND ta.stream_id = timetable_slots.stream_id
     AND ta.learning_area_id = timetable_slots.learning_area_id
     AND ta.is_active
    JOIN public.timetables tt ON tt.id = timetable_slots.timetable_id
    WHERE st.user_id = auth.uid()
      AND st.school_id = timetable_slots.school_id
      AND st.id = timetable_slots.staff_id
      AND st.is_archived = false
      AND st.status = 'active'
      AND public.teacher_has_permission(school_id, 'view_timetable', tt.academic_year_id, NULL, ta.stream_id, ta.learning_area_id)
  )
);