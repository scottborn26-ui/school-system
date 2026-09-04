import { describe, expect, it } from "vitest";
import { generateTimetable } from "./timetable-generator";

const options = {
  days: [1, 2, 3, 4, 5],
  periods: [1, 2, 3, 4, 5, 6, 7],
};

describe("generateTimetable", () => {
  it("groups an area into two periods per day and preserves its weekly frequency", () => {
    const result = generateTimetable(
      [
        {
          id: "allocation-1",
          streamId: "stream-1",
          staffId: "staff-1",
          learningAreaId: "area-1",
          periodsPerWeek: 6,
          roomId: null,
        },
      ],
      options,
    );

    const periodsByDay = new Map<number, number>();
    for (const slot of result.slots) {
      periodsByDay.set(slot.dayOfWeek, (periodsByDay.get(slot.dayOfWeek) ?? 0) + 1);
    }

    expect(result.failures).toEqual([]);
    expect(result.slots).toHaveLength(6);
    expect([...periodsByDay.values()]).toEqual([2, 2, 2]);
  });

  it("starts different areas on different days when the stream has capacity", () => {
    const result = generateTimetable(
      [1, 2, 3].map((index) => ({
        id: `allocation-${index}`,
        streamId: "stream-1",
        staffId: `staff-${index}`,
        learningAreaId: `area-${index}`,
        periodsPerWeek: 2,
        roomId: null,
      })),
      options,
    );

    expect(result.failures).toEqual([]);
    expect(new Set(result.slots.map((slot) => slot.dayOfWeek))).toEqual(new Set([1, 2, 3]));
  });
});