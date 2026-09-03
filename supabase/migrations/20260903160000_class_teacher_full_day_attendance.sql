-- Class teachers may mark one full-day attendance register for their owned stream.
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
        AND public.teacher_has_permission(
          _school_id,
          'mark_attendance',
          tt.academic_year_id,
          l.current_grade,
          ta.stream_id,
          ta.learning_area_id
        )
    );
$$;

GRANT EXECUTE ON FUNCTION public.teacher_can_mark_attendance(uuid, uuid, uuid, uuid)
  TO authenticated, service_role;

DROP POLICY IF EXISTS attendance_teacher_insert ON public.attendance_records;
CREATE POLICY attendance_teacher_insert ON public.attendance_records FOR INSERT TO authenticated
WITH CHECK (
  public.is_super_admin()
  OR public.is_school_admin(school_id)
  OR (
    timetable_slot_id IS NULL
    AND teacher_allocation_id IS NULL
    AND marked_by = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.learners l
      JOIN public.streams streams ON streams.id = l.current_stream_id
      JOIN public.staff st ON st.id = streams.class_teacher_id
      WHERE l.id = attendance_records.learner_id
        AND l.school_id = attendance_records.school_id
        AND streams.id = attendance_records.stream_id
        AND streams.class_teacher_id = st.id
        AND st.user_id = auth.uid()
        AND st.is_archived = false
        AND st.status = 'active'
    )
  )
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
  OR marked_by = auth.uid()
)
WITH CHECK (
  public.is_super_admin()
  OR public.is_school_admin(school_id)
  OR (
    marked_by = auth.uid()
    AND (
      (
        timetable_slot_id IS NULL
        AND teacher_allocation_id IS NULL
        AND EXISTS (
          SELECT 1
          FROM public.streams streams
          JOIN public.staff st ON st.id = streams.class_teacher_id
          WHERE streams.id = attendance_records.stream_id
            AND streams.school_id = attendance_records.school_id
            AND st.user_id = auth.uid()
            AND st.is_archived = false
            AND st.status = 'active'
        )
      )
      OR public.teacher_can_mark_attendance(school_id, learner_id, timetable_slot_id, teacher_allocation_id)
    )
  )
);
