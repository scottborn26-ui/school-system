import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { CheckCircle2, KeyRound, Lock, Mail, Phone, Shield, User, UserRound } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app-shell";
import { PhotoUploader } from "@/components/photo-uploader";
import { RequireSchool } from "@/components/require-school";
import { useTheme } from "@/components/use-theme";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { ROLE_LABELS, useSchool } from "@/hooks/use-school";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "My Profile · SHANSCOTT CBE" },
      {
        name: "description",
        content: "Manage your personal profile, credentials and account security settings.",
      },
    ],
  }),
  component: () => (
    <RequireSchool>
      <ProfilePage />
    </RequireSchool>
  ),
});

export function ProfilePage() {
  const school = useSchool();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();

  const [form, setForm] = useState({ fullName: "", email: "", phone: "", avatarUrl: "" });
  const [passwords, setPasswords] = useState({ current: "", next: "", confirm: "" });
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const profile = useQuery({
    queryKey: ["my-profile", school.userId],
    enabled: Boolean(school.userId),
    queryFn: async () => {
      const [{ data, error }, { data: user }] = await Promise.all([
        supabase
          .from("profiles")
          .select("full_name, email, phone, avatar_url, created_at")
          .eq("id", school.userId!)
          .single(),
        supabase.auth.getUser(),
      ]);
      if (error) throw error;
      return { ...data, lastLogin: user.user?.last_sign_in_at ?? null };
    },
  });

  const staff = useQuery({
    queryKey: ["my-staff-profile", school.userId, school.schoolId],
    enabled: Boolean(school.userId && school.schoolId),
    queryFn: async () => {
      const { data } = await supabase
        .from("staff")
        .select("job_title")
        .eq("user_id", school.userId!)
        .eq("school_id", school.schoolId!)
        .maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (profile.data) {
      setForm({
        fullName: profile.data.full_name ?? "",
        email: profile.data.email ?? "",
        phone: profile.data.phone ?? "",
        avatarUrl: profile.data.avatar_url ?? "",
      });
    }
  }, [profile.data]);

  const save = useMutation({
    mutationFn: async () => {
      if (!form.fullName.trim()) throw new Error("Full name is required.");
      if (!form.email.trim()) throw new Error("Email address is required.");
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(form.email.trim()))
        throw new Error("Please enter a valid email address.");

      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: form.fullName.trim(),
          email: form.email.trim(),
          phone: form.phone.trim() || null,
          avatar_url: form.avatarUrl || null,
        })
        .eq("id", school.userId!);
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["my-profile"] });
      await queryClient.invalidateQueries({ queryKey: ["school-context"] });
      toast.success("Profile changes saved successfully.");
    },
    onError: (error: Error) => toast.error(error.message || "Failed to update profile."),
  });

  async function changePassword() {
    if (!passwords.current) {
      return toast.error("Enter your current password.");
    }
    if (!passwords.next || passwords.next.length < 8) {
      return toast.error("New password must be at least 8 characters long.");
    }
    if (passwords.next !== passwords.confirm) {
      return toast.error("New passwords do not match.");
    }
    setIsChangingPassword(true);
    try {
      if (!school.email) throw new Error("No account email is available for verification.");
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: school.email,
        password: passwords.current,
      });
      if (signInError) throw new Error("Current password is incorrect.");
      const { error } = await supabase.auth.updateUser({ password: passwords.next });
      if (error) throw error;
      setPasswords({ current: "", next: "", confirm: "" });
      toast.success("Password changed successfully.");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not update password.");
    } finally {
      setIsChangingPassword(false);
    }
  }

  function handleCancel() {
    if (profile.data) {
      setForm({
        fullName: profile.data.full_name ?? "",
        email: profile.data.email ?? "",
        phone: profile.data.phone ?? "",
        avatarUrl: profile.data.avatar_url ?? "",
      });
    }
    void navigate({ to: "/dashboard" });
  }

  if (profile.isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
          <Skeleton className="h-80 rounded-xl" />
          <div className="space-y-6">
            <Skeleton className="h-64 rounded-xl" />
            <Skeleton className="h-48 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  const roleLabel =
    staff.data?.job_title ?? (school.activeRole ? ROLE_LABELS[school.activeRole] : "Staff Member");

  return (
    <div className="mx-auto max-w-[1280px] space-y-6 pb-8">
      <PageHeader
        title="My Profile"
        description="Manage your account identity, contact details and security preferences."
        icon={UserRound}
      />

      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        {/* Left Column: Avatar & Summary Card */}
        <Card className="h-fit rounded-xl border border-border/70 bg-card shadow-sm transition-all duration-200 hover:shadow-md">
          <CardContent className="flex flex-col items-center gap-4 pt-6 text-center">
            <PhotoUploader
              value={form.avatarUrl}
              name={form.fullName || school.fullName}
              size="lg"
              onChange={(avatarUrl) =>
                setForm((current) => ({ ...current, avatarUrl: avatarUrl ?? "" }))
              }
            />

            <div>
              <h2 className="text-lg font-bold tracking-tight text-foreground">
                {form.fullName || school.fullName || "User Account"}
              </h2>
              <div className="mt-1 flex items-center justify-center gap-1.5">
                <Badge variant="secondary" className="font-semibold text-xs">
                  {roleLabel}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {school.school?.name ?? "School Workspace"}
              </p>
            </div>

            <div className="w-full space-y-2.5 border-t border-border/60 pt-4 text-left text-xs">
              <div className="flex justify-between items-center text-muted-foreground">
                <span>Account role:</span>
                <span className="font-medium text-foreground capitalize">
                  {school.activeRole?.replace(/_/g, " ") ?? "Staff"}
                </span>
              </div>
              <div className="flex justify-between items-center text-muted-foreground">
                <span>Last login:</span>
                <span className="font-medium text-foreground">
                  {profile.data?.lastLogin
                    ? new Date(profile.data.lastLogin).toLocaleDateString("en-KE", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })
                    : "Active now"}
                </span>
              </div>
              <div className="flex justify-between items-center text-muted-foreground">
                <span>Account created:</span>
                <span className="font-medium text-foreground">
                  {profile.data?.created_at
                    ? new Date(profile.data.created_at).toLocaleDateString("en-KE", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })
                    : "—"}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Right Column: Profile Edit & Password Cards */}
        <div className="space-y-6">
          {/* Personal Details Form */}
          <Card className="rounded-xl border border-border/70 bg-card shadow-sm transition-all duration-200 hover:shadow-md">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold tracking-tight">
                Personal Details
              </CardTitle>
              <CardDescription>
                These details identify you across registers, audit logs and report approvals.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="fullName" className="text-xs font-semibold">
                    Full Name <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <User className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="fullName"
                      value={form.fullName}
                      onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                      placeholder="e.g. Scott Bornface Oduor"
                      className="pl-9 rounded-lg"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs font-semibold">
                    Email Address <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      placeholder="user@school.ac.ke"
                      className="pl-9 rounded-lg"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="phone" className="text-xs font-semibold">
                    Phone Number
                  </Label>
                  <div className="relative">
                    <Phone className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="phone"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      placeholder="0712 345 678"
                      className="pl-9 rounded-lg"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="role" className="text-xs font-semibold">
                    Primary Role
                  </Label>
                  <div className="relative">
                    <Shield className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="role"
                      value={roleLabel}
                      disabled
                      className="pl-9 rounded-lg bg-muted/40 cursor-not-allowed font-medium"
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-border/50">
                <Button
                  onClick={() => save.mutate()}
                  disabled={save.isPending}
                  className="rounded-lg bg-primary text-primary-foreground shadow-sm transition-all hover:shadow-md"
                >
                  {save.isPending ? "Saving changes…" : "Save Changes"}
                </Button>
                <Button variant="outline" onClick={handleCancel} className="rounded-lg">
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-xl border border-border/70 bg-card shadow-sm transition-all duration-200 hover:shadow-md">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg font-semibold tracking-tight">
                <Shield className="size-5 text-primary" />
                Appearance
              </CardTitle>
              <CardDescription>
                Choose how the platform looks across your sessions and device preferences.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <RadioGroup
                value={theme}
                onValueChange={(value) => setTheme(value as "light" | "dark" | "system")}
                className="space-y-3"
              >
                {[
                  { value: "light", label: "Light" },
                  { value: "dark", label: "Dark" },
                  { value: "system", label: "System" },
                ].map((option) => (
                  <label
                    key={option.value}
                    className="flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-background/40 px-3 py-2 text-sm font-medium text-foreground"
                  >
                    <RadioGroupItem value={option.value} id={option.value} />
                    <span>{option.label}</span>
                  </label>
                ))}
              </RadioGroup>
            </CardContent>
          </Card>

          {/* Change Password Card */}
          <Card className="rounded-xl border border-border/70 bg-card shadow-sm transition-all duration-200 hover:shadow-md">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg font-semibold tracking-tight">
                <KeyRound className="size-5 text-primary" />
                Change Password
              </CardTitle>
              <CardDescription>
                Ensure your account is using a long, random password to stay secure.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="currentPass" className="text-xs font-semibold">
                    Current Password
                  </Label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="currentPass"
                      type="password"
                      value={passwords.current}
                      onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
                      placeholder="••••••••"
                      className="pl-9 rounded-lg"
                    />
                  </div>
                </div>

                <div className="hidden sm:block" />

                <div className="space-y-1.5">
                  <Label htmlFor="newPass" className="text-xs font-semibold">
                    New Password (min. 8 characters)
                  </Label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="newPass"
                      type="password"
                      value={passwords.next}
                      onChange={(e) => setPasswords({ ...passwords, next: e.target.value })}
                      placeholder="••••••••"
                      className="pl-9 rounded-lg"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="confirmPass" className="text-xs font-semibold">
                    Confirm New Password
                  </Label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="confirmPass"
                      type="password"
                      value={passwords.confirm}
                      onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                      placeholder="••••••••"
                      className="pl-9 rounded-lg"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-border/50">
                <Button
                  variant="outline"
                  onClick={() => void changePassword()}
                  disabled={isChangingPassword || !passwords.next}
                  className="rounded-lg font-medium"
                >
                  {isChangingPassword ? "Updating password…" : "Update Password"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
