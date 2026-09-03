import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Set a new password · SHANSCOTT CBE" },
      {
        name: "description",
        content: "Choose a new password for your SHANSCOTT CBE school management account.",
      },
      { property: "og:title", content: "Set a new password · SHANSCOTT CBE" },
      {
        property: "og:description",
        content: "Complete your password reset for the SHANSCOTT CBE school management system.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const hash = window.location.hash;
    const isRecovery = hash.includes("type=recovery");
    void supabase.auth.getSession().then(({ data }) => {
      setReady(isRecovery || Boolean(data.session));
    });
  }, []);

  async function submit() {
    if (password.length < 8) {
      setError("Use at least 8 characters for your new password.");
      return;
    }
    if (password !== confirm) {
      setError("The two passwords do not match.");
      return;
    }
    setError(null);
    setSaving(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    const { data: auth } = await supabase.auth.getUser();
    if (!updateError && auth.user) {
      const { error: staffError } = await supabase
        .from("staff")
        .update({ must_change_password: false, account_status: "active" })
        .eq("user_id", auth.user.id);
      if (staffError) {
        toast.error("Password updated, but your staff account status could not be saved.", {
          description: staffError.message,
        });
        setSaving(false);
        return;
      }
    }
    setSaving(false);
    if (updateError) {
      toast.error("Your password could not be updated.", {
        description: "The reset link may have expired. Request a new one from the sign-in page.",
      });
      return;
    }
    toast.success("Password updated successfully. You can now sign in.");
    void router.navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="grid min-h-screen place-items-center bg-secondary/40 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mb-2 grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
            <KeyRound className="size-5" />
          </div>
          <CardTitle>Set a new password</CardTitle>
          <CardDescription>
            {ready
              ? "Choose a strong password you have not used before."
              : "Open this page from the reset link in your email to continue."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="new-password">New password</Label>
            <Input
              id="new-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm-password">Confirm password</Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button className="w-full" onClick={submit} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" /> Updating…
              </>
            ) : (
              "Update password"
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
