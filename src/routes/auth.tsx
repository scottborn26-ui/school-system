import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  BarChart3,
  BookOpen,
  Check,
  ChevronRight,
  Eye,
  EyeOff,
  LockKeyhole,
  Loader2,
  LogIn,
  Mail,
  Users,
  ShieldCheck,
  UserRound,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): { mode?: "signin" | "register" } =>
    search["mode"] === "register" ? { mode: "register" } : {},
  head: () => ({
    meta: [
      { title: "Sign in · SHANSCOTT CBE School Management" },
      {
        name: "description",
        content: "Sign in to your Kenyan CBE school account or register a new school on SHANSCOTT.",
      },
      { property: "og:title", content: "Sign in · SHANSCOTT CBE School Management" },
      {
        property: "og:description",
        content: "Access admissions, assessment, attendance and fees for your CBE school.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const router = useRouter();
  const { mode } = Route.useSearch();
  const [tab, setTab] = useState(mode === "register" ? "register" : "signin");
  const [busy, setBusy] = useState<"in" | "up" | "reset" | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [selectedRole, setSelectedRole] = useState<"principal" | "staff" | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  type Errors = { email?: string; password?: string; fullName?: string };
  const [fieldErrors, setFieldErrors] = useState<Errors>({});

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) void router.navigate({ to: "/select-role", replace: true });
    });
  }, [router]);

  function validate(withName: boolean) {
    const errors: Errors = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      errors.email = "Enter a valid email address.";
    if (password.length < 8) errors.password = "Password must be at least 8 characters.";
    if (withName && fullName.trim().length < 3) errors.fullName = "Enter your full name.";
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedRole) {
      toast.error("Choose how you want to sign in first.");
      return;
    }
    if (!validate(false)) return;
    setBusy("in");
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setBusy(null);
    if (error) {
      toast.error("Sign in failed.", { description: error.message });
      return;
    }
    if (!data.user) {
      toast.error("Sign in failed.");
      return;
    }
    const { data: roleRows } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id)
      .eq("is_active", true);
    const { data: staff } = await supabase
      .from("staff")
      .select("id, credentials_expires_at")
      .eq("user_id", data.user.id)
      .eq("is_archived", false)
      .eq("status", "active")
      .eq("account_status", "active")
      .maybeSingle();
    const { data: memberships } = await supabase
      .from("user_school_memberships")
      .select("school_id")
      .eq("user_id", data.user.id)
      .eq("is_active", true);
    const authenticatedRole = (roleRows ?? []).find((row) =>
      selectedRole === "principal"
        ? row.role === "principal" && !staff
        : ["admin", "exam_officer", "teacher", "class_teacher"].includes(row.role) && Boolean(staff),
    )?.role;
    if (!authenticatedRole) {
      if (selectedRole === "principal" && !staff && (memberships ?? []).length === 0) {
        toast.success("Continue setting up your school.");
        void router.navigate({ to: "/onboarding", replace: true });
        return;
      }
      await supabase.auth.signOut();
      toast.error("This account is not assigned to the selected role.");
      return;
    }
    if (staff?.credentials_expires_at && new Date(staff.credentials_expires_at) <= new Date()) {
      await supabase.auth.signOut();
      toast.error("Temporary credentials expired.", {
        description: "Ask a school administrator to resend your login details.",
      });
      return;
    }
    if (selectedRole === "principal") {
      window.localStorage.setItem("shanscott.activeRole", authenticatedRole);
    } else {
      window.localStorage.removeItem("shanscott.activeRole");
    }
    toast.success("Signed in successfully.");
    void router.navigate({ to: "/select-role", replace: true });
  }

  async function signUp(e: React.FormEvent) {
    e.preventDefault();
    if (!validate(true)) return;
    setBusy("up");
    const redirectUrl = new URL("/auth", window.location.origin).toString();
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: { full_name: fullName.trim() },
      },
    });
    setBusy(null);

    const createdUser = Boolean(data?.user);
    const confirmationEmailIssue =
      !!error &&
      /confirmation email|send.*email|email provider|testing emails|not configured/i.test(
        error.message,
      );

    if (error && !confirmationEmailIssue && !createdUser) {
      toast.error("Registration failed.", { description: error.message });
      return;
    }

    if (!data.session) {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) {
        toast.success("Account created.", {
          description: confirmationEmailIssue
            ? "Your account was created, but the confirmation email could not be sent automatically. Please contact your administrator or try again later."
            : "Check your email to confirm your address, then sign in.",
        });
        return;
      }
    }

    const { data: currentUser } = await supabase.auth.getUser();
    const { data: memberships } = await supabase
      .from("user_school_memberships")
      .select("school_id")
      .eq("user_id", currentUser.user?.id ?? "")
      .eq("is_active", true);
    toast.success(
      confirmationEmailIssue ? "Account created successfully." : "Account created successfully.",
    );
    void router.navigate({
      to: memberships && memberships.length > 0 ? "/select-role" : "/onboarding",
      replace: true,
    });
  }

  async function resetPassword() {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setFieldErrors({ email: "Enter your email address first." });
      return;
    }
    setBusy("reset");
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(null);
    if (error) {
      toast.error("Could not send the reset link.", {
        description: "Please try again in a moment.",
      });
      return;
    }
    toast.success("Password reset link sent successfully.", {
      description: "The link expires in 1 hour.",
    });
  }

  return (
    <div className="auth-page min-h-screen p-3 sm:p-6 lg:p-8">
      <div className="auth-shell mx-auto grid min-h-[calc(100vh-1.5rem)] w-full max-w-[1440px] overflow-hidden rounded-[24px] shadow-2xl sm:min-h-[calc(100vh-3rem)] lg:grid-cols-[1.1fr_.9fr]">
        <section className="auth-hero flex min-h-[560px] flex-col p-7 text-white sm:p-10 lg:p-14">
          <Link to="/" className="auth-hero-brand flex items-center gap-3">
            <span className="auth-shield-logo">
              <BookOpen className="size-6" />
              <span>★</span>
            </span>
            <span>
              <strong className="block text-2xl tracking-tight">
                S<span>M</span>S
              </strong>
              <small>School Management System</small>
            </span>
          </Link>
          <div className="auth-hero-copy mt-auto max-w-[600px]">
            <p className="auth-kicker">SMARTER SCHOOLS START HERE</p>
            <h1>
              Welcome to
              <br />
              <span>School Management System</span>
            </h1>
            <p className="auth-hero-description">
              A secure, simple, and smart platform that brings your whole school community together.
            </p>
            <div className="auth-features">
              <Feature
                icon={ShieldCheck}
                title="Secure & Reliable"
                description="Data safety, advanced security & backup"
                tone="light"
              />
              <Feature
                icon={BarChart3}
                title="Powerful Reports"
                description="Real-time insights, better decisions"
                tone="blue"
              />
              <Feature
                icon={Users}
                title="User Friendly"
                description="Easy for everyone in the school community"
                tone="green"
              />
            </div>
          </div>
          <div className="auth-hero-footer">
            <LockKeyhole className="size-3.5" /> Secure Login <i /> © 2024 School Management System.
            All rights reserved.
          </div>
        </section>

        <section className="auth-main flex items-center justify-center bg-[#f8fafc] p-5 sm:p-10">
          <div className="auth-shell w-full max-w-[460px]">
            <div className="mb-8 flex items-center justify-between">
              <Button asChild variant="ghost" className="auth-back px-0 hover:bg-transparent">
                <Link to="/">
                  <ArrowLeft className="mr-2 size-4" /> Back
                </Link>
              </Button>
              <button
                className="auth-register-link"
                type="button"
                onClick={() => setTab("register")}
              >
                Register school <ChevronRight className="size-4" />
              </button>
            </div>
            <Card className="auth-card">
              <CardHeader className="auth-card-header text-center">
                <div className="auth-lock-badge">
                  <LockKeyhole className="size-6" />
                </div>
                <CardTitle className="auth-title">Login to Your Account</CardTitle>
                <CardDescription>Choose your role to continue</CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs value={tab} onValueChange={setTab}>
                  <TabsList className="auth-tabs mb-6 grid w-full grid-cols-2">
                    <TabsTrigger value="signin" className="auth-tab">
                      Sign in
                    </TabsTrigger>
                    <TabsTrigger value="register" className="auth-tab">
                      <UserPlus className="mr-2 size-4" /> Register
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="signin">
                    {!selectedRole ? (
                      <div className="space-y-3">
                        <p className="text-sm text-muted-foreground">
                          Choose your role before entering your login details.
                        </p>
                        <RoleChoice
                          icon={UserRound}
                          title="Headteacher / Principal"
                          description="Login to access school overview, manage staff, students, academics and reports."
                          theme="blue"
                          selected={selectedRole === "principal"}
                          onClick={() => setSelectedRole("principal")}
                        />
                        <RoleChoice
                          icon={Users}
                          title="Staff"
                          description="Login to manage your tasks, classes, students and school activities."
                          theme="green"
                          selected={selectedRole === "staff"}
                          onClick={() => setSelectedRole("staff")}
                        />
                        <RoleChoice
                          icon={UserRound}
                          title="Other Roles"
                          description="Login as parent or student to view information and updates."
                          theme="purple"
                          selected={false}
                          onClick={() => toast.info("Parent and student access is coming soon.")}
                        />
                      </div>
                    ) : (
                      <form onSubmit={signIn} className="space-y-4">
                        <button
                          type="button"
                          className="flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                          onClick={() => setSelectedRole(null)}
                        >
                          <ArrowLeft className="size-4" /> Change role
                        </button>
                        <div className="rounded-lg border border-primary/15 bg-primary/5 px-3 py-2 text-sm font-medium">
                          Signing in as{" "}
                          {selectedRole === "principal" ? "Headteacher / Principal" : "Staff"}
                        </div>
                        <Field id="email" label="Email address" error={fieldErrors.email}>
                          <Input
                            id="email"
                            type="email"
                            autoComplete="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@school.ac.ke"
                          />
                        </Field>
                        <Field id="password" label="Password" error={fieldErrors.password}>
                          <div className="auth-password-wrap">
                            <Input
                              id="password"
                              type={showPassword ? "text" : "password"}
                              autoComplete="current-password"
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              aria-invalid={Boolean(fieldErrors.password)}
                            />
                            <button
                              type="button"
                              className="auth-password-toggle"
                              aria-label={showPassword ? "Hide password" : "Show password"}
                              onClick={() => setShowPassword(!showPassword)}
                            >
                              {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                            </button>
                          </div>
                        </Field>
                        <Button type="submit" className="w-full" disabled={busy !== null}>
                          {busy === "in" ? (
                            <>
                              <Loader2 className="mr-2 size-4 animate-spin" /> Signing in…
                            </>
                          ) : (
                            <>
                              <LogIn className="mr-2 size-4" /> Sign in
                            </>
                          )}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          className="w-full"
                          onClick={resetPassword}
                          disabled={busy !== null}
                        >
                          {busy === "reset" ? (
                            <>
                              <Loader2 className="mr-2 size-4 animate-spin" /> Sending…
                            </>
                          ) : (
                            <>
                              <Mail className="mr-2 size-4" /> Forgot password?
                            </>
                          )}
                        </Button>
                      </form>
                    )}
                  </TabsContent>

                  <TabsContent value="register">
                    <form onSubmit={signUp} className="space-y-4">
                      <Field id="fullName" label="Your full name" error={fieldErrors.fullName}>
                        <Input
                          id="fullName"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          placeholder="e.g. Jane Wanjiku"
                        />
                      </Field>
                      <Field id="remail" label="Official email address" error={fieldErrors.email}>
                        <Input
                          id="remail"
                          type="email"
                          autoComplete="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="principal@school.ac.ke"
                        />
                      </Field>
                      <Field id="rpassword" label="Create password" error={fieldErrors.password}>
                        <div className="auth-password-wrap">
                          <Input
                            id="rpassword"
                            type={showPassword ? "text" : "password"}
                            autoComplete="new-password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            aria-invalid={Boolean(fieldErrors.password)}
                          />
                          <button
                            type="button"
                            className="auth-password-toggle"
                            aria-label={showPassword ? "Hide password" : "Show password"}
                            onClick={() => setShowPassword(!showPassword)}
                          >
                            {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                          </button>
                        </div>
                        <p className="auth-password-hint">Use at least 8 characters.</p>
                      </Field>
                      <Button type="submit" className="w-full" disabled={busy !== null}>
                        {busy === "up" ? (
                          <>
                            <Loader2 className="mr-2 size-4 animate-spin" /> Creating account…
                          </>
                        ) : (
                          <>
                            <UserPlus className="mr-2 size-4" /> Create account
                          </>
                        )}
                      </Button>
                      <p className="text-xs text-muted-foreground">
                        After registering you will complete the guided school onboarding wizard.
                      </p>
                    </form>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
            <p className="auth-help">
              Need help? <a href="mailto:admin@shanscott.com">Contact System Administrator</a>
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

function Feature({
  icon: Icon,
  title,
  description,
  tone,
}: {
  icon: typeof ShieldCheck;
  title: string;
  description: string;
  tone: string;
}) {
  return (
    <div className="auth-feature">
      <span className={`auth-feature-icon ${tone}`}>
        <Icon className="size-5" />
      </span>
      <span>
        <strong>{title}</strong>
        <small>{description}</small>
      </span>
    </div>
  );
}

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string | undefined;
  children: React.ReactNode;
}) {
  return (
    <div className={`auth-field space-y-1.5 ${error ? "auth-field-error" : ""}`}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function RoleChoice({
  icon: Icon,
  title,
  description,
  theme,
  selected,
  onClick,
}: {
  icon: typeof ShieldCheck;
  title: string;
  description: string;
  theme: "blue" | "green" | "purple";
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`auth-role-choice auth-role-${theme} group w-full rounded-xl border bg-card p-4 text-left transition-all ${selected ? "auth-role-selected" : "border-border"}`}
    >
      <span className="flex items-start gap-3">
        <span className="auth-role-icon grid size-11 shrink-0 place-items-center rounded-full transition-colors">
          <Icon className="size-5" />
        </span>
        <span>
          <span className="block font-semibold">{title}</span>
          <span className="mt-1 block text-sm leading-5 text-muted-foreground">{description}</span>
          <span className="mt-3 flex items-center gap-2 text-sm font-semibold text-primary">
            Continue as {title}
            {selected && <Check className="size-4" />}
          </span>
        </span>
      </span>
    </button>
  );
}
