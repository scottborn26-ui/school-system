import { describe, expect, it } from "vitest";
import { formatSeniorPathwaySummary, isSeniorSchoolGrade } from "./pathway-display";

describe("senior pathway profile helpers", () => {
  it("recognizes the senior school grade band", () => {
    expect(isSeniorSchoolGrade("G9")).toBe(false);
    expect(isSeniorSchoolGrade("G10")).toBe(true);
    expect(isSeniorSchoolGrade("G12")).toBe(true);
  });

  it("formats a learner's current path from the linked records", () => {
    expect(
      formatSeniorPathwaySummary({
        senior_pathways: { name: "STEM" },
        pathway_tracks: { name: "Pure Sciences" },
        pathway_strands: { name: "Mathematics" },
        subject_combinations: { name: "Physics, Chemistry & Maths" },
      }),
    ).toBe("STEM • Pure Sciences • Mathematics • Physics, Chemistry & Maths");

    expect(
      formatSeniorPathwaySummary({
        senior_pathways: { name: "Arts and Sports Science" },
      }),
    ).toBe("Arts and Sports Science");
  });
});
