import { BackupImportPage } from "@/routes/_authenticated/backup-import";

export function AdmissionsPage() {
  return (
    <div className="relative isolate overflow-hidden rounded-3xl bg-gradient-to-br from-primary/[0.08] via-background to-accent/[0.18] p-1">
      <div className="rounded-[1.35rem] bg-background/90 px-3 py-3 sm:px-5 sm:py-5">
        <BackupImportPage variant="admissions" />
      </div>
    </div>
  );
}
