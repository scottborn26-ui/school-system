# SHANSCOTT CBE/CBC School Management System

## Complete User Guide

This guide explains how to use SHANSCOTT from the first account registration through daily school operations. The screens shown in the sidebar depend on the signed-in user's role and permissions. A user only sees data belonging to the active school, and teachers are further limited to their active allocations.

## 1. Before You Begin

The school administrator should have these details ready:

- Official school name, short name and motto
- School category, ownership, day/boarding status and gender composition
- KNEC centre code and NEMIS/institution code, where applicable
- County, sub-county, ward, physical address, postal address, email, phone and website
- Headteacher/principal name, phone and email
- Academic year name, opening date and closing date
- Grades offered by the school
- Report footer and whether internal ranking or raw scores should be shown

The application uses Kenyan school conventions, Kenya phone-number validation and KES as the finance currency.

## 2. Create the First Account

1. Open the application and select **Register school** on the sign-in page.
2. Enter your full name, email address and a password of at least eight characters.
3. Select **Create account**.
4. If email confirmation is enabled for the Supabase project, open the confirmation email and confirm the address.
5. Return to the application and sign in using **Headteacher / Principal**.
6. A new account with no school membership is sent to **School onboarding** automatically.

Use an email address that the principal can access. It becomes the initial authenticated account for the school.

### Sign in later

1. Open the sign-in page.
2. Select **Headteacher / Principal** for the school owner account, or **Staff** for an account created by a school administrator.
3. Enter email and password.
4. Select **Sign in**.
5. Users with more than one active role choose the role to use for the session on the role-selection page.

The application signs out a disabled account and refuses expired temporary credentials. Select **Sign out** from the bottom of the navigation when finished on a shared device.

### Forgot password

Enter the account email on the sign-in page and request a reset link. The reset link is time-limited. Open it from the same browser, choose a new password, and sign in again.

## 3. Complete School Onboarding

Onboarding has five steps. Your draft is saved in the browser, so an interrupted setup can be resumed on the same device.

### Step 1: School identity

Enter the official name. Short name and motto are optional. Select:

- Category: pre-primary, primary, junior, senior or comprehensive
- Ownership: public or private
- Day/boarding: day, boarding or mixed
- Gender composition

### Step 2: Location and contacts

Select the county and enter the official school email and a valid Kenyan phone number. Add sub-county, ward, addresses, website, codes and headteacher contact information where available. The county, official email, phone and headteacher name are required.

### Step 3: Grades offered

Select every grade the school actually offers. The available CBE grades are PP1, PP2, Grade 1 through Grade 9, and Grade 10 through Grade 12. For senior school, select applicable pathways such as STEM, Social Sciences, or Arts and Sports Science.

Only selected grades should be used later for streams, learners, assessments and reports. Select at least one grade.

### Step 4: Academic year

Enter the academic year name and opening and closing dates. The end date must be later than the start date. Completing onboarding creates the first academic year and Term 1, Term 2 and Term 3.

### Step 5: Preferences

Review the admission-number format, report footer, ranking preference and raw-score preference. Ranking is off by default. Select **Complete onboarding** to create the school.

Completion creates the school, principal membership and role, academic year, terms, selected grade offerings and school settings. You are then taken to the dashboard.

## 4. Understand the Navigation

The sidebar is role-aware. Common pages are:

- **Dashboard**: current operational summary and links into relevant records
- **Learners**: learner list, profiles, guardians, documents and lifecycle actions
- **Admissions**: applicant and admission processing
- **Staff**: staff accounts and employment information; principal/deputy only
- **Grades & Streams**: grades, streams, class teachers and enrollment counts
- **Curriculum**: learning areas and curriculum structures
- **Timetable**: setup, generation, editing and publication
- **Attendance**: daily and lesson/session attendance
- **Marks Entry**: assessment marks and status changes
- **Add Assessment**: create assessments for a grade, stream and learning area
- **Report Cards**: review and publish reports
- **Approve Report Cards**: administrator approval queue
- **Fees & Finance**: fee structures, invoices, payments and statements
- **Grading Scheme**: grading levels and school assessment rules
- **School Settings**: profile, grade offerings, calendar and reports
- **Audit Logs**: sensitive school activity for authorized users
- **Platform Control**: platform-level school administration for super administrators

On smaller screens, open the menu button to access the same navigation. The header includes school context, academic year/term controls and learner search where available.

## 5. Create Staff Accounts

Only a principal or deputy can create staff accounts.

1. Open **Staff**.
2. Select **Add Staff Member**.
3. Enter the staff member's full name, email and email confirmation.
4. Add phone, TSC number, national ID, job title, department, employment type, employment date and role.
5. Select the appropriate role, such as teacher, class teacher, registrar or bursar.
6. Select **Add Staff Member**.

The system validates the email, checks for duplicates, creates the staff record and account, generates temporary credentials, records the operation in the audit log and attempts to send the invitation email.

The staff member receives a time-limited login invitation. They sign in as **Staff**, then are redirected to **Set your password**. They must choose a new password before entering the application.

### Resend an invitation

1. Open **Staff** and locate the staff member.
2. Open the row actions menu.
3. Select **Resend credentials** and confirm.

This generates a new temporary credential window. Never send passwords manually. If email delivery fails, the account can still exist; correct the email configuration and use **Resend credentials**.

### Staff account rules

- Email addresses must be unique.
- Temporary credentials expire after the configured period, normally 48 hours.
- A disabled or suspended account cannot operate normally.
- Role changes and account actions are permission-controlled and audited.
- Creating a staff account does not automatically allocate teaching classes.

## 6. Configure Grades, Streams and Calendar

### Grades and streams

1. Open **Grades & Streams**.
2. Confirm that the grade was selected during onboarding.
3. Create a stream under that grade, for example `PP1 Red`, `Grade 7 North` or `Grade 10 STEM A`.
4. Set the stream name, academic year, class teacher, room, capacity, active status and notes.
5. Save the stream.

Create each stream before enrolling learners or allocating teachers. Historical enrollment remains associated with its academic year and is not overwritten by later promotion.

### Settings and calendar

Principals and deputies can open **School Settings** and use these tabs:

- **Profile**: identity, contacts, codes, headteacher details and logo
- **Grades Offered**: activate or deactivate offered grades
- **Academic Calendar**: terms and school calendar events
- **Reports**: report footer, ranking visibility and raw-score visibility

Changing these settings can affect admissions, assessments, timetables and reports. Review the warning on the settings page before saving.

## 7. Admit and Enroll Learners

Admissions are available to the principal, deputy and registrar.

1. Open **Admissions**.
2. Start a new application.
3. Search for a possible duplicate learner before entering a new record.
4. Enter the learner's identity, demographic, contact, guardian and emergency information.
5. Select the admission year, term, offered grade and stream.
6. Upload available documents, such as a birth certificate, previous report or transfer letter.
7. Review the application and either approve or reject it.
8. For an approved application, complete enrollment and confirm the generated admission number.
9. Assign the appropriate fee structure.
10. Generate or print the admission letter where available.
11. Optionally create a parent or student portal account.

An admitted learner becomes enrolled only after the enrollment action is completed. Admission numbers are unique within the school. Documents retain verification status and history.

### Learner profile

Open a learner from **Learners** to review the information allowed by your role. Depending on permissions, the profile can contain overview, admission and enrollment history, guardians, academic performance, competencies, attendance, timetable, finance, medical information, discipline, activities, portfolio evidence, documents, communication and audit history.

Medical and financial information is restricted. A teacher should only see learners and information permitted by active assignments and explicit permissions.

### Learner lifecycle actions

Use the learner action menu for promotion, repetition, stream change, transfer, withdrawal, completion, alumni conversion or re-admission. Confirm the effective date, academic period and reason when requested.

These actions preserve history and create the appropriate new enrollment or status record. Do not create a duplicate learner to represent a promotion or transfer.

## 8. Allocate Teachers

Teacher access to learners, attendance, marks, timetables and reports is based on active allocations.

1. Open **Assignments** or the staff allocation area.
2. Choose the academic year and term.
3. Select the teacher, grade, stream and learning area.
4. Enter lessons per week and allocation start/end dates.
5. Save the allocation.
6. Assign a class teacher separately when the teacher is responsible for a homeroom.

A teacher will not see a class or learning area until the allocation is active. Being a class teacher does not grant mark-entry rights for unrelated learning areas.

## 9. Create Assessments and Enter Marks

### Create an assessment

1. Open **Add Assessment**.
2. Select the academic year/term, grade, stream where applicable, learning area and assessment date.
3. Enter the title, assessment type, maximum score and weight.
4. Add strand, sub-strand, rubric or evidence settings where used.
5. Save the assessment.

Teachers can only work with assessments within their permitted allocation scope.

### Enter marks

1. Open **Marks Entry**.
2. Select the grade.
3. Select your allocated stream.
4. Select the assessment.
5. Review the learner roster.
6. Enter marks or select absent/exempt where appropriate.
7. Select **Save marks**.
8. Review incomplete records and then select **Submit for approval**.
9. Administrators review and approve, then lock the assessment when complete.

The entry format changes by grade:

- PP1-PP2: observation descriptors
- Grades 1-5: KJSEA competency levels and points
- Grade 6: KPSEA section-based entry
- Grades 7-12: numeric marks and percentages

Scores are checked against the maximum mark. Absence and exemption are stored separately and are not converted into a zero. Duplicate assessment rows are prevented by the assessment/learner combination. CSV export and import are available where enabled; always review imported rows before saving.

### Mark statuses

The normal workflow is:

`Draft -> Submitted -> Approved -> Locked`

A locked assessment should not be changed casually. Reopening or changing published/locked work requires the appropriate permission and a reason recorded in the audit trail.

### KJSEA levels

For Grades 1-6, the system maps percentages to levels and points as follows:

| Percentage | Level | Points |
|---|---|---:|
| 90-100% | EE1 | 8 |
| 75-89% | EE2 | 7 |
| 58-74% | ME1 | 6 |
| 41-57% | ME2 | 5 |
| 31-40% | AE1 | 4 |
| 21-30% | AE2 | 3 |
| 11-20% | BE1 | 2 |
| 0-10% | BE2 | 1 |

A raw score of 0% maps to BE2 and one point. Absent and exempt entries are excluded from the calculation.

## 10. Attendance

1. Open **Attendance**.
2. Select the date.
3. Select an allocated class or stream.
4. Load the roster.
5. Mark each learner as Present, Absent, Late, Excused, Sick, School Activity or Not Marked.
6. Save the register, or submit and lock it according to the workflow.

Teachers only receive rosters for allocated classes. Corrections to submitted or locked attendance require the appropriate approval. Use attendance summaries and reports to review daily, weekly, term, learner, stream, grade or school patterns.

Do not use a mark of Absent as a substitute for a missing register. Resolve Not Marked records before final reporting.

## 11. Timetable

### Configure the timetable

1. Open **Timetable**.
2. Set teaching days, opening and closing times, period duration, breaks and lunch.
3. Add rooms and any special periods such as assembly, clubs, games or remedials.
4. Confirm teacher allocations and lessons per week.

### Generate or edit

Use automatic generation after allocations are complete. The generator checks teacher, stream and room conflicts, closed periods and workload limits. If a complete schedule is impossible, review the conflict report and correct allocations or period constraints.

Every generated entry can be edited afterward. Recheck conflicts after moving or swapping a lesson. Use master, class, teacher or room views to inspect the result.

### Publish

Keep the timetable in draft while reviewing it. Publish only after conflicts are resolved. Teachers, parents and students should rely on the published version; draft changes are not the operational timetable.

## 12. Reports and Approval

1. Open **Report Cards**.
2. Select the academic year, term, grade, stream or learner.
3. Review attendance, assessment results, competencies, values, comments and report metadata.
4. Complete teacher and class-teacher comments where applicable.
5. Submit the report for review.
6. Authorized reviewers use **Approve Report Cards** to process the queue.
7. The headteacher approves and publishes the final report.

The report workflow is:

`Draft -> Teacher Review -> Class Teacher Review -> Deputy Review -> Headteacher Approval -> Published`

Grades 1-6 reports display KJSEA level abbreviations, points, totals, means and permitted internal positions. Ranking is internal school analytics only and is not an official national result.

Published reports are versioned snapshots. Print or export the published version for the official record. Draft reports should remain visibly marked as drafts.

## 13. Fees and Finance

Finance is available to the bursar, principal and permitted deputy users.

1. Open **Fees & Finance**.
2. Create fee structures and fee items for the academic year, term, grade, stream or boarding category.
3. Generate individual or bulk invoices.
4. Record payments using the correct method: cash, bank, M-Pesa, cheque or card.
5. Allocate each payment to the correct invoice or learner ledger.
6. Issue or print receipts.
7. Review balances, arrears, statements, bursaries, discounts and reconciliation exceptions.

Balances come from ledger entries. Posted payments should be corrected through a reason-logged reversal or refund, never by silently editing or deleting the original transaction.

M-Pesa requires configured server-side credentials and callbacks. When those credentials are absent, use the clearly labelled manual-payment process and do not treat an unverified transaction as a successful M-Pesa payment.

Teachers do not receive finance access unless explicitly granted.

## 14. Roles and Data Access

- **Principal**: full authority within the school, including settings, staff, allocations, approvals, reports and audit logs.
- **Deputy**: delegated academic and administrative management; finance depends on explicit permission.
- **Teacher**: assigned grades, streams and learning areas only.
- **Class teacher**: assigned homeroom only, plus permitted attendance and class review functions.
- **Registrar**: admissions, enrollment, learner documents and lifecycle administration.
- **Bursar**: fees, invoices, payments, receipts, ledgers and finance reports.
- **Parent/guardian**: view-only access to linked learners, published reports, statements, attendance, timetable and notices where portal access is enabled.
- **Student**: view-only access to their own permitted profile, timetable, attendance, reports and feedback where enabled.
- **Super administrator**: platform school administration and platform audit functions; private learner data requires explicit, audited support access.

Access is enforced by application permissions and database row-level security. A hidden menu item is not the only security control.

## 15. Audit, Imports and Exports

Sensitive operations such as admission decisions, staff account actions, marks changes, approvals, publication, payment reversals and learner lifecycle changes are audited.

Use CSV import only with the required column format for the selected page. Validate the preview or loaded rows before saving. Exports may contain sensitive data, so use them only when authorized and store them securely.

## 16. Common Problems

### I cannot see a class or learner

Ask an administrator to confirm your active school membership, grade/stream allocation, learning-area allocation or class-teacher assignment. The restriction is intentional.

### The temporary password does not work

Check that it has not expired and that you selected **Staff** at sign-in. Ask a principal or deputy to use **Resend credentials**.

### The account was created but no email arrived

Check spam/junk mail. The server must have a valid Resend API key, verified sender address and application URL. After configuration, resend the credentials from **Staff**.

### A mark cannot be changed

The assessment may be submitted, approved or locked. Use the authorized reopen process and provide the required reason. Do not create a second assessment to bypass the status.

### A timetable has conflicts

Open the conflict report. Check teacher allocations, stream assignments, room use, periods, breaks and workload limits, then regenerate or edit the affected entries.

### A payment needs correction

Use a reversal or refund with a reason. Preserve the original posted transaction for reconciliation and audit purposes.

## 17. Administrator Checklist

For each new school, complete these steps in order:

1. Register the principal account and confirm the email.
2. Complete onboarding and select the correct grades.
3. Verify profile, logo, academic year, terms and report settings.
4. Create streams and rooms.
5. Create staff accounts and confirm invitation delivery.
6. Allocate teachers and assign class teachers.
7. Configure curriculum, grading, assessments and timetable rules.
8. Admit learners, verify documents and enroll them in streams.
9. Configure fee structures and invoice rules.
10. Record attendance and enter assessment marks.
11. Review and approve reports, then publish them.
12. Review audit logs, missing marks, missing attendance and finance reconciliation exceptions.
13. Back up or export authorized records according to school policy.

## 18. Technical Setup for Administrators

Create a local `.env` file from `.env.example` before using staff account creation. Required server configuration includes:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only; never expose it in frontend code)
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `APP_URL` or `VITE_APP_URL`

Restart the development server after changing environment variables. The service-role key must never use a `VITE_` prefix, be committed to source control or be sent to the browser.

For local development, install dependencies and start the application with:

```sh
npm install
npm run dev
```

The application normally runs at `http://localhost:5173`.

## 19. Support and Safety Rules

- Never share passwords or service keys through email or chat.
- Never use a second learner record to represent a promotion or transfer.
- Never change a posted payment directly.
- Never treat an absent learner as having a zero mark.
- Never assume a teacher can access a class because they can see the menu item.
- Confirm destructive, irreversible or publication actions before completing them.
- Review the success or error notification after every save, submit, approval, import, export or publication action.
