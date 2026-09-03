import { describe, expect, it } from "vitest";
import { formatLessonOptionLabel, getAttendanceDayOfWeek } from "./attendance";

describe("attendance helpers", () => {
  it("maps a selected date to its timetable weekday", () => {
    expect(getAttendanceDayOfWeek("2026-08-26")).toBe(3);
    expect(getAttendanceDayOfWeek("2026-08-28")).toBe(5);
    expect(getAttendanceDayOfWeek("2026-08-29")).toBeNull();
  });

  it("formats a lesson label with the period time range", () => {
    expect(
      formatLessonOptionLabel(2, {
        label: "Period 2",
        start_time: "08:40",
        end_time: "09:20",
      }),
    ).toBe("Period 2 · 8:40–9:20 AM");

    expect(
      formatLessonOptionLabel(8, {
        label: "Period 8",
        start_time: "14:00",
        end_time: "14:40",
      }),
    ).toBe("Period 8 · 2:00–2:40 PM");
  });
});
