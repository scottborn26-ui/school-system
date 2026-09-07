import { supabase } from "@/lib/supabase";

type JournalLine = {
  accountId: string;
  debit: number;
  credit: number;
  description?: string;
};

export async function postJournalEntry(input: {
  schoolId: string;
  source: "manual" | "fees_module" | "inventory_module" | "payroll_module" | "other";
  sourceReferenceId?: string;
  narration: string;
  entryDate?: string;
  termId?: string;
  academicYearId?: string;
  lines: JournalLine[];
}) {
  const debit = input.lines.reduce((sum, line) => sum + line.debit, 0);
  const credit = input.lines.reduce((sum, line) => sum + line.credit, 0);
  if (!input.narration.trim()) throw new Error("A journal narration is required.");
  if (!input.lines.length || debit <= 0 || Math.abs(debit - credit) > 0.005) {
    throw new Error("Journal entry must have equal debit and credit totals.");
  }

  const { data: entryNumber, error: numberError } = await supabase.rpc("next_journal_entry_number", {
    _school_id: input.schoolId,
  });
  if (numberError) throw numberError;

  const { data: entry, error: entryError } = await supabase
    .from("journal_entries")
    .insert({
      school_id: input.schoolId,
      entry_number: entryNumber,
      entry_date: input.entryDate,
      term_id: input.termId,
      academic_year_id: input.academicYearId,
      source: input.source,
      source_reference_id: input.sourceReferenceId,
      narration: input.narration.trim(),
      created_by: (await supabase.auth.getUser()).data.user?.id ?? null,
    })
    .select("*")
    .single();
  if (entryError) throw entryError;

  const { error: linesError } = await supabase.from("journal_entry_lines").insert(
    input.lines.map((line) => ({
      school_id: input.schoolId,
      journal_entry_id: entry.id,
      account_id: line.accountId,
      debit_amount: line.debit,
      credit_amount: line.credit,
      description: line.description ?? null,
    })),
  );
  if (linesError) throw linesError;

  const { data: posted, error: postError } = await supabase.rpc("post_journal_entry", {
    _journal_entry_id: entry.id,
  });
  if (postError) throw postError;
  return posted;
}
