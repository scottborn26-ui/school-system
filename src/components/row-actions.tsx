import type { ReactNode } from "react";
import { ArchiveRestore, Archive, ArrowUp, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface RowActionsProps {
  /** Called when the user chooses Edit. */
  onEdit?: () => void;
  /** Called when the user chooses to promote or change placement. */
  onPromote?: () => void;
  /** Called when the user archives / deactivates the record. */
  onArchive?: () => void;
  /** Called when the user restores / reactivates the record. */
  onRestore?: () => void;
  /** True when the record is currently archived or inactive. */
  archived?: boolean;
  archiveLabel?: string;
  restoreLabel?: string;
  /** Extra menu items appended below the standard ones. */
  extra?: ReactNode;
  disabled?: boolean;
  /** Shown when nothing can be done, e.g. a locked or published record. */
  lockedReason?: string;
}

/**
 * Shared row-actions menu used by every register table so edit, archive and
 * restore behave identically across the app.
 */
export function RowActions({
  onEdit,
  onPromote,
  onArchive,
  onRestore,
  archived = false,
  archiveLabel = "Archive",
  restoreLabel = "Restore",
  extra,
  disabled,
  lockedReason,
}: RowActionsProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 text-muted-foreground hover:text-foreground"
          aria-label="Row actions"
          disabled={disabled}
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>Actions</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {onEdit && (
          <DropdownMenuItem onSelect={() => onEdit()}>
            <Pencil className="mr-2 size-4" /> Edit details
          </DropdownMenuItem>
        )}
        {onPromote && (
          <DropdownMenuItem onSelect={() => onPromote()}>
            <ArrowUp className="mr-2 size-4" /> Promote / change class
          </DropdownMenuItem>
        )}
        {!archived && onArchive && (
          <DropdownMenuItem
            onSelect={() => onArchive()}
            className="text-destructive focus:text-destructive"
          >
            <Archive className="mr-2 size-4" /> {archiveLabel}
          </DropdownMenuItem>
        )}
        {archived && onRestore && (
          <DropdownMenuItem onSelect={() => onRestore()}>
            <ArchiveRestore className="mr-2 size-4" /> {restoreLabel}
          </DropdownMenuItem>
        )}
        {extra}
        {lockedReason && (
          <p className="px-2 py-1.5 text-xs text-muted-foreground">{lockedReason}</p>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Column definition helper: a right-aligned, narrow actions column. */
export const ACTIONS_COLUMN_CLASS = "w-[64px] text-right";
