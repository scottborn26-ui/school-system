import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileArchive,
  FileSpreadsheet,
  History,
  Loader2,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { RequireSchool } from "@/components/require-school";
import { PageHeader } from "@/components/app-shell";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/lib/supabase";
import { useSchool } from "@/hooks/use-school";
import { GRADE_LABELS, type CbeGrade } from "@/lib/cbe";
import { KE_PHONE_REGEX, normalizeKePhone } from "@/lib/format";

type BackupRecord = { id: string; createdAt: string; size: number; blobUrl: string };
type ImportRow = Record<string, string>;
type ImportError = { row: ImportRow; rowNumber: number; reason: string };
type ImportPreviewStatus = "ready" | "duplicate" | "invalid";
type ImportPreviewRow = {
  rowNumber: number;
  row: ImportRow;
  status: ImportPreviewStatus;
  reason: string;
};
type ImportPreviewSummary = {
  ready: number;
  duplicates: number;
  errors: number;
  decisions: ImportPreviewRow[];
};
const MAX_ROWS = 2000;
const EXPECTED_FIELDS = [
  "first_name",
  "middle_name",
  "last_name",
  "grade",
  "stream",
  "gender",
  "date_of_birth",
  "upi_number",
  "boarding_status",
  "admission_date",
  "guardian_name",
  "guardian_phone",
  "guardian_relationship",
];
const FIELD_LABELS: Record<string, string> = {
  first_name: "First Name",
  middle_name: "Middle Name",
  last_name: "Surname",
  admission_number: "Admission No.",
  grade: "Grade",
  stream: "Stream",
  gender: "Gender",
  date_of_birth: "Date of Birth",
  upi_number: "UPI Number",
  boarding_status: "Boarding Status",
  admission_date: "Admission Date",
  guardian_name: "Primary Guardian Name",
  guardian_phone: "Guardian Phone",
  guardian_relationship: "Relationship",
  ignore: "Do not import",
};
const HEADER_ALIASES: Record<string, string> = {
  surname: "last_name",
  last_name: "last_name",
  first_name: "first_name",
  middle_name: "middle_name",
  grade: "grade",
  grade_of_admission: "grade",
  current_grade: "grade",
  grade_name: "grade",
  stream: "stream",
  gender: "gender",
  date_of_birth: "date_of_birth",
  dob: "date_of_birth",
  upi_number: "upi_number",
  upi: "upi_number",
  boarding_status: "boarding_status",
  admission_date: "admission_date",
  primary_guardian_name: "guardian_name",
  guardian_name: "guardian_name",
  guardian_phone: "guardian_phone",
  relationship: "guardian_relationship",
  guardian_relationship: "guardian_relationship",
};

function normalizeImportText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeNameKey(value: string): string {
  return normalizeImportText(value).toLowerCase();
}

function parseFlexibleDate(value: string): Date | null {
  const raw = normalizeImportText(value);
  if (!raw) return null;

  const iso = /^\d{4}-\d{1,2}-\d{1,2}$/.exec(raw);
  if (iso) {
    const [year, month, day] = raw.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const slash = /^\d{1,2}\/\d{1,2}\/\d{4}$/.exec(raw);
  if (slash) {
    const [day, month, year] = raw.split("/").map(Number);
    const date = new Date(year, month - 1, day);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatYmd(value: string): string | null {
  const date = parseFlexibleDate(value);
  if (!date) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeImportGrade(value: string): string {
  return normalizeImportText(value).replace(/[^a-z0-9]/gi, "").toUpperCase();
}

function resolveGradeValue(value: string, schoolGrades: string[]): string | null {
  const raw = normalizeImportText(value);
  if (!raw) return null;

  const exact = schoolGrades.find(
    (grade) =>
      normalizeImportGrade(grade) === normalizeImportGrade(raw) ||
      normalizeImportGrade(GRADE_LABELS[grade as CbeGrade] ?? grade) ===
        normalizeImportGrade(raw),
  );
  if (exact) return exact;

  const normalized = normalizeImportGrade(raw);
  const fallback = schoolGrades.find((grade) => normalizeImportGrade(grade) === normalized);
  return fallback ?? null;
}

function normalizeGender(value: string): string | null {
  const raw = normalizeImportText(value).toLowerCase();
  if (!raw) return null;
  if (["male", "m"].includes(raw)) return "male";
  if (["female", "f"].includes(raw)) return "female";
  if (["other", "o", "nonbinary", "prefer not to say"].includes(raw)) return "other";
  return null;
}

function normalizeBoardingStatus(value: string): string {
  const raw = normalizeImportText(value).toLowerCase();
  if (["boarding", "boarder", "boarder student", "residential", "b"].includes(raw)) {
    return "boarding";
  }
  return "day";
}

function getMappedValue(row: ImportRow, field: string, currentMapping: Record<string, string>): string {
  const header = Object.keys(currentMapping).find((key) => currentMapping[key] === field);
  return header ? normalizeImportText(String(row[header] ?? "")) : "";
}

export const Route = createFileRoute("/_authenticated/backup-import")({
  head: () => ({ meta: [{ title: "Backup & import · SHANSCOTT CBE" }] }),
  component: () => (
    <RequireSchool roles={["principal", "deputy"]}>
      <BackupImportPage />
    </RequireSchool>
  ),
});

function formatBytes(bytes: number) {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
  return url;
}

export function BackupImportPage({ variant = "backup" }: { variant?: "backup" | "admissions" }) {
  const school = useSchool();
  const schoolId = school.schoolId!;
  const restoreInput = useRef<HTMLInputElement>(null);
  const importInput = useRef<HTMLInputElement>(null);
  const [backingUp, setBackingUp] = useState(false);
  const [history, setHistory] = useState<BackupRecord[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      return JSON.parse(localStorage.getItem(`backups:${schoolId}`) ?? "[]") as BackupRecord[];
    } catch {
      return [];
    }
  });
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [importError, setImportError] = useState("");
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null);
  const [importErrors, setImportErrors] = useState<ImportError[]>([]);
  const [importPreview, setImportPreview] = useState<ImportPreviewSummary | null>(null);
  const [confirmImportOpen, setConfirmImportOpen] = useState(false);

  async function createBackup() {
    setBackingUp(true);
    try {
      const tables = [
        "schools",
        "school_settings",
        "learners",
        "staff",
        "streams",
        "terms",
        "attendance_records",
        "assessment_records",
      ];
      const entries = await Promise.all(
        tables.map(async (table) => {
          const response = await supabase.from(table).select("*").eq("school_id", schoolId);
          return [table, response.data ?? []] as const;
        }),
      );
      const payload = {
        version: 1,
        exportedAt: new Date().toISOString(),
        schoolId,
        data: Object.fromEntries(entries),
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const createdAt = new Date().toISOString();
      const blobUrl = downloadBlob(blob, `school-backup-${createdAt.slice(0, 10)}.json`);
      const record = { id: crypto.randomUUID(), createdAt, size: blob.size, blobUrl };
      const next = [record, ...history].slice(0, 5);
      setHistory(next);
      localStorage.setItem(`backups:${schoolId}`, JSON.stringify(next));
      toast.success("Backup downloaded successfully.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create backup.");
    } finally {
      setBackingUp(false);
    }
  }

  function handleRestore(file: File | undefined) {
    if (!file) return;
    if (file.type !== "application/json" && !file.name.toLowerCase().endsWith(".json")) {
      toast.error("Choose a .json backup file.");
      return;
    }
    setRestoreFile(file);
    setRestoreOpen(true);
  }

  async function confirmRestore() {
    if (!restoreFile) return;
    try {
      const parsed = JSON.parse(await restoreFile.text()) as {
        version?: number;
        schoolId?: string;
        data?: Record<string, unknown>;
      };
      if (parsed.version !== 1 || parsed.schoolId !== schoolId || !parsed.data)
        throw new Error("This backup does not belong to the current school.");
      toast.info(
        "Backup verified. Full restore requires a server-side transaction and was not applied.",
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Invalid backup file.");
    }
    setRestoreOpen(false);
    setRestoreFile(null);
  }

  async function parseImport(file: File | undefined) {
    if (!file) return;
    setImportError("");
    setResult(null);
    setImportFile(file);
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (!extension || !["csv", "xlsx", "xls"].includes(extension)) {
      setImportError("Unsupported file type. Choose a .csv, .xlsx, or .xls file.");
      return;
    }
    try {
        const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const values = XLSX.utils.sheet_to_json<ImportRow>(sheet, { defval: "", raw: false });
      if (values.length > MAX_ROWS) {
        setImportError(
          `This file has ${values.length.toLocaleString()} rows. Please split it into files of 2,000 rows or fewer.`,
        );
        return;
      }
      if (!values.length) {
        setImportError("This file has no data rows.");
        return;
      }
      const foundHeaders = Object.keys(values[0]);
      setHeaders(foundHeaders);
      setRows(values);
      setMapping(
        Object.fromEntries(
          foundHeaders.map((header) => {
            const normalized = header.toLowerCase().replace(/[\s-]+/g, "_");
            const field = HEADER_ALIASES[normalized] ?? normalized;
            return [header, EXPECTED_FIELDS.includes(field) ? field : "ignore"];
          }),
        ),
      );
    } catch {
      setImportError("The file could not be read. Check that it is a valid spreadsheet.");
    }
  }

  async function reviewImport() {
    if (!rows.length) return;
    setImportError("");
    setImporting(true);
    setProgress(10);

    try {
      const { data: streamRows, error: streamError } = await supabase
        .from("streams")
        .select("id, name, grade")
        .eq("school_id", schoolId)
        .eq("is_active", true);
        if (streamError) throw streamError;

      const { data: existingLearners } = await supabase
        .from("learners")
        .select("id, first_name, last_name, date_of_birth, upi_number")
        .eq("school_id", schoolId);

      const existingUpis = new Set(
        (existingLearners ?? [])
          .filter((learner) => learner.upi_number)
          .map((learner) => learner.upi_number!.trim().toLowerCase()),
      );
      const existingNameDob = new Set(
        (existingLearners ?? [])
          .filter((learner) => learner.first_name && learner.last_name && learner.date_of_birth)
          .map((learner) => {
            const dob = formatYmd(learner.date_of_birth ?? "");
            return `${normalizeNameKey(learner.first_name ?? "")}::${normalizeNameKey(
              learner.last_name ?? "",
            )}::${dob ?? ""}`;
          }),
      );
      const seenUpis = new Set<string>();
      const seenNameDob = new Set<string>();
      const decisions: ImportPreviewRow[] = [];
      let ready = 0;
      let duplicates = 0;
      let errors = 0;

      for (const [index, row] of rows.entries()) {
        const rowNumber = index + 2;
        const firstName = getMappedValue(row, "first_name", mapping);
        const lastName = getMappedValue(row, "last_name", mapping);
        const rawGrade = getMappedValue(row, "grade", mapping);
        const grade = resolveGradeValue(rawGrade, school.grades);
        const streamName = getMappedValue(row, "stream", mapping);
        const stream = (streamRows ?? []).find(
          (item) => item.grade === grade && item.name.trim().toLowerCase() === streamName.toLowerCase(),
        );
        const upiValue = getMappedValue(row, "upi_number", mapping);
        const dobValue = getMappedValue(row, "date_of_birth", mapping);
        const admissionDateValue = getMappedValue(row, "admission_date", mapping);
        const guardianPhone = getMappedValue(row, "guardian_phone", mapping);

        if (!firstName || !lastName || !grade) {
          decisions.push({
            rowNumber,
            row,
            status: "invalid",
            reason: "Missing required fields: First Name, Surname, and Grade of Admission.",
          });
          errors += 1;
          continue;
        }

        if (!formatYmd(dobValue)) {
          decisions.push({
            rowNumber,
            row,
            status: "invalid",
            reason: "Date of birth is required and must be a valid date.",
          });
          errors += 1;
          continue;
        }

        if (admissionDateValue && !formatYmd(admissionDateValue)) {
          decisions.push({
            rowNumber,
            row,
            status: "invalid",
            reason: "Admission date is invalid.",
          });
          errors += 1;
          continue;
        }

        if (streamName && !stream) {
          decisions.push({
            rowNumber,
            row,
            status: "invalid",
            reason: `Stream "${streamName}" is not valid for grade ${grade}.`,
          });
          errors += 1;
          continue;
        }

        if (guardianPhone && !KE_PHONE_REGEX.test(guardianPhone.replace(/\s+/g, ""))) {
          decisions.push({
            rowNumber,
            row,
            status: "invalid",
            reason: "Guardian phone number is invalid.",
          });
          errors += 1;
          continue;
        }

        const normalizedUpi = upiValue.toLowerCase();
        const normalizedNameDob = `${normalizeNameKey(firstName)}::${normalizeNameKey(lastName)}::${formatYmd(dobValue)!}`;

        if (normalizedUpi) {
          if (existingUpis.has(normalizedUpi) || seenUpis.has(normalizedUpi)) {
            decisions.push({
              rowNumber,
              row,
              status: "duplicate",
              reason: "Duplicate UPI",
            });
            duplicates += 1;
            continue;
          }
          seenUpis.add(normalizedUpi);
        } else if (existingNameDob.has(normalizedNameDob) || seenNameDob.has(normalizedNameDob)) {
          decisions.push({
            rowNumber,
            row,
            status: "duplicate",
            reason: "Possible duplicate: matching name & DOB",
          });
          duplicates += 1;
          continue;
        } else {
          seenNameDob.add(normalizedNameDob);
        }

        decisions.push({
          rowNumber,
          row,
          status: "ready",
          reason: "Ready to admit",
        });
        ready += 1;
      }

      setImportErrors(
        decisions
          .filter((decision) => decision.status !== "ready")
          .map((decision) => ({ row: decision.row, rowNumber: decision.rowNumber, reason: decision.reason })),
      );
      setImportPreview({ ready, duplicates, errors, decisions });
      setResult({ imported: ready, skipped: duplicates + errors });
      setProgress(100);
      toast.success(
        `${ready.toLocaleString()} student${ready === 1 ? "" : "s"} ready to admit. ${duplicates} duplicate${duplicates === 1 ? "" : "s"} and ${errors} validation error${errors === 1 ? "" : "s"} found.`,
      );
    } catch (error) {
      setImportError(
        error instanceof Error ? error.message : "The import review could not be completed.",
      );
    } finally {
      setImporting(false);
    }
  }

  async function importLearners() {
    setConfirmImportOpen(false);
    if (!importPreview || importPreview.ready === 0) {
      await reviewImport();
      return;
    }

    setImporting(true);
    setProgress(10);
    let currentRowNumber: number | null = null;

    try {
      const importRows = importPreview.decisions.filter((decision) => decision.status === "ready");
      const { data: streamRows, error: streamError } = await supabase
        .from("streams")
        .select("id, name, grade")
        .eq("school_id", schoolId)
        .eq("is_active", true);
        if (streamError) throw streamError;
      let imported = 0;
      for (const [index, decision] of importRows.entries()) {
        currentRowNumber = decision.rowNumber;
        const row = decision.row;
        const grade = resolveGradeValue(getMappedValue(row, "grade", mapping), school.grades);
        const streamName = getMappedValue(row, "stream", mapping);
        const stream = (streamRows ?? []).find(
          (item) => item.grade === grade && item.name.trim().toLowerCase() === streamName.toLowerCase(),
        );

        const { data: admissionNumber, error: admissionNumberError } = await supabase.rpc(
          "next_admission_number",
          { _school_id: schoolId },
        );
        if (admissionNumberError || !admissionNumber) {
          throw admissionNumberError ?? new Error("Could not generate an admission number.");
        }

        const { data: learner, error } = await supabase
          .from("learners")
          .insert({
            school_id: schoolId,
            admission_number: admissionNumber as string,
            first_name: getMappedValue(row, "first_name", mapping).trim(),
            middle_name: getMappedValue(row, "middle_name", mapping) || null,
            last_name: getMappedValue(row, "last_name", mapping).trim(),
            gender: normalizeGender(getMappedValue(row, "gender", mapping)) ?? null,
            date_of_birth: formatYmd(getMappedValue(row, "date_of_birth", mapping)) ?? null,
            upi_number: getMappedValue(row, "upi_number", mapping) || null,
            current_grade: (grade ?? school.grades[0]) as CbeGrade,
            current_stream_id: stream?.id ?? null,
            boarding_status: normalizeBoardingStatus(
              getMappedValue(row, "boarding_status", mapping) || "day",
            ),
            admission_date:
              formatYmd(getMappedValue(row, "admission_date", mapping)) ??
              new Date().toISOString().slice(0, 10),
            status: "active",
          })
          .select("id, admission_number")
          .single();

        if (error || !learner) {
          throw error ?? new Error("The learner record could not be saved.");
        }

        const guardianName = getMappedValue(row, "guardian_name", mapping);
        if (guardianName) {
          const guardianPhone = getMappedValue(row, "guardian_phone", mapping);
          const guardian = await supabase
            .from("guardians")
            .insert({
              school_id: schoolId,
              full_name: guardianName,
              phone: guardianPhone ? normalizeKePhone(guardianPhone) : null,
              relationship: getMappedValue(row, "guardian_relationship", mapping) || "Parent",
            })
            .select("id")
            .single();
          if (guardian.data) {
            await supabase.from("learner_guardians").insert({
              school_id: schoolId,
              learner_id: learner.id,
              guardian_id: guardian.data.id,
              relationship: getMappedValue(row, "guardian_relationship", mapping) || "Parent",
              is_primary: true,
            });
          }
        }

        const { error: historyError } = await supabase.from("learner_status_history").insert({
          school_id: schoolId,
          learner_id: learner.id,
          actor_id: school.userId,
          action: "admitted",
          new_status: "active" as never,
          new_grade: grade as CbeGrade,
          new_stream_id: stream?.id ?? null,
          academic_year_id: school.academicYearId,
          term_id: school.termId,
          effective_date:
            formatYmd(getMappedValue(row, "admission_date", mapping)) ??
            new Date().toISOString().slice(0, 10),
          reason: "Bulk import admission",
        });
        if (historyError) throw historyError;

        const lifecycle = supabase as any;
        const { error: lifecycleError } = await lifecycle.from("student_status_history").insert({
          school_id: schoolId,
          learner_id: learner.id,
          new_status: "active",
          effective_date:
            formatYmd(getMappedValue(row, "admission_date", mapping)) ??
            new Date().toISOString().slice(0, 10),
          reason: "Bulk import admission",
          changed_by: school.userId,
        });
        if (lifecycleError) throw lifecycleError;

        if (school.academicYearId) {
          const { data: enrollment } = await supabase
            .from("enrollments")
            .insert({
              school_id: schoolId,
              learner_id: learner.id,
              academic_year_id: school.academicYearId,
              term_id: school.termId,
              grade: grade as CbeGrade,
              stream_id: stream?.id ?? null,
              boarding_status: normalizeBoardingStatus(
                getMappedValue(row, "boarding_status", mapping) || "day",
              ),
            })
            .select("id")
            .single();

          const lifecycleHistory = supabase as any;
          await lifecycleHistory.from("student_class_history").insert({
            school_id: schoolId,
            learner_id: learner.id,
            enrollment_id: enrollment?.id,
            academic_year_id: school.academicYearId,
            grade: grade as CbeGrade,
            stream_id: stream?.id ?? null,
            enrollment_date:
              formatYmd(getMappedValue(row, "admission_date", mapping)) ??
              new Date().toISOString().slice(0, 10),
            movement_reason: "Bulk import admission",
            moved_by: school.userId,
          });
        }

        imported += 1;
        setProgress(Math.min(95, 10 + Math.round(((index + 1) / Math.max(importRows.length, 1)) * 85)));
      }

      await supabase.from("audit_logs").insert({
        school_id: schoolId,
        actor_id: school.userId,
        actor_name: school.fullName,
        action: "bulk_import",
        entity: "learner_import",
        reason: "Bulk student admission import",
        after_data: {
          file_name: importFile?.name ?? "bulk-import",
          total_rows: rows.length,
          imported,
          duplicates: importPreview.duplicates,
          errors: importPreview.errors,
        },
      });

      setProgress(100);
      setResult({ imported, skipped: importPreview.duplicates + importPreview.errors });
      setImportPreview(null);
      setImportErrors([]);
      setRows([]);
      setHeaders([]);
      setImportFile(null);
      toast.success(`${imported.toLocaleString()} learners were admitted successfully.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "The import could not be completed.";
      toast.error(
        currentRowNumber
          ? `Import stopped at spreadsheet row ${currentRowNumber}: ${message}`
          : message,
      );
    } finally {
      setImporting(false);
    }
  }

  function mappingFor(row: ImportRow, field: string) {
    const header = Object.keys(mapping).find((key) => mapping[key] === field);
    return header ? String(row[header] ?? "") : "";
  }

  function downloadTemplate() {
    const sheet = XLSX.utils.json_to_sheet([
      {
        "First Name": "Jane",
        "Middle Name": "Wanjiku",
        Surname: "Njeri",
        Gender: "Female",
        "Date of Birth": "15/01/2018",
        "UPI Number": "",
        "Grade of Admission": "G1",
        Stream: "A",
        "Boarding Status": "Day",
        "Admission Date": new Date().toISOString().slice(0, 10),
        "Primary Guardian Name": "Mary Njeri",
        "Guardian Phone": "0712345678",
        Relationship: "Mother",
      },
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "Learners");
    XLSX.writeFile(workbook, "student-admission-import-template.xlsx");
  }

  function downloadImportErrors() {
    const lines = [
      ["Error", ...headers].map((value) => JSON.stringify(value)).join(","),
      ...importErrors.map(({ row, reason }) =>
        [reason, ...headers.map((header) => row[header] ?? "")]
          .map((value) => JSON.stringify(value))
          .join(","),
      ),
    ];
    downloadBlob(new Blob([lines.join("\n")], { type: "text/csv" }), "learner-import-errors.csv");
  }

  function downloadImportReport() {
    const rowsForReport = importPreview?.decisions ?? [];
    const lines = [
      ["Row", "Status", "Reason", "First Name", "Surname", "Grade", "UPI Number", "Date of Birth"]
        .map((value) => JSON.stringify(value))
        .join(","),
      ...rowsForReport.map((decision) => {
        const firstName = getMappedValue(decision.row, "first_name", mapping);
        const lastName = getMappedValue(decision.row, "last_name", mapping);
        const grade = getMappedValue(decision.row, "grade", mapping);
        const upi = getMappedValue(decision.row, "upi_number", mapping);
        const dob = getMappedValue(decision.row, "date_of_birth", mapping);
        return [
          decision.rowNumber,
          decision.status,
          decision.reason,
          firstName,
          lastName,
          grade,
          upi,
          dob,
        ]
          .map((value) => JSON.stringify(String(value ?? "")))
          .join(",");
      }),
    ];
    downloadBlob(new Blob([lines.join("\n")], { type: "text/csv" }), "student-admission-import-report.csv");
  }

  return (
    <div
      className={`mx-auto max-w-6xl space-y-6 ${
        variant === "admissions"
          ? "[&>div:first-child]:rounded-2xl [&>div:first-child]:border [&>div:first-child]:border-primary/15 [&>div:first-child]:bg-card/70 [&>div:first-child]:p-5 [&>div:first-child]:shadow-sm"
          : ""
      }`}
    >
      <PageHeader
        title={variant === "admissions" ? "Admissions workspace" : "Backup & Import"}
        description={
          variant === "admissions"
            ? "Bring new learners into your school register with confidence."
            : "Protect school records and add learners in bulk."
        }
        icon={variant === "admissions" ? FileSpreadsheet : FileArchive}
      />
      <div className="grid items-start gap-5 lg:grid-cols-2 lg:gap-6">
        <Card className="overflow-hidden border-primary/15 shadow-md shadow-primary/5">
          <CardHeader className="border-b bg-muted/20 p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle>System Backup</CardTitle>
                <CardDescription>
                  Download a full backup of your school&apos;s data, or restore from a previous
                  backup.
                </CardDescription>
              </div>
              <FileArchive className="size-5 text-primary" />
            </div>
          </CardHeader>
          <CardContent className="space-y-5 p-5 sm:p-6">
            <div className="rounded-lg border bg-muted/30 p-4">
              <p className="text-sm font-medium">
                {history[0]
                  ? `Last backup: ${new Date(history[0].createdAt).toLocaleString()}`
                  : "No backups created yet"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Includes learners, staff, grades, attendance, and academic records.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={createBackup} disabled={backingUp}>
                {backingUp ? <Loader2 className="animate-spin" /> : <Download />}{" "}
                {backingUp ? "Preparing backup…" : "Download Backup"}
              </Button>
              <Button variant="outline" onClick={() => restoreInput.current?.click()}>
                <Upload /> Restore from Backup
              </Button>
              <Input
                ref={restoreInput}
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={(event) => handleRestore(event.target.files?.[0])}
              />
            </div>
            <div>
              <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                <History className="size-4" /> Backup history
              </div>
              {history.length ? (
                <div className="divide-y rounded-lg border">
                  {history.map((item) => (
                    <div
                      className="flex items-center justify-between gap-3 p-3 text-sm"
                      key={item.id}
                    >
                      <div>
                        <p>{new Date(item.createdAt).toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">{formatBytes(item.size)}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const anchor = document.createElement("a");
                          anchor.href = item.blobUrl;
                          anchor.download = `school-backup-${item.createdAt.slice(0, 10)}.json`;
                          anchor.click();
                        }}
                      >
                        <Download className="size-4" /> Re-download
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  Your five most recent backups will appear here.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-primary/25 shadow-lg shadow-primary/10">
          <CardHeader className="border-b border-primary/10 bg-primary/[0.04] p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle>Import Learners</CardTitle>
                <CardDescription>Bulk import student records using a spreadsheet.</CardDescription>
              </div>
              <FileSpreadsheet className="size-5 text-primary" />
            </div>
          </CardHeader>
          <CardContent className="space-y-5 p-5 sm:p-6">
            <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm leading-6 text-muted-foreground">
                Use the template to keep column names consistent.
              </p>
              <Button variant="link" className="px-0" onClick={downloadTemplate}>
                <Download className="size-4" /> Download template
              </Button>
            </div>
            <button
              type="button"
              className="flex min-h-44 w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-primary/30 bg-primary/[0.04] p-5 text-center transition-colors hover:border-primary/50 hover:bg-primary/[0.08] sm:p-8"
              onClick={() => importInput.current?.click()}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                void parseImport(event.dataTransfer.files[0]);
              }}
            >
              <span className="mb-3 grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
                <Upload className="size-6" />
              </span>
              <span className="text-sm font-semibold sm:text-base">
                Drag and drop your file here, or{" "}
                <span className="text-primary underline">click to browse</span>
              </span>
              <span className="mt-2 text-xs text-muted-foreground">
                Supports .csv, .xlsx, .xls · Maximum 2,000 rows
              </span>
              <Input
                ref={importInput}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={(event) => void parseImport(event.target.files?.[0])}
              />
            </button>
            {importError && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                {importError}
              </div>
            )}
            {importFile && !importError && (
              <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 shadow-sm">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-emerald-950">{importFile.name}</p>
                  <p className="mt-0.5 text-xs text-emerald-800/70">
                    {formatBytes(importFile.size)} · {rows.length.toLocaleString()} rows detected
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Remove selected file"
                  onClick={() => {
                    setImportFile(null);
                    setRows([]);
                    setHeaders([]);
                    setResult(null);
                  }}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            )}
            {rows.length > 0 && (
              <>
                <div className="rounded-xl border border-border/80 bg-muted/20 p-4 shadow-sm">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <Label className="text-sm font-semibold">Column mapping</Label>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Match each spreadsheet column to a learner field.
                      </p>
                    </div>
                    <Badge variant="secondary" className="font-medium">
                      {headers.length} columns
                    </Badge>
                  </div>
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    {headers.map((header) => (
                      <div
                        className="flex min-w-0 items-center gap-3 rounded-lg border border-border/70 bg-card p-2.5"
                        key={header}
                      >
                        <span className="min-w-0 flex-1 break-words text-xs font-medium text-foreground">
                          {header}
                        </span>
                        <Select
                          value={mapping[header]}
                          onValueChange={(value) =>
                            setMapping((current) => ({ ...current, [header]: value }))
                          }
                        >
                          <SelectTrigger className="w-[9.5rem] bg-background text-xs sm:w-40">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(FIELD_LABELS).map(([value, label]) => (
                              <SelectItem key={value} value={value}>
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
                  <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold">Data preview</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Showing the first {Math.min(10, rows.length)} rows from your file.
                      </p>
                    </div>
                    <Badge variant="outline">Preview</Badge>
                  </div>
                  <div className="overflow-x-auto">
                  <Table className="min-w-[900px]">
                    <TableHeader>
                      <TableRow>
                        {headers.map((header) => (
                          <TableHead key={header} className="min-w-[150px] whitespace-nowrap">
                            {header}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.slice(0, 10).map((row, index) => (
                        <TableRow key={index}>
                          {headers.map((header) => (
                            <TableCell className="max-w-[180px] break-words" key={header}>
                              {row[header]}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/70 p-3">
                  <p className="text-xs leading-5 text-amber-900">
                    Required: First Name, Surname, and Grade. Admission No. is generated when blank.
                  </p>
                  <Button
                    onClick={() => void reviewImport()}
                    disabled={
                      importing ||
                      !headers.some((header) => mapping[header] === "first_name") ||
                      !headers.some((header) => mapping[header] === "last_name") ||
                      !headers.some((header) => mapping[header] === "grade")
                    }
                  >
                    {importing ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}{" "}
                    {importing ? "Reviewing…" : "Review import"}
                  </Button>
                </div>
                {importing && (
                  <div className="space-y-1">
                    <Progress value={progress} />
                    <p className="text-xs text-muted-foreground">Processing {progress}%</p>
                  </div>
                )}
              </>
            )}
            {result && (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm">
                <p className="font-medium text-emerald-700">
                  <CheckCircle2 className="mr-1 inline size-4" />
                  {result.imported.toLocaleString()} learners imported successfully
                </p>
                {result.skipped > 0 && (
                  <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-amber-700">
                    <span>
                      {result.skipped.toLocaleString()} rows skipped due to validation or duplicate
                      errors.
                    </span>
                    <Button
                      variant="link"
                      className="h-auto p-0 text-amber-800"
                      onClick={downloadImportErrors}
                    >
                      Download error report
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {importPreview && (
        <div className="space-y-5">
          <div className="rounded-2xl border border-primary/15 bg-card/80 p-5 shadow-sm">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <p className="text-base font-semibold text-slate-800">Import summary</p>
              <Badge variant="outline">
                {importPreview.ready} ready · {importPreview.duplicates} duplicates · {importPreview.errors} errors
              </Badge>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border bg-emerald-500/5 p-3">
                <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500">
                  Ready to admit
                </div>
                <div className="mt-1 text-2xl font-semibold text-emerald-700">
                  {importPreview.ready}
                </div>
              </div>
              <div className="rounded-lg border bg-amber-500/5 p-3">
                <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500">
                  Duplicates
                </div>
                <div className="mt-1 text-2xl font-semibold text-amber-700">
                  {importPreview.duplicates}
                </div>
              </div>
              <div className="rounded-lg border bg-rose-500/5 p-3">
                <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500">
                  Validation errors
                </div>
                <div className="mt-1 text-2xl font-semibold text-rose-700">
                  {importPreview.errors}
                </div>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <Button variant="outline" onClick={() => setImportPreview(null)}>
                Review again
              </Button>
              <Button variant="outline" onClick={downloadImportReport}>
                Download CSV report
              </Button>
              <Button
                onClick={() => setConfirmImportOpen(true)}
                disabled={importing || importPreview.ready === 0}
              >
                Confirm import
              </Button>
            </div>
          </div>

          {importing && (
            <div className="sticky top-4 z-20 rounded-xl border border-primary/15 bg-card/95 p-3 shadow-sm backdrop-blur-sm">
              <Progress value={progress} />
              <p className="mt-2 text-xs text-muted-foreground">Processing {progress}%</p>
            </div>
          )}

          <div className="rounded-2xl border border-primary/15 bg-card/80 p-3 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-slate-800">Review results</p>
              <Badge variant="outline">{importPreview.decisions.length} rows</Badge>
            </div>
            <div className="mb-3 max-h-40 space-y-2 overflow-auto rounded-lg border bg-muted/20 p-3">
              {importPreview.decisions
                .filter((decision) => decision.status !== "ready")
                .slice(0, 10)
                .map((decision) => (
                  <div
                    key={`${decision.rowNumber}-${decision.reason}`}
                    className="rounded border bg-white px-2 py-1 text-xs text-slate-700"
                  >
                    <span className="font-medium">Row {decision.rowNumber}:</span> {decision.reason}
                  </div>
                ))}
            </div>
            <div className="overflow-x-auto pb-1">
              <div className="min-w-[1100px]">
                <div className="max-h-[560px] overflow-auto rounded-lg border">
                  <Table className="min-w-[1100px] border-separate border-spacing-0">
                    <TableHeader className="sticky top-0 z-10 bg-background">
                      <TableRow>
                        <TableHead className="sticky left-0 z-20 min-w-[72px] border-r bg-background">
                          Row
                        </TableHead>
                        <TableHead className="sticky left-[72px] z-20 min-w-[120px] border-r bg-background">
                          Status
                        </TableHead>
                        <TableHead className="min-w-[140px]">First name</TableHead>
                        <TableHead className="min-w-[140px]">Surname</TableHead>
                        <TableHead className="min-w-[100px]">Grade</TableHead>
                        <TableHead className="min-w-[180px]">Reason</TableHead>
                        <TableHead className="min-w-[130px]">DOB</TableHead>
                        <TableHead className="min-w-[120px]">UPI</TableHead>
                        <TableHead className="min-w-[160px]">Guardian</TableHead>
                        <TableHead className="min-w-[150px]">Guardian phone</TableHead>
                        <TableHead className="min-w-[140px]">Relationship</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importPreview.decisions.map((decision) => (
                        <TableRow
                          key={`${decision.rowNumber}-${decision.reason}`}
                          className="odd:bg-muted/15 even:bg-background hover:bg-slate-50"
                        >
                          <TableCell className="sticky left-0 z-10 border-r bg-background font-medium">
                            {decision.rowNumber}
                          </TableCell>
                          <TableCell className="sticky left-[72px] z-10 border-r bg-background">
                            <Badge
                              variant={
                                decision.status === "ready"
                                  ? "default"
                                  : decision.status === "duplicate"
                                    ? "warning"
                                    : "destructive"
                              }
                            >
                              {decision.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="min-w-[140px]">
                            {getMappedValue(decision.row, "first_name", mapping) || "—"}
                          </TableCell>
                          <TableCell className="min-w-[140px]">
                            {getMappedValue(decision.row, "last_name", mapping) || "—"}
                          </TableCell>
                          <TableCell className="min-w-[100px]">
                            {getMappedValue(decision.row, "grade", mapping) || "—"}
                          </TableCell>
                          <TableCell className="min-w-[180px] text-xs">
                            {decision.reason}
                            {decision.status !== "ready" && decision.reason ? (
                              <div className="mt-1 rounded bg-destructive/5 px-1.5 py-1 text-[10px] text-destructive">
                                {decision.reason}
                              </div>
                            ) : null}
                          </TableCell>
                          <TableCell className="min-w-[130px]">
                            {getMappedValue(decision.row, "date_of_birth", mapping) || "—"}
                          </TableCell>
                          <TableCell className="min-w-[120px]">
                            {getMappedValue(decision.row, "upi_number", mapping) || "—"}
                          </TableCell>
                          <TableCell className="min-w-[160px]">
                            {getMappedValue(decision.row, "guardian_name", mapping) || "—"}
                          </TableCell>
                          <TableCell className="min-w-[150px]">
                            {getMappedValue(decision.row, "guardian_phone", mapping) || "—"}
                          </TableCell>
                          <TableCell className="min-w-[140px]">
                            {getMappedValue(decision.row, "guardian_relationship", mapping) || "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      <AlertDialog open={confirmImportOpen} onOpenChange={setConfirmImportOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <div className="flex items-start gap-3 pr-6">
              <div className="grid size-10 shrink-0 place-items-center rounded-full bg-emerald-500/15 text-emerald-700">
                <CheckCircle2 className="size-5" />
              </div>
              <div className="space-y-1">
                <AlertDialogTitle>Confirm bulk admission import?</AlertDialogTitle>
                <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">
                  {importPreview?.ready ?? 0} students ready to admit
                </p>
              </div>
            </div>
            <AlertDialogDescription>
              {importPreview
                ? `This will admit ${importPreview.ready.toLocaleString()} learner${importPreview.ready === 1 ? "" : "s"} from this file. ${importPreview.duplicates.toLocaleString()} duplicate${importPreview.duplicates === 1 ? "" : "s"} and ${importPreview.errors.toLocaleString()} validation issue${importPreview.errors === 1 ? "" : "s"} will be skipped.`
                : "Check the import summary before confirming."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void importLearners()}>
              Confirm and import
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={restoreOpen} onOpenChange={setRestoreOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <div className="flex items-start gap-3 pr-6">
              <div className="grid size-10 shrink-0 place-items-center rounded-full bg-amber-500/15 text-amber-700">
                <AlertTriangle className="size-5" />
              </div>
              <div className="space-y-1">
                <AlertDialogTitle>Restore this backup?</AlertDialogTitle>
                <p className="text-xs font-medium uppercase tracking-wide text-amber-700">
                  Overwrites current records
                </p>
              </div>
            </div>
            <AlertDialogDescription>
              Restoring will overwrite current school data. Make a fresh backup first, then confirm
              that this file belongs to this school before continuing.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmRestore()}>
              Verify and restore
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
