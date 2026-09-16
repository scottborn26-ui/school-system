import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Database,
  Layers3,
  Plug,
  Plus,
  RefreshCw,
  Settings2,
  ToggleRight,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  MetricStrip,
  PlatformPage,
  StatusBadge,
  fetchPlatformRows,
} from "@/components/platform-page";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/_authenticated/super-admin/settings")({
  component: PlatformSettingsPage,
});
type Settings = {
  id: boolean;
  platform_name: string;
  support_email: string;
  default_currency: string;
  default_timezone: string;
  default_trial_length_days: number;
  default_plan: string;
  maintenance_enabled: boolean;
  maintenance_message: string;
  updated_at: string;
};
type Module = {
  id: string;
  name: string;
  description: string;
  default_enabled: boolean;
  status: string;
  deleted_at: string | null;
};
type Assignment = { tenant_id: string; module_id: string; enabled: boolean };
type Policy = {
  id: string;
  name: string;
  applies_to: string;
  max_storage_gb: number;
  max_upload_size_mb: number;
  retention_days: number;
  overflow_action: string;
};
type Config = { tenant_id: string; config_key: string; config_value: unknown };
type Integration = { provider: string; status: string; last_verified_at: string | null };
type Mutation = {
  insert: (value: unknown) => Promise<{ error: Error | null }>;
  upsert: (value: unknown) => Promise<{ error: Error | null }>;
  update: (value: unknown) => Mutation;
  delete: () => Mutation;
  eq: (key: string, value: unknown) => Mutation;
};
const mutation = (table: string) => supabase.from(table as never) as unknown as Mutation;
const providerNames: Record<string, string> = {
  mpesa: "M-Pesa",
  stripe_bank: "Stripe / bank",
  email: "Email",
  sms: "SMS",
};

async function loadData() {
  const [settings, modules, assignments, policies, configurations, integrations] =
    await Promise.all([
      fetchPlatformRows<Settings>("platform_settings"),
      fetchPlatformRows<Module>("modules", "id,name,description,default_enabled,status,deleted_at"),
      fetchPlatformRows<Assignment>("tenant_module_settings", "tenant_id,module_id,enabled"),
      fetchPlatformRows<Policy>("storage_policies"),
      fetchPlatformRows<Config>("tenant_configurations"),
      fetchPlatformRows<Integration>("integration_settings", "provider,status,last_verified_at"),
    ]);
  return {
    settings: settings[0] ?? null,
    modules,
    assignments,
    policies,
    configurations,
    integrations,
  };
}

function PlatformSettingsPage() {
  const client = useQueryClient();
  const query = useQuery({ queryKey: ["platform-config-workspace"], queryFn: loadData });
  const [moduleName, setModuleName] = useState("");
  const [moduleDescription, setModuleDescription] = useState("");
  const [policy, setPolicy] = useState({
    name: "",
    applies_to: "all",
    max_storage_gb: "10",
    max_upload_size_mb: "100",
    retention_days: "365",
    overflow_action: "block",
  });
  const [config, setConfig] = useState({
    tenant_id: "",
    config_key: "custom_trial_length",
    config_value: "",
  });
  const data = query.data;
  const refresh = () => void client.invalidateQueries({ queryKey: ["platform-config-workspace"] });
  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!data?.settings) return;
    const result = await mutation("platform_settings").upsert({
      ...data.settings,
      id: true,
      updated_at: new Date().toISOString(),
    });
    if (result.error) toast.error(result.error.message);
    else {
      toast.success("Platform settings saved.");
      refresh();
    }
  };
  const addModule = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!moduleName.trim()) return;
    const result = await mutation("modules").insert({
      name: moduleName.trim(),
      description: moduleDescription,
      status: "active",
      default_enabled: false,
    });
    if (result.error) toast.error(result.error.message);
    else {
      toast.success("Module created.");
      setModuleName("");
      setModuleDescription("");
      refresh();
    }
  };
  const addPolicy = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = await mutation("storage_policies").insert({
      ...policy,
      max_storage_gb: Number(policy.max_storage_gb),
      max_upload_size_mb: Number(policy.max_upload_size_mb),
      retention_days: Number(policy.retention_days),
    });
    if (result.error) toast.error(result.error.message);
    else {
      toast.success("Storage policy created.");
      setPolicy({ ...policy, name: "" });
      refresh();
    }
  };
  const addConfig = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!config.tenant_id || !config.config_value) return;
    const result = await mutation("tenant_configurations").upsert({
      ...config,
      config_value: config.config_value,
      updated_at: new Date().toISOString(),
    });
    if (result.error) toast.error(result.error.message);
    else {
      toast.success("Tenant override saved.");
      setConfig({ ...config, config_value: "" });
      refresh();
    }
  };
  const remove = async (table: string, key: string, value: string, label: string) => {
    if (!window.confirm(`Delete this ${label}?`)) return;
    const result = await mutation(table).delete().eq(key, value);
    if (result.error) toast.error(result.error.message);
    else {
      toast.success(`${label} deleted.`);
      refresh();
    }
  };

  if (query.isLoading)
    return (
      <PlatformPage
        eyebrow="Observability & system"
        title="Platform config"
        description="Loading platform configuration."
      >
        <Loading />
      </PlatformPage>
    );
  if (query.error || !data?.settings)
    return (
      <PlatformPage
        eyebrow="Observability & system"
        title="Platform config"
        description="The platform configuration could not be loaded."
      >
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <p className="font-semibold text-rose-600">Settings could not be loaded.</p>
            <p className="max-w-lg text-sm text-muted-foreground">
              {query.error instanceof Error
                ? query.error.message
                : "Apply the latest Supabase migration to seed platform settings."}
            </p>
            <Button variant="outline" onClick={() => void query.refetch()}>
              <RefreshCw className="mr-2 size-4" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </PlatformPage>
    );
  const settings = data.settings;
  const activeModules = data.modules.filter((item) => !item.deleted_at);
  return (
    <PlatformPage
      eyebrow="Observability & system"
      title="Platform config"
      description="Manage defaults, module adoption, storage rules, tenant overrides, and integrations."
      action={
        <Button
          onClick={() =>
            void save({ preventDefault: () => undefined } as React.FormEvent<HTMLFormElement>)
          }
        >
          <Settings2 className="mr-2 size-4" />
          Save changes
        </Button>
      }
    >
      {settings.maintenance_enabled && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <strong>Maintenance mode is active.</strong>{" "}
          {settings.maintenance_message || "School admins will see the maintenance banner."}
        </div>
      )}
      <MetricStrip
        items={[
          {
            label: "Tenant settings",
            value: new Set(data.configurations.map((item) => item.tenant_id)).size,
            icon: Settings2,
            detail: "tenants with overrides",
          },
          {
            label: "Enabled modules",
            value: data.assignments.filter((item) => item.enabled).length,
            icon: ToggleRight,
            tone: "blue",
            detail: "tenant assignments",
          },
          { label: "Module records", value: data.assignments.length, icon: Layers3 },
          { label: "Storage policies", value: data.policies.length, icon: Database, tone: "amber" },
        ]}
      />
      <Tabs defaultValue="general" className="space-y-4">
        <TabsList className="flex h-auto flex-wrap justify-start gap-1">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="modules">Modules</TabsTrigger>
          <TabsTrigger value="storage">Storage policies</TabsTrigger>
          <TabsTrigger value="tenants">Tenant overrides</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
        </TabsList>
        <TabsContent value="general" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>General platform settings</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={save} className="grid gap-4 md:grid-cols-2">
                <Field label="Platform name">
                  <Input
                    value={settings.platform_name}
                    onChange={(event) => {
                      settings.platform_name = event.target.value;
                    }}
                  />
                </Field>
                <Field label="Support email">
                  <Input
                    type="email"
                    value={settings.support_email}
                    onChange={(event) => {
                      settings.support_email = event.target.value;
                    }}
                  />
                </Field>
                <Field label="Default currency">
                  <Input
                    value={settings.default_currency}
                    onChange={(event) => {
                      settings.default_currency = event.target.value.toUpperCase();
                    }}
                  />
                </Field>
                <Field label="Default timezone">
                  <Input
                    value={settings.default_timezone}
                    onChange={(event) => {
                      settings.default_timezone = event.target.value;
                    }}
                  />
                </Field>
                <Field label="Trial length (days)">
                  <Input
                    type="number"
                    min="0"
                    value={settings.default_trial_length_days}
                    onChange={(event) => {
                      settings.default_trial_length_days = Number(event.target.value);
                    }}
                  />
                </Field>
                <Field label="Default plan">
                  <Input
                    value={settings.default_plan}
                    onChange={(event) => {
                      settings.default_plan = event.target.value;
                    }}
                  />
                </Field>
                <Button type="submit" className="md:col-span-2 md:justify-self-end">
                  Save general settings
                </Button>
              </form>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Maintenance mode</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Show maintenance banner</p>
                  <p className="text-sm text-muted-foreground">
                    Inform school admins while the platform is unavailable.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.maintenance_enabled}
                  onChange={(event) => {
                    settings.maintenance_enabled = event.target.checked;
                    void save({
                      preventDefault: () => undefined,
                    } as React.FormEvent<HTMLFormElement>);
                  }}
                />
              </div>
              <Field label="Maintenance message">
                <Textarea
                  value={settings.maintenance_message}
                  onChange={(event) => {
                    settings.maintenance_message = event.target.value;
                  }}
                />
              </Field>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="modules">
          <Card>
            <CardHeader>
              <CardTitle>Module catalog</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <form
                onSubmit={addModule}
                className="grid gap-3 rounded-xl border p-4 md:grid-cols-3"
              >
                <Input
                  placeholder="Module name"
                  value={moduleName}
                  onChange={(event) => setModuleName(event.target.value)}
                />
                <Input
                  placeholder="Description"
                  value={moduleDescription}
                  onChange={(event) => setModuleDescription(event.target.value)}
                />
                <Button type="submit">
                  <Plus className="mr-2 size-4" />
                  Add module
                </Button>
              </form>
              <div className="divide-y">
                {activeModules.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-3 py-4">
                    <div>
                      <p className="font-semibold">{item.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {item.description || "No description"}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusBadge value={item.status} />
                      <span className="text-xs text-muted-foreground">
                        {
                          data.assignments.filter((row) => row.module_id === item.id && row.enabled)
                            .length
                        }{" "}
                        enabled
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => void remove("modules", "id", item.id, "module")}
                      >
                        <Trash2 className="size-4 text-rose-600" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="storage">
          <Card>
            <CardHeader>
              <CardTitle>Storage policies</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <form
                onSubmit={addPolicy}
                className="grid gap-3 rounded-xl border p-4 md:grid-cols-3"
              >
                <Input
                  placeholder="Policy name"
                  value={policy.name}
                  onChange={(event) => setPolicy({ ...policy, name: event.target.value })}
                />
                <Select
                  value={policy.applies_to}
                  onValueChange={(value) => setPolicy({ ...policy, applies_to: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All tenants</SelectItem>
                    <SelectItem value="plan_tier">Plan tier</SelectItem>
                    <SelectItem value="specific_tenant">Specific tenant</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  min="1"
                  placeholder="Storage GB"
                  value={policy.max_storage_gb}
                  onChange={(event) => setPolicy({ ...policy, max_storage_gb: event.target.value })}
                />
                <Input
                  type="number"
                  min="1"
                  placeholder="Upload MB"
                  value={policy.max_upload_size_mb}
                  onChange={(event) =>
                    setPolicy({ ...policy, max_upload_size_mb: event.target.value })
                  }
                />
                <Input
                  type="number"
                  min="0"
                  placeholder="Retention days"
                  value={policy.retention_days}
                  onChange={(event) => setPolicy({ ...policy, retention_days: event.target.value })}
                />
                <Button type="submit">
                  <Plus className="mr-2 size-4" />
                  Create policy
                </Button>
              </form>
              {data.policies.length ? (
                data.policies.map((item) => (
                  <div key={item.id} className="flex items-center justify-between border-b py-4">
                    <div>
                      <p className="font-semibold">{item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.applies_to} · {item.max_storage_gb} GB · {item.max_upload_size_mb} MB
                        · {item.retention_days} days
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        void remove("storage_policies", "id", item.id, "storage policy")
                      }
                    >
                      <Trash2 className="size-4 text-rose-600" />
                    </Button>
                  </div>
                ))
              ) : (
                <Empty text="No storage policies yet. Create your first one above." />
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="tenants">
          <Card>
            <CardHeader>
              <CardTitle>Tenant configuration overrides</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <form
                onSubmit={addConfig}
                className="grid gap-3 rounded-xl border p-4 md:grid-cols-4"
              >
                <Input
                  placeholder="Tenant ID"
                  value={config.tenant_id}
                  onChange={(event) => setConfig({ ...config, tenant_id: event.target.value })}
                />
                <Select
                  value={config.config_key}
                  onValueChange={(value) => setConfig({ ...config, config_key: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="custom_trial_length">Custom trial length</SelectItem>
                    <SelectItem value="custom_storage_limit">Custom storage limit</SelectItem>
                    <SelectItem value="feature_override">Feature override</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Value"
                  value={config.config_value}
                  onChange={(event) => setConfig({ ...config, config_value: event.target.value })}
                />
                <Button type="submit">
                  <Plus className="mr-2 size-4" />
                  Save override
                </Button>
              </form>
              {data.configurations.length ? (
                data.configurations.map((item) => (
                  <div
                    key={`${item.tenant_id}-${item.config_key}`}
                    className="flex items-center justify-between border-b py-4"
                  >
                    <div>
                      <p className="font-mono text-xs">{item.tenant_id}</p>
                      <p className="text-sm">
                        {item.config_key}: {String(item.config_value)}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        void remove(
                          "tenant_configurations",
                          "tenant_id",
                          item.tenant_id,
                          "tenant configuration",
                        )
                      }
                    >
                      <Trash2 className="size-4 text-rose-600" />
                    </Button>
                  </div>
                ))
              ) : (
                <Empty text="No tenant overrides yet. Create the first one above." />
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="integrations">
          <div className="grid gap-4 md:grid-cols-2">
            {data.integrations.map((item) => (
              <Card key={item.provider}>
                <CardContent className="flex items-center justify-between gap-4 p-5">
                  <div className="flex items-center gap-3">
                    <div className="grid size-10 place-items-center rounded-xl bg-emerald-100 text-emerald-700">
                      <Plug className="size-5" />
                    </div>
                    <div>
                      <p className="font-semibold">
                        {providerNames[item.provider] ?? item.provider}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {item.last_verified_at
                          ? `Verified ${new Date(item.last_verified_at).toLocaleString()}`
                          : "Not verified yet"}
                      </p>
                    </div>
                  </div>
                  <StatusBadge value={item.status} />
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </PlatformPage>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}
function Loading() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }, (_, index) => (
        <Card key={index}>
          <CardContent className="space-y-3 p-5">
            <Skeleton className="h-10 w-10 rounded-xl" />
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-8 w-16" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
