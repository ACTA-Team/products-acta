import * as React from 'react';
import { BadgeCheck, HelpCircle, TriangleAlert } from 'lucide-react';
import { cn } from '../lib/utils';

/**
 * Holder-proof attribution state, as distinct from credential validity.
 *
 * This answers "was this presentation put together by the holder's key?",
 * not "are the credentials in it still valid?" — the latter is
 * `CredentialStatusKind` / `VerificationBanner`. The two must never be
 * conflated: an `unsigned` presentation is unattributed, not invalid, and a
 * `mismatch` never changes a credential's on-chain status.
 */
export type AttributionStatus = 'signed' | 'unsigned' | 'mismatch';

const CONTAINER_STYLES: Record<AttributionStatus, string> = {
  signed: 'border-st-current/20 bg-st-current/[0.02]',
  unsigned: 'border-border/80 bg-muted/20',
  mismatch: 'border-st-invalid/20 bg-st-invalid/[0.02]',
};

const ICON_WRAPPER_STYLES: Record<AttributionStatus, string> = {
  signed: 'bg-st-current/10 text-st-current',
  unsigned: 'bg-muted text-muted-foreground',
  mismatch: 'bg-st-invalid/10 text-st-invalid',
};

const TITLE_STYLES: Record<AttributionStatus, string> = {
  signed: 'text-st-current',
  unsigned: 'text-foreground',
  mismatch: 'text-st-invalid',
};

const DEFAULT_ICONS: Record<AttributionStatus, React.ReactNode> = {
  signed: <BadgeCheck className="size-5" />,
  unsigned: <HelpCircle className="size-5" />,
  mismatch: <TriangleAlert className="size-5" />,
};

export interface AttributionNoteProps extends React.HTMLAttributes<HTMLDivElement> {
  status: AttributionStatus;
  /** Localised headline (e.g. "Presented by the holder"). */
  title: string;
  /** Localised supporting copy. */
  description: string;
  /** Optional override for the default status icon. */
  icon?: React.ReactNode;
}

/**
 * Compact, secondary note for the holder-proof attribution result in a
 * public verify flow — rendered alongside (not instead of) the credential
 * `VerificationBanner`, since the two are independent signals.
 *
 * Text is passed via props so this component stays i18n-agnostic and can be
 * reused across products without bundling any copy.
 */
export function AttributionNote({
  status,
  title,
  description,
  icon,
  className,
  ...props
}: AttributionNoteProps) {
  return (
    <div
      data-slot="attribution-note"
      className={cn('rounded-lg border px-4 py-3', CONTAINER_STYLES[status], className)}
      {...props}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'flex size-8 shrink-0 items-center justify-center rounded-full',
            ICON_WRAPPER_STYLES[status]
          )}
        >
          {icon ?? DEFAULT_ICONS[status]}
        </div>
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className={cn('text-sm font-semibold', TITLE_STYLES[status])}>{title}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
    </div>
  );
}