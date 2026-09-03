-- Manual integration-test specification for a Supabase test database.
-- Run each case with a JWT for the named teacher and assert that the result
-- is empty or the write returns an RLS violation.

-- 1. A teacher assigned to stream A must not see a learner in stream B.
-- select id from public.learners where id = '<stream-B-learner>'; -- expect 0 rows

-- 2. A teacher assigned Mathematics in stream A must not insert a mark for
--    an assessment whose learning_area_id is English or whose stream is B.
-- insert into public.marks (school_id, assessment_id, learner_id, raw_score)
-- values ('<school>', '<english-or-stream-B-assessment>', '<learner>', 50);
-- expect: new row violates row-level security policy for table "marks"

-- 3. A teacher must not see another teacher's timetable slot.
-- select id from public.timetable_slots where id = '<other-teacher-slot>'; -- expect 0 rows

-- 4. Direct attendance writes must include a published slot and matching
--    teacher allocation; guessing stream_id/learner_id alone must be denied.
-- insert into public.attendance_records (
--   school_id, stream_id, learner_id, attendance_date, status, marked_by
-- ) values ('<school>', '<other-stream>', '<other-learner>', current_date,
--           'present', auth.uid());
-- expect: new row violates row-level security policy for table "attendance_records"