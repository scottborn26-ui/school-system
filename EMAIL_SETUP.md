# Email Configuration Setup Guide

## Overview

This implementation uses **Resend** (https://resend.com) for professional email delivery. It's free, easy to set up, and works great for school staff management.

## The Issue You're Seeing

**Error:** "validation_error: You can only send testing emails to your own email address"

**Cause:** Resend's free trial has a limitation - during the trial phase, you can only send emails to your own email address.

**Solution:** You have two options:

### Option 1: Use Your Own Email for Testing (Quickest ⚡)

During development/testing, simply create staff accounts with your own email address:

1. Create staff with email: **scot0718757621@gmail.com**
2. Email will be sent successfully
3. Test the complete workflow
4. Once you're ready for production, verify a domain (see Option 2)

### Option 2: Verify a Domain (For Production 🚀)

To send to any email address, you need to verify a domain with Resend:

1. **Go to Resend Dashboard:**
   - Visit https://resend.com/domains
   - Sign in to your Resend account

2. **Add Your Domain:**
   - Click "Add Domain"
   - Enter your school's domain (e.g., `school.com`, `admin.school.com`)
   - Follow DNS verification steps (takes 5-10 minutes)

3. **Update Environment Variables:**
   ```env
   RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxx
   RESEND_FROM_EMAIL=noreply@school.com  # Use your verified domain
   ```

4. **Restart Dev Server:**
   ```bash
   npm run dev
   ```

5. **Test Email Sending:**
   - Create a staff member with any email address
   - Email should now send successfully! ✅

## Quick Setup (5 minutes)

### Step 1: Create Resend Account

1. Go to https://resend.com
2. Sign up (free account)
3. Verify your email

### Step 2: Get API Key

1. Log in to Resend dashboard
2. Go to **API Keys** section
3. Click **Create API Key**
4. Copy the key (starts with `re_`)

### Step 3: Set Environment Variables

Create `.env` file in project root:

```env
# Resend Email Configuration
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxx
RESEND_FROM_EMAIL=onboarding@resend.dev

# Application URLs
APP_URL=http://localhost:5173
VITE_APP_URL=http://localhost:5173
```

**Note:** Use `RESEND_FROM_EMAIL=onboarding@resend.dev` during testing. This is Resend's test domain that allows testing emails to any address (actually, it only works to specific test emails - use your own email for easiest testing).

### Step 4: Test It

1. Start dev server: `npm run dev`
2. Go to Staff Management
3. Create a staff member with an email
4. Check for success notification

## Using Resend's Test Domain

For development, you can use Resend's test domain:

```env
RESEND_FROM_EMAIL=onboarding@resend.dev
```

But there's a catch - the test domain has limitations. For easier testing, just use your own email:

```env
RESEND_FROM_EMAIL=noreply@yourdomain.com  # During trial: only works with your own email
```

## Troubleshooting

### "HTTP 403: validation_error"

**Problem:** You're trying to send to an email that's not verified/not your own email

**Solutions:**
1. **Option A (Quick):** Use your own email for testing (scot0718757621@gmail.com)
2. **Option B (Production):** Verify a domain with Resend (see Option 2 above)

### "HTTP 401: Unauthorized"

**Problem:** Invalid or missing API key

**Solution:**
1. Go to https://resend.com/api-keys
2. Copy your API key exactly (no spaces)
3. Update `.env` with `RESEND_API_KEY=re_...`
4. Restart dev server

### "Email provider not configured"

**Problem:** Missing environment variables

**Solution:**
1. Create `.env` file in project root
2. Add both `RESEND_API_KEY` and `RESEND_FROM_EMAIL`
3. Restart dev server: `npm run dev`

### Email Not Arriving

**Problem:** Email was "sent" but didn't arrive

**Checklist:**
- [ ] Check spam/junk folder
- [ ] Verify email address is spelled correctly
- [ ] Check Resend dashboard for failed emails
- [ ] Try again with a different email address
- [ ] Restart dev server to reload env vars

## Email Features

✅ **Professional HTML template** - SHANSCOTT branding with responsive design  
✅ **Automatic retries** - Resend handles delivery failures  
✅ **Security warnings** - Password change instructions included  
✅ **Plain text fallback** - Works with all email clients  
✅ **Mobile friendly** - Responsive design tested  

## Email Content Sent to Teachers

Teachers receive:
- Full name greeting
- Email confirmation
- Temporary password (secure, unique)
- Direct login link
- Security instructions
- Password change requirement notice
- School name and SHANSCOTT branding

## Testing Workflow

1. **Create Staff Member**
   - Full name: Test Teacher
   - Email: scot0718757621@gmail.com (use your own email for testing)
   - Role: teacher
   - Click "Add Staff Member"

2. **Check for Success Toast**
   - ✅ Green toast = "Staff member created and login details sent"
   - ❌ Red toast = Check email configuration

3. **Receive Email**
   - Email arrives in 30 seconds
   - Contains all login details

4. **Test Login**
   - Click login link in email
   - Use email + temporary password
   - Forced to change password

## Production Deployment

For production, follow these steps:

1. **Verify Your Domain:**
   - Go to https://resend.com/domains
   - Add your school domain
   - Complete DNS verification

2. **Update Environment Variables:**
   ```env
   RESEND_API_KEY=re_xxxxxxxxxxxx
   RESEND_FROM_EMAIL=noreply@yourdomain.com
   APP_URL=https://your-school-domain.com
   ```

3. **Deploy:**
   - Push code to production
   - Set environment variables in hosting platform
   - Test email sending with real staff emails

4. **Monitor:**
   - Watch Resend dashboard for failed emails
   - Check bounce rates
   - Monitor delivery performance

## Resend Pricing & Limits

**Free Tier:**
- 100 emails/day during trial
- 5,000 emails/month after trial
- Unlimited sending to your own email

**Paid Plans:**
- $20/month for 50,000 emails
- Scales up as needed

See https://resend.com/pricing for details.

## Email Provider Alternative

If you prefer a different email provider:
- **SendGrid:** Similar setup, more features
- **Mailgun:** Developer-friendly
- **AWS SES:** Scalable for large deployments

All work with the same code structure by swapping the API integration.

## FAQ

**Q: Can I test without domain verification?**  
A: Yes! Use your own email address (scot0718757621@gmail.com) for testing. This works even on the free trial.

**Q: How do I verify my domain?**  
A: Go to Resend → Domains → Add Domain → Follow DNS steps. Takes about 5-10 minutes.

**Q: Can I use multiple sender emails?**  
A: Yes, verify multiple domains and change `RESEND_FROM_EMAIL` as needed.

**Q: What if I hit email limits?**  
A: Upgrade to a paid Resend plan or use a different provider.

**Q: Do I need to regenerate the API key?**  
A: No, same key works forever (until you rotate it for security).

## Quick Reference

**Setup Files:**
- `.env` - Your API key and email config
- `src/lib/staff-credentials.email.ts` - Email template
- `src/lib/staff-account.functions.ts` - Email sending logic

**Testing Email:**
- **Address:** scot0718757621@gmail.com (your own email)
- **Provider:** Resend (free account)
- **No domain verification needed** during testing

**For Production:**
- Verify domain with Resend
- Update RESEND_FROM_EMAIL to use your domain
- Use paid plan if needed for volume

## Next Steps

1. **Set up Resend account** (5 min)
2. **Get API key** (1 min)
3. **Update .env file** (1 min)
4. **Test with your own email** (2 min)
5. **Verify domain when ready** (10 min - optional for testing)
6. **Deploy to production** (when ready)


