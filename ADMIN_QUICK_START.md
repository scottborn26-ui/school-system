# Quick Start: Teacher Account Creation for Admins

## Creating a Teacher Account (5 min walkthrough)

### Access Staff Management

1. **Log in** as Principal or Deputy
2. Click **Staff** in the left navigation
3. Click **Add Staff Member** button

### Fill in Teacher Details

#### Required Fields

| Field | What to Enter | Example |
|-------|--------------|---------|
| Full Name | Teacher's first and last name | John Smith |
| Email | Teacher's unique email address | john.smith@school.com |
| Email (confirm) | Re-enter the email to confirm | john.smith@school.com |

#### Recommended Fields

| Field | What to Enter |
|-------|--------------|
| Phone | Teacher's phone number |
| TSC Number | TSC registration number (if applicable) |
| National ID | Government ID number |
| Job Title | E.g., "Mathematics Teacher" |
| Role | Select from dropdown: `teacher`, `class_teacher`, `registrar`, or `bursar` |
| Employment Type | E.g., "TSC", "BOM", "Intern", "Support" |
| Assigned Grade | E.g., "Form 4" or "Primary 5" |
| Employment Date | Start date in school |

### Create Account

1. Click **Add Staff Member**
2. Wait for confirmation message:
   ```
   ✓ Staff member created and login details sent to john.smith@school.com
   ```
3. Note the **staff number** (auto-generated ID)

### What Happens Next

1. **Immediately:** System creates:
   - Staff record with auto-generated staff number
   - Login account for the teacher
   - Audit log entry

2. **Instantly:** Professional email sent to teacher with:
   - Temporary password
   - Login credentials
   - Direct login button
   - Instructions to change password

3. **Teacher receives:** Email with subject "Your SHANSCOTT Login Credentials"

---

## Teacher's First Login Steps

### Email Received

Teacher will receive professional email containing:
- Full name and staff number
- Temporary password
- Login URL and button
- Security notice about changing password

### First Login

1. Click login link or visit login page
2. Enter: `email` + `temporary password` from email
3. Click **Sign In**

### Change Password (Required)

1. System shows "Set Your Password" page
2. Enter new password (must be 8+ characters)
3. Confirm password
4. Click **Set Password**
5. Automatically redirected to dashboard

---

## Resend Credentials (If Needed)

### When to Use

- Teacher lost login email
- Temporary password expired (48 hours)
- Teacher never received credentials
- Need to reset teacher's account

### How to Resend

1. Navigate to **Staff Management**
2. Find teacher in the list
3. Click **⋮ (More)** button on teacher's row
4. Select **Resend credentials**
5. Confirm in popup
6. Wait for success message:
   ```
   ✓ Credentials sent successfully to john.smith@school.com
   ```
7. Teacher receives new email with new temporary password

---

## Troubleshooting

### "Email already exists" Error

**Problem:** Email is already used for another teacher

**Solution:**
- Check if teacher is already in the system
- Use a different email address
- Contact system admin to verify

### "Only a principal or deputy can create accounts" Error

**Problem:** Your account doesn't have admin permissions

**Solution:**
- Only principals and deputies can create staff accounts
- Contact your principal to create this account
- Or ask principal to grant you admin privileges

### Teacher Didn't Receive Email

**Problem:** Email didn't arrive

**Solution:**
1. Check teacher's spam/junk folder
2. Click **Resend credentials** from staff list
3. Wait a few minutes for email to arrive
4. If still not received, contact system admin

### Temporary Password Expired

**Problem:** More than 48 hours have passed

**Solution:**
1. Navigate to Staff Management
2. Click **Resend credentials** for that teacher
3. Teacher gets new temporary password
4. New 48-hour window starts

---

## Common Questions

### Q: Can I change a teacher's password?
**A:** No, teachers change their own password on first login. If they forget a password, they must contact a principal to resend credentials.

### Q: Can I create multiple teachers at once?
**A:** Not currently. Create one teacher at a time, but the process only takes ~1 minute per teacher.

### Q: What if email delivery fails?
**A:** The staff account is still created successfully. You'll see an error message. Click "Resend credentials" once email is working.

### Q: Can teachers create other user accounts?
**A:** No, only principals and deputies can create staff accounts.

### Q: How long is the temporary password valid?
**A:** 48 hours. After that, teacher must ask you to resend credentials.

### Q: Can I see what emails I've sent?
**A:** Yes, check the staff member's row - you can see "Credentials sent" and "Last sent at" timestamps.

### Q: What password requirements should I tell teachers?
**A:** Minimum 8 characters. The system will tell them if password is too weak.

---

## Access Control

### Who Can Create Staff Accounts?

- ✅ Principals
- ✅ Deputies

### Who Can Create Staff Accounts?

- ❌ Teachers (no access)
- ❌ Class teachers (no access)
- ❌ Support staff (no access)

---

## Best Practices

1. **Before Creating Account:**
   - Verify teacher's email is correct and unique
   - Confirm teacher has email access
   - Get teacher's phone number (optional but recommended)

2. **After Creating Account:**
   - Verify teacher received credentials email
   - Have teacher log in and change password during school hours
   - Keep record of staff number for future reference

3. **Password Management:**
   - Remind teachers to use strong passwords
   - Never share teacher passwords
   - Use "Resend credentials" if password lost (creates new temporary password)

4. **Account Updates:**
   - For email changes: Contact system admin
   - For role changes: Contact system admin
   - For phone/TSC number: Edit staff record in Staff Management

---

## Need Help?

- **Email not configured?** See [EMAIL_SETUP.md](./EMAIL_SETUP.md)
- **Implementation details?** See [TEACHER_ACCOUNT_IMPLEMENTATION.md](./TEACHER_ACCOUNT_IMPLEMENTATION.md)
- **System error?** Contact your IT support team

---

## Reference Information

- **Account creation time:** ~5 seconds
- **Email delivery time:** 1-2 minutes
- **Password change requirement:** First login (enforced)
- **Temporary password valid for:** 48 hours
- **Staff number format:** Auto-generated UUID
