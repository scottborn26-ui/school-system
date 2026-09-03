import { type ReactNode, useMemo } from "react";
import { Edit3, MessageSquareText, Printer, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { initials } from "@/lib/format";
import { getPersonDisplayName, type DetailEntityType } from "@/lib/detail-panel";

interface DetailPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: DetailEntityType;
  photoUrl?: string | null;
  title?: string;
  subtitle?: string;
  status?: string;
  context?: string;
  children: ReactNode;
  onEdit?: () => void;
  onPrint?: () => void;
  onCloseFocus?: () => void;
}

export function DetailPanel({
  open,
  onOpenChange,
  entityType,
  photoUrl,
  title,
  subtitle,
  status,
  context,
  children,
  onEdit,
  onPrint,
  onCloseFocus,
}: DetailPanelProps) {
  const personLabel = useMemo(() => {
    const label = title || `${entityType === "learner" ? "Learner" : entityType === "staff" ? "Staff" : "Allocation"} ${entityType === "allocation" ? "details" : "profile"}`;
    return label;
  }, [entityType, title]);

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) {
          onCloseFocus?.();
        }
      }}
    >
      <SheetContent
        side="right"
        aria-label={personLabel}
        style={{
          width: "min(700px, 90vw)",
          maxWidth: "min(700px, 90vw)",
          boxSizing: "border-box",
        }}
        className="border-l bg-background p-0 shadow-[0_0_0_1px_rgba(15,23,42,0.06),-20px_0_40px_rgba(15,23,42,0.12)] [&>button]:hidden"
      >
        <div className="flex h-full flex-col">
          <div className="sticky top-0 z-10 border-b border-slate-200 bg-gradient-to-r from-teal-50 via-white to-cyan-50 backdrop-blur-sm">
            <div className="h-1 w-full bg-gradient-to-r from-teal-500 via-cyan-500 to-emerald-500" />
            <div className="flex items-start justify-between gap-3 px-4 py-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="relative shrink-0 overflow-hidden rounded-full border border-teal-200 bg-gradient-to-br from-teal-100 via-white to-cyan-100 p-0.5 shadow-sm ring-4 ring-teal-50">
                  {photoUrl ? (
                    <Avatar className="size-14 border-0">
                      <AvatarImage src={photoUrl} alt={personLabel} onError={(event) => {
                        event.currentTarget.style.display = "none";
                      }} />
                      <AvatarFallback className="bg-primary/10 text-base font-semibold text-primary">
                        {initials(personLabel)}
                      </AvatarFallback>
                    </Avatar>
                  ) : (
                    <div className="grid size-14 place-items-center bg-primary/10 text-base font-semibold text-primary">
                      {initials(personLabel)}
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="break-words text-xl font-semibold leading-tight tracking-[-0.02em] text-slate-950">{personLabel}</div>
                  <div className="text-xs leading-5 text-slate-500">{subtitle ?? "Loading…"}</div>
                  {context && <div className="text-xs font-medium leading-5 text-slate-700">{context}</div>}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {status && (
                  <span className="hidden rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold capitalize text-primary sm:inline-flex">
                    {status}
                  </span>
                )}
                <button
                  type="button"
                  aria-label={`Edit ${entityType} profile`}
                  title="Edit"
                  onClick={onEdit}
                  disabled={!onEdit}
                  className="rounded-md border border-border bg-card p-2 text-muted-foreground shadow-sm transition-colors hover:border-primary/30 hover:bg-primary/5 hover:text-primary"
                >
                  <Edit3 className="size-4" />
                </button>
                <button
                  type="button"
                  aria-label={`Print ${entityType} profile`}
                  title="Print / Export"
                  onClick={onPrint}
                  disabled={!onPrint}
                  className="rounded-md border border-border bg-card p-2 text-muted-foreground shadow-sm transition-colors hover:border-primary/30 hover:bg-primary/5 hover:text-primary"
                >
                  <Printer className="size-4" />
                </button>
                <button
                  type="button"
                  aria-label={`Message ${entityType} parent`}
                  title="Message parent"
                  className="rounded-md border border-border bg-card p-2 text-muted-foreground shadow-sm transition-colors hover:border-primary/30 hover:bg-primary/5 hover:text-primary"
                >
                  <MessageSquareText className="size-4" />
                </button>
                <button
                  type="button"
                  aria-label={`Close ${entityType} panel`}
                  onClick={() => onOpenChange(false)}
                  className="rounded-md border border-border bg-card p-2 text-muted-foreground shadow-sm transition-colors hover:bg-muted hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 md:p-5" role="dialog" aria-modal="true" aria-label={personLabel}>
            {children}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function PersonAvatar({
  name,
  photoUrl,
  className = "size-9",
}: {
  name: string;
  photoUrl?: string | null;
  className?: string;
}) {
  const safeName = getPersonDisplayName({ full_name: name });

  return (
    <Avatar className={className}>
      <AvatarImage
        src={photoUrl ?? undefined}
        alt={safeName}
        onError={(event) => {
          event.currentTarget.style.display = "none";
        }}
      />
      <AvatarFallback className="bg-primary/10 text-[11px] font-semibold text-primary">
        {initials(safeName)}
      </AvatarFallback>
    </Avatar>
  );
}
