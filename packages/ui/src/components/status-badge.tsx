import * as React from 'react';
import { cn } from '../lib/utils';

/**
 * Credential status as rendered in the UI.
 *
 * The contract/SDK only distinguishes `valid` | `revoked`; `invalid`
 * (not found / not verifiable) is an app-level state. The badge renders all
 * three, each mapped to a semantic colour from the brand book
 * (`--st-current` / `--st-revoked` / `--st-invalid`).
 *
 * Text is passed in via `label` so this component stays i18n-agnostic and can
 * be reused across products (list, detail, public verify) without bundling
 * any copy.
 */
export type CredentialStatusKind = 'valid' | 'revoked' | 'invalid';

// Full class strings (not constructed) so Tailwind can statically detect them.
const STATUS_STYLES: Record<CredentialStatusKind, string> = {
  valid: 'bg-st-current/10 text-st-current',
  revoked: 'bg-st-revoked/10 text-st-revoked',
  invalid: 'bg-st-invalid/10 text-st-invalid',
};

const DOT_STYLES: Record<CredentialStatusKind, string> = {
  valid: 'bg-st-current',
  revoked: 'bg-st-revoked',
  invalid: 'bg-st-invalid',
};

export interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: CredentialStatusKind;
  /** Localised, human-readable label (e.g. "Current", "Revoked on 14 Feb 2025"). */
  label: string;
}

export function StatusBadge({ status, label, className, ...props }: StatusBadgeProps) {
  return (
    <span
      data-slot="status-badge"
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold',
        STATUS_STYLES[status],
        className
      )}
      {...props}
    >
      <span aria-hidden="true" className={cn('size-1.5 rounded-full', DOT_STYLES[status])} />
      {label}
    </span>
  );
}
