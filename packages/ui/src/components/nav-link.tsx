import * as React from 'react';
import { Slot } from 'radix-ui';
import { cn } from '../lib/utils';

function NavLink({
  className,
  asChild = false,
  active = false,
  ...props
}: React.ComponentProps<'a'> & { asChild?: boolean; active?: boolean }) {
  const Comp = asChild ? Slot.Root : 'a';
  return (
    <Comp
      data-slot="nav-link"
      className={cn(
        'text-sm font-medium transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm px-3 py-2',
        active ? 'text-primary' : 'text-foreground/70',
        className
      )}
      {...props}
    />
  );
}

export { NavLink };
