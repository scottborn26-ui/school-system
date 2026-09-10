import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import {
  CheckCircle2,
  CircleAlert,
  Landmark,
  Link2,
  Loader2,
  RefreshCw,
  Smartphone,
  Unlink2,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app-shell";
import { RequireSchool } from "@/components/require-school";
import { Badge } from "@/components/ui/badge";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSchool } from "@/hooks/use-school";
import { supabase } from "@/lib/supabase";
import { savePaymentConfig, testPaymentConfig } from "@/lib/payment-integration.functions";

export const Route = createFileRoute("/_authenticated/finance-payment-settings")({
  component: () => (
    <RequireSchool roles={["admin", "accountant", "principal", "deputy", "super_admin"]}>
      <PaymentSettingsPage />
    </RequireSchool>
  ),
});

type Provider = "mpesa" | "bank_jenga";
type Config = {
  id: string;
  provider: Provider;
  environment: "sandbox" | "live";
  shortcode: string | null;
  account_number: string | null;
  callback_base_url: string;
  account_reference_format: string;
  is_active: boolean;
  last_error: string | null;
  last_verified_at: string | null;
};
type TransactionRow = {
  id: string;
  account_reference: string | null;
  provider: string;
  amount: number | string;
  status: string;
  matched_invoice_id: string | null;
  created_at: string;
};
type LearnerRow = { id: string; admission_number: string; first_name: string; last_name: string };
type AuditEntry = { id: string; action: string; created_at: string };
type FormState = {
  environment: "sandbox" | "live";
  consumerKey: string;
  consumerSecret: string;
  passkey: string;
  shortcode: string;
  apiKey: string;
  apiSecret: string;
  accountNumber: string;
  accountReferenceFormat: string;
};
const emptyForm: FormState = {
  environment: "sandbox",
  consumerKey: "",
  consumerSecret: "",
  passkey: "",
  shortcode: "",
  apiKey: "",
  apiSecret: "",
  accountNumber: "",
  accountReferenceFormat: "{admission_number}",
};

function PaymentSettingsPage() {
  const { schoolId } = useSchool();
  const qc = useQueryClient();
  // Payment tables are introduced by the adjacent migration and will be added
  // to generated Supabase types on the next type generation pass.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as unknown as { from: (table: string) => any };
  const [selected, setSelected] = useState<Provider | null>(null);
  const [tested, setTested] = useState<Record<string, boolean>>({});
  const [form, setForm] = useState<FormState>(emptyForm);
  const [statusFilter, setStatusFilter] = useState("all");
  const [matchingId, setMatchingId] = useState<string | null>(null);
  const [matchingLearnerId, setMatchingLearnerId] = useState("");
  const configs = useQuery({
    queryKey: ["payment-configs", schoolId],
    queryFn: async () => {
      const { data, error } = await db
        .from("payment_provider_configs")
        .select(
          "id, provider, environment, shortcode, account_number, callback_base_url, account_reference_format, is_active, last_error, last_verified_at",
        )
        .eq("school_id", schoolId)
        .order("provider");
      if (error) throw error;
      return (data ?? []) as Config[];
    },
    enabled: !!schoolId,
  });
  const transactions = useQuery({
    queryKey: ["payment-transactions", schoolId, statusFilter],
    queryFn: async () => {
      let query = db
        .from("payment_transactions")
        .select(
          "id, provider, amount, phone_number, account_reference, status, matched_invoice_id, provider_transaction_id, created_at, student_id",
        )
        .eq("school_id", schoolId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (statusFilter !== "all") query = query.eq("status", statusFilter);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!schoolId,
  });
  const audit = useQuery({
    queryKey: ["payment-config-audit", schoolId],
    queryFn: async () => {
      const { data, error } = await db
        .from("payment_config_audit_logs")
        .select(
          "id, action, changed_fields, actor_id, created_at, provider_configs:config_id(provider)",
        )
        .eq("school_id", schoolId)
        .order("created_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!schoolId,
  });
  const learners = useQuery({
    queryKey: ["payment-match-learners", schoolId],
    queryFn: async () => {
      const { data, error } = await db
        .from("learners")
        .select("id, admission_number, first_name, last_name")
        .eq("school_id", schoolId)
        .eq("is_archived", false)
        .order("admission_number")
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!schoolId && matchingId !== null,
  });
  const match = useMutation({
    mutationFn: async () => {
      if (!matchingId || !matchingLearnerId) throw new Error("Select a learner first.");
      const { error } = await db.rpc("match_payment_transaction", {
        transaction_id: matchingId,
        learner_id_input: matchingLearnerId,
        invoice_id_input: null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Transaction matched and posted to the fee ledger");
      setMatchingId(null);
      setMatchingLearnerId("");
      qc.invalidateQueries({ queryKey: ["payment-transactions", schoolId] });
    },
    onError: (error) => toast.error(error.message),
  });
  const save = useMutation({
    mutationFn: () =>
      savePaymentConfig({ data: { schoolId: schoolId!, provider: selected!, ...form } }),
    onSuccess: () => {
      toast.success(
        "Payment settings saved securely. Test the saved connection before activating it.",
      );
      qc.invalidateQueries({ queryKey: ["payment-configs", schoolId] });
      setSelected(null);
      setForm(emptyForm);
    },
    onError: (error) => toast.error(error.message),
  });
  const test = useMutation({
    mutationFn: (configId: string) =>
      testPaymentConfig({ data: { schoolId: schoolId!, configId } }),
    onSuccess: () => {
      setTested((current) => ({ ...current, [selected!]: true }));
      toast.success("Sandbox credentials verified");
      qc.invalidateQueries({ queryKey: ["payment-configs", schoolId] });
    },
    onError: (error) => toast.error(error.message),
  });
  const configFor = (provider: Provider) =>
    configs.data?.find((item) => item.provider === provider);
  const openEditor = (provider: Provider) => {
    const existing = configFor(provider);
    setSelected(provider);
    setTested({});
    setForm({
      ...emptyForm,
      environment: existing?.environment ?? "sandbox",
      shortcode: existing?.shortcode ?? "",
      accountNumber: existing?.account_number ?? "",
      accountReferenceFormat: existing?.account_reference_format ?? "{admission_number}",
    });
  };
  const callbackUrl = selected
    ? `https://api.shanscott.com/webhooks/${selected === "mpesa" ? "mpesa" : "bank"}/${schoolId}`
    : "";

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6 pb-10">
      <PageHeader
        title="Payment settings"
        description="Connect school-owned M-Pesa and bank payment channels to the fee ledger."
      />
      <div className="grid gap-4 md:grid-cols-2">
        <ProviderCard
          icon={<Smartphone className="size-5" />}
          title="M-Pesa (Daraja)"
          config={configFor("mpesa")}
          onClick={() => openEditor("mpesa")}
        />
        <ProviderCard
          icon={<Landmark className="size-5" />}
          title="Bank transfer"
          config={configFor("bank_jenga")}
          onClick={() => openEditor("bank_jenga")}
        />
      </div>
      {selected && (
        <Card className="border-primary/40 shadow-md">
          <CardHeader>
            <CardTitle>
              {selected === "mpesa" ? "M-Pesa Daraja connection" : "Bank connection"}
            </CardTitle>
            <CardDescription>
              Enter credentials issued for this school. Test in Sandbox before switching to Live.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              {selected === "mpesa" ? (
                <>
                  <Field
                    label="Shortcode (Paybill / Till)"
                    value={form.shortcode}
                    onChange={(value) => setForm({ ...form, shortcode: value })}
                  />
                  <Field
                    label="Consumer key"
                    value={form.consumerKey}
                    onChange={(value) => setForm({ ...form, consumerKey: value })}
                  />
                  <Field
                    label="Consumer secret"
                    type="password"
                    value={form.consumerSecret}
                    onChange={(value) => setForm({ ...form, consumerSecret: value })}
                  />
                  <Field
                    label="Lipa na M-Pesa passkey"
                    type="password"
                    value={form.passkey}
                    onChange={(value) => setForm({ ...form, passkey: value })}
                  />
                </>
              ) : (
                <>
                  <Field
                    label="API key"
                    value={form.apiKey}
                    onChange={(value) => setForm({ ...form, apiKey: value })}
                  />
                  <Field
                    label="API secret"
                    type="password"
                    value={form.apiSecret}
                    onChange={(value) => setForm({ ...form, apiSecret: value })}
                  />
                  <Field
                    label="Account number"
                    value={form.accountNumber}
                    onChange={(value) => setForm({ ...form, accountNumber: value })}
                  />
                </>
              )}
              <div className="space-y-2">
                <Label>Environment</Label>
                <Select
                  value={form.environment}
                  onValueChange={(value: "sandbox" | "live") => {
                    setForm({ ...form, environment: value });
                    setTested({});
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sandbox">Sandbox</SelectItem>
                    <SelectItem value="live">Live</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Field
                label="Account reference format"
                value={form.accountReferenceFormat}
                onChange={(value) => setForm({ ...form, accountReferenceFormat: value })}
              />
              <div className="space-y-2 sm:col-span-2">
                <Label>Callback URL</Label>
                <div className="flex gap-2">
                  <Input readOnly value={callbackUrl} />
                  <Button
                    size="icon"
                    variant="outline"
                    title="Copy callback URL"
                    onClick={() => navigator.clipboard.writeText(callbackUrl)}
                  >
                    <Link2 className="size-4" />
                  </Button>
                </div>
              </div>
            </div>
            {form.environment === "sandbox" && <Badge variant="warning">SANDBOX</Badge>}
            <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
              <Button variant="outline" onClick={() => setSelected(null)}>
                Cancel
              </Button>
              <Button
                variant="outline"
                disabled={test.isPending || !configFor(selected)?.id}
                onClick={() => configFor(selected)?.id && test.mutate(configFor(selected)!.id)}
              >
                {test.isPending ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 size-4" />
                )}
                Test connection
              </Button>
              <Button disabled={save.isPending} onClick={() => save.mutate()}>
                {save.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}Save
                settings
              </Button>
            </div>
            {form.environment === "sandbox" && !tested[selected] && (
              <p className="text-right text-xs text-amber-700">
                Saved credentials remain inactive until a Sandbox connection test passes.
              </p>
            )}
          </CardContent>
        </Card>
      )}
      <Tabs defaultValue="transactions">
        <TabsList>
          <TabsTrigger value="transactions">Transaction log</TabsTrigger>
          <TabsTrigger value="audit">Settings activity</TabsTrigger>
        </TabsList>
        <TabsContent value="transactions">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <div>
                <CardTitle>Incoming payments</CardTitle>
                <CardDescription>
                  Duplicate callbacks are deduplicated by provider transaction ID.
                </CardDescription>
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="unmatched">Unmatched</SelectItem>
                  <SelectItem value="reconciled">Reconciled</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="p-3">Date</th>
                      <th className="p-3">Reference</th>
                      <th className="p-3">Method</th>
                      <th className="p-3">Amount</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Invoice</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.data?.map((row: TransactionRow) => (
                      <tr className="border-b last:border-0" key={row.id}>
                        <td className="p-3">{new Date(row.created_at).toLocaleString()}</td>
                        <td className="p-3">{row.account_reference ?? "-"}</td>
                        <td className="p-3 capitalize">{row.provider.replace("_", " ")}</td>
                        <td className="p-3">KES {Number(row.amount).toLocaleString()}</td>
                        <td className="p-3">
                          <Badge
                            variant={
                              row.status === "reconciled" || row.status === "success"
                                ? "default"
                                : row.status === "failed"
                                  ? "destructive"
                                  : "warning"
                            }
                          >
                            {row.status}
                          </Badge>
                        </td>
                        <td className="p-3">
                          {(row.matched_invoice_id ?? row.status !== "unmatched") ? (
                            (row.matched_invoice_id ?? "-")
                          ) : matchingId === row.id ? (
                            <div className="flex min-w-64 gap-2">
                              <Select
                                value={matchingLearnerId}
                                onValueChange={setMatchingLearnerId}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select learner" />
                                </SelectTrigger>
                                <SelectContent>
                                  {learners.data?.map((learner: LearnerRow) => (
                                    <SelectItem key={learner.id} value={learner.id}>
                                      {learner.admission_number} · {learner.first_name}{" "}
                                      {learner.last_name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Button
                                size="sm"
                                disabled={match.isPending}
                                onClick={() => match.mutate()}
                              >
                                Match
                              </Button>
                            </div>
                          ) : (
                            <Button
                              variant="link"
                              className="h-auto p-0"
                              onClick={() => setMatchingId(row.id)}
                            >
                              Match to student
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!transactions.data?.length && (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    No payment transactions yet.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="audit">
          <Card>
            <CardHeader>
              <CardTitle>Settings activity</CardTitle>
              <CardDescription>
                Credential values are intentionally excluded from this audit trail.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {audit.data?.map((entry: AuditEntry) => (
                <div
                  className="flex items-center justify-between border-b pb-3 text-sm"
                  key={entry.id}
                >
                  <span>{entry.action} payment configuration</span>
                  <span className="text-muted-foreground">
                    {new Date(entry.created_at).toLocaleString()}
                  </span>
                </div>
              ))}
              {!audit.data?.length && (
                <p className="text-sm text-muted-foreground">No settings changes recorded yet.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ProviderCard({
  icon,
  title,
  config,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  config?: Config;
  onClick: () => void;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between">
        <div className="flex gap-3">
          <div className="rounded-lg bg-primary/10 p-2 text-primary">{icon}</div>
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription className="mt-1">
              {config?.environment === "sandbox" && (
                <Badge variant="warning" className="mr-2">
                  SANDBOX
                </Badge>
              )}
              {config?.is_active ? (
                <span className="text-emerald-700">Connected</span>
              ) : (
                <span>Not connected</span>
              )}
            </CardDescription>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={onClick}>
          {config ? (
            <>
              <Unlink2 className="mr-2 size-4" />
              Edit
            </>
          ) : (
            <>
              <Link2 className="mr-2 size-4" />
              Connect
            </>
          )}
        </Button>
      </CardHeader>
      <CardContent>
        {config?.last_error ? (
          <p className="flex items-center gap-2 text-sm text-destructive">
            <CircleAlert className="size-4" />
            {config.last_error}
          </p>
        ) : config?.last_verified_at ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="size-4 text-emerald-600" />
            Verified {new Date(config.last_verified_at).toLocaleString()}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">No verified connection.</p>
        )}
      </CardContent>
    </Card>
  );
}
function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}
