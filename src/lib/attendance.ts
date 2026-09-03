export type AttendanceStatus = "present" | "absent" | "late" | "excused";

export function getAttendanceDayOfWeek(date: string): number | null {
  if (!date) return null;

  const parsed = new Date(`${date}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;

  const weekday = parsed.getDay();
  return weekday >= 1 && weekday <= 5 ? weekday : null;
}

export function formatLessonOptionLabel(
  periodIndex: number,
  period?: { label?: string; start_time?: string; end_time?: string },
): string {
  const label = period?.label ?? `Period ${periodIndex}`;
  const startTime = period?.start_time;
  const endTime = period?.end_time;

  if (!startTime || !endTime) {
    return label;
  }

  const formatTime = (time: string, includeSuffix: boolean) => {
    const [hours, minutes] = time.split(":").map(Number);
    const suffix = hours >= 12 ? "PM" : "AM";
    const formattedHour = hours % 12 || 12;
    const value = `${formattedHour}:${String(minutes).padStart(2, "0")}`;
    return includeSuffix ? `${value} ${suffix}` : value;
  };

  const startSuffix = startTime >= "12:00" ? "PM" : "AM";
  const endSuffix = endTime >= "12:00" ? "PM" : "AM";

  if (startSuffix === endSuffix) {
    return `${label} · ${formatTime(startTime, false)}–${formatTime(endTime, true)}`;
  }

  return `${label} · ${formatTime(startTime, true)}–${formatTime(endTime, true)}`;
}
