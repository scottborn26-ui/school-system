ALTER TABLE public.attendance_records
  ADD COLUMN IF NOT EXISTS timetable_slot_id uuid REFERENCES public.timetable_slots(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS teacher_allocation_id uuid REFERENCES public.teacher_allocations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS attendance_records_register_idx
  ON public.attendance_records (school_id, stream_id, attendance_date, timetable_slot_id);

NOTIFY pgrst, 'reload schema';