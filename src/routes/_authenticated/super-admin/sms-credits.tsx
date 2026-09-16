import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { CircleDollarSign, KeyRound, Loader2, Save, Settings2, WalletCards } from "lucide-react";
import { toast } from "sonner";
import { PlatformPage } from "@/components/platform-page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";
import {
  listPlatformSmsSettings,
  saveSmsCredentials,
  listPlatformSmsBalances,
  setPlatformSmsBalance,
  topUpSmsCredits,
} from "@/lib/sms-credits.functions";

export const Route = createFileRoute("/_authenticated/super-admin/sms-credits")({
  component: SuperAdminSmsCreditsPage,
});

type School = { id: string; name: string; county: string | null; status: string };
type SmsSettings = {
  school_id: string;
  project_id: string;
  endpoint_url: string;
  last_balance: number | string | null;
  last_synced_at: string | null;
  apiKeyLastFour: string;
};

function SuperAdminSmsCreditsPage() {
  const queryClient = useQueryClient();
  const [selectedSchoolId, setSelectedSchoolId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [endpointUrl, setEndpointUrl] = useState("https://sozuri.net/api/v1/messaging");
  const [search, setSearch] = useState("");
  const [amount, setAmount] = useState("1000");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [schoolBalance, setSchoolBalance] = useState("");
  const [businessNumber, setBusinessNumber] = useState("4029323");
  const [accountNumber, setAccountNumber] = useState("shnscott technologies");

  const schools = useQuery({
    queryKey: ["platform-sms-schools"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schools")
        .select("id, name, county, status")
        .order("name");
      if (error) throw error;
      return (data ?? []) as School[];
    },
  });
  const settings = useQuery({
    queryKey: ["platform-sms-settings"],
    queryFn: () => listPlatformSmsSettings({ data: undefined }),
  });
  const balances = useQuery({
    queryKey: ["platform-sms-balances"],
    queryFn: () => listPlatformSmsBalances({ data: undefined }),
  });

  const selectedSettings = settings.data?.find((item) => item.school_id === selectedSchoolId) as
    SmsSettings | undefined;
  const selectedSchool = schools.data?.find((school) => school.id === selectedSchoolId);
  const visibleSchools = (schools.data ?? []).filter((school) =>
    school.name.toLowerCase().includes(search.toLowerCase()),
  );

  const selectSchool = (schoolId: string) => {
    setSelectedSchoolId(schoolId);
    const existing = settings.data?.find((item) => item.school_id === schoolId) as
      SmsSettings | undefined;
    setProjectId(existing?.project_id ?? "");
    setEndpointUrl(existing?.endpoint_url ?? "https://sozuri.net/api/v1/messaging");
    setApiKey("");
    setSchoolBalance(
      String(balances.data?.find((item) => item.school_id === schoolId)?.balance ?? ""),
    );
    const existingBalance = balances.data?.find((item) => item.school_id === schoolId);
    setBusinessNumber(existingBalance?.business_number ?? "4029323");
    setAccountNumber(existingBalance?.account_number ?? "shnscott technologies");
  };

  const save = useMutation({
    mutationFn: () =>
      saveSmsCredentials({
        data: { schoolId: selectedSchoolId, projectId, endpointUrl, apiKey: apiKey || undefined },
      }),
    onSuccess: () => {
      setApiKey("");
      toast.success("SMS configuration saved for this school.");
      void queryClient.invalidateQueries({ queryKey: ["platform-sms-settings"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const topUp = useMutation({
    mutationFn: () =>
      topUpSmsCredits({
        data: { schoolId: selectedSchoolId, amount: Number(amount), phoneNumber },
      }),
    onSuccess: () => toast.success("Top-up attempt recorded for this school."),
    onError: (error: Error) => toast.error(error.message),
  });
  const setBalance = useMutation({
    mutationFn: () =>
      setPlatformSmsBalance({
        data: {
          schoolId: selectedSchoolId,
          balance: Number(schoolBalance),
          businessNumber,
          accountNumber,
        },
      }),
    onSuccess: () => {
      toast.success("SMS balance updated for this school.");
      void queryClient.invalidateQueries({ queryKey: ["platform-sms-balances"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <PlatformPage
      eyebrow="Messaging operations"
      title="SMS credits"
      description="Configure and manage Sozuri SMS credits for every school tenant."
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <WalletCards className="size-5 text-emerald-600" />
              School balances
            </CardTitle>
            <CardDescription>
              Select a school to configure its Sozuri project or record a top-up.
            </CardDescription>
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search schools..."
            />
          </CardHeader>
          <CardContent className="space-y-2">
            {schools.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading schools...</p>
            ) : (
              visibleSchools.map((school) => {
                const item = settings.data?.find((setting) => setting.school_id === school.id) as
                  SmsSettings | undefined;
                const balance = balances.data?.find((item) => item.school_id === school.id);
                return (
                  <button
                    type="button"
                    key={school.id}
                    onClick={() => selectSchool(school.id)}
                    className={`flex w-full items-center justify-between rounded-lg border p-3 text-left ${selectedSchoolId === school.id ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30" : "hover:bg-muted/50"}`}
                  >
                    <span>
                      <span className="block font-semibold">{school.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {school.county ?? "County not set"}
                      </span>
                    </span>
                    <span className="text-right">
                      <Badge variant={item ? "default" : "outline"}>
                        {item ? "Configured" : "Not configured"}
                      </Badge>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {balance?.balance != null
                          ? `${Number(balance.balance).toLocaleString()} credits`
                          : "No balance"}
                      </span>
                    </span>
                  </button>
                );
              })
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings2 className="size-5 text-emerald-600" />
                Configure tenant
              </CardTitle>
              <CardDescription>
                {selectedSchool
                  ? `Configuration for ${selectedSchool.name}`
                  : "Select a school first."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="sms-project">Project Name / ID</Label>
                <Input
                  id="sms-project"
                  value={projectId}
                  onChange={(event) => setProjectId(event.target.value)}
                  disabled={!selectedSchoolId}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sms-api-key">Secret API Key</Label>
                <Input
                  id="sms-api-key"
                  type="password"
                  value={apiKey}
                  onChange={(event) => setApiKey(event.target.value)}
                  placeholder={
                    selectedSettings
                      ? `Configured · last 4 ${selectedSettings.apiKeyLastFour}`
                      : "Paste API key"
                  }
                  disabled={!selectedSchoolId}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sms-endpoint">Endpoint URL</Label>
                <Input
                  id="sms-endpoint"
                  value={endpointUrl}
                  onChange={(event) => setEndpointUrl(event.target.value)}
                  disabled={!selectedSchoolId}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                <KeyRound className="mr-1 inline size-3" />
                Keys are encrypted server-side and never displayed in full.
              </p>
              <Button
                disabled={
                  !selectedSchoolId ||
                  !projectId ||
                  (!selectedSettings && !apiKey) ||
                  save.isPending
                }
                onClick={() => save.mutate()}
              >
                <Save className="mr-2 size-4" />
                {save.isPending ? "Saving..." : "Save configuration"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <WalletCards className="size-5 text-emerald-600" />
                School SMS balance
              </CardTitle>
              <CardDescription>
                Set the balance displayed to {selectedSchool?.name ?? "the selected school"}.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="school-sms-balance">SMS balance</Label>
                <Input
                  id="school-sms-balance"
                  type="number"
                  min="0"
                  value={schoolBalance}
                  onChange={(event) => setSchoolBalance(event.target.value)}
                  disabled={!selectedSchoolId}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="school-business-number">Business number</Label>
                <Input
                  id="school-business-number"
                  value={businessNumber}
                  onChange={(event) => setBusinessNumber(event.target.value)}
                  disabled={!selectedSchoolId}
                  placeholder="4029323"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="school-account-number">Account number</Label>
                <Input
                  id="school-account-number"
                  value={accountNumber}
                  onChange={(event) => setAccountNumber(event.target.value)}
                  disabled={!selectedSchoolId}
                  placeholder="shnscott technologies"
                />
              </div>
              <Button
                disabled={
                  !selectedSchoolId ||
                  schoolBalance === "" ||
                  Number(schoolBalance) < 0 ||
                  setBalance.isPending
                }
                onClick={() => setBalance.mutate()}
              >
                {setBalance.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                Save SMS balance
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CircleDollarSign className="size-5 text-emerald-600" />
                Record top-up
              </CardTitle>
              <CardDescription>Use the manual M-Pesa flow for the selected school.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="admin-topup-amount">Amount in KES</Label>
                <Input
                  id="admin-topup-amount"
                  type="number"
                  min="1"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  disabled={!selectedSchoolId}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin-topup-phone">M-Pesa phone number</Label>
                <Input
                  id="admin-topup-phone"
                  value={phoneNumber}
                  onChange={(event) => setPhoneNumber(event.target.value)}
                  placeholder="07..."
                  disabled={!selectedSchoolId}
                />
              </div>
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950">
                Paybill <strong>{businessNumber || "4029323"}</strong>, account{" "}
                <strong>{accountNumber || "shnscott technologies"}</strong>.
              </div>
              <Button
                variant="outline"
                disabled={
                  !selectedSchoolId || !phoneNumber || Number(amount) <= 0 || topUp.isPending
                }
                onClick={() => topUp.mutate()}
              >
                {topUp.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}Record top-up
                attempt
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </PlatformPage>
  );
}
