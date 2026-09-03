import { FileDown, Loader2, Printer } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase";
import { GRADE_LABELS, LEVEL_GRADES, type CbeGrade } from "@/lib/cbe";
import { useSchool } from "@/hooks/use-school";

export interface LearnerCertificateData {
  id: string;
  name: string;
  admissionNumber: string;
  currentGrade: CbeGrade | null;
  dateOfBirth: string | null;
  admissionDate: string | null;
  photoUrl?: string | null;
}

const grades = Object.values(LEVEL_GRADES)
  .flat()
  .filter((grade, index, list) => list.indexOf(grade) === index);
const today = () => new Date().toISOString().slice(0, 10);

export function LeavingCertificateDialog({
  learner,
  open,
  onOpenChange,
}: {
  learner: LearnerCertificateData;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const school = useSchool();
  const [busy, setBusy] = useState(false);
  const [lastPopup, setLastPopup] = useState<Window | null>(null);

  const [form, setForm] = useState({
    fullName: learner.name,
    admissionNumber: learner.admissionNumber,
    dateOfBirth: learner.dateOfBirth ?? "",
    dateEntered: learner.admissionDate ?? "",
    enrolled: learner.currentGrade ?? "G1",
    leftFrom: learner.currentGrade ?? "G1",
    course: learner.currentGrade ?? "G1",
    dateOfIssue: today(),
    ability: "Good academic progress and diligent effort in all learning areas.",
    conduct: "Exemplary character, disciplined, obedient and respectful to teachers and peers.",
    activities: "Actively participated in school clubs, games and environmental activities.",
  });

  function setField(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function generate() {
    if (
      !form.fullName.trim() ||
      !form.admissionNumber.trim() ||
      !form.dateOfIssue ||
      !form.dateEntered
    ) {
      toast.error("Complete the required learner and issue details.");
      return;
    }
    setBusy(true);
    try {
      const certificate = certificateHtml(
        form,
        school.school?.name ?? "School of Excellence",
        school.school?.county ?? null,
        learner.photoUrl,
      );

      const popup = window.open("", "_blank", "noopener,noreferrer");
      if (!popup) {
        toast.error("Allow pop-ups to generate the certificate.");
        setBusy(false);
        return;
      }
      popup.document.write(certificate);
      popup.document.close();
      setLastPopup(popup);

      // Log action to audit logs
      await supabase.from("audit_logs").insert({
        action: "generated_leaving_certificate",
        entity: "learner",
        entity_id: learner.id,
        school_id: school.schoolId,
        actor_id: school.userId,
        actor_name: school.fullName,
        reason: `Generated leaving certificate for ${form.fullName} (Adm: ${form.admissionNumber})`,
      });

      setBusy(false);
      onOpenChange(false);

      toast.success("Leaving certificate generated successfully", {
        description: "Your official certificate is ready in the print preview window.",
        action: {
          label: "View / Print Again",
          onClick: () => {
            if (popup && !popup.closed) {
              popup.focus();
              popup.print();
            } else {
              const newPopup = window.open("", "_blank", "noopener,noreferrer");
              if (newPopup) {
                newPopup.document.write(certificate);
                newPopup.document.close();
              }
            }
          },
        },
      });
    } catch (err: unknown) {
      setBusy(false);
      toast.error(
        "Failed to generate certificate: " + (err instanceof Error ? err.message : "Unknown error"),
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto rounded-xl border border-border/70 shadow-lg">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold tracking-tight text-foreground">
            Generate Leaving Certificate
          </DialogTitle>
          <DialogDescription className="text-sm font-medium text-muted-foreground">
            <span className="capitalize">{learner.name.toLowerCase()}</span> — Adm:{" "}
            {learner.admissionNumber} —{" "}
            <span className="font-semibold uppercase text-primary">
              {GRADE_LABELS[learner.currentGrade ?? "G1"]}
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 py-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full Name" required>
              <Input
                value={form.fullName}
                onChange={(e) => setField("fullName", e.target.value)}
                placeholder="Learner's official full name"
                className="rounded-lg"
              />
            </Field>

            <Field label="Admission / Serial No." required>
              <Input
                value={form.admissionNumber}
                onChange={(e) => setField("admissionNumber", e.target.value)}
                placeholder="e.g. 2026/0491"
                className="rounded-lg font-mono"
              />
            </Field>

            <Field label="Date of Birth">
              <Input
                type="date"
                value={form.dateOfBirth}
                onChange={(e) => setField("dateOfBirth", e.target.value)}
                className="rounded-lg"
              />
            </Field>

            <Field label="Date Entered School" required>
              <Input
                type="date"
                value={form.dateEntered}
                onChange={(e) => setField("dateEntered", e.target.value)}
                className="rounded-lg"
              />
            </Field>

            <GradeField
              label="Form / Grade Enrolled In"
              value={form.enrolled}
              onChange={(value) => setField("enrolled", value)}
            />

            <GradeField
              label="Form / Grade Left From"
              value={form.leftFrom}
              onChange={(value) => setField("leftFrom", value)}
            />

            <GradeField
              label="Course Completed For"
              value={form.course}
              onChange={(value) => setField("course", value)}
            />

            <Field label="Date of Issue" required>
              <Input
                type="date"
                value={form.dateOfIssue}
                onChange={(e) => setField("dateOfIssue", e.target.value)}
                className="rounded-lg"
              />
            </Field>
          </div>

          <section className="space-y-4 rounded-xl border border-border/80 bg-muted/20 p-4 shadow-xs">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
                Headteacher&apos;s Report
              </h3>
              <p className="text-xs text-muted-foreground">
                Observations and assessment remarks to appear on the official certificate.
              </p>
            </div>

            <Field label="Ability & Industry">
              <Textarea
                rows={2}
                value={form.ability}
                onChange={(e) => setField("ability", e.target.value)}
                placeholder="Academic ability, diligence and industry observations..."
                className="rounded-lg resize-none text-sm"
              />
            </Field>

            <Field label="Conduct">
              <Textarea
                rows={2}
                value={form.conduct}
                onChange={(e) => setField("conduct", e.target.value)}
                placeholder="Discipline, moral conduct, character and interpersonal relations..."
                className="rounded-lg resize-none text-sm"
              />
            </Field>

            <Field label="Co-curricular Activities">
              <Textarea
                rows={2}
                value={form.activities}
                onChange={(e) => setField("activities", e.target.value)}
                placeholder="Games, athletics, clubs, societies, student leadership, drama..."
                className="rounded-lg resize-none text-sm"
              />
            </Field>
          </section>
        </div>

        <DialogFooter className="gap-2 sm:justify-end border-t border-border/60 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-lg">
            Cancel
          </Button>
          <Button
            onClick={() => void generate()}
            disabled={busy}
            className="rounded-lg bg-primary text-primary-foreground shadow-md transition-all hover:shadow-lg"
          >
            {busy ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Printer className="mr-2 size-4" />
            )}
            {busy ? "Preparing PDF…" : "Generate PDF"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold text-foreground">
        {label}
        {required && <span className="text-destructive font-bold"> *</span>}
      </Label>
      {children}
    </div>
  );
}

function GradeField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label} required>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="rounded-lg">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {grades.map((grade) => (
            <SelectItem key={grade} value={grade}>
              {GRADE_LABELS[grade]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

function certificateHtml(
  form: Record<string, string>,
  schoolName: string,
  schoolCounty: string | null,
  photoUrl?: string | null,
) {
  const escape = (value: string) =>
    value.replace(
      /[&<>"']/g,
      (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]!,
    );

  const formattedDob = form.dateOfBirth
    ? new Date(form.dateOfBirth).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "Not captured";

  const formattedEntered = form.dateEntered
    ? new Date(form.dateEntered).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "";

  const formattedIssue = form.dateOfIssue
    ? new Date(form.dateOfIssue).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Leaving Certificate - ${escape(form.fullName)}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm 15mm;
    }
    *, *::before, *::after {
      box-sizing: border-box;
    }
    body {
      font-family: "Times New Roman", Times, "Liberation Serif", serif;
      color: #0a0a0a;
      background: #ffffff;
      margin: 0;
      padding: 0;
      line-height: 1.35;
      font-size: 13.5px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .outer-border {
      border: 3px double #1a1a1a;
      padding: 5px;
      min-height: 268mm;
      position: relative;
    }
    .inner-border {
      border: 1.5px solid #2d2d2d;
      padding: 24px 30px;
      min-height: calc(268mm - 10px);
      position: relative;
      background: #fafaf8;
    }
    .watermark {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-30deg);
      font-size: 80px;
      font-weight: bold;
      color: rgba(0, 0, 0, 0.025);
      letter-spacing: 12px;
      pointer-events: none;
      white-space: nowrap;
      text-transform: uppercase;
      z-index: 0;
    }
    .header-section {
      text-align: center;
      position: relative;
      margin-bottom: 20px;
    }
    .coat-of-arms {
      width: 72px;
      height: auto;
      margin: 0 auto 6px;
      display: block;
    }
    .gov-heading {
      font-size: 15px;
      font-weight: bold;
      letter-spacing: 2px;
      margin: 0 0 2px;
      text-transform: uppercase;
    }
    .ministry-heading {
      font-size: 13px;
      font-weight: bold;
      letter-spacing: 1.5px;
      margin: 0 0 8px;
      text-transform: uppercase;
      color: #1f2937;
    }
    .school-name {
      font-size: 20px;
      font-weight: bold;
      letter-spacing: 1px;
      text-transform: uppercase;
      color: #111827;
      margin: 6px 0 2px;
      text-decoration: underline;
      text-underline-offset: 3px;
    }
    .school-county {
      font-size: 11.5px;
      font-style: italic;
      color: #4b5563;
      margin: 0 0 10px;
    }
    .cert-title-box {
      border-top: 2px solid #111;
      border-bottom: 2px solid #111;
      padding: 5px 0;
      margin: 10px auto;
      max-width: 540px;
    }
    .cert-title {
      font-size: 18px;
      font-weight: bold;
      letter-spacing: 2.5px;
      margin: 0;
      text-transform: uppercase;
    }
    .serial-no {
      position: absolute;
      top: 0;
      left: 0;
      font-size: 11px;
      font-weight: bold;
      color: #991b1b;
      letter-spacing: 0.5px;
    }
    .photo-box {
      position: absolute;
      top: 0;
      right: 0;
      width: 35mm;
      height: 45mm;
      border: 1.5px solid #333;
      background: #ffffff;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      font-size: 9px;
      color: #6b7280;
      overflow: hidden;
      box-shadow: 0 2px 4px rgba(0,0,0,0.06);
    }
    .photo-box img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .certify-text {
      font-size: 13.5px;
      font-style: italic;
      text-align: center;
      margin: 12px 0 16px;
    }
    .details-table {
      width: 100%;
      margin: 14px 0;
      border-collapse: collapse;
      font-size: 13.5px;
    }
    .details-table td {
      padding: 6px 4px;
      vertical-align: bottom;
    }
    .details-label {
      width: 250px;
      white-space: nowrap;
      font-weight: bold;
      color: #1f2937;
    }
    .details-line {
      border-bottom: 1.5px dotted #374151;
      padding-left: 8px;
      padding-bottom: 2px;
      font-weight: 600;
      color: #111827;
    }
    .student-name-line {
      font-size: 15px;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: #0f172a;
    }
    .report-card {
      margin: 16px 0 20px;
      border: 1px solid #9ca3af;
      background: #ffffff;
      padding: 12px 16px;
      border-radius: 4px;
    }
    .report-card-title {
      font-size: 12.5px;
      font-weight: bold;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      text-align: center;
      margin: 0 0 10px;
      padding-bottom: 4px;
      border-bottom: 1px solid #d1d5db;
    }
    .report-row {
      margin-bottom: 8px;
    }
    .report-label {
      font-weight: bold;
      font-size: 12.5px;
      color: #1f2937;
    }
    .report-value {
      display: block;
      border-bottom: 1px dotted #4b5563;
      padding: 3px 0 2px 4px;
      font-size: 13px;
      min-height: 20px;
      color: #111827;
    }
    .signatures-grid {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      margin-top: 36px;
      padding: 0 10px;
    }
    .sig-block {
      text-align: center;
      width: 190px;
    }
    .sig-line {
      border-bottom: 1.5px solid #111;
      margin-bottom: 6px;
      height: 35px;
    }
    .sig-label {
      font-size: 11.5px;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .stamp-box {
      width: 130px;
      height: 90px;
      border: 1.5px dashed #6b7280;
      border-radius: 6px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      font-size: 9.5px;
      font-weight: bold;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 4px;
    }
    .footer-note {
      position: absolute;
      bottom: 10px;
      left: 30px;
      right: 30px;
      text-align: center;
      font-size: 10.5px;
      font-style: italic;
      color: #374151;
      border-top: 1px solid #d1d5db;
      padding-top: 6px;
    }
    @media print {
      body {
        background: transparent;
      }
      .no-print {
        display: none !important;
      }
    }
  </style>
</head>
<body>
  <div class="outer-border">
    <div class="inner-border">
      <div class="watermark">KENYA CBE</div>

      <header class="header-section">
        <div class="serial-no">SERIAL NO: SLC/${escape(form.admissionNumber.toUpperCase())}</div>

        <div class="photo-box">
          ${
            photoUrl
              ? `<img src="${escape(photoUrl)}" alt="Student photo">`
              : `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg><span style="margin-top:4px">AFFIX PASSPORT<br>PHOTO HERE</span>`
          }
        </div>

        <!-- Official Republic of Kenya Emblem -->
        <svg class="coat-of-arms" viewBox="0 0 100 80" xmlns="http://www.w3.org/2000/svg">
          <g fill="none" stroke="#111" stroke-width="1.2">
            <!-- Crossed Spears -->
            <line x1="20" y1="75" x2="80" y2="15" stroke="#333" stroke-width="2"/>
            <line x1="80" y1="75" x2="20" y2="15" stroke="#333" stroke-width="2"/>
            <!-- Center Maasai Shield -->
            <path d="M50 10 Q65 30 65 55 Q50 75 50 75 Q35 55 35 30 Z" fill="#b91c1c" stroke="#111" stroke-width="1.8"/>
            <path d="M50 10 Q58 30 58 55 Q50 75 50 75 Z" fill="#047857"/>
            <path d="M50 10 Q42 30 42 55 Q50 75 50 75 Z" fill="#111"/>
            <circle cx="50" cy="42" r="6" fill="#fff" stroke="#111" stroke-width="1"/>
            <!-- Rooster with axe emblem in shield -->
            <path d="M48 38 L52 38 L50 45 Z" fill="#b91c1c"/>
            <!-- Supporting Lions -->
            <path d="M28 32 Q18 35 22 55 Q26 65 34 68" stroke="#111" stroke-width="1.6" fill="none"/>
            <path d="M72 32 Q82 35 78 55 Q74 65 66 68" stroke="#111" stroke-width="1.6" fill="none"/>
            <!-- Harambee Banner -->
            <rect x="22" y="70" width="56" height="8" rx="2" fill="#fff" stroke="#111" stroke-width="1.2"/>
            <text x="50" y="76.5" font-family="'Times New Roman', serif" font-size="5.5" font-weight="bold" text-anchor="middle" fill="#111" letter-spacing="1">HARAMBEE</text>
          </g>
        </svg>

        <h2 class="gov-heading">REPUBLIC OF KENYA</h2>
        <h3 class="ministry-heading">MINISTRY OF EDUCATION</h3>
        <div class="school-name">${escape(schoolName)}</div>
        ${schoolCounty ? `<div class="school-county">${escape(schoolCounty)} County, Kenya</div>` : `<div class="school-county">Kenya Basic Education</div>`}

        <div class="cert-title-box">
          <h1 class="cert-title">SCHOOL LEAVING CERTIFICATE</h1>
        </div>
      </header>

      <p class="certify-text">This is to certify that</p>

      <table class="details-table">
        <tbody>
          <tr>
            <td class="details-label">FULL NAME:</td>
            <td class="details-line student-name-line">${escape(form.fullName)}</td>
          </tr>
          <tr>
            <td class="details-label">ADMISSION / SERIAL NUMBER:</td>
            <td class="details-line font-mono">${escape(form.admissionNumber)}</td>
          </tr>
          <tr>
            <td class="details-label">DATE OF BIRTH:</td>
            <td class="details-line">${escape(formattedDob)}</td>
          </tr>
          <tr>
            <td class="details-label">DATE ENTERED THIS SCHOOL:</td>
            <td class="details-line">${escape(formattedEntered)}</td>
          </tr>
          <tr>
            <td class="details-label">FORM / GRADE ENROLLED IN:</td>
            <td class="details-line">${escape(GRADE_LABELS[form.enrolled as CbeGrade] ?? form.enrolled)}</td>
          </tr>
          <tr>
            <td class="details-label">FORM / GRADE LEFT FROM:</td>
            <td class="details-line">${escape(GRADE_LABELS[form.leftFrom as CbeGrade] ?? form.leftFrom)}</td>
          </tr>
          <tr>
            <td class="details-label">COURSE COMPLETED FOR:</td>
            <td class="details-line">${escape(GRADE_LABELS[form.course as CbeGrade] ?? form.course)} Curriculum</td>
          </tr>
        </tbody>
      </table>

      <section class="report-card">
        <div class="report-card-title">HEADTEACHER&apos;S CONFIDENTIAL REPORT</div>

        <div class="report-row">
          <span class="report-label">1. Ability &amp; Industry:</span>
          <span class="report-value">${escape(form.ability || "Satisfactory academic effort and regular attendance.")}</span>
        </div>

        <div class="report-row">
          <span class="report-label">2. Conduct &amp; Character:</span>
          <span class="report-value">${escape(form.conduct || "Good conduct and disciplined demeanor throughout the school term.")}</span>
        </div>

        <div class="report-row">
          <span class="report-label">3. Games, Sports &amp; Co-curricular Activities:</span>
          <span class="report-value">${escape(form.activities || "Participated in school clubs, sports and social activities.")}</span>
        </div>
      </section>

      <div class="signatures-grid">
        <div class="sig-block">
          <div class="sig-line"></div>
          <div class="sig-label">Student&apos;s Signature</div>
          <div style="font-size: 11px; margin-top: 4px; color: #4b5563;">Date: ${escape(formattedIssue)}</div>
        </div>

        <div class="stamp-box">
          <span>OFFICIAL<br>SCHOOL STAMP</span>
        </div>

        <div class="sig-block">
          <div class="sig-line"></div>
          <div class="sig-label">Headteacher&apos;s Signature</div>
          <div style="font-size: 11px; margin-top: 4px; color: #4b5563;">Date of Issue: ${escape(formattedIssue)}</div>
        </div>
      </div>

      <div class="footer-note">
        This certificate was issued without any erasure or alteration whatsoever. · Republic of Kenya Ministry of Education
      </div>
    </div>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 250);
    };
  </script>
</body>
</html>`;
}
