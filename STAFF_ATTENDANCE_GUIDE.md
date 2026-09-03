# Staff Attendance System - User Guide

## Overview

The School Management System now includes a comprehensive Staff Attendance system that allows every staff member to record their daily attendance with automatic clock in/out timestamps. Administrators can monitor, manage, and export attendance records for all staff members.

---

## For Staff Members

### Clock In/Clock Out from Dashboard

1. **Dashboard Widget**: Every day, a "My Attendance" card appears on your dashboard
2. **Clock In**: 
   - Click the green "Clock In" button to record your arrival
   - If you're clocking in after the school's configured start time (e.g., 8:15 AM including grace period), you'll be marked as "Late" with an orange badge
   - You may be required to provide a reason for lateness (depends on school settings)
3. **Clock Out**:
   - Click the blue "Clock Out" button when leaving
   - Your worked hours will be automatically calculated
   - Display format: "Worked: 7h 45m"

### View Your Attendance History

1. **Navigation**: Click "My Attendance" in the sidebar menu
2. **Monthly View**: 
   - Select the month using the date picker
   - View all your attendance records for that month
3. **Summary Statistics**:
   - **Present**: Days you clocked in on time (green)
   - **Late**: Days you clocked in after grace period (orange)
   - **Absent**: Days with no clock in record (red)
   - **Attendance Rate**: Percentage of present/late days vs. total

### Attendance Record Details

For each day, you'll see:
- **Date**: The attendance date
- **Clock In Time**: Time you clocked in (or "-" if not marked)
- **Clock Out Time**: Time you clocked out (or "-" if not marked)
- **Hours Worked**: Total hours and minutes worked that day
- **Status Badge**: Color-coded status (green=present, orange=late, red=absent, purple=on leave)

---

## For Administrators (Admin/Principal/Deputy)

### Staff Attendance Dashboard

Navigate to: **Sidebar → Staff Attendance**

#### Summary Cards (Top of Page)
- **Present Today** (Green): Count and percentage of staff clocked in on time
- **Late Today** (Orange): Count and percentage of staff who clocked in late
- **Absent Today** (Red): Count of staff with no attendance record
- **On Leave** (Purple): Count of staff marked on leave
- **Total Staff** (Blue): Total active staff count

#### Filters and Search

Use the filter row to find specific attendance records:

1. **Date Picker**: Select a specific date (default: today)
2. **Role/Department Filter**: Filter by job title (e.g., "Teaching Staff", "Admin")
3. **Status Filter**: Show only specific statuses:
   - All statuses
   - Present (on time)
   - Late
   - Absent
   - On Leave
   - Half Day
4. **Search**: Type staff member's name to find them quickly

#### Staff Attendance Table

The table displays all staff members and their attendance:

| Column | Description |
|--------|-------------|
| **Staff Member** | Staff photo and full name |
| **Role** | Job title/position |
| **Clock In** | Time clocked in (or "-" if not marked) |
| **Clock Out** | Time clocked out (or "-" if not marked) |
| **Status** | Color-coded badge showing their status |
| **Action** | View detail or edit buttons |

#### Sorting & Pagination

- **Pagination**: Use bottom controls to navigate between pages
- **Rows Per Page**: Select 10, 25, 50, or 100 records per page
- All columns are sortable (click column headers to sort)

### Viewing Staff Attendance History

1. Click the **View** (eye icon) button next to a staff member's name
2. A detail drawer will show:
   - Their attendance history for the past month
   - Each day's clock in/out times and hours worked
   - Status for each day
   - Calendar view showing attendance patterns

### Manually Edit/Override Attendance

Use this when a staff member forgets to clock in or there's a discrepancy:

1. Click the **Edit** (pencil icon) button next to a staff member's name
2. In the dialog, you can:
   - Change the attendance **Status** (Present, Late, Absent, On Leave, Half Day)
   - Set custom **Clock In Time** (optional)
   - Set custom **Clock Out Time** (optional)
   - System auto-calculates hours worked if both times are set
   - Provide a **Reason/Note** (required for manual changes - for audit trail)
3. Click **Save Manual Change**
4. The record is marked as manually overridden with your name recorded

### Export Attendance Report

1. Click the **Export CSV** button at the top
2. A CSV file downloads containing:
   - Date
   - Staff name
   - Role
   - Clock In time
   - Clock Out time
   - Hours worked
   - Status

Use this for monthly reports, compliance, or external record keeping.

---

## Administrator Settings

Navigate to: **Sidebar → School Settings → Staff Attendance Policy Tab**

### Configuration Options

| Setting | Description | Default |
|---------|-------------|---------|
| **Enable Staff Attendance Clocking** | Toggle the entire system on/off | Enabled |
| **Official Start Time** | What time is considered "on time" for clock in | 08:00 |
| **Grace Period (minutes)** | Number of minutes after start time before marking as late | 15 |
| **Require Reason for Late Clock-In** | Whether staff must provide a reason when clocking in late | Off |

### Example Configuration

If you set:
- Start Time: 08:00
- Grace Period: 15 minutes

Then:
- Clock in at 08:00-08:14 = **On Time** (green, "Present")
- Clock in at 08:15-09:00 = **Late** (orange, "Late")
- Clock in after 09:00 = **Late** (orange, "Late")

---

## Status Meanings

| Status | Badge Color | Meaning |
|--------|------------|---------|
| **Present** | Green | Clocked in on time |
| **Late** | Orange | Clocked in after grace period cutoff |
| **Absent** | Red | No clock-in record for the day |
| **On Leave** | Purple | Manually marked as on leave (approved leave) |
| **Half Day** | Gray | Staff member worked partial day |

---

## Key Features

### For Staff
✅ Self-service clock in/out  
✅ Automatic late detection  
✅ Personal attendance history  
✅ Monthly summary statistics  
✅ Works on any device with browser access  

### For Administrators
✅ Real-time attendance dashboard  
✅ Staff member filtering and search  
✅ Manual attendance editing with audit trail  
✅ CSV export for reports  
✅ Configurable school attendance policy  
✅ Multi-month history viewing  
✅ Color-coded status indicators  
✅ Summary statistics at a glance  

---

## Timezone Handling

All attendance times are recorded and displayed in the school's configured timezone (default: Africa/Nairobi). This ensures consistent time records regardless of user location.

---

## Security & Access Control

- **Staff** can only view and modify their own attendance
- **Admins/Principals/Deputies** can view all staff attendance and edit records
- **Audit Trail**: Admin edits are tracked with editor name and timestamp
- **RLS Policies**: Database-level security ensures multi-tenant data isolation

---

## Troubleshooting

### Clock In Button Won't Work
- Ensure you're logged in to your school account
- Verify staff attendance is enabled in school settings
- Check that your staff account is active and not archived

### Clock Out Button Disabled
- You must clock in first before you can clock out
- Cannot clock out if already clocked out for the day (can only edit via admin)

### Cannot View Other Staff's Attendance
- Only Admin/Principal/Deputy roles can view all staff attendance
- Staff can only see their own attendance history

### Late Reason Not Required but Asking
- Check if your school's settings require late reasons
- Admin can disable this requirement in Settings

---

## Frequently Asked Questions

**Q: Can I clock in/out multiple times in a day?**  
A: No, one clock in and one clock out per day. Use the admin edit feature if you need to change times.

**Q: What if I forget to clock out?**  
A: Contact your admin to manually set your clock out time. Admin can edit the record and add a note.

**Q: How is "late" determined?**  
A: It's based on your school's configured start time plus the grace period. If you clock in after that time, you're marked late.

**Q: Can I see previous months' attendance?**  
A: Yes, use the month picker in "My Attendance" to view any previous month.

**Q: Will staff be notified if an admin edits their attendance?**  
A: Currently, edits are logged in the system. Notification features may be added in future updates.

---

## Support

For issues or questions about the Staff Attendance system, contact your school administrator.
