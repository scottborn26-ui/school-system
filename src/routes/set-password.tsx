import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/set-password")({
  head: () => ({
    meta: [{ title: "Set your password · SHANSCOTT CBE" }, { name: "robots", content: "noindex" }],
  }),
  component: SetPasswordPage,
});

function SetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) void router.navigate({ to: "/auth", replace: true });
      const { data: staff } = await supabase
        .from("staff")
        .select("credentials_expires_at")
        .eq("user_id", data.user?.id ?? "")
        .maybeSingle();
      if (staff?.credentials_expires_at && new Date(staff.credentials_expires_at) <= new Date()) {
        await supabase.auth.signOut();
        toast.error("Temporary credentials expired.", {
          description: "Ask a school administrator to resend your login details.",
        });
        void router.navigate({ to: "/auth", replace: true });
      }
    });
  }, [router]);

  async function submit() {
    if (password.length < 8) return setError("Use at least 8 characters for your new password.");
    if (password !== confirm) return setError("The two passwords do not match.");
    setError(null);
    setSaving(true);
    const { data: auth } = await supabase.auth.getUser();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (!updateError && auth.user) {
      const { error: staffError } = await supabase
        .from("staff")
        .update({ must_change_password: false, account_status: "active" })
        .eq("user_id", auth.user.id);
      if (staffError) throw staffError;
    }
    setSaving(false);
    if (updateError) {
      toast.error("Your password could not be updated.", { description: updateError.message });
      return;
    }
    toast.success("Password updated successfully.");
    void router.navigate({ to: "/select-role", replace: true });
  }

  return (
    <div className="grid min-h-screen place-items-center bg-secondary/40 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mb-2 grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
            <KeyRound className="size-5" />
          </div>
          <CardTitle>Set your password</CardTitle>
          <CardDescription>
            Choose a new password before continuing to your school workspace.
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
          <Button className="w-full" onClick={() => void submit()} disabled={saving}>
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
