# Shanscott EduFlow

## User Guide

For the complete operating instructions, from creating the first account through onboarding, admissions, teaching, attendance, assessments, reports and finance, see the [SHANSCOTT CBE/CBC User Guide](./USER_GUIDE.md).

Mandate and Role

Act as a senior full-stack software architect, UI/UX designer, database engineer, and Kenyan education-management specialist. Your task is to design and build, in a single uninterrupted implementation phase, the complete, production-ready, multi-tenant Kenyan CBE/CBC school management platform named SHANSCOTT CBE/CBC School Management System. Do not stop after building only the database, authentication, dashboard, or a handful of sample pages. Do not respond with a plan asking whether to continue, and do not deliver a static demonstration. Every form, table, filter, button, calculation, report, permission, and dashboard must operate against real database data, with full Create, Read, Update, Delete (CRUD), archive, and audit behavior wired end to end.

Technology Stack

Build the system using Next.js with the App Router and TypeScript, styled with Tailwind CSS and shadcn/ui. Use Supabase PostgreSQL as the database, Supabase Authentication for identity, and Supabase Storage for student photos, documents, and assessment evidence. Handle all forms with React Hook Form and Zod validation. Render every large dataset with TanStack Table, including built-in pagination, sorting, and filtering. Use Recharts for all dashboard analytics. Apply Font Awesome and/or Lucide React icons consistently across navigation items, action buttons, status badges, sort indicators, and — critically — every filter bar in the system, so that information can be located quickly. Enforce authorization on the server and through PostgreSQL Row-Level Security (RLS). Support PDF generation for report cards, receipts, and school reports, and CSV/Excel import and export throughout. Configure the system for the Africa/Nairobi timezone, Kenyan locale formatting, and KES currency by default. Use currently installed stable dependency versions and avoid unnecessary upgrades.

Core Multi-Tenant Architecture

The system must be strictly multi-tenant: many schools can register independently, but one school must never be able to view or modify another school’s learners, staff, assessments, attendance, timetable, or financial records under any circumstance. Every school-owned table must carry a school_id column enforced simultaneously by application-level authorization middleware and by PostgreSQL RLS policies. Implement complete audit logging for every sensitive create, update, delete, approve, publish, and reversal action; soft deletion and archival so no historical record is ever permanently destroyed; global search, filtering, sorting, and pagination on every data table; fully responsive mobile, tablet, and desktop layouts; light and dark themes; and accessible forms, tables, and navigation with clear loading, empty, success, and error states everywhere.

School Registration and Onboarding

When a school registers, launch a guided, multi-step onboarding wizard that collects: official school name and short name, logo, motto, category, ownership (public/private), day/boarding/mixed status, gender composition, KNEC centre code and NEMIS/institution code where applicable, county/sub-county/ward, physical and postal address, official email, phone numbers and website, headteacher/principal information, academic-year structure with term opening/closing dates, default currency (locked to KES), admission-number format, report-branding preferences, and grading/assessment preferences.

The school must select only the education levels and grades it actually offers, grouped as:

Pre-Primary: PP1 and PP2

Lower Primary: Grade 1, Grade 2, Grade 3

Upper Primary: Grade 4, Grade 5, Grade 6

Junior School: Grade 7, Grade 8, Grade 9

Senior School: Grade 10, Grade 11, Grade 12 — with configurable STEM, Social Sciences, and Arts and Sports Science pathways and subject combinations

Only these selected grades may appear anywhere else in the system (classes, admissions, assessments, timetable, fees, reports). Do not allow schools to invent grade names outside the Kenyan CBE structure, but do allow unlimited custom streams within any selected grade (e.g., “PP1 Red,” “Grade 7 North,” “Grade 10 STEM A”). On completion, automatically create the school record, the principal’s account, the first academic year and terms, the selected grades, and initial settings — and immediately trigger the password-setup email described below for the principal’s account.

Roles and Access Control

Support users holding multiple simultaneous roles (e.g., a deputy who also teaches Mathematics, or a teacher who is also a class teacher), with a clear role-selection screen at login for multi-role users. Implement, at minimum:

Platform Super Administrator: manages schools (activate/suspend/archive), subscription plans, platform analytics, and platform audit logs; must not casually browse private learner data; support access must be explicit and audited.

Headteacher/Principal: full authority within their school — settings, admissions, staff, allocations, streams, timetable, assessment/grading configuration, report verification and publication, permissions, and audit logs.

Deputy Headteacher/Deputy Principal: delegated academic/administrative management (learners, classes, allocations, timetable, attendance monitoring, assessment verification, report review); no finance access unless explicitly granted.

Subject Teacher: access is strictly limited to the grades, streams, and learning areas they are actively allocated to — their learners, their timetable, their attendance registers, their mark-entry sheets, and their assessment evidence only. A teacher must never see learners in unrelated classes or enter marks for an unallocated learning area, and a teacher may only log in to the single school that holds their staff account and allocation records — cross-school login must be structurally impossible, not merely hidden.

Class Teacher: access limited to assigned homeroom classes only — attendance, authorized results, class-teacher comments, progress review, class reports, limited guardian contacts. Being a class teacher never grants mark-entry rights outside the teacher’s own learning-area allocations.

Admissions Officer/Registrar: applications, admissions, documents, enrollment; no marks or finance access unless separately granted.

Finance Officer/Bursar: fees, invoices, receipts, payments, balances, bursaries, statements, and finance reports; cannot edit academic marks.

Parent/Guardian: view-only access to their own linked learners’ profile, attendance, published reports, fee statements, receipts, timetable, and notices.

Student: view-only access to their own profile, timetable, attendance, published reports, assessment feedback, and permitted fee information.

Every permission above must be enforced server-side and via RLS — hiding a UI element is never sufficient. Teacher, class-teacher, attendance, marks, timetable, reports, academics, staff, and learner-profile screens must all apply the same scope filter so that a teacher’s class picker, learner list, mark sheet, and attendance register are generated exclusively from their currently active allocation records.

Automatic Password-Setup Delivery

Whenever an administrator creates a new staff account or a parent/guardian portal account, the system must immediately and automatically send a secure, time-limited (e.g., 48-hour), single-use password-setup link to the person’s registered email. The recipient clicks the link, sets their own password, and is routed straight into their role-appropriate dashboard — no credentials are ever manually communicated by the administrator. The administrator must see a clear confirmation such as “Invitation and password-setup link sent successfully,” and a failed send must produce a clear, non-silent error.

Learner Admission and Lifecycle Management

Track every learner from first contact through final exit using the lifecycle:

$$\text{Applicant} \rightarrow \text{Admitted} \rightarrow \text{Enrolled} \rightarrow \text{Active} \rightarrow \text{Promoted / Repeated / Stream Changed} \rightarrow \text{Transferred / Withdrawn / Completed} \rightarrow \text{Alumni}$$

Never delete a learner record; always archive with full history preserved and searchable by authorized users. The admission workflow must include starting an application, duplicate-learner search, learner and guardian data capture, document upload/verification, selection of admission year/term/grade/stream, review and approval/rejection, permanent unique admission-number generation, enrollment, fee-structure assignment, admission-letter generation, optional parent/student portal account creation (triggering the password-setup email), and an audit-timeline entry.

Capture the full learner data set specified in the original design (identity numbers, demographics, admission and academic history, boarding/transport, medical alerts restricted to authorized users, emergency contacts, status and exit fields) plus full guardian records (relationship, contact details, fee-responsibility percentage, pickup authorization, portal access, sibling/family linking) and document management (birth certificate, reports, transfer letters, medical documents, consents, with verification status/date/verifier).

Build a tabbed learner profile — Overview, Admission History, Enrollment History, Guardians, Academic Performance, Competencies and Values, Attendance, Timetable, Finance, Medical Information, Discipline, Co-curricular Activities, Portfolio Evidence, Documents, Communication, Audit Timeline — with every tab scope-filtered by role (e.g., a subject teacher never sees the Finance or Medical tab unless separately authorized).

Support bulk and individual promotion, grade repetition, stream change, mid-year transfer, transfer out, withdrawal, Grade 12 completion, alumni conversion, and re-admission. Every such change must record the previous and new grade/stream, effective date, academic year/term, reason, actor, and approval — and grade promotion must always create a new enrollment record, never overwrite the historical one. Generate transfer certificates, completion records, and clearance forms where applicable.

Grades, Classes, and Streams

Allow the Headteacher/Principal to create unlimited named streams per offered grade, each with grade, name, display name, academic year, class teacher, optional assistant class teacher, room, capacity, active status, color label, and notes. Provide paginated grade and stream lists showing learner counts, gender distribution, capacity usage, attendance rate, performance summary, and (for authorized users only) outstanding fee summary, plus printable class/grade lists. Class enrollment is stored per academic year; a learner’s historical class assignment is never overwritten on promotion.

Staff and Teacher Allocation

Build a full-CRUD, paginated staff module (staff number, name, photo, national ID, TSC number, contact details, job title, department, employment type, qualified learning areas, employment date, status, roles). Allocate teachers using academic year, term, teacher, grade, stream, learning area, lessons/week, and start/end dates, with a separate class-teacher assignment record. Every teacher’s dashboard, class picker, mark sheet, attendance register, and timetable must be derived exclusively from their active allocation records — never from a manually curated learner list.

Timetable Management with Automatic Generation

Support both manual timetable configuration (teaching days, opening/closing times, period duration, breaks, lunch, assembly, clubs, games, remedials, double lessons, rooms, per-teacher daily workload limits, and required lessons/week per learning area) and automatic timetable generation. The generator must read all active teacher allocations for the selected academic year/term (teacher, grade, stream, learning area, lessons/week) and distribute lessons across configured periods while rejecting: double-booking a teacher, double-booking a stream, double-booking a room, scheduling into a break/closed period, assigning an unallocated teacher, and exceeding configured workload limits. Where a full automatic solution is impossible, the generator must output a conflict report rather than silently violating a constraint. Every generated slot must remain fully editable afterward — administrators can move, swap, or override any lesson, ideally via drag-and-drop, with conflict validation re-run on every edit. Provide master, class, grade, teacher, and room timetable views, draft/published versions, cloning, substitution management, PDF/Excel export, and paginated timetable-entry lists. Teacher, parent, and student portals must only ever display published timetables, and every teacher-facing timetable view must use a teacher-scoped class picker limited to that teacher’s active allocations.

CBE/CBC Curriculum and Assessment Engine

Model curriculum data as education level → grade → learning area → strand → sub-strand → outcome → core competency → value → pertinent and contemporary issue → assessment method, seeded from current KICD designs but versioned and editable, with import/export and an integration-ready adapter rather than any invented KNEC/NEMIS API. Support all standard CBE assessment types (observation, oral, written, project, practical, portfolio, performance task, assignment, continuous assessment, end-term, school-based, and school-defined types), each carrying name, year/term, grade/stream, learning area, strand/sub-strand, type, max score, weight, rubric, dates, teacher, status, and evidence/publication flags.

Provide a versioned grading-scheme module. Seed the generic four-level CBE descriptors (Exceeding, Meeting, Approaching, Below Expectations) as configurable defaults, then implement the 2025 KJSEA eight-level achievement system for Grades 1 through 6 exactly as follows:

$$\text{EE1 (Exceeding Expectations 1): } 90%\text{–}100% \rightarrow 8 \text{ points}$$
$$\text{EE2 (Exceeding Expectations 2): } 75%\text{–}89% \rightarrow 7 \text{ points}$$
$$\text{ME1 (Meeting Expectations 1): } 58%\text{–}74% \rightarrow 6 \text{ points}$$
$$\text{ME2 (Meeting Expectations 2): } 41%\text{–}57% \rightarrow 5 \text{ points}$$
$$\text{AE1 (Approaching Expectations 1): } 31%\text{–}40% \rightarrow 4 \text{ points}$$
$$\text{AE2 (Approaching Expectations 2): } 21%\text{–}30% \rightarrow 3 \text{ points}$$
$$\text{BE1 (Below Expectations 1): } 11%\text{–}20% \rightarrow 2 \text{ points}$$
$$\text{BE2 (Below Expectations 2): } 0%\text{–}10% \rightarrow 1 \text{ point}$$

Note the boundary fix applied here: the original band list runs from 1%–10% for BE2, which leaves an exact score of 0% undefined; since the rule explicitly states that “every learner is awarded at least one point,” a raw score of 0% must also map to BE2 (1 point), so the lower bound of BE2 should be implemented as inclusive of 0%. Marks recorded as “absent” or “exempt” are excluded from this calculation entirely and must never be converted into a 0% score or a forced point value. Keep every grading-scheme version historically frozen so that a later scheme change never silently alters an already-published report.

Build a grade-adaptive, spreadsheet-style mark-entry interface with per-grade behavior:

PP1–PP2: observation-level selectors only (Exceeding/Meeting/Approaching/Below Expectations descriptors), no numeric score entry.

Grades 1–5: competency-level entry mapped to the eight-level KJSEA scale, displaying level abbreviation and points columns.

Grade 6 (KPSEA): section-based entry matching the KPSEA structure, with the same eight-level KJSEA grading applied per section and aggregated overall.

Grades 7–12: standard numeric mark entry with percentage calculation and performance-level assignment, sectioned where applicable.

The mark-entry page must load only learners from the teacher’s own allocated grade/stream/learning area, support auto-save drafts, validate against maximum marks, never convert absence into zero, warn on incomplete records, prevent duplicate assessment entries, calculate weighted results and averages at full precision (rounding only for display), and log who entered or changed every value. Marks progress through the workflow:

$$\text{Draft} \rightarrow \text{Submitted} \rightarrow \text{Verified} \rightarrow \text{Approved} \rightarrow \text{Published} \rightarrow \text{Locked}$$

Published marks require an authorized, reason-logged reopening before any change. For Grades 1–6, calculate and display position per stream and position per grade based on total KJSEA points/percentage, alongside class/grade means, learning-area means, and performance-level distribution. All internal ranking must be off by default, clearly labeled as internal school analytics, configurable per grade/assessment, and never conflated with official national results. Apply pagination and the teacher-scope filter to every marks-related list.

Learner Reports Including the KJSEA Transcript Redesign

Generate print-ready A4 individual reports containing school branding, report metadata, learner identity fields, attendance summary and term dates, and — for every learning area — the assessment breakdown, raw score/percentage where enabled, performance descriptor, strand/outcome summary, and teacher feedback. For Grades 1–6, redesign this section as a KJSEA-styled transcript table showing, per learning area: the KJSEA level abbreviation (EE1–BE2), the corresponding points value, and a totals row with the learner’s aggregate points, mean, position in stream, and position in grade. Include the seven core competencies (Communication and Collaboration, Critical Thinking and Problem Solving, Creativity and Imagination, Citizenship, Digital Literacy, Learning to Learn, Self-Efficacy), values, pertinent and contemporary issues, community service learning, portfolio/talents/co-curricular sections, behavior and conduct, learner reflection, class-teacher/headteacher/parent comment areas, signatures, stamp area, and a verification QR code or report number. Reports flow through:

$$\text{Draft} \rightarrow \text{Teacher Review} \rightarrow \text{Class Teacher Review} \rightarrow \text{Deputy Review} \rightarrow \text{Headteacher Approval} \rightarrow \text{Published}$$

A published report is stored as an immutable versioned snapshot; later grading-scheme changes must never retroactively alter it. Support individual, merged-class, merged-grade, and ZIP-batch PDF printing with correct pagination, print preview, and draft watermarking, all scoped so teachers only ever see report cards for their own allocated learners.

Attendance

Support daily and lesson/session attendance with statuses Present, Absent, Late, Excused, Sick, School Activity, and Not Marked, following a select-date → select-allocated-class → load-roster → mark → save/submit-and-lock workflow, with corrections requiring approval and optional guardian notifications on consecutive absences. Provide daily/weekly/term summaries and individual/stream/grade/whole-school reports, with pagination and the teacher-scope filter applied throughout, and attendance totals/percentages surfaced on the learner’s report card.

Finance and Fee Management

Build a complete KES-denominated finance module with configurable fee items per year/term/grade/stream/boarding-category, and a permanent per-learner ledger (opening balance, invoices, charges, payments, credits, discounts, bursaries, scholarships, waivers, refunds, reversals, closing balance) where balances are always computed from ledger entries, never typed totals. Support cash, bank, M-Pesa, cheque, and card payments; implement M-Pesa with real server-side callbacks, transaction references, idempotency, and reconciliation, falling back to a clearly labeled manual-payment workflow (never a simulated success) if credentials are absent. Provide invoicing (individual/bulk/automatic), receipts, payment allocation, discounts/bursaries, credit notes, reason-logged reversals and refunds, arrears tracking, payment plans, cashbook, reconciliation, and class/grade/family statements — with posted transactions never silently deleted or edited, teachers barred from balances unless explicitly authorized, and pagination applied to every finance table.

Dashboards

Every dashboard card must be backed by real data and clickable through to its filtered source page. Provide dedicated dashboards for the Headteacher/Principal (enrollment, admissions/transfers, attendance, staffing, timetable conflicts, missing marks, published reports, CBE distribution, fee collection, audit activity), Deputy (enrollment/attendance issues, allocations, timetable status, missing registers/marks, verification queue, performance, at-risk learners), Teacher (today’s timetable, assigned classes/learning areas — scoped strictly to active allocations — pending attendance/marking, draft sheets, notices), Class Teacher (homeroom enrollment, today’s attendance, class performance, missing subject marks, comment queue, guardian communication), and Finance (invoiced vs. collected, collection rate, payment-method totals, outstanding balances, overpayments, bursaries, reconciliation exceptions, recent payments).

Complete Page Inventory

Implement and fully connect every page required across authentication (registration, onboarding, login, forgot/reset password, accept-invitation/password-setup, role selection, unauthorized), school administration (profile, years/terms, grade offerings, streams, rooms, departments, staff, roles/permissions, allocations, class-teacher assignments, curriculum/assessment/report/finance/notification settings, audit logs), learners (applications, admission, review, active list, profile, guardians, documents, promotion/repetition/transfer/withdrawal/completion/alumni, bulk import, enrollment history), academics (learning areas, strands, sub-strands, outcomes, assessments, rubrics, mark entry/verification/approval, performance analysis, missing marks, report cards/publishing), timetable (setup, auto-generator, manual builder with post-generation editing, conflict report, master/class/teacher/room views, substitutions, publishing), attendance (daily, lesson, corrections, alerts, reports), finance (structures, items, invoices, payments, receipts, accounts, bursaries/discounts, refunds, reconciliation, arrears, reports), and portals (parent/student dashboards, published reports, statements, receipts, attendance, timetable, notices). No navigation item may lead to an empty, unfinished, or placeholder page.

Database Schema

Create normalized, tenant-aware tables with proper indexes, unique constraints, foreign keys, and composite constraints for at least: schools, school_settings, school_grade_offerings, academic_years, terms, users, user_school_memberships, roles, permissions, user_roles, staff, departments, grades, streams, rooms, teacher_allocations, class_teacher_assignments, learners, learner_applications, admissions, enrollments, enrollment_history, learner_status_history, guardians, learner_guardians, learner_documents, medical_records, learning_areas, curriculum_versions, strands, sub_strands, learning_outcomes, competencies, values, assessment_types, assessments, assessment_components, grading_schemes, grading_levels, rubrics, marks, rubric_results, assessment_evidence, report_cards, report_card_versions, attendance_sessions, attendance_records, timetable_versions, timetable_slots, timetable_entries, substitutions, fee_structures, fee_items, invoices, invoice_items, payments, payment_allocations, receipts, bursaries, discounts, ledger_entries, reconciliations, notifications, communication_logs, and audit_logs.

Critical Business Rules

Enforce, server-side and via RLS: teachers cannot view unallocated classes or enter marks for unallocated learning areas; class teachers cannot access unrelated homerooms; a teacher may log in only to the school holding their account/allocations; schools may use only onboarding-selected grades; learners cannot hold two active enrollments in one academic period; admission numbers are unique per school; historical enrollments are never overwritten; absence never becomes a zero score or a forced zero point; every learner in Grades 1–6 receives at least one KJSEA point (including a 0% score); published marks and reports are immutable except through audited reopening; timetable conflicts are rejected automatically; cross-school access is rejected at every layer; posted payments require reversals, never silent edits; every sensitive change is audited; medical data requires extra permission; bulk operations validate before saving; archived learners remain searchable; promotions always create new enrollment records; and finance balances derive strictly from ledger entries.

Pagination Requirements

Apply working, server-side pagination — with page-size selector, page count, and previous/next controls — to every substantial table in the system, explicitly including: staff, learners/admissions, attendance registers and reports, marks/assessment lists, timetable entries, report-card lists, academics tables (learning areas, strands, sub-strands, assessments), all finance tables (invoices, payments, receipts, fee structures, ledger entries, arrears), audit logs, guardians, documents, and every stream/grade list, as well as the sub-tables inside the learner profile.

Icon and Filter Requirements

Apply Font Awesome and/or Lucide icons consistently to every filter bar (search inputs, dropdowns, date pickers, reset buttons), every action button, every navigation item, every status badge, sortable column headers, empty-state illustrations, and toast notifications, with special attention to the filter bars in attendance, marks, timetable, reports, academics, staff, and the learner profile, so that filtering is fast, discoverable, and scoped correctly to a teacher’s own allocations.

UI/UX Design

Deliver a premium, uncluttered interface: collapsible sidebar with logo, school name, role badge, year/term selector, and global learner search; real-data dashboard cards and Recharts visualizations; responsive TanStack tables with sorting/filtering/pagination; step-by-step admission wizard; timeline-based learner history; tabbed, scope-filtered learner profiles; spreadsheet-style, grade-adaptive mark entry; drag-and-drop timetable editing; print-friendly, KJSEA-styled report layouts; confirmation dialogs on destructive actions; toast notifications (never alert()); skeleton loaders; and meaningful empty states. Use navy/deep blue as primary branding, green for success, amber for warnings, red for errors, and purple/blue for analytics, prioritizing the most important actions on every screen.

Security and Data Protection

Implement secure authentication, expiring password-reset tokens, optional two-factor authentication, session expiry, least-privilege authorization, RLS-based tenant isolation, encrypted connections, signed-URL document access, thorough input validation, rate limiting on sensitive endpoints, CSRF protection where applicable, full audit logging, guardian consent tracking, controlled export permissions, extra medical-data restrictions, and backup/recovery guidance. Never expose service-role keys in frontend code.

Standard API Response Structure and Notification System

Every mutation endpoint returns a consistent structure. A success response looks like:

{
"success": true,
"message": "Student admitted successfully.",
"data": {}
}

A failure response looks like:

{
"success": false,
"message": "Student admission failed.",
"errorCode": "ADMISSION_FAILED",
"fieldErrors": {}
}

Use correct HTTP status codes, never expose raw SQL/Supabase/stack-trace errors to end users, and log technical detail securely for administrators. Build one reusable, accessible notification system supporting success, error, warning, and info toasts plus inline field errors, confirmation dialogs, and progress indicators for bulk operations — dismissible, non-duplicated, consistent across every module, and never implemented via alert(). Cover realistic examples such as “Marks saved successfully,” “Timetable published successfully,” “This admission number is already in use,” “You are not authorized to access this class,” “This timetable entry conflicts with another lesson,” and “Some learners do not have marks for this assessment.”

Form Behavior and Validation

Every form needs matching client-side (Zod) and server-side validation. While submitting: disable the submit button, show a spinner and an in-progress label (“Saving…”/“Submitting…”), and block duplicate submits. On success: show the specific success toast, reset/close/redirect/refresh as appropriate. On failure: keep the form open, preserve entered data, highlight and describe invalid fields, focus the first invalid field, and allow retry. Validate required fields, emails, Kenyan phone numbers, dates, admission/UPI numbers, duplicates, grade/stream selections, marks vs. maximum scores, fee amounts, payment references, file type/size, teacher allocations, timetable conflicts, and role permissions.

Demo Seed Data

Seed one demo school with streams PP1 Red, PP1 Blue, Grade 1 Yellow, Grade 4 East, Grade 7 North, and Grade 10 STEM A; one headteacher, one deputy, several subject teachers, at least two class teachers, one finance officer, and one admissions officer; at least 30 learners with guardians; active teacher allocations; a published (auto-generated then edited) timetable; a term of attendance records; CBE assessments with marks, rubric results, and KJSEA levels/points for Grades 1–6; published KJSEA-styled report cards; and fee invoices/payments. Trigger the same automatic password-setup flow for seeded staff/parent accounts, and place credentials only in the development README.

Testing Requirements

Cover tenant isolation, role/teacher/class-teacher restrictions, admission-number generation and duplicate detection, promotion/transfer history, KJSEA grading calculations (including the 0%-boundary and never-zero rules), ranking ties, mark approval/locking, report versioning, automatic timetable generation and conflict detection, attendance calculations, fee invoicing/allocation/idempotency, ledger accuracy, PDF generation, password-setup link delivery, and teacher-scope filtering — plus mobile and print-layout testing.

Final System-Wide Audit, Repair, and Validation Protocol

Before declaring the system complete, run one continuous audit-and-repair pass, without pausing to ask permission. Build a complete page inventory per role, then open and test every page for: no 404/500/blank/hydration errors, correct loading/empty/error states, real data, working refresh/direct-URL access, mobile/tablet/desktop layout, tenant/role enforcement, working navigation/breadcrumbs/pagination/filters/search, and zero placeholders or “Coming Soon” text. Test every interactive element (add, save, submit, edit, delete, archive, restore, approve, reject, verify, publish, lock, reopen, promote, transfer, print, export, import, and so on) and confirm each calls the correct backend operation, mutates the database, and refreshes the UI with a clear, specific success/error/warning/info message — never a silent completion and never a raw technical error shown to the user. Require reason-logged confirmation dialogs before reopening marks, reversing payments, rejecting admissions, withdrawing/transferring/archiving learners, or deactivating staff, and never permanently delete historical marks, payments, attendance, or reports. Run and fix TypeScript checks, ESLint, the production build, migrations, seed scripts, and unit/integration/end-to-end tests until there are zero build errors, zero TypeScript errors, zero unhandled rejections, zero hydration errors, zero broken routes, and zero cross-school data leaks. Conclude with a final audit table (page/module, role tested, actions tested, problems found, fixes completed, final status), using only the statuses Passed, Fixed and Passed, or Blocked by Missing External Credentials, and never marking a page passed without having actually opened and exercised it.

Definition of Done

The system is complete only when: authentication and password-setup automation work for staff and parents; onboarding, grade selection, and streams work; staff can be fully managed and allocated; admissions run end-to-end with preserved history; promotions/transfers/withdrawals create new enrollment records without overwriting history; teacher and class-teacher access is enforced server-side and every class picker/attendance register/mark sheet/timetable/report list is scoped to active allocations only, with teachers restricted to logging into their own school; the timetable can be auto-generated from allocations, freely edited afterward, validated, published, and printed; attendance can be recorded, corrected, and reported with pagination and scope filtering; the grade-adaptive marks-entry UI (PP1–PP2 observation, Grades 1–5 KJSEA competency, Grade 6 KPSEA sections, Grades 7–12 standard) works with correct per-grade validation; the KJSEA eight-level scale, points, and stream/grade positions calculate correctly (including the 0%-boundary fix); report cards use the KJSEA transcript layout and remain immutable once published; finance invoices, payments, receipts, and statements reconcile from ledger entries; every dashboard uses live data and links through to its filtered page; every table has pagination and every filter bar has icons; every page is responsive, reachable, and free of placeholders or TODOs; full CRUD (including edit/delete/archive) is closed on every entity; and migrations, seeds, typecheck, lint, build, and tests all pass, with setup instructions documented in the README. Where a minor decision is unspecified, choose a sensible Kenyan-school default, expose it as a configurable setting, and continue building without pausing for clarification. Deliver the entire system, including this full audit-and-repair pass, in one uninterrupted implementation phase.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

Create a local `.env` file from `.env.example` before using staff account creation. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from the Supabase project settings, and set `SUPABASE_SERVICE_ROLE_KEY` from the server-side API keys section. The service-role key must remain server-only: do not prefix it with `VITE_`, commit it, or expose it in browser code. Restart the dev server after changing environment variables.

Staff credential emails use Resend. Add `RESEND_API_KEY` from Resend and a verified sender in `RESEND_FROM_EMAIL`, for example `SHANSCOTT CBE <noreply@your-verified-domain.example>`. Set `APP_URL` to the public application URL used in the email. Until these values are configured, staff accounts are still created but their credential email is reported as failed.
