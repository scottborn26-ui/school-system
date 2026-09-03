import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CreateStaffInput = z.object({
  schoolId: z.string().uuid("School ID must be a valid UUID"),
  fullName: z
    .string()
    .min(3, "Full name must be at least 3 characters")
    .max(100, "Full name cannot exceed 100 characters"),
  email: z.string().email("Email must be a valid email address").max(255, "Email is too long"),
  tscNumber: z.string().max(50, "TSC number is too long").optional(),
  nationalId: z.string().max(50, "National ID is too long").optional(),
  gender: z.string().max(20, "Gender value is too long").optional(),
  jobTitle: z.string().max(100, "Job title is too long").optional(),
  role: z.enum(["teacher", "class_teacher", "exam_officer"], {
    errorMap: () => ({
      message: "Role must be one of: teacher, class_teacher, or exam_officer",
    }),
  }),
  employmentType: z.string().max(50, "Employment type is too long").optional(),
  phone: z.string().max(20, "Phone number is too long").optional(),
  employmentDate: z
    .string()
    .refine((val) => !val || !isNaN(Date.parse(val)), "Employment date must be a valid date")
    .optional(),
  assignedGrades: z.array(z.string().max(10, "Grade value is too long")).default([]),
  classTeacherGrade: z.string().max(10, "Grade value is too long").optional(),
  classTeacherStreamId: z.string().uuid("Class-teacher stream must be valid").optional(),
});

function getRandomItem<T>(items: T[]): T {
  const index = crypto.getRandomValues(new Uint32Array(1))[0] % items.length;
  return items[index];
}

function generateTemporaryPassword(length = 12) {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const digits = "23456789";
  const symbols = "!@#$%^&*()-_=+[]{};:,.<>?";
  const required = [
    getRandomItem(upper.split("")),
    getRandomItem(lower.split("")),
    getRandomItem(digits.split("")),
    getRandomItem(symbols.split("")),
  ];
  const all = `${upper}${lower}${digits}${symbols}`;
  const filler = Array.from({ length: Math.max(length - required.length, 0) }, () =>
    getRandomItem(all.split("")),
  );

  return [...required, ...filler]
    .map((value) => value)
    .sort(() => (crypto.getRandomValues(new Uint32Array(1))[0] % 2 === 0 ? 1 : -1))
    .join("")
    .slice(0, length);
}

export const createStaffWithAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => CreateStaffInput.parse(input))
  .handler(async ({ data, context }) => {
    const normalizedEmail = data.email.trim().toLowerCase();

    // Step 1: Verify admin permissions
    const { data: adminRole, error: adminRoleError } = await context.supabase
      .from("user_roles")
      .select("id")
      .eq("user_id", context.userId)
      .eq("school_id", data.schoolId)
      .eq("is_active", true)
      .in("role", ["principal", "deputy"])
      .maybeSingle();

    if (adminRoleError) {
      throw new Error("Failed to verify administrator permissions. Please try again.");
    }

    if (!adminRole) {
      throw new Error("Only a principal or deputy can create staff accounts.");
    }

    // Step 2: Import Supabase Admin client
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Step 3: Check for duplicate email in Auth
    const { data: userList, error: lookupError } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

    if (lookupError) {
      throw new Error(`Failed to check for existing accounts: ${lookupError.message}`);
    }

    if (userList.users.some((user) => user.email?.trim().toLowerCase() === normalizedEmail)) {
      throw new Error(
        `An account already exists for ${normalizedEmail}. Each teacher must have a unique email address.`,
      );
    }

    // Step 4: Check for duplicate email in staff table
    const { data: allStaff, error: staffCheckError } = await supabaseAdmin
      .from("staff")
      .select("id, email")
      .eq("school_id", data.schoolId)
      .eq("is_archived", false);

    if (staffCheckError) {
      throw new Error("Failed to check for existing staff records. Please try again.");
    }

    const existingStaff = allStaff?.find(
      (staff) => staff.email?.trim().toLowerCase() === normalizedEmail,
    );

    if (existingStaff) {
      throw new Error(
        `A staff record with the email ${normalizedEmail} already exists in this school.`,
      );
    }

    // Step 5: Generate a one-time temporary password that is shown only to the admin.
    const temporaryPassword = generateTemporaryPassword();

    // Step 6: Create Supabase Auth user
    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: normalizedEmail,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: {
        full_name: data.fullName.trim(),
        role: data.role,
        created_by_admin: true,
      },
    });

    if (createError || !created.user) {
      throw new Error(
        createError?.message ??
          "The authentication account could not be created. Please verify the email is valid and try again.",
      );
    }

    // Step 7: Create staff record
    const { data: staffId, error: transactionError } = await supabaseAdmin.rpc(
      "create_staff_account",
      {
        _school_id: data.schoolId,
        _user_id: created.user.id,
        _actor_id: context.userId,
        _staff: {
          full_name: data.fullName.trim(),
          tsc_number: data.tscNumber?.trim() || null,
          national_id: data.nationalId?.trim() || null,
          gender: data.gender || null,
          job_title: data.jobTitle?.trim() || null,
          employment_type: data.employmentType || null,
          phone: data.phone?.trim() || null,
          email: normalizedEmail,
          employment_date: data.employmentDate || null,
          assigned_grade: data.assignedGrades[0] || null,
          assigned_grades: data.assignedGrades,
          class_teacher_grade: data.classTeacherGrade || null,
          class_teacher_stream_id: data.classTeacherStreamId || null,
        },
        _role: data.role,
      },
    );

    if (transactionError || !staffId) {
      // Rollback: Delete the created auth user to prevent orphan accounts
      try {
        await supabaseAdmin.auth.admin.deleteUser(created.user.id);
      } catch {
        // Silently fail if rollback fails; the user should contact support
      }

      const errorMsg =
        transactionError?.message ??
        "The staff profile could not be created. Please verify all details and try again.";

      throw new Error(errorMsg);
    }

    // Step 8: Fetch created staff record
    const { data: staff, error: staffLookupError } = await supabaseAdmin
      .from("staff")
      .select("staff_number")
      .eq("id", staffId)
      .single();

    if (staffLookupError || !staff) {
      throw new Error(
        "The staff account was created, but the staff number could not be retrieved. " +
          "The login email will be sent, but you may need to contact support to complete setup.",
      );
    }

    await supabaseAdmin.from("audit_logs").insert({
      school_id: data.schoolId,
      actor_id: context.userId,
      action: "staff_account_created",
      entity: "staff",
      entity_id: staffId,
      after_data: {
        staff_number: staff.staff_number,
        full_name: data.fullName.trim(),
        email: normalizedEmail,
      },
    });

    return {
      staffId,
      userId: created.user.id,
      staffNumber: staff.staff_number,
      email: normalizedEmail,
      password: temporaryPassword,
    };
  });

const DeleteStaffAccountInput = z.object({
  schoolId: z.string().uuid(),
  staffId: z.string().uuid(),
});

export const deleteStaffAccountPermanently = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => DeleteStaffAccountInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: adminRole, error: adminRoleError } = await context.supabase
      .from("user_roles")
      .select("id")
      .eq("user_id", context.userId)
      .eq("school_id", data.schoolId)
      .eq("is_active", true)
      .in("role", ["principal", "deputy"])
      .maybeSingle();

    if (adminRoleError || !adminRole) {
      throw new Error("Only a principal or deputy can permanently delete staff accounts.");
    }

    const { data: staff, error: staffError } = await supabaseAdmin
      .from("staff")
      .select("user_id, full_name")
      .eq("id", data.staffId)
      .eq("school_id", data.schoolId)
      .single();

    if (staffError || !staff) throw new Error("The staff member could not be found.");

    const { error: deleteError } = await supabaseAdmin.rpc("delete_staff_account", {
      _school_id: data.schoolId,
      _staff_id: data.staffId,
      _actor_id: context.userId,
    });
    if (deleteError) {
      throw new Error(`The staff account could not be deleted: ${deleteError.message}`);
    }

    if (staff.user_id) {
      const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(staff.user_id);
      if (authError) {
        throw new Error(`Staff record deleted, but login account cleanup failed: ${authError.message}`);
      }
    }

    return { fullName: staff.full_name };
  });

const ResendStaffCredentialsInput = z.object({
  schoolId: z.string().uuid(),
  staffId: z.string().uuid(),
});

export const resendStaffCredentials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => ResendStaffCredentialsInput.parse(input))
  .handler(async ({ data, context }) => {
    // Step 1: Verify admin permissions
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: adminRole, error: adminRoleError } = await context.supabase
      .from("user_roles")
      .select("id")
      .eq("user_id", context.userId)
      .eq("school_id", data.schoolId)
      .eq("is_active", true)
      .in("role", ["principal", "deputy"])
      .maybeSingle();

    if (adminRoleError) {
      throw new Error("Failed to verify administrator permissions. Please try again.");
    }

    if (!adminRole) {
      throw new Error("Only a principal or deputy can resend staff credentials.");
    }

    // Step 2: Fetch staff member
    const { data: staff, error: staffError } = await supabaseAdmin
      .from("staff")
      .select("user_id, email, full_name")
      .eq("id", data.staffId)
      .eq("school_id", data.schoolId)
      .single();

    if (staffError || !staff) {
      throw new Error("The staff member could not be found. They may have been archived.");
    }

    if (!staff.user_id) {
      throw new Error(
        "This staff member does not have a linked login account yet. " +
          "Use the staff creation flow to set up their account.",
      );
    }

    if (!staff.email) {
      throw new Error(
        "This staff member does not have an email address. " +
          "Please add an email address before resending credentials.",
      );
    }

    // Step 3: Generate new temporary password
    const temporaryPassword = generateTemporaryPassword();

    // Step 4: Update auth user password
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(staff.user_id, {
      password: temporaryPassword,
    });

    if (updateError) {
      throw new Error(`Failed to reset password: ${updateError.message}`);
    }

    // Step 5: Update staff record flags
    const { error: updateStaffError } = await supabaseAdmin
      .from("staff")
      .update({
        must_change_password: true,
        account_status: "active",
        credentials_expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
        credentials_sent_at: new Date().toISOString(),
      })
      .eq("id", data.staffId);

    if (updateStaffError) {
      throw new Error("Failed to update staff record. Please try again.");
    }

    const { data: freshStaff } = await supabaseAdmin
      .from("staff")
      .select("full_name, email")
      .eq("id", data.staffId)
      .single();

    return {
      sent: true,
      email: freshStaff?.email ?? undefined,
      staffName: freshStaff?.full_name ?? "Staff member",
      password: temporaryPassword,
    };
  });
