import * as React from 'react';
import { cn } from '../lib/utils';

export interface StatePanelProps extends React.HTMLAttributes<HTMLDivElement> {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}

/**
 * Generic empty / error / informational state panel.
 *
 * Text is passed in via props so this component stays i18n-agnostic and can
 * be reused across products without bundling any copy.
 */
export function StatePanel({
  icon,
  title,
  description,
  action,
  className,
  ...props
}: StatePanelProps) {
  return (
    <div
      data-slot="state-panel"
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border px-6 py-16 text-center',
        className
      )}
      {...props}
    >
      <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        {icon}
      </div>
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}
