import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border border-transparent px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground shadow-sm hover:bg-primary/80',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        destructive:
          'bg-destructive/10 text-destructive shadow-xs hover:bg-destructive/20 dark:bg-destructive/20 dark:text-red-400 dark:hover:bg-destructive/30',
        outline: 'text-foreground border-border hover:bg-muted',
        success:
          'bg-emerald-500/15 text-emerald-700 dark:bg-emerald-500/25 dark:text-emerald-400 hover:bg-emerald-500/20',
        warning:
          'bg-amber-500/15 text-amber-700 dark:bg-amber-500/25 dark:text-amber-400 hover:bg-amber-500/20',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}
