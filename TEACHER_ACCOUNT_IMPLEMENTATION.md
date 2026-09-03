# Teacher Account Creation & Email Workflow - Implementation Guide

## Overview

This document describes the complete implementation of the teacher account creation and login email notification workflow for the SHANSCOTT School Management System. The system allows authorized administrators (principals/deputies) to create teacher staff records with automatic Supabase Auth account setup and professional email notification.

## Implementation Status: ✅ COMPLETE

The following components have been implemented and enhanced:

### 1. **Email Templates** (`src/lib/staff-credentials.email.ts`)

**What Changed:**
- Upgraded from plain text emails to professional HTML design
- Added responsive email layout with mobile support
- Included SHANSCOTT branding and color scheme
- Enhanced security notices with clear warnings
- Added call-to-action button for direct login
- Maintained plain text fallback for email clients

**Features:**
- Professional gradient header with SHANSCOTT branding
- Clear credential presentation in formatted section
- Prominent login button with fallback URL
- Security warnings about password change requirement
- Mobile-responsive design
- Footer with company information

### 2. **Staff Account Functions** (`src/lib/staff-account.functions.ts`)

**Enhanced Validation:**
- Email validation with proper error messages
- Full name length validation (3-100 characters)
- Phone number validation (max 20 characters)
- Employment date validation
- All fields have clear, user-friendly error messages

**createStaffWithAccount Function:**
- Step-by-step permission verification
- Duplicate email checking in both Auth and staff table
- Cryptographically secure temporary password generation
- Auth user creation with metadata
- Staff record creation via database function
- Atomic transaction handling with rollback on failure
- Audit logging for all operations
- Email delivery with comprehensive error handling

**resendStaffCredentials Function:**
- Staff member lookup with helpful error messages
- Account status verification
- New password generation and update
- Credentials expiry management (48-hour window)
- Resend email delivery
- Audit logging

### 3. **Staff Management UI** (`src/routes/_authenticated/staff.tsx`)

**Create Staff Dialog:**
- Full form with all required fields
- Email confirmation field to prevent typos
- Role selection (teacher, class_teacher, registrar, bursar)
- Grade assignment option
- Employment type selection
- Professional error messages with field-specific guidance

**Error Handling:**
- Specific error messages for duplicate emails
- Permission-based error handling
- Email delivery failure detection
- User-friendly error descriptions

**Resend Credentials Feature:**
- "Resend credentials" action for existing staff
- Email address display in success notifications
- Clear error messages for each failure scenario

### 4. **Login & Password Management**

**Login Flow (`src/routes/auth.tsx`):**
- Credentials expiry checking
- Staff account validation
- Proper error messaging for expired credentials

**Set Password Route (`src/routes/set-password.tsx`):**
- Forced password change on first login
- Password strength requirements
- Credentials expiry verification
- Flag update on successful password change

**Authenticated Route Protection (`src/routes/_authenticated/route.tsx`):**
- Automatic redirect to `/set-password` when `must_change_password = true`
- Credentials expiry validation
- Staff account status checking

## Database Schema

The implementation uses the following database columns:

```sql
-- Staff table columns (already in place)
ALTER TABLE public.staff
  ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS account_status text DEFAULT 'active'
    CONSTRAINT staff_account_status_check CHECK (account_status IN ('active', 'suspended', 'disabled', 'pending')),
  ADD COLUMN IF NOT EXISTS credentials_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS credentials_sent_at timestamptz;

-- Create unique index to link staff to auth users
CREATE UNIQUE INDEX IF NOT EXISTS staff_user_id_key ON public.staff(user_id) WHERE user_id IS NOT NULL;
```

## Security Considerations

### ✅ Implemented Security Measures

1. **Service Role Key Protection:**
   - Service role key never exposed to browser
   - All admin operations isolated to server-side functions
   - Supabase anon key used for client operations

2. **Permission Verification:**
   - Only principals/deputies can create staff accounts
   - School membership verification
   - Role-based access control (RBAC) via RLS policies

3. **Password Security:**
   - Temporary passwords generated server-side (never in browser)
   - Passwords not stored in plaintext
   - Forced password change on first login
   - 48-hour credential expiry window
   - Strong password requirements enforced

4. **Email Security:**
   - Email addresses normalized and validated
   - Duplicate email prevention
   - One-time delivery (credentials sent at creation time)
   - Professional security warnings in email
   - Password marked as temporary in all communications

5. **Audit Logging:**
   - All staff creation events logged
   - All credential delivery tracked
   - Actor ID and timestamp captured
   - Admin actions are auditable

## Error Scenarios & Handling

### Email Already Exists
```
An account already exists for [email]. Each teacher must have a unique email address.
```
**Response:** Creation blocked, user guided to verify email or use existing account.

### Invalid Email Format
```
Email must be a valid email address.
```
**Response:** Form validation shows error before submission.

### Permission Denied
```
Only a principal or deputy can create staff accounts.
```
**Response:** Clear error that this is an admin-only operation.

### Email Delivery Failed
```
Account created (staff number: XXX), but login email failed to send.
Contact your system administrator or use "Resend credentials" from the staff list.
```
**Response:** Staff record created, admin can retry with "Resend" button.

### Credentials Expired
```
Temporary credentials expired. Ask a school administrator to resend your login details.
```
**Response:** Teacher cannot log in with expired temporary password; admin must resend.

## Configuration Requirements

### Environment Variables

```env
# Email Provider (Resend)
RESEND_API_KEY=<your-resend-api-key>
RESEND_FROM_EMAIL=noreply@yourdomain.com

# Application URLs
APP_URL=https://your-school-domain.com
# or
VITE_APP_URL=https://your-school-domain.com
```

### Supabase Configuration

1. **Auth Settings:**
   - Enable email/password authentication
   - Disable email confirmation requirement (handled via `email_confirm: true` in admin API)

2. **RLS Policies:**
   - Staff table: CRUD policies based on school membership and role
   - User roles: Used for permission verification

3. **Email Provider Integration:**
   - Resend API key configured in environment
   - Sender email verified in Resend dashboard

## Workflow Walkthrough

### For Administrators (Create Teacher)

```
1. Navigate to Staff Management → Add Staff Member
2. Fill out staff profile form:
   - Full name
   - Email address (confirmed)
   - TSC number (if applicable)
   - Job title
   - Account role (teacher, class_teacher, etc.)
   - Employment type (TSC, BOM, Intern, Support)
   - Assigned grade (optional)
3. Click "Add Staff Member"
4. System processes:
   - ✓ Verifies admin permission
   - ✓ Checks for duplicate email
   - ✓ Generates temporary password
   - ✓ Creates Supabase Auth account
   - ✓ Creates staff record
   - ✓ Sends professional email
5. Success notification:
   "✓ Staff member created and login details sent to [email]"
6. Staff list refreshes automatically
```

### For Teachers (First Login)

```
1. Receive professional email with:
   - Login credentials
   - Temporary password
   - Login button/URL
   - Security instructions
2. Click login button or visit login page
3. Enter email + temporary password
4. Authentication succeeds
5. System detects must_change_password = true
6. Redirect to "Set your password" page
7. Enter new password (validated for strength)
8. Password changed, flag updated to false
9. Redirect to role-based dashboard
```

### For Administrators (Resend Credentials)

```
1. Navigate to Staff Management
2. Find the staff member in the list
3. Click row actions → "Resend credentials"
4. System processes:
   - ✓ Verifies admin permission
   - ✓ Finds staff member
   - ✓ Generates new temporary password
   - ✓ Updates Auth user password
   - ✓ Resets must_change_password flag
   - ✓ Sets 48-hour expiry
   - ✓ Sends new email
5. Success notification:
   "Credentials sent successfully to [email]"
```

## Testing Checklist

### Unit Tests
- [ ] Password generation produces unique, secure passwords
- [ ] Email validation catches invalid formats
- [ ] Permission checks reject non-admin users
- [ ] Duplicate email detection works for both Auth and staff table

### Integration Tests
- [ ] End-to-end staff creation workflow
- [ ] Email delivery with Resend API
- [ ] Auth account creation
- [ ] Staff record creation
- [ ] Audit log creation
- [ ] Rollback on failure

### Manual Testing
- [ ] Create staff member as principal
- [ ] Verify email received with correct credentials
- [ ] Verify staff number was auto-generated
- [ ] Login with temporary password
- [ ] Forced redirect to password change
- [ ] Update password successfully
- [ ] Cannot use temporary password after change
- [ ] Resend credentials creates new password
- [ ] Old temporary password no longer works

### Security Testing
- [ ] Service role key not exposed in network requests
- [ ] Temporary password not logged anywhere
- [ ] Email not sent if staff creation fails
- [ ] Orphan auth users cleaned up on staff creation failure
- [ ] Credentials expiry enforced (48 hours)
- [ ] User cannot bypass password change requirement

### UI/UX Testing
- [ ] Clear error messages for all failure scenarios
- [ ] Success notifications show relevant details
- [ ] Toast notifications don't block interaction
- [ ] Form validation catches errors before submission
- [ ] Admin stays on staff page during creation (no redirect)
- [ ] Loading states show during async operations

## Performance Considerations

- Email sending is async and non-blocking
- Staff list queries use indexes on email
- Audit logging is asynchronous
- No N+1 queries in staff creation
- Batch operations for user school memberships

## Future Enhancements

1. **Bulk Import:**
   - CSV upload for multiple staff members
   - Batch email sending
   - Progress tracking

2. **Email Customization:**
   - School-branded email templates
   - Configurable message content
   - Multi-language support

3. **Account Lifecycle:**
   - Account deactivation/reactivation
   - Forced password resets
   - Account suspension handling

4. **Notifications:**
   - Dashboard notification badges
   - Email delivery status tracking
   - Failed delivery alerts for admins

## Troubleshooting

### Email Not Sending
1. Check `RESEND_API_KEY` is set correctly
2. Check `RESEND_FROM_EMAIL` is verified in Resend dashboard
3. Check email address is valid format
4. Check Resend API quota
5. Review error message in toast notification

### Duplicate Email Error
1. Verify email hasn't been used for other staff members
2. Check if staff member was archived (try unarchiving)
3. Check Supabase Auth users for the email

### Credentials Expired
1. Admin must click "Resend credentials"
2. New 48-hour expiry window starts
3. New temporary password is generated

### Cannot Reset Password
1. Verify user is logged in
2. Verify credentials haven't expired
3. Check password meets strength requirements (8+ chars)
4. Check passwords match in confirmation field

## Support & Maintenance

- All operations are logged to `audit_logs` table for troubleshooting
- Email templates can be updated in `sendStaffCredentialsEmail()` function
- Error messages can be customized in server functions and UI components
- Monitor Resend API usage in Resend dashboard
- Review audit logs regularly for security compliance

## Related Files

- `src/lib/staff-credentials.email.ts` - Email template and sending logic
- `src/lib/staff-account.functions.ts` - Staff creation and credential functions
- `src/routes/_authenticated/staff.tsx` - Staff management UI
- `src/routes/auth.tsx` - Login page with credential validation
- `src/routes/set-password.tsx` - Password change page
- `src/routes/_authenticated/route.tsx` - Auth middleware
- `supabase/migrations/20260821100000_staff_login_lifecycle.sql` - Database schema
