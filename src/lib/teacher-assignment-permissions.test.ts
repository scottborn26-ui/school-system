import { describe, expect, it } from "vitest";
import {
  canCreateAssessment,
  canTeacherCreateAssessment,
  canTeacherEnterMarks,
  canTeacherViewClassRoster,
  canTeacherViewStudent,
  type TeacherAssignment,
} from "./teacher-assignment-permissions";

describe("teacher assignment permissions", () => {
  it("allows assessment creation only for exam administration roles", () => {
    expect(canCreateAssessment("exam_officer")).toBe(true);
    expect(canCreateAssessment("admin")).toBe(true);
    expect(canCreateAssessment("teacher")).toBe(false);
    expect(canCreateAssessment("class_teacher")).toBe(false);
  });

  const activeYear = "year-2026";
  const termTwo = "term-2";
  const termThree = "term-3";

  const teacherAssignments: TeacherAssignment[] = [
    {
      id: "a1",
      teacher_id: "teacher-1",
      school_id: "school-1",
      class_id: "class-5-red",
      subject_id: "maths",
      academic_year: activeYear,
      term: termTwo,
      role: "subject_teacher",
      status: "active",
    },
    {
      id: "a2",
      teacher_id: "teacher-1",
      school_id: "school-1",
      class_id: "class-6-blue",
      subject_id: null,
      academic_year: activeYear,
      term: termTwo,
      role: "class_teacher",
      status: "active",
    },
    {
      id: "a3",
      teacher_id: "teacher-2",
      school_id: "school-1",
      class_id: "class-5-red",
      subject_id: "english",
      academic_year: activeYear,
      term: termTwo,
      role: "subject_teacher",
      status: "active",
    },
  ];

  it("allows a subject teacher to view only the class roster for their assigned subject and blocks other class access", () => {
    expect(
      canTeacherViewClassRoster({
        teacherAssignments,
        teacherId: "teacher-1",
        classId: "class-5-red",
        academicYear: activeYear,
        term: termTwo,
      }),
    ).toBe(true);

    expect(
      canTeacherViewClassRoster({
        teacherAssignments,
        teacherId: "teacher-1",
        classId: "class-6-blue",
        academicYear: activeYear,
        term: termTwo,
      }),
    ).toBe(true);

    expect(
      canTeacherViewClassRoster({
        teacherAssignments,
        teacherId: "teacher-2",
        classId: "class-6-blue",
        academicYear: activeYear,
        term: termTwo,
      }),
    ).toBe(false);
  });

  it("denies marks entry when the teacher is only a class teacher for a different subject", () => {
    const classTeacherOnlyAssignments = [
      {
        ...teacherAssignments[1],
        teacher_id: "teacher-3",
        class_id: "class-5-red",
        subject_id: null,
      },
    ];

    expect(
      canTeacherCreateAssessment({
        teacherAssignments: classTeacherOnlyAssignments,
        teacherId: "teacher-3",
        classId: "class-5-red",
        subjectId: "maths",
        academicYear: activeYear,
        term: termTwo,
      }),
    ).toBe(false);

    expect(
      canTeacherEnterMarks({
        teacherAssignments: classTeacherOnlyAssignments,
        teacherId: "teacher-3",
        classId: "class-5-red",
        subjectId: "maths",
        academicYear: activeYear,
        term: termTwo,
      }),
    ).toBe(false);
  });

  it("blocks access when the assignment is inactive for the current academic year or term", () => {
    const expiredTermAssignments = [
      {
        ...teacherAssignments[0],
        term: termTwo,
      },
    ];

    expect(
      canTeacherViewStudent({
        teacherAssignments: expiredTermAssignments,
        teacherId: "teacher-1",
        studentId: "student-1",
        academicYear: activeYear,
        term: termThree,
      }),
    ).toBe(false);

    expect(
      canTeacherEnterMarks({
        teacherAssignments: expiredTermAssignments,
        teacherId: "teacher-1",
        classId: "class-5-red",
        subjectId: "maths",
        academicYear: activeYear,
        term: termThree,
      }),
    ).toBe(false);
  });
});
