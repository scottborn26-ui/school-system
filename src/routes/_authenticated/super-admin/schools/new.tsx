import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/_authenticated/super-admin/schools/new")({
  component: NewSchoolPage,
});
function NewSchoolPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    slug: "",
    county: "",
    curriculum_type: "cbc_cbe",
    plan: "Basic",
    admin_email: "",
  });
  function update(key: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }
  async function createSchool() {
    if (!form.name.trim() || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.slug)) {
      toast.error("Use a school name and a lowercase slug like scott-academy.");
      return;
    }
    setSaving(true);
    try {
      const { data: school, error } = await supabase
        .from("schools")
        .insert({
          name: form.name.trim(),
          slug: form.slug,
          county: form.county || null,
          curriculum_type: form.curriculum_type,
          onboarding_completed: false,
          status: "active",
        })
        .select("id")
        .single();
      if (error) throw error;
      const { data: plan } = await supabase
        .from("subscription_plans")
        .select("id")
        .eq("name", form.plan)
        .maybeSingle();
      if (school && plan)
        await supabase.from("tenant_subscriptions").insert({
          tenant_id: school.id,
          plan_id: plan.id,
          status: "trialing",
          payment_status: "pending",
        });
      toast.success(`${form.name} was added to the platform.`);
      void navigate({ to: "/super-admin/schools/$schoolId", params: { schoolId: school.id } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "School could not be created.");
    } finally {
      setSaving(false);
    }
  }
  const steps = ["School info", "Curriculum", "Plan", "Admin contact"];
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => void navigate({ to: "/super-admin/schools" })}
          aria-label="Back to schools"
        >
          <ArrowLeft />
        </Button>
        <div>
          <p className="text-sm font-medium text-emerald-600">Tenant onboarding</p>
          <h2 className="text-3xl font-semibold tracking-tight">Add a new school</h2>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {steps.map((label, index) => (
          <div
            key={label}
            className={`border-t-2 pt-2 text-xs ${index <= step ? "border-emerald-500 font-semibold text-emerald-700" : "border-slate-200 text-slate-500"}`}
          >
            {index + 1}. {label}
          </div>
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{steps[step]}</CardTitle>
          <CardDescription>
            Configure the tenant before inviting its school administrator.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {step === 0 && (
            <>
              <div className="space-y-2">
                <Label htmlFor="school-name">Official school name</Label>
                <Input
                  id="school-name"
                  value={form.name}
                  onChange={(event) => update("name", event.target.value)}
                  placeholder="Scott Academy"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="school-slug">Subdomain slug</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="school-slug"
                    value={form.slug}
                    onChange={(event) =>
                      update("slug", event.target.value.toLowerCase().replace(/\s+/g, "-"))
                    }
                    placeholder="scott-academy"
                  />
                  <span className="shrink-0 text-sm text-slate-500">.shanscott.com</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="county">County</Label>
                <Input
                  id="county"
                  value={form.county}
                  onChange={(event) => update("county", event.target.value)}
                  placeholder="Nairobi"
                />
              </div>
            </>
          )}
          {step === 1 && (
            <div className="space-y-2">
              <Label>Curriculum type</Label>
              <Select
                value={form.curriculum_type}
                onValueChange={(value) => update("curriculum_type", value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cbc_cbe">CBC / CBE</SelectItem>
                  <SelectItem value="8_4_4">8-4-4</SelectItem>
                  <SelectItem value="igcse">IGCSE</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          {step === 2 && (
            <div className="space-y-2">
              <Label>Subscription plan</Label>
              <Select value={form.plan} onValueChange={(value) => update("plan", value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Basic">Basic</SelectItem>
                  <SelectItem value="Standard">Standard</SelectItem>
                  <SelectItem value="Premium">Premium</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-slate-500">
                The school starts in trial status. You can change plan limits from its detail page.
              </p>
            </div>
          )}
          {step === 3 && (
            <div className="space-y-2">
              <Label htmlFor="admin-email">First school-admin email</Label>
              <Input
                id="admin-email"
                type="email"
                value={form.admin_email}
                onChange={(event) => update("admin_email", event.target.value)}
                placeholder="admin@school.ac.ke"
              />
              <p className="text-sm text-slate-500">
                Account invitation is reserved for the server-side admin function; this contact is
                stored for the next onboarding step.
              </p>
            </div>
          )}
          <div className="flex justify-between border-t pt-5">
            <Button
              variant="outline"
              disabled={step === 0}
              onClick={() => setStep((value) => value - 1)}
            >
              <ArrowLeft /> Back
            </Button>
            {step < steps.length - 1 ? (
              <Button onClick={() => setStep((value) => value + 1)}>
                Continue <ArrowRight />
              </Button>
            ) : (
              <Button onClick={() => void createSchool()} disabled={saving}>
                <CheckCircle2 /> {saving ? "Creating..." : "Create school"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
