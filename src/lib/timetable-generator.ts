export type GeneratorAllocation = {
  id: string;
  streamId: string;
  staffId: string;
  learningAreaId: string;
  periodsPerWeek: number;
  roomId: string | null;
};

export type GeneratorSlot = {
  allocationId: string;
  streamId: string;
  staffId: string;
  learningAreaId: string;
  roomId: string | null;
  dayOfWeek: number;
  periodIndex: number;
};

export type GeneratorResult = {
  slots: GeneratorSlot[];
  failures: string[];
};

type GeneratorOptions = {
  days: number[];
  periods: number[];
  maxTeacherPeriodsPerDay?: number;
  maxTeacherPeriodsPerWeek?: number;
};

export function generateTimetable(
  allocations: GeneratorAllocation[],
  options: GeneratorOptions,
): GeneratorResult {
  const maxPerDay = options.maxTeacherPeriodsPerDay ?? 6;
  const maxPerWeek = options.maxTeacherPeriodsPerWeek ?? 30;
  const slots: GeneratorSlot[] = [];
  const used = new Set<string>();
  const teacherDayLoad = new Map<string, number>();
  const teacherWeekLoad = new Map<string, number>();
  const placedByAllocation = new Map<string, number>();
  const failures: string[] = [];
  const ordered = allocations
    .filter((allocation) => allocation.periodsPerWeek > 0)
    .flatMap((allocation) =>
      Array.from({ length: allocation.periodsPerWeek }, (_, index) => ({ allocation, index })),
    )
    .sort((left, right) => right.allocation.periodsPerWeek - left.allocation.periodsPerWeek);

  const key = (kind: string, id: string, day: number, period: number) =>
    `${kind}:${id}:${day}:${period}`;
  const candidates = (allocation: GeneratorAllocation) =>
    options.days.flatMap((day) =>
      options.periods
        .map((periodIndex) => ({ day, periodIndex }))
        .sort((left, right) => {
          const leftSpread = placedByAllocation.get(`${allocation.id}:${left.day}`) ?? 0;
          const rightSpread = placedByAllocation.get(`${allocation.id}:${right.day}`) ?? 0;
          return leftSpread - rightSpread;
        }),
    );

  function place(index: number): boolean {
    if (index === ordered.length) return true;
    const allocation = ordered[index]!.allocation;
    for (const candidate of candidates(allocation)) {
      const { day, periodIndex } = candidate;
      const streamKey = key("stream", allocation.streamId, day, periodIndex);
      const teacherKey = key("teacher", allocation.staffId, day, periodIndex);
      const roomKey = allocation.roomId ? key("room", allocation.roomId, day, periodIndex) : null;
      const dayLoadKey = `${allocation.staffId}:${day}`;
      const dayLoad = teacherDayLoad.get(dayLoadKey) ?? 0;
      const weekLoad = teacherWeekLoad.get(allocation.staffId) ?? 0;
      if (used.has(streamKey) || used.has(teacherKey) || (roomKey && used.has(roomKey))) continue;
      if (dayLoad >= maxPerDay || weekLoad >= maxPerWeek) continue;

      used.add(streamKey);
      used.add(teacherKey);
      if (roomKey) used.add(roomKey);
      teacherDayLoad.set(dayLoadKey, dayLoad + 1);
      teacherWeekLoad.set(allocation.staffId, weekLoad + 1);
      placedByAllocation.set(
        `${allocation.id}:${day}`,
        (placedByAllocation.get(`${allocation.id}:${day}`) ?? 0) + 1,
      );
      slots.push({
        allocationId: allocation.id,
        streamId: allocation.streamId,
        staffId: allocation.staffId,
        learningAreaId: allocation.learningAreaId,
        roomId: allocation.roomId,
        dayOfWeek: day,
        periodIndex,
      });

      if (place(index + 1)) return true;

      slots.pop();
      used.delete(streamKey);
      used.delete(teacherKey);
      if (roomKey) used.delete(roomKey);
      teacherDayLoad.set(dayLoadKey, dayLoad);
      teacherWeekLoad.set(allocation.staffId, weekLoad);
      const spreadKey = `${allocation.id}:${day}`;
      const spread = placedByAllocation.get(spreadKey) ?? 1;
      if (spread <= 1) placedByAllocation.delete(spreadKey);
      else placedByAllocation.set(spreadKey, spread - 1);
    }
    return false;
  }

  if (!place(0)) {
    const placedCounts = new Map<string, number>();
    for (const slot of slots)
      placedCounts.set(slot.allocationId, (placedCounts.get(slot.allocationId) ?? 0) + 1);
    for (const allocation of allocations) {
      const placed = placedCounts.get(allocation.id) ?? 0;
      if (placed < allocation.periodsPerWeek)
        failures.push(
          `${allocation.id}: only ${placed} of ${allocation.periodsPerWeek} periods placed`,
        );
    }
  }
  return { slots, failures };
}
