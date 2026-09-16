import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Banknote,
  CircleAlert,
  ClipboardCheck,
  Loader2,
  RefreshCw,
  Smartphone,
  WalletCards,
} from "lucide-react";
import { toast } from "sonner";
import { RequireSchool } from "@/components/require-school";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSchool } from "@/hooks/use-school";
import { getSmsSettings, refreshSmsBalance, topUpSmsCredits } from "@/lib/sms-credits.functions";

export const Route = createFileRoute("/_authenticated/sms-credits")({
  head: () => ({ meta: [{ title: "SMS credits · SHANSCOTT CBE" }] }),
  component: () => (
    <RequireSchool roles={["admin", "accountant", "principal", "deputy", "super_admin"]}>
      <SmsCreditsPage />
    </RequireSchool>
  ),
});

type SmsSettings = {
  project_id: string;
  endpoint_url: string;
  last_balance: number | string | null;
  last_synced_at: string | null;
  apiKeyLastFour: string;
};
type SmsCreditBalance = {
  balance: number | string;
  business_number: string;
  account_number: string;
  updated_at: string;
};

function SmsCreditsPage() {
  const { schoolId } = useSchool();
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("1000");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [topUpOpen, setTopUpOpen] = useState(false);

  const settings = useQuery({
    queryKey: ["sms-settings", schoolId],
    queryFn: () => getSmsSettings({ data: { schoolId: schoolId! } }),
    enabled: !!schoolId,
  });

  const balance = useQuery({
    queryKey: ["sms-balance", schoolId],
    queryFn: () => refreshSmsBalance({ data: { schoolId: schoolId! } }),
    enabled: !!schoolId,
  });

  const topUp = useMutation({
    mutationFn: () =>
      topUpSmsCredits({
        data: { schoolId: schoolId!, amount: Number(amount), phoneNumber },
      }),
    onSuccess: () => {
      setTopUpOpen(false);
      toast.success("Top-up request recorded. Complete the M-Pesa payment instructions shown.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const current = (balance.data?.settings ?? settings.data) as SmsSettings | null | undefined;
  const assignedBalance = balance.data?.manualBalance as SmsCreditBalance | null | undefined;
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["sms-balance", schoolId] });
  const syncedLabel = current?.last_synced_at
    ? `${Math.max(0, Math.floor((Date.now() - Date.parse(current.last_synced_at)) / 60_000))} min ago`
    : "Not synced yet";
  const isLow =
    assignedBalance?.balance !== null &&
    assignedBalance?.balance !== undefined &&
    Number(assignedBalance.balance) < 100;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6 pb-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">SMS credits</h1>
        <p className="text-sm text-muted-foreground">
          Manage the Sozuri account used for parent messages.
        </p>
      </div>

      {isLow && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          <CircleAlert className="mt-0.5 size-5 shrink-0" />
          <span>Your SMS credits are running low - top up to keep parent messages sending.</span>
        </div>
      )}

      <Card>
        <CardHeader className="flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <WalletCards className="size-5 text-primary" />
              Current balance
            </CardTitle>
            <CardDescription>
              Credits are held in your school&apos;s Sozuri project.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={refresh} disabled={balance.isFetching}>
            {balance.isFetching ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 size-4" />
            )}
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {balance.isLoading ? (
            <div className="h-12 w-48 animate-pulse rounded bg-muted" />
          ) : assignedBalance?.balance !== null && assignedBalance?.balance !== undefined ? (
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-4xl font-bold">
                  {Number(assignedBalance.balance).toLocaleString()}
                </p>
                <p className="text-sm text-muted-foreground">SMS credits</p>
              </div>
              <p className="text-sm text-muted-foreground">
                Last updated: {new Date(assignedBalance.updated_at).toLocaleString()}
              </p>
            </div>
          ) : (
            <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
              Connect your Sozuri account below to show the balance.
            </div>
          )}
          {balance.data?.error && (
            <p className="mt-4 flex items-start gap-2 text-sm text-amber-700">
              <CircleAlert className="mt-0.5 size-4 shrink-0" />
              {balance.data.error}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Top up credits</CardTitle>
          <CardDescription>Open the M-Pesa payment form for this school.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Button disabled={!settings.data} onClick={() => setTopUpOpen(true)}>
            Top up
          </Button>
          <p className="basis-full text-xs text-muted-foreground">
            Complete the payment instructions, then click Refresh here to update the balance.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-4">
          <div>
            <CardTitle>Sozuri connection</CardTitle>
            <CardDescription>
              SMS credentials are managed by SHANSCOTT platform administration.
            </CardDescription>
          </div>
          {settings.data ? (
            <Badge>Connected</Badge>
          ) : (
            <Badge variant="outline">Not connected</Badge>
          )}
        </CardHeader>
      </Card>

      <Dialog open={topUpOpen} onOpenChange={setTopUpOpen}>
        <DialogContent className="max-h-[min(92vh,760px)] max-w-2xl gap-0 overflow-y-auto overflow-x-hidden p-0">
          <div className="border-b bg-emerald-950 px-6 py-6 text-white sm:px-8">
            <DialogHeader className="space-y-3 text-left">
              <div className="flex items-center gap-3">
                <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-emerald-400 text-emerald-950">
                  <WalletCards className="size-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-300">
                    SMS credits
                  </p>
                  <DialogTitle className="mt-1 truncate text-xl text-white sm:text-2xl">
                    Top up project {settings.data?.project_id ?? ""}
                  </DialogTitle>
                </div>
              </div>
              <DialogDescription className="max-w-lg text-emerald-100/75">
                Pay for this school&apos;s SMS credits securely with M-Pesa.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="grid gap-6 p-6 sm:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] sm:p-8">
            <div className="space-y-5">
              <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950">
                <div className="grid size-10 place-items-center rounded-lg bg-white text-emerald-700 shadow-sm">
                  <Smartphone className="size-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700/70">
                    Payment method
                  </p>
                  <p className="font-semibold">M-Pesa</p>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sms-amount">Amount in KES</Label>
                <div className="relative">
                  <Banknote className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="sms-amount"
                    type="number"
                    min="1"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    className="h-11 pl-9 text-base font-semibold tabular-nums"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sms-phone">Phone number</Label>
                <div className="relative">
                  <Smartphone className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="sms-phone"
                    inputMode="tel"
                    placeholder="07XX XXX XXX"
                    value={phoneNumber}
                    onChange={(event) => setPhoneNumber(event.target.value)}
                    className="h-11 pl-9"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Use the phone number registered for your M-Pesa account.
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-muted/30 p-5 sm:p-6">
              <div className="flex items-start gap-3">
                <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-emerald-100 text-emerald-700">
                  <ClipboardCheck className="size-4" />
                </div>
                <div>
                  <h3 className="font-semibold">Manual M-Pesa Paybill</h3>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    You can also complete the payment directly from your phone.
                  </p>
                </div>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border bg-background p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Business number
                  </p>
                  <p className="mt-1 break-words text-lg font-bold tracking-wide">
                    {assignedBalance?.business_number ?? "4029323"}
                  </p>
                </div>
                <div className="rounded-lg border bg-background p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Account number
                  </p>
                  <p className="mt-1 break-words text-sm font-bold">
                    {assignedBalance?.account_number ?? "shnscott technologies"}
                  </p>
                </div>
              </div>
              <ol className="mt-5 space-y-3 text-sm text-muted-foreground">
                <li className="flex gap-3">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">
                    1
                  </span>
                  <span>Open your M-Pesa menu.</span>
                </li>
                <li className="flex gap-3">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">
                    2
                  </span>
                  <span>
                    Choose <strong className="text-foreground">Lipa M-Pesa → Paybill</strong>.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">
                    3
                  </span>
                  <span>Enter the business and account numbers above.</span>
                </li>
                <li className="flex gap-3">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">
                    4
                  </span>
                  <span>Enter the amount and confirm with your PIN.</span>
                </li>
              </ol>
            </div>
          </div>

          <DialogFooter className="border-t bg-muted/20 px-6 py-4 sm:px-8">
            <Button variant="outline" onClick={() => setTopUpOpen(false)}>
              Cancel
            </Button>
            <Button
              className="min-w-32 bg-emerald-600 hover:bg-emerald-700"
              disabled={topUp.isPending || !phoneNumber.trim() || Number(amount) <= 0}
              onClick={() => topUp.mutate()}
            >
              {topUp.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}Pay now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
