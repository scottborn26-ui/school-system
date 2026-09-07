import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  Pencil,
  Plus,
  RotateCcw,
  Scale,
  Sparkles,
  Trash2,
  Wallet,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app-shell";
import { RequireSchool } from "@/components/require-school";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useSchool } from "@/hooks/use-school";
import { PlatformConfirmDialog } from "@/components/platform-confirm-dialog";
import { downloadCsv } from "@/lib/csv";
import { formatDate, formatKES } from "@/lib/format";
import { postJournalEntry } from "@/lib/general-ledger";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/_authenticated/general-ledger")({
  component: () => (
    <RequireSchool roles={["admin", "accountant", "principal", "deputy", "super_admin"]}>
      <GeneralLedgerPage />
    </RequireSchool>
  ),
});

type Line = { accountId: string; debit: string; credit: string; description: string };
const TYPES = ["asset", "liability", "equity", "revenue", "expense"];

export function GeneralLedgerPage() {
  const school = useSchool();
  const schoolId = school.schoolId!;
  const qc = useQueryClient();
  const [entryOpen, setEntryOpen] = useState(false);
  const [clearLedgerOpen, setClearLedgerOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [viewAccount, setViewAccount] = useState<ChartAccount | null>(null);
  const [editAccount, setEditAccount] = useState<ChartAccount | null>(null);
  const [narration, setNarration] = useState("");
  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10));
  const [lines, setLines] = useState<Line[]>([
    { accountId: "", debit: "", credit: "", description: "" },
    { accountId: "", debit: "", credit: "", description: "" },
  ]);
  const [accountForm, setAccountForm] = useState({
    code: "",
    name: "",
    type: "expense",
    normal: "debit",
  });
  const [reconciliationOpen, setReconciliationOpen] = useState(false);
  const [statementDate, setStatementDate] = useState(new Date().toISOString().slice(0, 10));
  const [statementBalance, setStatementBalance] = useState("");
  const [reconciliationNotes, setReconciliationNotes] = useState("");
  const accounts = useQuery({
    queryKey: ["chart-of-accounts", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chart_of_accounts")
        .select("*")
        .eq("school_id", schoolId)
        .order("account_code");
      if (error) throw error;
      return data;
    },
  });
  const entries = useQuery({
    queryKey: ["journal-entries", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("journal_entries")
        .select("*, journal_entry_lines(*)")
        .eq("school_id", schoolId)
        .order("entry_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const reconciliations = useQuery({
    queryKey: ["cash-reconciliations", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cash_reconciliations")
        .select("*")
        .eq("school_id", schoolId)
        .order("statement_date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const seed = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("seed_school_chart_of_accounts", {
        _school_id: schoolId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("CBC chart of accounts ready.");
      void qc.invalidateQueries({ queryKey: ["chart-of-accounts", schoolId] });
    },
    onError: (e: Error) => toast.error("Could not seed accounts", { description: e.message }),
  });
  const clearLedger = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("clear_school_journal", {
        _school_id: schoolId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("The school journal was cleared.");
      setClearLedgerOpen(false);
      void qc.invalidateQueries({ queryKey: ["journal-entries", schoolId] });
    },
    onError: (e: Error) => toast.error("Could not clear the journal", { description: e.message }),
  });
  const addAccount = useMutation({
    mutationFn: async () => {
      if (!accountForm.code || !accountForm.name)
        throw new Error("Account code and name are required.");
      const { error } = await supabase
        .from("chart_of_accounts")
        .insert({
          school_id: schoolId,
          account_code: accountForm.code,
          account_name: accountForm.name,
          account_type: accountForm.type,
          normal_balance: accountForm.normal,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Account added.");
      setAccountOpen(false);
      void qc.invalidateQueries({ queryKey: ["chart-of-accounts", schoolId] });
    },
    onError: (e: Error) => toast.error("Could not add account", { description: e.message }),
  });
  const updateAccount = useMutation({
    mutationFn: async () => {
      if (!editAccount || !editAccount.account_code || !editAccount.account_name)
        throw new Error("Account code and name are required.");
      const { error } = await supabase
        .from("chart_of_accounts")
        .update({
          account_code: editAccount.account_code,
          account_name: editAccount.account_name,
          account_type: editAccount.account_type,
          normal_balance: editAccount.normal_balance,
        })
        .eq("id", editAccount.id)
        .eq("school_id", schoolId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Account updated.");
      setEditAccount(null);
      void qc.invalidateQueries({ queryKey: ["chart-of-accounts", schoolId] });
    },
    onError: (e: Error) => toast.error("Could not update account", { description: e.message }),
  });
  const deactivateAccount = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("chart_of_accounts")
        .update({ is_active: false })
        .eq("id", id)
        .eq("school_id", schoolId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Account deactivated.");
      void qc.invalidateQueries({ queryKey: ["chart-of-accounts", schoolId] });
    },
    onError: (e: Error) => toast.error("Could not deactivate account", { description: e.message }),
  });
  const post = useMutation({
    mutationFn: () =>
      postJournalEntry({
        schoolId,
        source: "manual",
        narration,
        entryDate,
        lines: lines.map((line) => ({
          accountId: line.accountId,
          debit: Number(line.debit) || 0,
          credit: Number(line.credit) || 0,
          description: line.description,
        })),
      }),
    onSuccess: () => {
      toast.success("Journal entry posted.");
      setEntryOpen(false);
      setNarration("");
      setLines([
        { accountId: "", debit: "", credit: "", description: "" },
        { accountId: "", debit: "", credit: "", description: "" },
      ]);
      void qc.invalidateQueries({ queryKey: ["journal-entries", schoolId] });
    },
    onError: (e: Error) => toast.error("Could not post journal", { description: e.message }),
  });
  const reverse = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("reverse_journal_entry", { _journal_entry_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Reversal posted.");
      void qc.invalidateQueries({ queryKey: ["journal-entries", schoolId] });
    },
    onError: (e: Error) => toast.error("Could not reverse entry", { description: e.message }),
  });
  const reconcileCash = useMutation({
    mutationFn: async () => {
      const account = (accounts.data ?? []).find((item) => item.account_code === "1100");
      const balance = Number(statementBalance);
      if (!account) throw new Error("Seed the chart of accounts first.");
      if (!statementDate || !Number.isFinite(balance)) throw new Error("Enter a valid statement date and balance.");
      const { error } = await supabase.from("cash_reconciliations").insert({
        school_id: schoolId,
        account_id: account.id,
        statement_date: statementDate,
        statement_balance: balance,
        notes: reconciliationNotes.trim() || null,
        reconciled_by: school.userId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cash position reconciled.");
      setReconciliationOpen(false);
      setStatementBalance("");
      setReconciliationNotes("");
      void qc.invalidateQueries({ queryKey: ["cash-reconciliations", schoolId] });
    },
    onError: (e: Error) => toast.error("Could not save reconciliation", { description: e.message }),
  });
  const debitTotal = lines.reduce((sum, line) => sum + (Number(line.debit) || 0), 0);
  const creditTotal = lines.reduce((sum, line) => sum + (Number(line.credit) || 0), 0);
  const balanced = debitTotal > 0 && Math.abs(debitTotal - creditTotal) < 0.005;
  const postedLines = (entries.data ?? []).flatMap((entry) =>
    (entry.journal_entry_lines ?? []).map((line) => ({ ...line, entry })),
  );
  const trial = (accounts.data ?? [])
    .map((account) => ({
      ...account,
      debit: postedLines
        .filter((line) => line.account_id === account.id && line.entry.status === "posted")
        .reduce((sum, line) => sum + Number(line.debit_amount), 0),
      credit: postedLines
        .filter((line) => line.account_id === account.id && line.entry.status === "posted")
        .reduce((sum, line) => sum + Number(line.credit_amount), 0),
    }))
    .filter((account) => account.debit || account.credit);
  const cashAccount = trial.find((account) => account.account_code === "1100");
  const cashBookBalance = (cashAccount?.debit ?? 0) - (cashAccount?.credit ?? 0);
  const latestReconciliation = reconciliations.data?.[0];
  const reconciliationDifference = latestReconciliation
    ? Number(latestReconciliation.statement_balance) - cashBookBalance
    : null;

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        title="General ledger"
        description="Double-entry accounting for school income, expenses, assets and liabilities."
        icon={BookOpen}
      />
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold">Ledger actions</p>
            <p className="text-sm text-muted-foreground">
              Set up accounts, edit the CBC account list, or clear journal records.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => seed.mutate()} disabled={seed.isPending}>
              <Sparkles className="mr-2 size-4" />
              {seed.isPending ? "Seeding..." : "Seed CBC accounts"}
            </Button>
            <Button
              variant="outline"
              onClick={() => document.getElementById("chart-of-accounts")?.scrollIntoView({ behavior: "smooth" })}
            >
              <Pencil className="mr-2 size-4" /> Edit CBC accounts
            </Button>
            <Button
              variant="destructive"
              onClick={() => setClearLedgerOpen(true)}
              disabled={clearLedger.isPending}
            >
              <Trash2 className="mr-2 size-4" /> Clear ledger
            </Button>
          </div>
        </CardContent>
      </Card>
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Posted entries</p>
            <p className="text-2xl font-bold">
              {(entries.data ?? []).filter((entry) => entry.status === "posted").length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Accounts</p>
            <p className="text-2xl font-bold">{accounts.data?.length ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Trial balance</p>
            <p className="text-2xl font-bold">
              {formatKES(trial.reduce((sum, row) => sum + row.debit, 0))}
            </p>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader className="flex flex-col gap-3 border-b sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base"><Wallet className="size-4" /> Cash position</CardTitle>
            <p className="text-sm text-muted-foreground">Posted Cash and bank activity compared with the latest bank or cash statement.</p>
          </div>
          <Dialog open={reconciliationOpen} onOpenChange={setReconciliationOpen}>
            <DialogTrigger asChild><Button><CheckCircle2 className="mr-2 size-4" /> Reconcile balance</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Reconcile Cash and bank</DialogTitle>
                <DialogDescription>Enter the ending balance from the bank or cash statement. The difference will remain visible until the books and statement agree.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <Field label="Statement date"><Input type="date" value={statementDate} onChange={(e) => setStatementDate(e.target.value)} /></Field>
                <Field label="Statement ending balance"><Input type="number" min={0} step="0.01" value={statementBalance} onChange={(e) => setStatementBalance(e.target.value)} /></Field>
                <Field label="Notes"><Textarea value={reconciliationNotes} onChange={(e) => setReconciliationNotes(e.target.value)} rows={3} placeholder="Optional outstanding deposits, withdrawals, or bank charges" /></Field>
              </div>
              <DialogFooter><Button onClick={() => reconcileCash.mutate()} disabled={reconcileCash.isPending}>Save reconciliation</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="grid gap-4 p-5 sm:grid-cols-3">
          <div><p className="text-xs uppercase tracking-wide text-muted-foreground">Book balance</p><p className="text-2xl font-bold">{formatKES(cashBookBalance)}</p><p className="text-xs text-muted-foreground">Posted account 1100</p></div>
          <div><p className="text-xs uppercase tracking-wide text-muted-foreground">Latest statement</p><p className="text-2xl font-bold">{latestReconciliation ? formatKES(Number(latestReconciliation.statement_balance)) : "Not recorded"}</p><p className="text-xs text-muted-foreground">{latestReconciliation ? formatDate(latestReconciliation.statement_date) : "Enter a statement balance to reconcile"}</p></div>
          <div><p className="text-xs uppercase tracking-wide text-muted-foreground">Difference</p><p className={`text-2xl font-bold ${reconciliationDifference === null ? "text-muted-foreground" : Math.abs(reconciliationDifference) < 0.005 ? "text-emerald-600" : "text-amber-600"}`}>{reconciliationDifference === null ? "-" : formatKES(reconciliationDifference)}</p><p className="text-xs text-muted-foreground">{reconciliationDifference === null ? "No reconciliation yet" : Math.abs(reconciliationDifference) < 0.005 ? "Reconciled" : "Investigate variance"}</p></div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-col gap-3 border-b bg-muted/20 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base">Accounting workspace</CardTitle>
            <p className="text-sm text-muted-foreground">
              Every posted journal is balanced, locked and reversible.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() =>
                downloadCsv(
                  "trial-balance",
                  trial.map((row) => ({
                    code: row.account_code,
                    account: row.account_name,
                    type: row.account_type,
                    debit: row.debit,
                    credit: row.credit,
                  })),
                )
              }
            >
              <Download className="mr-2 size-4" /> Export
            </Button>
            <Dialog open={accountOpen} onOpenChange={setAccountOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Plus className="mr-2 size-4" /> Account
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add account</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <Field label="Account code">
                    <Input
                      value={accountForm.code}
                      onChange={(e) => setAccountForm({ ...accountForm, code: e.target.value })}
                    />
                  </Field>
                  <Field label="Account name">
                    <Input
                      value={accountForm.name}
                      onChange={(e) => setAccountForm({ ...accountForm, name: e.target.value })}
                    />
                  </Field>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Type">
                      <Select
                        value={accountForm.type}
                        onValueChange={(value) => setAccountForm({ ...accountForm, type: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TYPES.map((type) => (
                            <SelectItem key={type} value={type}>
                              {type}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Normal balance">
                      <Select
                        value={accountForm.normal}
                        onValueChange={(value) => setAccountForm({ ...accountForm, normal: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="debit">Debit</SelectItem>
                          <SelectItem value="credit">Credit</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={() => addAccount.mutate()}>Save account</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Dialog open={entryOpen} onOpenChange={setEntryOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 size-4" /> New journal
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
                <DialogHeader>
                  <DialogTitle>New journal entry</DialogTitle>
                  <DialogDescription>
                    Debits must equal credits before the entry can post.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <Field label="Entry date">
                    <Input
                      type="date"
                      value={entryDate}
                      onChange={(e) => setEntryDate(e.target.value)}
                    />
                  </Field>
                  <Field label="Narration">
                    <Textarea
                      value={narration}
                      onChange={(e) => setNarration(e.target.value)}
                      rows={2}
                    />
                  </Field>
                  {lines.map((line, index) => (
                    <div
                      key={index}
                      className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[1.5fr_1fr_1fr_auto]"
                    >
                      <Select
                        value={line.accountId}
                        onValueChange={(value) =>
                          setLines(
                            lines.map((item, i) =>
                              i === index ? { ...item, accountId: value } : item,
                            ),
                          )
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Account" />
                        </SelectTrigger>
                        <SelectContent>
                          {(accounts.data ?? [])
                            .filter((account) => account.is_active)
                            .map((account) => (
                              <SelectItem key={account.id} value={account.id}>
                                {account.account_code} · {account.account_name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        min={0}
                        placeholder="Debit"
                        value={line.debit}
                        onChange={(e) =>
                          setLines(
                            lines.map((item, i) =>
                              i === index ? { ...item, debit: e.target.value, credit: "" } : item,
                            ),
                          )
                        }
                      />
                      <Input
                        type="number"
                        min={0}
                        placeholder="Credit"
                        value={line.credit}
                        onChange={(e) =>
                          setLines(
                            lines.map((item, i) =>
                              i === index ? { ...item, credit: e.target.value, debit: "" } : item,
                            ),
                          )
                        }
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setLines(lines.filter((_, i) => i !== index))}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      setLines([
                        ...lines,
                        { accountId: "", debit: "", credit: "", description: "" },
                      ])
                    }
                  >
                    Add line
                  </Button>
                  <div
                    className={`flex justify-between rounded-lg p-3 text-sm ${balanced ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}
                  >
                    <span>
                      Debits {formatKES(debitTotal)} · Credits {formatKES(creditTotal)}
                    </span>
                    <strong>{balanced ? "Balanced" : "Not balanced"}</strong>
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={() => post.mutate()} disabled={!balanced || post.isPending}>
                    Post journal
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent id="chart-of-accounts" className="p-0">
          <Tabs defaultValue="accounts">
            <TabsList className="m-4 flex-wrap">
              <TabsTrigger value="accounts">
                <BookOpen className="mr-2 size-4" /> Chart of accounts
              </TabsTrigger>
              <TabsTrigger value="journals">
                <Scale className="mr-2 size-4" /> Journal entries
              </TabsTrigger>
              <TabsTrigger value="trial">
                <Scale className="mr-2 size-4" /> Trial balance
              </TabsTrigger>
            </TabsList>
            <TabsContent value="accounts" className="m-0">
              <AccountTable accounts={accounts.data ?? []} />
            </TabsContent>
            <TabsContent value="journals" className="m-0">
              <JournalTable entries={entries.data ?? []} onReverse={(id) => reverse.mutate(id)} />
            </TabsContent>
            <TabsContent value="trial" className="m-0">
              <TrialTable rows={trial} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      <PlatformConfirmDialog
        open={clearLedgerOpen}
        onOpenChange={setClearLedgerOpen}
        title="Clear the entire school ledger?"
        description="This permanently deletes all journal entries and their lines for this school. Invoices, payments, inventory records and chart-of-accounts definitions will remain unchanged."
        confirmation="CLEAR LEDGER"
        confirmLabel={clearLedger.isPending ? "Clearing..." : "Clear ledger"}
        onConfirm={() => clearLedger.mutate()}
      />
    </div>
  );
}
type ChartAccount = {
  id: string;
  account_code: string;
  account_name: string;
  account_type: string;
  normal_balance: string;
  is_active: boolean;
};
const TABLE_PAGE_SIZE = 10;

function PaginationControls({
  page,
  total,
  onPageChange,
}: {
  page: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  const pageCount = Math.max(1, Math.ceil(total / TABLE_PAGE_SIZE));
  if (total <= TABLE_PAGE_SIZE) return null;
  return (
    <div className="flex items-center justify-between border-t px-4 py-3 text-sm text-muted-foreground">
      <span>
        Showing {Math.min((page - 1) * TABLE_PAGE_SIZE + 1, total)}-
        {Math.min(page * TABLE_PAGE_SIZE, total)} of {total}
      </span>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={page === 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <span className="min-w-16 text-center">Page {page} of {pageCount}</span>
        <Button
          size="sm"
          variant="outline"
          disabled={page === pageCount}
          onClick={() => onPageChange(page + 1)}
          aria-label="Next page"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
function AccountTable({ accounts }: { accounts: ChartAccount[] }) {
  const school = useSchool();
  const queryClient = useQueryClient();
  const [viewing, setViewing] = useState<ChartAccount | null>(null);
  const [editing, setEditing] = useState<ChartAccount | null>(null);
  const [page, setPage] = useState(1);
  const save = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      const { error } = await supabase
        .from("chart_of_accounts")
        .update({
          account_code: editing.account_code,
          account_name: editing.account_name,
          account_type: editing.account_type,
          normal_balance: editing.normal_balance,
        })
        .eq("id", editing.id)
        .eq("school_id", school.schoolId!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Account updated.");
      setEditing(null);
      void queryClient.invalidateQueries({ queryKey: ["chart-of-accounts", school.schoolId] });
    },
    onError: (error: Error) =>
      toast.error("Could not update account", { description: error.message }),
  });
  const deleteAccount = async (account: ChartAccount) => {
    if (!window.confirm(`Permanently delete account ${account.account_code} · ${account.account_name}? All linked journal transactions and reversal entries will also be removed. This cannot be undone.`))
      return;
    const { error } = await supabase.rpc("delete_chart_of_account", {
      _account_id: account.id,
      _school_id: school.schoolId!,
    });
    if (error) toast.error("Could not permanently delete account", { description: error.message });
    else {
      toast.success("Account permanently deleted.");
      void queryClient.invalidateQueries({ queryKey: ["chart-of-accounts", school.schoolId] });
    }
  };
  const pageCount = Math.max(1, Math.ceil(accounts.length / TABLE_PAGE_SIZE));
  const visibleAccounts = accounts.slice((page - 1) * TABLE_PAGE_SIZE, page * TABLE_PAGE_SIZE);
  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Code</TableHead>
            <TableHead>Account</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Normal balance</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {accounts.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="py-12 text-center text-sm text-muted-foreground">
                Seed the CBC chart of accounts to begin.
              </TableCell>
            </TableRow>
          )}
          {visibleAccounts.map((account) => (
            <TableRow key={account.id}>
              <TableCell className="font-mono">{account.account_code}</TableCell>
              <TableCell className="font-medium">{account.account_name}</TableCell>
              <TableCell>{account.account_type}</TableCell>
              <TableCell>{account.normal_balance}</TableCell>
              <TableCell>
                <Badge variant={account.is_active ? "outline" : "secondary"}>
                  {account.is_active ? "Active" : "Inactive"}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex justify-end gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    title="View account"
                    aria-label={`View ${account.account_name}`}
                    onClick={() => setViewing(account)}
                  >
                    <Eye className="size-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    title="Edit account"
                    aria-label={`Edit ${account.account_name}`}
                    onClick={() => setEditing({ ...account })}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    title="Delete account permanently"
                    aria-label={`Delete ${account.account_name} permanently`}
                    onClick={() => void deleteAccount(account)}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <PaginationControls page={Math.min(page, pageCount)} total={accounts.length} onPageChange={setPage} />
      <Dialog open={Boolean(viewing)} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Account details</DialogTitle>
          </DialogHeader>
          {viewing && (
            <div className="space-y-3 rounded-lg border bg-muted/20 p-4 text-sm">
              <div className="flex justify-between">
                <span>Code</span>
                <strong>{viewing.account_code}</strong>
              </div>
              <div className="flex justify-between">
                <span>Account</span>
                <strong>{viewing.account_name}</strong>
              </div>
              <div className="flex justify-between">
                <span>Type</span>
                <strong>{viewing.account_type}</strong>
              </div>
              <div className="flex justify-between">
                <span>Normal balance</span>
                <strong>{viewing.normal_balance}</strong>
              </div>
              <div className="flex justify-between">
                <span>Status</span>
                <strong>{viewing.is_active ? "Active" : "Inactive"}</strong>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewing(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit account</DialogTitle>
            <DialogDescription>
              Update the account definition. Existing journal history is preserved.
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <Field label="Account code">
                <Input
                  value={editing.account_code}
                  onChange={(event) => setEditing({ ...editing, account_code: event.target.value })}
                />
              </Field>
              <Field label="Account name">
                <Input
                  value={editing.account_name}
                  onChange={(event) => setEditing({ ...editing, account_name: event.target.value })}
                />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Type">
                  <Select
                    value={editing.account_type}
                    onValueChange={(value) => setEditing({ ...editing, account_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Normal balance">
                  <Select
                    value={editing.normal_balance}
                    onValueChange={(value) => setEditing({ ...editing, normal_balance: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="debit">Debit</SelectItem>
                      <SelectItem value="credit">Credit</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
function JournalTable({
  entries,
  onReverse,
}: {
  entries: Array<{
    id: string;
    entry_number: string;
    entry_date: string;
    source: string;
    narration: string;
    status: string;
    journal_entry_lines?: Array<{ debit_amount: number; credit_amount: number }>;
  }>;
  onReverse: (id: string) => void;
}) {
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(entries.length / TABLE_PAGE_SIZE));
  const visibleEntries = entries.slice((page - 1) * TABLE_PAGE_SIZE, page * TABLE_PAGE_SIZE);
  return (
    <>
      <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Entry</TableHead>
          <TableHead>Source</TableHead>
          <TableHead>Narration</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Amount</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.length === 0 && (
          <TableRow>
            <TableCell colSpan={7} className="py-12 text-center text-sm text-muted-foreground">
              No journal entries yet.
            </TableCell>
          </TableRow>
        )}
        {visibleEntries.map((entry) => {
          const amount = (entry.journal_entry_lines ?? []).reduce(
            (sum, line) => sum + Number(line.debit_amount),
            0,
          );
          return (
            <TableRow key={entry.id}>
              <TableCell>{formatDate(entry.entry_date)}</TableCell>
              <TableCell className="font-mono text-xs">{entry.entry_number}</TableCell>
              <TableCell>{entry.source}</TableCell>
              <TableCell>{entry.narration}</TableCell>
              <TableCell>
                <Badge variant={entry.status === "posted" ? "default" : "outline"}>
                  {entry.status}
                </Badge>
              </TableCell>
              <TableCell className="text-right">{formatKES(amount)}</TableCell>
              <TableCell>
                {entry.status === "posted" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    title="Reverse entry"
                    onClick={() => onReverse(entry.id)}
                  >
                    <RotateCcw className="size-4" />
                  </Button>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
      </Table>
      <PaginationControls page={Math.min(page, pageCount)} total={entries.length} onPageChange={setPage} />
    </>
  );
}
function TrialTable({
  rows,
}: {
  rows: Array<{
    account_code: string;
    account_name: string;
    account_type: string;
    debit: number;
    credit: number;
  }>;
}) {
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(rows.length / TABLE_PAGE_SIZE));
  const visibleRows = rows.slice((page - 1) * TABLE_PAGE_SIZE, page * TABLE_PAGE_SIZE);
  const debit = rows.reduce((sum, row) => sum + row.debit, 0);
  const credit = rows.reduce((sum, row) => sum + row.credit, 0);
  return (
    <>
      <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Code</TableHead>
          <TableHead>Account</TableHead>
          <TableHead>Type</TableHead>
          <TableHead className="text-right">Debit</TableHead>
          <TableHead className="text-right">Credit</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {visibleRows.map((row) => (
          <TableRow key={row.account_code}>
            <TableCell className="font-mono">{row.account_code}</TableCell>
            <TableCell>{row.account_name}</TableCell>
            <TableCell>{row.account_type}</TableCell>
            <TableCell className="text-right">{formatKES(row.debit)}</TableCell>
            <TableCell className="text-right">{formatKES(row.credit)}</TableCell>
          </TableRow>
        ))}
        <TableRow className="font-bold">
          <TableCell colSpan={3}>Totals</TableCell>
          <TableCell className="text-right">{formatKES(debit)}</TableCell>
          <TableCell className="text-right">{formatKES(credit)}</TableCell>
        </TableRow>
      </TableBody>
      </Table>
      <PaginationControls page={Math.min(page, pageCount)} total={rows.length} onPageChange={setPage} />
    </>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
