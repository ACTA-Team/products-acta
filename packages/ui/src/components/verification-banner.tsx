import * as React from 'react';
import { CheckCircle2, ShieldAlert, AlertTriangle } from 'lucide-react';
import { cn } from '../lib/utils';
import type { CredentialStatusKind } from './status-badge';

const BANNER_STYLES: Record<CredentialStatusKind, string> = {
  valid: 'border-st-current/20 bg-st-current/[0.02]',
  revoked: 'border-st-revoked/20 bg-st-revoked/[0.02]',
  invalid: 'border-st-invalid/20 bg-st-invalid/[0.02]',
};

const ICON_WRAPPER_STYLES: Record<CredentialStatusKind, string> = {
  valid: 'bg-st-current/10 text-st-current',
  revoked: 'bg-st-revoked/10 text-st-revoked',
  invalid: 'bg-st-invalid/10 text-st-invalid',
};

const TITLE_STYLES: Record<CredentialStatusKind, string> = {
  valid: 'text-st-current',
  revoked: 'text-st-revoked',
  invalid: 'text-st-invalid',
};

const DEFAULT_ICONS: Record<CredentialStatusKind, React.ReactNode> = {
  valid: <CheckCircle2 className="size-6" />,
  revoked: <AlertTriangle className="size-6" />,
  invalid: <ShieldAlert className="size-6" />,
};

export interface VerificationBannerProps extends React.HTMLAttributes<HTMLDivElement> {
  status: CredentialStatusKind;
  /** Localised headline (e.g. "Verified & valid"). */
  title: string;
  /** Localised supporting copy. */
  description: string;
  /** Optional override for the default status icon. */
  icon?: React.ReactNode;
}

/**
 * Prominent verification outcome banner for public verify flows.
 *
 * Text is passed via props so this component stays i18n-agnostic and can
 * be reused across products without bundling any copy.
 */
export function VerificationBanner({
  status,
  title,
  description,
  icon,
  className,
  ...props
}: VerificationBannerProps) {
  return (
    <div
      data-slot="verification-banner"
      className={cn('rounded-xl border shadow-md', BANNER_STYLES[status], className)}
      {...props}
    >
      <div className="flex flex-col items-center gap-4 p-6 text-center md:flex-row md:text-left">
        <div
          className={cn(
            'flex size-12 shrink-0 items-center justify-center rounded-full',
            ICON_WRAPPER_STYLES[status]
          )}
        >
          {icon ?? DEFAULT_ICONS[status]}
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className={cn('text-xl font-bold tracking-tight', TITLE_STYLES[status])}>{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
    </div>
  );
}
