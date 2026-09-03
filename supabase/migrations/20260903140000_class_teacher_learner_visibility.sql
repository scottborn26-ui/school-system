-- Class teachers can view learners assigned to their class-teacher streams.
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
        OR EXISTS (
          SELECT 1
          FROM public.staff st
          JOIN public.streams class_stream
            ON class_stream.class_teacher_id = st.id
           AND class_stream.id = l.current_stream_id
           AND class_stream.school_id = _school_id
           AND class_stream.is_active = true
          WHERE st.user_id = auth.uid()
            AND st.school_id = _school_id
            AND st.is_archived = false
            AND st.status = 'active'
        )
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

GRANT EXECUTE ON FUNCTION public.teacher_can_access_learner(uuid, uuid, text, uuid)
  TO authenticated, service_role;
