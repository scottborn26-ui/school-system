export type TeacherAssignmentRole = "class_teacher" | "subject_teacher";
export type TeacherAssignmentStatus = "active" | "inactive";
export type AssessmentCreationRole =
  | "super_admin"
  | "admin"
  | "principal"
  | "deputy"
  | "exam_officer"
  | "teacher"
  | "class_teacher";

export function canCreateAssessment(role: AssessmentCreationRole): boolean {
  return ["super_admin", "admin", "principal", "deputy", "exam_officer"].includes(role);
}

export interface TeacherAssignment {
  id: string;
  teacher_id: string;
  school_id: string;
  class_id: string;
  subject_id: string | null;
  academic_year: string;
  term: string;
  role: TeacherAssignmentRole;
  status: TeacherAssignmentStatus;
}

interface TeacherAssignmentPermissionArgs {
  teacherAssignments: TeacherAssignment[];
  teacherId: string;
  academicYear: string;
  term: string;
}

interface TeacherClassSubjectArgs extends TeacherAssignmentPermissionArgs {
  classId: string;
  subjectId?: string | null;
}

interface TeacherStudentArgs extends TeacherAssignmentPermissionArgs {
  studentId: string;
}

const activeAssignment = (
  assignments: TeacherAssignment[],
  teacherId: string,
  academicYear: string,
  term: string,
) =>
  assignments.filter(
    (assignment) =>
      assignment.teacher_id === teacherId &&
      assignment.academic_year === academicYear &&
      assignment.term === term &&
      assignment.status === "active",
  );

export function canTeacherViewStudent({
  teacherAssignments,
  teacherId,
  studentId,
  academicYear,
  term,
}: TeacherStudentArgs): boolean {
  void studentId;
  return activeAssignment(teacherAssignments, teacherId, academicYear, term).length > 0;
}

export function canTeacherViewClassRoster({
  teacherAssignments,
  teacherId,
  classId,
  academicYear,
  term,
}: TeacherClassSubjectArgs): boolean {
  const assignments = activeAssignment(teacherAssignments, teacherId, academicYear, term).filter(
    (assignment) => assignment.class_id === classId,
  );

  return assignments.some(
    (assignment) => assignment.role === "class_teacher" || assignment.subject_id != null,
  );
}

export function canTeacherMarkAttendance({
  teacherAssignments,
  teacherId,
  classId,
  academicYear,
  term,
}: TeacherClassSubjectArgs): boolean {
  const assignments = activeAssignment(teacherAssignments, teacherId, academicYear, term).filter(
    (assignment) => assignment.class_id === classId,
  );

  return assignments.some((assignment) => assignment.role === "class_teacher");
}

export function canTeacherCreateAssessment({
  teacherAssignments,
  teacherId,
  classId,
  subjectId,
  academicYear,
  term,
}: TeacherClassSubjectArgs): boolean {
  void teacherAssignments;
  void teacherId;
  void classId;
  void subjectId;
  void academicYear;
  void term;
  return false;
}

export function canTeacherEnterMarks({
  teacherAssignments,
  teacherId,
  classId,
  subjectId,
  academicYear,
  term,
}: TeacherClassSubjectArgs): boolean {
  if (!subjectId) return false;

  return activeAssignment(teacherAssignments, teacherId, academicYear, term).some(
    (assignment) =>
      assignment.class_id === classId &&
      assignment.subject_id === subjectId &&
      assignment.role === "subject_teacher",
  );
}

export function canTeacherEditMarks({
  teacherAssignments,
  teacherId,
  classId,
  subjectId,
  academicYear,
  term,
}: TeacherClassSubjectArgs): boolean {
  return canTeacherEnterMarks({
    teacherAssignments,
    teacherId,
    classId,
    subjectId,
    academicYear,
    term,
  });
}

export function canTeacherViewResults({
  teacherAssignments,
  teacherId,
  classId,
  subjectId,
  academicYear,
  term,
}: TeacherClassSubjectArgs): boolean {
  return canTeacherEnterMarks({
    teacherAssignments,
    teacherId,
    classId,
    subjectId,
    academicYear,
    term,
  });
}

export function canTeacherViewReportCard({
  teacherAssignments,
  teacherId,
  classId,
  studentId,
  academicYear,
  term,
}: TeacherStudentArgs & { classId: string }): boolean {
  void studentId;
  return activeAssignment(teacherAssignments, teacherId, academicYear, term).some(
    (assignment) =>
      assignment.class_id === classId &&
      (assignment.role === "class_teacher" || assignment.subject_id != null),
  );
}

export function canTeacherMarkLesson({
  teacherAssignments,
  teacherId,
  classId,
  subjectId,
  academicYear,
  term,
}: TeacherClassSubjectArgs): boolean {
  return canTeacherEnterMarks({
    teacherAssignments,
    teacherId,
    classId,
    subjectId,
    academicYear,
    term,
  });
}
