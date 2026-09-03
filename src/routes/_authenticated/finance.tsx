import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Coins,
  Download,
  Eye,
  FileText,
  Plus,
  Printer,
  Receipt,
  RotateCcw,
  Trash2,
  Upload,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app-shell";
import { DataTable, type Column } from "@/components/data-table";
import { RequireSchool } from "@/components/require-school";
import { SchoolLogo } from "@/components/school-logo";
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
import { supabase } from "@/lib/supabase";
import { GRADE_LABELS, type CbeGrade } from "@/lib/cbe";
import { downloadCsv, parseCsv, printSection } from "@/lib/csv";
import { formatDate, formatDateTime, formatKES } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/finance")({
  head: () => ({
    meta: [
      { title: "Fees, invoices & receipts · SHANSCOTT CBE" },
      {
        name: "description",
        content:
          "Invoice learners, record M-PESA and bank payments, issue receipts and print reconciled fee statements.",
      },
      { property: "og:title", content: "Fees, invoices & receipts · SHANSCOTT CBE" },
      {
        property: "og:description",
        content: "A reconciled fee ledger with CSV import and export for Kenyan schools.",
      },
    ],
  }),
  component: () => (
    <RequireSchool roles={["admin", "principal", "deputy", "super_admin"]}>
      <FinancePage />
    </RequireSchool>
  ),
});

const METHODS = ["mpesa", "bank", "cash", "cheque", "bursary", "waiver"] as const;

function FinancePage() {
  const school = useSchool();
  const qc = useQueryClient();
  const schoolId = school.schoolId!;

  const learners = useQuery({
    queryKey: ["learners-lite", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("learners")
        .select("id, admission_number, first_name, last_name, current_grade")
        .eq("school_id", schoolId)
        .eq("is_archived", false)
        .order("last_name");
      if (error) throw error;
      return data;
    },
  });

  const feeItems = useQuery({
    queryKey: ["fee-items", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fee_items")
        .select("*")
        .eq("school_id", schoolId)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const invoices = useQuery({
    queryKey: ["invoices", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .eq("school_id", schoolId)
        .order("issue_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const payments = useQuery({
    queryKey: ["payments", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("*")
        .eq("school_id", schoolId)
        .order("paid_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const ledger = useQuery({
    queryKey: ["ledger", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ledger_entries")
        .select("*")
        .eq("school_id", schoolId)
        .order("entry_date");
      if (error) throw error;
      return data;
    },
  });

  const learnerName = (id: string) => {
    const l = learners.data?.find((x) => x.id === id);
    return l ? `${l.first_name} ${l.last_name}` : "—";
  };
  const learnerAdm = (id: string) =>
    learners.data?.find((x) => x.id === id)?.admission_number ?? "";

  const totals = (() => {
    const billed = (invoices.data ?? [])
      .filter((invoice) => invoice.status !== "void")
      .reduce((sum, invoice) => sum + Number(invoice.total || 0), 0);
    const received = (payments.data ?? [])
      .filter((payment) => !payment.is_reversed)
      .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    return { billed, received, outstanding: billed - received };
  })();

  // ---------- fee item
  const [fiOpen, setFiOpen] = useState(false);
  const [fiName, setFiName] = useState("");
  const [fiGrade, setFiGrade] = useState<string>("all");
  const [fiAmount, setFiAmount] = useState("");

  const createFeeItem = useMutation({
    mutationFn: async () => {
      if (fiName.trim().length < 2) throw new Error("Enter the fee item name.");
      const amount = Number(fiAmount);
      if (!(amount >= 0)) throw new Error("Enter a valid amount.");
      const { error } = await supabase.from("fee_items").insert({
        school_id: schoolId,
        name: fiName.trim(),
        grade: fiGrade === "all" ? null : (fiGrade as CbeGrade),
        term_id: school.termId,
        amount,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Fee item added successfully.");
      setFiOpen(false);
      setFiName("");
      setFiAmount("");
      void qc.invalidateQueries({ queryKey: ["fee-items", schoolId] });
    },
    onError: (e: Error) => toast.error("Could not add the fee item.", { description: e.message }),
  });

  // ---------- invoice
  const [invOpen, setInvOpen] = useState(false);
  const [invLearner, setInvLearner] = useState("");
  const [invDue, setInvDue] = useState("");
  const [invNotes, setInvNotes] = useState("");
  const [invSelected, setInvSelected] = useState<string[]>([]);
  type InvRow = NonNullable<typeof invoices.data>[number];
  type FeeRow = NonNullable<typeof feeItems.data>[number];
  const [viewInvoice, setViewInvoice] = useState<InvRow | null>(null);
  const [editInvoice, setEditInvoice] = useState<InvRow | null>(null);
  const [editInvoiceTotal, setEditInvoiceTotal] = useState("");
  const [editInvoiceDue, setEditInvoiceDue] = useState("");
  const [editInvoiceStatus, setEditInvoiceStatus] = useState("issued");
  const [editFee, setEditFee] = useState<FeeRow | null>(null);
  const [viewFee, setViewFee] = useState<FeeRow | null>(null);
  const [editFeeName, setEditFeeName] = useState("");
  const [editFeeAmount, setEditFeeAmount] = useState("");
  const [editFeeGrade, setEditFeeGrade] = useState("all");

  const invoiceTotal = (feeItems.data ?? [])
    .filter((f) => invSelected.includes(f.id))
    .reduce((s, f) => s + Number(f.amount), 0);

  const createInvoice = useMutation({
    mutationFn: async () => {
      if (!invLearner) throw new Error("Select a learner.");
      if (invSelected.length === 0) throw new Error("Select at least one fee item.");
      const { data: number, error: numErr } = await supabase.rpc("next_counter", {
        _school_id: schoolId,
        _key: "invoice",
        _prefix: "INV",
      });
      if (numErr) throw numErr;

      const { data: inv, error } = await supabase
        .from("invoices")
        .insert({
          school_id: schoolId,
          learner_id: invLearner,
          academic_year_id: school.academicYearId,
          term_id: school.termId,
          invoice_number: number as string,
          due_date: invDue || null,
          total: invoiceTotal,
          notes: invNotes.trim() || null,
          status: "issued",
          created_by: school.userId,
        })
        .select("id")
        .single();
      if (error) throw error;

      const items = (feeItems.data ?? [])
        .filter((f) => invSelected.includes(f.id))
        .map((f) => ({
          school_id: schoolId,
          invoice_id: inv.id,
          description: f.name,
          quantity: 1,
          unit_amount: Number(f.amount),
        }));
      const { error: itemErr } = await supabase.from("invoice_items").insert(items);
      if (itemErr) throw itemErr;
      return number as string;
    },
    onSuccess: (number) => {
      toast.success(`Invoice ${number} issued successfully.`);
      setInvOpen(false);
      setInvSelected([]);
      setInvNotes("");
      setInvDue("");
      void qc.invalidateQueries({ queryKey: ["invoices", schoolId] });
      void qc.invalidateQueries({ queryKey: ["ledger", schoolId] });
    },
    onError: (e: Error) => toast.error("Could not issue the invoice.", { description: e.message }),
  });

  const bulkInvoice = useMutation({
    mutationFn: async () => {
      const items = (feeItems.data ?? []).filter((f) => invSelected.includes(f.id));
      if (items.length === 0) throw new Error("Select the fee items to bill.");
      const total = items.reduce((s, f) => s + Number(f.amount), 0);
      const target = learners.data ?? [];
      let issued = 0;
      for (const learner of target) {
        const { data: number, error: numErr } = await supabase.rpc("next_counter", {
          _school_id: schoolId,
          _key: "invoice",
          _prefix: "INV",
        });
        if (numErr) throw numErr;
        const { data: inv, error } = await supabase
          .from("invoices")
          .insert({
            school_id: schoolId,
            learner_id: learner.id,
            academic_year_id: school.academicYearId,
            term_id: school.termId,
            invoice_number: number as string,
            due_date: invDue || null,
            total,
            notes: invNotes.trim() || null,
            status: "issued",
            created_by: school.userId,
          })
          .select("id")
          .single();
        if (error) throw error;
        const { error: itemErr } = await supabase.from("invoice_items").insert(
          items.map((f) => ({
            school_id: schoolId,
            invoice_id: inv.id,
            description: f.name,
            quantity: 1,
            unit_amount: Number(f.amount),
          })),
        );
        if (itemErr) throw itemErr;
        issued++;
      }
      return issued;
    },
    onSuccess: (n) => {
      toast.success(`${n} invoice${n === 1 ? "" : "s"} issued successfully.`);
      setInvOpen(false);
      setInvSelected([]);
      void qc.invalidateQueries({ queryKey: ["invoices", schoolId] });
      void qc.invalidateQueries({ queryKey: ["ledger", schoolId] });
    },
    onError: (e: Error) => toast.error("Bulk invoicing stopped.", { description: e.message }),
  });

  const updateInvoice = useMutation({
    mutationFn: async () => {
      if (!editInvoice) throw new Error("Select an invoice to edit.");
      const total = Number(editInvoiceTotal);
      if (!(total >= 0)) throw new Error("Enter a valid invoice total.");
      const { error } = await supabase
        .from("invoices")
        .update({
          total,
          due_date: editInvoiceDue || null,
          status: editInvoiceStatus,
        })
        .eq("id", editInvoice.id)
        .eq("school_id", schoolId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Invoice updated.");
      setEditInvoice(null);
      void qc.invalidateQueries({ queryKey: ["invoices", schoolId] });
      void qc.invalidateQueries({ queryKey: ["ledger", schoolId] });
    },
    onError: (e: Error) => toast.error("Invoice could not be updated.", { description: e.message }),
  });

  const deleteInvoice = useMutation({
    mutationFn: async (invoiceId: string) => {
      const { data, error } = await supabase
        .from("invoices")
        .delete()
        .eq("id", invoiceId)
        .eq("school_id", schoolId)
        .select("id");
      if (error) throw error;
      if (!data?.length) {
        throw new Error("Invoice was not deleted. Check your Finance permissions and school assignment.");
      }
    },
    onSuccess: () => {
      toast.success("Invoice deleted.");
      void qc.invalidateQueries({ queryKey: ["invoices", schoolId] });
      void qc.invalidateQueries({ queryKey: ["ledger", schoolId] });
    },
    onError: (e: Error) => toast.error("Invoice could not be deleted.", { description: e.message }),
  });

  const updateFee = useMutation({
    mutationFn: async () => {
      if (!editFee) throw new Error("Select a fee item to edit.");
      const amount = Number(editFeeAmount);
      if (editFeeName.trim().length < 2 || !(amount >= 0))
        throw new Error("Enter a valid fee item and amount.");
      const { error } = await supabase
        .from("fee_items")
        .update({
          name: editFeeName.trim(),
          amount,
          grade: editFeeGrade === "all" ? null : (editFeeGrade as CbeGrade),
        })
        .eq("id", editFee.id)
        .eq("school_id", schoolId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Fee item updated.");
      setEditFee(null);
      void qc.invalidateQueries({ queryKey: ["fee-items", schoolId] });
    },
    onError: (e: Error) =>
      toast.error("Fee item could not be updated.", { description: e.message }),
  });

  const deleteFee = useMutation({
    mutationFn: async (feeId: string) => {
      const { error } = await supabase
        .from("fee_items")
        .delete()
        .eq("id", feeId)
        .eq("school_id", schoolId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Fee item deleted.");
      void qc.invalidateQueries({ queryKey: ["fee-items", schoolId] });
    },
    onError: (e: Error) =>
      toast.error("Fee item could not be deleted.", { description: e.message }),
  });

  // ---------- payment
  const [payOpen, setPayOpen] = useState(false);
  const [payLearner, setPayLearner] = useState("");
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState<string>("mpesa");
  const [payRef, setPayRef] = useState("");
  const [payer, setPayer] = useState("");
  const [receipt, setReceipt] = useState<{
    id?: string;
    number: string;
    learner: string;
    amount: number;
    method: string;
    ref: string;
  } | null>(null);

  const deletePayment = useMutation({
    mutationFn: async (paymentId: string) => {
      const { error } = await supabase
        .from("payments")
        .delete()
        .eq("id", paymentId)
        .eq("school_id", schoolId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Payment deleted.");
      setReceipt(null);
      void qc.invalidateQueries({ queryKey: ["payments", schoolId] });
      void qc.invalidateQueries({ queryKey: ["ledger", schoolId] });
      void qc.invalidateQueries({ queryKey: ["dashboard-fees", schoolId] });
      void qc.invalidateQueries({ queryKey: ["dashboard", schoolId] });
    },
    onError: (e: Error) => toast.error("Payment could not be deleted.", { description: e.message }),
  });

  const rollbackPayment = useMutation({
    mutationFn: async (paymentId: string) => {
      const { error } = await supabase
        .from("payments")
        .update({ is_reversed: true })
        .eq("id", paymentId)
        .eq("school_id", schoolId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Transaction rolled back.");
      setReceipt(null);
      void qc.invalidateQueries({ queryKey: ["payments", schoolId] });
      void qc.invalidateQueries({ queryKey: ["ledger", schoolId] });
    },
    onError: (e: Error) =>
      toast.error("Transaction could not be rolled back.", { description: e.message }),
  });

  function viewPayment(payment: PayRow) {
    setReceipt({
      id: payment.id,
      number: payment.receipt_number,
      learner: learnerName(payment.learner_id),
      amount: Number(payment.amount),
      method: payment.method,
      ref: payment.reference ?? "",
    });
  }

  const recordPayment = useMutation({
    mutationFn: async () => {
      if (!payLearner) throw new Error("Select a learner.");
      const amount = Number(payAmount);
      if (!(amount > 0)) throw new Error("Enter an amount greater than zero.");
      const { data: number, error: numErr } = await supabase.rpc("next_counter", {
        _school_id: schoolId,
        _key: "receipt",
        _prefix: "RCT",
      });
      if (numErr) throw numErr;
      const { data: payment, error } = await supabase
        .from("payments")
        .insert({
          school_id: schoolId,
          learner_id: payLearner,
          term_id: school.termId,
          receipt_number: number as string,
          amount,
          method: payMethod,
          reference: payRef.trim() || null,
          payer_name: payer.trim() || null,
          recorded_by: school.userId,
        })
        .select("id")
        .single();
      if (error) throw error;
      if (!payment?.id) throw new Error("The payment was not saved.");
      return { number: number as string, amount };
    },
    onSuccess: ({ number, amount }) => {
      toast.success(`Receipt ${number} issued successfully.`);
      setReceipt({
        number,
        learner: learnerName(payLearner),
        amount,
        method: payMethod,
        ref: payRef,
      });
      setPayOpen(false);
      setPayAmount("");
      setPayRef("");
      setPayer("");
      void qc.invalidateQueries({ queryKey: ["payments", schoolId] });
      void qc.invalidateQueries({ queryKey: ["ledger", schoolId] });
      void qc.invalidateQueries({ queryKey: ["dashboard-fees", schoolId] });
      void qc.invalidateQueries({ queryKey: ["dashboard", schoolId] });
    },
    onError: (e: Error) => toast.error("Payment was not recorded.", { description: e.message }),
  });

  async function importPayments(file: File) {
    const rows = parseCsv(await file.text());
    if (rows.length === 0) {
      toast.error("That CSV file has no data rows.", {
        description: "Columns: admission_number, amount, method, reference, payer_name",
      });
      return;
    }
    let ok = 0;
    const problems: string[] = [];
    for (const row of rows) {
      const learner = (learners.data ?? []).find(
        (l) => l.admission_number === row["admission_number"],
      );
      const amount = Number(row["amount"]);
      if (!learner) {
        problems.push(`${row["admission_number"]}: learner not found`);
        continue;
      }
      if (!(amount > 0)) {
        problems.push(`${row["admission_number"]}: invalid amount`);
        continue;
      }
      const method = METHODS.includes((row["method"] ?? "") as (typeof METHODS)[number])
        ? row["method"]!
        : "mpesa";
      const { data: number, error: numErr } = await supabase.rpc("next_counter", {
        _school_id: schoolId,
        _key: "receipt",
        _prefix: "RCT",
      });
      if (numErr) {
        problems.push(`${row["admission_number"]}: ${numErr.message}`);
        continue;
      }
      const { error } = await supabase.from("payments").insert({
        school_id: schoolId,
        learner_id: learner.id,
        term_id: school.termId,
        receipt_number: number as string,
        amount,
        method,
        reference: row["reference"] || null,
        payer_name: row["payer_name"] || null,
        recorded_by: school.userId,
      });
      if (error) problems.push(`${row["admission_number"]}: ${error.message}`);
      else ok++;
    }
    void qc.invalidateQueries({ queryKey: ["payments", schoolId] });
    void qc.invalidateQueries({ queryKey: ["ledger", schoolId] });
    void qc.invalidateQueries({ queryKey: ["dashboard-fees", schoolId] });
    void qc.invalidateQueries({ queryKey: ["dashboard", schoolId] });
    if (ok > 0) toast.success(`${ok} payment${ok === 1 ? "" : "s"} imported successfully.`);
    if (problems.length > 0)
      toast.error(`${problems.length} row(s) skipped.`, {
        description: problems.slice(0, 3).join(" · "),
      });
  }

  // ---------- statement
  const [stLearner, setStLearner] = useState("");
  const statementRows = (() => {
    if (!stLearner) return [];
    let balance = 0;
    return (ledger.data ?? [])
      .filter((e) => e.learner_id === stLearner)
      .map((e) => {
        balance += e.entry_type === "debit" ? Number(e.amount) : -Number(e.amount);
        return { ...e, balance };
      });
  })();

  const invoiceColumns: Column<InvRow>[] = [
    {
      key: "number",
      header: "Invoice",
      sortable: true,
      sortValue: (r) => r.invoice_number,
      cell: (r) => <span className="font-mono text-xs">{r.invoice_number}</span>,
    },
    {
      key: "learner",
      header: "Learner",
      cell: (r) => <span className="font-medium">{learnerName(r.learner_id)}</span>,
    },
    {
      key: "issued",
      header: "Issued",
      sortable: true,
      sortValue: (r) => r.issue_date,
      cell: (r) => formatDate(r.issue_date),
    },
    { key: "due", header: "Due", cell: (r) => formatDate(r.due_date) },
    {
      key: "total",
      header: "Total",
      className: "text-right",
      sortable: true,
      sortValue: (r) => Number(r.total),
      cell: (r) => formatKES(Number(r.total)),
    },
    {
      key: "status",
      header: "Status",
      cell: (r) => (
        <Badge variant={r.status === "issued" ? "default" : "secondary"}>{r.status}</Badge>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      className: "text-right",
      cell: (r) => (
        <div className="flex justify-end gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setViewInvoice(r)}
            title="View invoice"
            aria-label={`View invoice ${r.invoice_number}`}
          >
            <Eye className="size-4" /> <span className="hidden lg:inline">View</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setEditInvoice(r);
              setEditInvoiceTotal(String(r.total));
              setEditInvoiceDue(r.due_date ?? "");
              setEditInvoiceStatus(r.status);
            }}
            title="Edit invoice"
            aria-label={`Edit invoice ${r.invoice_number}`}
          >
            <FileText className="size-4 text-primary" />{" "}
            <span className="hidden lg:inline">Edit</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              if (window.confirm(`Delete invoice ${r.invoice_number}? This cannot be undone.`))
                deleteInvoice.mutate(r.id);
            }}
            title="Delete invoice"
            aria-label={`Delete invoice ${r.invoice_number}`}
          >
            <Trash2 className="size-4 text-destructive" />{" "}
            <span className="hidden lg:inline">Delete</span>
          </Button>
        </div>
      ),
    },
  ];

  type PayRow = NonNullable<typeof payments.data>[number];
  const paymentColumns: Column<PayRow>[] = [
    {
      key: "receipt",
      header: "Receipt",
      cell: (r) => <span className="font-mono text-xs">{r.receipt_number}</span>,
    },
    {
      key: "learner",
      header: "Learner",
      cell: (r) => <span className="font-medium">{learnerName(r.learner_id)}</span>,
    },
    {
      key: "paid",
      header: "Paid at",
      sortable: true,
      sortValue: (r) => r.paid_at,
      cell: (r) => formatDateTime(r.paid_at),
    },
    { key: "method", header: "Method", cell: (r) => <Badge variant="outline">{r.method}</Badge> },
    { key: "ref", header: "Reference", cell: (r) => r.reference ?? "—" },
    {
      key: "amount",
      header: "Amount",
      className: "text-right",
      sortable: true,
      sortValue: (r) => Number(r.amount),
      cell: (r) => formatKES(Number(r.amount)),
    },
    {
      key: "actions",
      header: "Actions",
      className: "text-right",
      cell: (r) => (
        <div className="flex justify-end gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => viewPayment(r)}
            title="View receipt"
            aria-label={`View receipt ${r.receipt_number}`}
          >
            <Eye className="size-4" />
            <span className="hidden lg:inline">View</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={r.is_reversed || rollbackPayment.isPending}
            onClick={() => {
              if (
                window.confirm(
                  `Roll back transaction ${r.receipt_number}? This will reverse the payment in the ledger.`,
                )
              )
                rollbackPayment.mutate(r.id);
            }}
            title="Roll back transaction"
            aria-label={`Roll back transaction ${r.receipt_number}`}
          >
            <RotateCcw className="size-4 text-amber-600" />
            <span className="hidden lg:inline">Rollback</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={deletePayment.isPending}
            onClick={() => {
              if (window.confirm(`Delete receipt ${r.receipt_number}? This cannot be undone.`))
                deletePayment.mutate(r.id);
            }}
            title="Delete payment"
            aria-label={`Delete payment ${r.receipt_number}`}
          >
            <Trash2 className="size-4 text-destructive" />
            <span className="hidden lg:inline">Delete</span>
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Fees & finance"
        description="Invoices, payments, receipts and statements all post to one reconciled ledger."
        icon={Coins}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        {[
          { label: "Total billed", value: totals.billed, icon: FileText },
          { label: "Total received", value: totals.received, icon: Wallet },
          { label: "Outstanding balance", value: totals.outstanding, icon: Coins },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="flex items-center gap-3 pt-6">
              <div className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
                <s.icon className="size-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{s.label}</p>
                <p className="text-lg font-semibold">{formatKES(s.value)}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="invoices">
        <TabsList className="mb-4 flex-wrap">
          <TabsTrigger value="invoices">
            <FileText className="mr-2 size-4" /> Invoices
          </TabsTrigger>
          <TabsTrigger value="payments">
            <Receipt className="mr-2 size-4" /> Payments & receipts
          </TabsTrigger>
          <TabsTrigger value="statements">
            <Wallet className="mr-2 size-4" /> Statements
          </TabsTrigger>
          <TabsTrigger value="items">
            <Coins className="mr-2 size-4" /> Fee structure
          </TabsTrigger>
        </TabsList>

        <TabsContent value="invoices">
          <DataTable
            rows={invoices.data ?? []}
            columns={invoiceColumns}
            loading={invoices.isLoading}
            rowKey={(r) => r.id}
            searchValue={(r) => `${r.invoice_number} ${learnerName(r.learner_id)}`}
            searchPlaceholder="Search invoices…"
            emptyTitle="No invoices yet"
            emptyDescription="Define your fee structure, then invoice a single learner or the whole school."
            toolbar={
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() =>
                    downloadCsv(
                      "invoices",
                      (invoices.data ?? []).map((r) => ({
                        invoice_number: r.invoice_number,
                        admission_number: learnerAdm(r.learner_id),
                        learner: learnerName(r.learner_id),
                        issue_date: r.issue_date,
                        due_date: r.due_date ?? "",
                        total: Number(r.total),
                        status: r.status,
                      })),
                    )
                  }
                >
                  <Download className="mr-2 size-4" /> Export
                </Button>
                <Dialog open={invOpen} onOpenChange={setInvOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="mr-2 size-4" /> New invoice
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
                    <DialogHeader className="rounded-xl border border-primary/15 bg-primary/[0.04] p-4 sm:p-5">
                      <DialogTitle className="text-xl">Create invoices</DialogTitle>
                      <DialogDescription>
                        Select fee items, set a due date, then issue one invoice or bill every
                        active learner.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-5 py-1">
                      <div className="space-y-1.5 rounded-xl border bg-muted/20 p-4">
                        <Label>Learner for single invoice</Label>
                        <Select value={invLearner} onValueChange={setInvLearner}>
                          <SelectTrigger className="bg-background">
                            <SelectValue placeholder="Select learner" />
                          </SelectTrigger>
                          <SelectContent>
                            {(learners.data ?? []).map((l) => (
                              <SelectItem key={l.id} value={l.id}>
                                {l.first_name} {l.last_name} · {l.admission_number}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2 rounded-xl border bg-muted/20 p-4">
                        <Label>Fee items</Label>
                        <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border bg-background p-2">
                          {(feeItems.data ?? []).length === 0 && (
                            <p className="p-2 text-sm text-muted-foreground">
                              Add fee items under “Fee structure” first.
                            </p>
                          )}
                          {(feeItems.data ?? []).map((f) => {
                            const on = invSelected.includes(f.id);
                            return (
                              <button
                                key={f.id}
                                type="button"
                                onClick={() =>
                                  setInvSelected((p) =>
                                    on ? p.filter((x) => x !== f.id) : [...p, f.id],
                                  )
                                }
                                className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-sm ${on ? "bg-primary/10" : "hover:bg-muted"}`}
                              >
                                <span>
                                  {f.name}
                                  {f.grade ? ` · ${GRADE_LABELS[f.grade as CbeGrade]}` : ""}
                                </span>
                                <span className="font-medium">{formatKES(Number(f.amount))}</span>
                              </button>
                            );
                          })}
                        </div>
                        <p className="flex items-center justify-between gap-3 rounded-lg bg-primary/10 px-3 py-2 text-sm">
                          <span>Invoice total</span>
                          <strong className="text-base text-primary">
                            {formatKES(invoiceTotal)}
                          </strong>
                        </p>
                      </div>
                      <div className="space-y-1.5 rounded-xl border bg-muted/20 p-4">
                        <Label htmlFor="inv-due">Due date</Label>
                        <Input
                          id="inv-due"
                          type="date"
                          value={invDue}
                          onChange={(e) => setInvDue(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1.5 rounded-xl border bg-muted/20 p-4">
                        <Label htmlFor="inv-notes">Notes</Label>
                        <Textarea
                          id="inv-notes"
                          value={invNotes}
                          onChange={(e) => setInvNotes(e.target.value)}
                          rows={2}
                        />
                      </div>
                    </div>
                    <DialogFooter className="flex-col gap-2 sm:flex-row">
                      <Button
                        variant="outline"
                        onClick={() => bulkInvoice.mutate()}
                        disabled={bulkInvoice.isPending}
                      >
                        Invoice all learners
                      </Button>
                      <Button
                        onClick={() => createInvoice.mutate()}
                        disabled={createInvoice.isPending}
                      >
                        Issue invoice
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            }
          />
        </TabsContent>

        <TabsContent value="payments">
          {receipt && (
            <Card className="mb-4">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Latest receipt</CardTitle>
                <Button size="sm" variant="outline" onClick={() => printSection("receipt-print")}>
                  <Printer className="mr-2 size-4" /> Print receipt
                </Button>
              </CardHeader>
              <CardContent>
                <div
                  id="receipt-print"
                  className="print-page mx-auto max-w-md space-y-2 rounded-lg border p-5 text-sm"
                >
                  <div className="text-center">
                    <SchoolLogo
                      logoUrl={school.school?.logo_url}
                      schoolName={school.school?.name}
                      shortName={school.school?.short_name}
                      className="mx-auto mb-3 size-16 rounded-lg border"
                    />
                    <p className="text-base font-semibold">{school.school?.name}</p>
                    <p className="text-muted-foreground">Official fee receipt</p>
                  </div>
                  <div className="flex justify-between">
                    <span>Receipt no.</span>
                    <span className="font-mono">{receipt.number}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Learner</span>
                    <span>{receipt.learner}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Method</span>
                    <span>{receipt.method}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Reference</span>
                    <span>{receipt.ref || "—"}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2 text-base font-semibold">
                    <span>Amount</span>
                    <span>{formatKES(receipt.amount)}</span>
                  </div>
                  <p className="pt-2 text-center text-xs text-muted-foreground">
                    Received by {school.fullName} · {formatDateTime(new Date())}
                  </p>
                  {receipt.id && (
                    <p className="text-center text-[11px] text-muted-foreground print:hidden">
                      This receipt is available from the payment actions below.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
          <DataTable
            rows={payments.data ?? []}
            columns={paymentColumns}
            loading={payments.isLoading}
            rowKey={(r) => r.id}
            searchValue={(r) =>
              `${r.receipt_number} ${learnerName(r.learner_id)} ${r.reference ?? ""}`
            }
            searchPlaceholder="Search receipts…"
            emptyTitle="No payments recorded"
            emptyDescription="Record M-PESA, bank, cash or bursary payments — each one issues a numbered receipt."
            toolbar={
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() =>
                    downloadCsv(
                      "payments",
                      (payments.data ?? []).map((r) => ({
                        receipt_number: r.receipt_number,
                        admission_number: learnerAdm(r.learner_id),
                        learner: learnerName(r.learner_id),
                        paid_at: r.paid_at,
                        method: r.method,
                        reference: r.reference ?? "",
                        amount: Number(r.amount),
                      })),
                    )
                  }
                >
                  <Download className="mr-2 size-4" /> Export
                </Button>
                <Button variant="outline" asChild>
                  <label className="cursor-pointer">
                    <Upload className="mr-2 size-4" /> Import
                    <input
                      type="file"
                      accept=".csv"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void importPayments(f);
                        e.target.value = "";
                      }}
                    />
                  </label>
                </Button>
                <Dialog open={payOpen} onOpenChange={setPayOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="mr-2 size-4" /> Record payment
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Record payment</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <Label>Learner</Label>
                        <Select value={payLearner} onValueChange={setPayLearner}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select learner" />
                          </SelectTrigger>
                          <SelectContent>
                            {(learners.data ?? []).map((l) => (
                              <SelectItem key={l.id} value={l.id}>
                                {l.first_name} {l.last_name} · {l.admission_number}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label htmlFor="pay-amount">Amount (KES)</Label>
                          <Input
                            id="pay-amount"
                            type="number"
                            min={1}
                            value={payAmount}
                            onChange={(e) => setPayAmount(e.target.value)}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Method</Label>
                          <Select value={payMethod} onValueChange={setPayMethod}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {METHODS.map((m) => (
                                <SelectItem key={m} value={m}>
                                  {m}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label htmlFor="pay-ref">Reference (e.g. M-PESA code)</Label>
                          <Input
                            id="pay-ref"
                            value={payRef}
                            onChange={(e) => setPayRef(e.target.value)}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="pay-payer">Payer name</Label>
                          <Input
                            id="pay-payer"
                            value={payer}
                            onChange={(e) => setPayer(e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        onClick={() => recordPayment.mutate()}
                        disabled={recordPayment.isPending}
                      >
                        Record & issue receipt
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            }
          />
        </TabsContent>

        <TabsContent value="statements">
          <Card className="mb-4 no-print">
            <CardContent className="grid gap-3 pt-6 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Learner</Label>
                <Select value={stLearner} onValueChange={setStLearner}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select learner" />
                  </SelectTrigger>
                  <SelectContent>
                    {(learners.data ?? []).map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.first_name} {l.last_name} · {l.admission_number}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-2">
                <Button
                  variant="outline"
                  disabled={!stLearner}
                  onClick={() => printSection("statement-print")}
                >
                  <Printer className="mr-2 size-4" /> Print
                </Button>
                <Button
                  variant="outline"
                  disabled={!stLearner}
                  onClick={() =>
                    downloadCsv(
                      `statement-${learnerAdm(stLearner)}`,
                      statementRows.map((r) => ({
                        date: r.entry_date,
                        description: r.description,
                        source: r.source,
                        debit: r.entry_type === "debit" ? Number(r.amount) : "",
                        credit: r.entry_type === "credit" ? Number(r.amount) : "",
                        balance: r.balance,
                      })),
                    )
                  }
                >
                  <Download className="mr-2 size-4" /> Export CSV
                </Button>
              </div>
            </CardContent>
          </Card>

          {stLearner && (
            <div id="statement-print" className="print-page rounded-lg border bg-card p-5">
              <div className="mb-4 flex items-center gap-4 border-b pb-4">
                <SchoolLogo
                  logoUrl={school.school?.logo_url}
                  schoolName={school.school?.name}
                  shortName={school.school?.short_name}
                  className="size-16 rounded-lg border"
                />
                <div>
                  <h2 className="text-lg font-semibold">{school.school?.name} — fee statement</h2>
                  <p className="text-sm text-muted-foreground">
                    {learnerName(stLearner)} · {learnerAdm(stLearner)} · generated{" "}
                    {formatDate(new Date())}
                  </p>
                </div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Debit</TableHead>
                    <TableHead className="text-right">Credit</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {statementRows.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="py-8 text-center text-sm text-muted-foreground"
                      >
                        No ledger activity for this learner yet.
                      </TableCell>
                    </TableRow>
                  )}
                  {statementRows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{formatDate(r.entry_date)}</TableCell>
                      <TableCell>{r.description}</TableCell>
                      <TableCell className="text-right">
                        {r.entry_type === "debit" ? formatKES(Number(r.amount)) : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {r.entry_type === "credit" ? formatKES(Number(r.amount)) : "—"}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatKES(r.balance)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {statementRows.length > 0 && (
                <p className="mt-4 text-right text-sm">
                  Closing balance:{" "}
                  <strong>{formatKES(statementRows[statementRows.length - 1]!.balance)}</strong>
                </p>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="items">
          <Card id="fee-structure-print" className="print-page">
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex items-center gap-3">
                <SchoolLogo
                  logoUrl={school.school?.logo_url}
                  schoolName={school.school?.name}
                  shortName={school.school?.short_name}
                  className="size-12 rounded-lg border"
                />
                <CardTitle className="text-base">Fee structure for the selected term</CardTitle>
              </div>
              <div className="no-print flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => printSection("fee-structure-print")}
                >
                  <Printer className="mr-2 size-4" /> Print
                </Button>
                <Dialog open={fiOpen} onOpenChange={setFiOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="mr-2 size-4" /> Add fee item
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add a fee item</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="fi-name">Name</Label>
                        <Input
                          id="fi-name"
                          value={fiName}
                          onChange={(e) => setFiName(e.target.value)}
                          placeholder="e.g. Tuition, Lunch, Transport"
                        />
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label>Applies to</Label>
                          <Select value={fiGrade} onValueChange={setFiGrade}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All grades</SelectItem>
                              {(school.grades.length ? school.grades : []).map((g) => (
                                <SelectItem key={g} value={g}>
                                  {GRADE_LABELS[g]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="fi-amount">Amount (KES)</Label>
                          <Input
                            id="fi-amount"
                            type="number"
                            min={0}
                            value={fiAmount}
                            onChange={(e) => setFiAmount(e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        onClick={() => createFeeItem.mutate()}
                        disabled={createFeeItem.isPending}
                      >
                        Save fee item
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Grade</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="no-print text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(feeItems.data ?? []).length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="py-8 text-center text-sm text-muted-foreground"
                      >
                        No fee items yet.
                      </TableCell>
                    </TableRow>
                  )}
                  {(feeItems.data ?? []).map((f) => (
                    <TableRow key={f.id}>
                      <TableCell className="font-medium">{f.name}</TableCell>
                      <TableCell className="no-print">
                        {f.grade ? GRADE_LABELS[f.grade as CbeGrade] : "All grades"}
                      </TableCell>
                      <TableCell className="text-right">{formatKES(Number(f.amount))}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setViewFee(f)}
                            title="View fee item"
                            aria-label={`View fee item ${f.name}`}
                          >
                            <Eye className="size-4" />{" "}
                            <span className="hidden lg:inline">View</span>
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditFee(f);
                              setEditFeeName(f.name);
                              setEditFeeAmount(String(f.amount));
                              setEditFeeGrade(f.grade ?? "all");
                            }}
                            title="Edit fee item"
                            aria-label={`Edit fee item ${f.name}`}
                          >
                            <FileText className="size-4 text-primary" />{" "}
                            <span className="hidden lg:inline">Edit</span>
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (
                                window.confirm(`Delete fee item ${f.name}? This cannot be undone.`)
                              )
                                deleteFee.mutate(f.id);
                            }}
                            title="Delete fee item"
                            aria-label={`Delete fee item ${f.name}`}
                          >
                            <Trash2 className="size-4 text-destructive" />{" "}
                            <span className="hidden lg:inline">Delete</span>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={Boolean(viewInvoice)} onOpenChange={(open) => !open && setViewInvoice(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invoice {viewInvoice?.invoice_number}</DialogTitle>
            <DialogDescription>
              Invoice details for {viewInvoice ? learnerName(viewInvoice.learner_id) : ""}.
            </DialogDescription>
          </DialogHeader>
          {viewInvoice && (
            <div className="space-y-3 rounded-lg border bg-muted/20 p-4 text-sm">
              <div className="flex justify-between">
                <span>Learner</span>
                <strong>{learnerName(viewInvoice.learner_id)}</strong>
              </div>
              <div className="flex justify-between">
                <span>Issued</span>
                <strong>{formatDate(viewInvoice.issue_date)}</strong>
              </div>
              <div className="flex justify-between">
                <span>Due</span>
                <strong>{formatDate(viewInvoice.due_date)}</strong>
              </div>
              <div className="flex justify-between">
                <span>Status</span>
                <Badge>{viewInvoice.status}</Badge>
              </div>
              <div className="flex justify-between border-t pt-3">
                <span>Total</span>
                <strong>{formatKES(Number(viewInvoice.total))}</strong>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editInvoice)} onOpenChange={(open) => !open && setEditInvoice(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit invoice {editInvoice?.invoice_number}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="edit-invoice-total">Total (KES)</Label>
              <Input
                id="edit-invoice-total"
                type="number"
                min={0}
                value={editInvoiceTotal}
                onChange={(e) => setEditInvoiceTotal(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-invoice-due">Due date</Label>
              <Input
                id="edit-invoice-due"
                type="date"
                value={editInvoiceDue}
                onChange={(e) => setEditInvoiceDue(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={editInvoiceStatus} onValueChange={setEditInvoiceStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="issued">Issued</SelectItem>
                  <SelectItem value="void">Void</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => updateInvoice.mutate()} disabled={updateInvoice.isPending}>
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editFee)} onOpenChange={(open) => !open && setEditFee(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit fee item</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="edit-fee-name">Name</Label>
              <Input
                id="edit-fee-name"
                value={editFeeName}
                onChange={(e) => setEditFeeName(e.target.value)}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Applies to</Label>
                <Select value={editFeeGrade} onValueChange={setEditFeeGrade}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All grades</SelectItem>
                    {school.grades.map((g) => (
                      <SelectItem key={g} value={g}>
                        {GRADE_LABELS[g]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-fee-amount">Amount (KES)</Label>
                <Input
                  id="edit-fee-amount"
                  type="number"
                  min={0}
                  value={editFeeAmount}
                  onChange={(e) => setEditFeeAmount(e.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => updateFee.mutate()} disabled={updateFee.isPending}>
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(viewFee)} onOpenChange={(open) => !open && setViewFee(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{viewFee?.name}</DialogTitle>
            <DialogDescription>Fee item for the selected term.</DialogDescription>
          </DialogHeader>
          {viewFee && (
            <div className="space-y-3 rounded-lg border bg-muted/20 p-4 text-sm">
              <div className="flex justify-between">
                <span>Item</span>
                <strong>{viewFee.name}</strong>
              </div>
              <div className="flex justify-between">
                <span>Grade</span>
                <strong>
                  {viewFee.grade ? GRADE_LABELS[viewFee.grade as CbeGrade] : "All grades"}
                </strong>
              </div>
              <div className="flex justify-between border-t pt-3">
                <span>Amount</span>
                <strong>{formatKES(Number(viewFee.amount))}</strong>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
