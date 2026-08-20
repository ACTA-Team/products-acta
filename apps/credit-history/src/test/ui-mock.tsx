/**
 * Lightweight stand-ins for `@acta-products/ui` used in component tests.
 *
 * The shared design system is consumed from source and pulls in radix-ui / cva,
 * which is irrelevant to the view *state logic* under test (loading / empty /
 * error / invalid / valid). Stubbing it keeps these tests focused and fast.
 *
 * Each stub renders its text-bearing props (title/description/label) and
 * children so assertions can find copy; `Button` renders a real <button> so
 * role queries work. Wire it up with:
 *   vi.mock('@acta-products/ui', () => import('@/test/ui-mock'));
 */
import * as React from 'react';

interface StubProps {
  children?: React.ReactNode;
  title?: React.ReactNode;
  description?: React.ReactNode;
  label?: React.ReactNode;
  action?: React.ReactNode;
  value?: React.ReactNode;
}

// Each text-bearing prop is wrapped in its own element so Testing Library can
// match it exactly (otherwise sibling text nodes merge into one element's text).
function Stub({ children, title, description, label, action, value }: StubProps) {
  return (
    <div>
      {title != null && <span>{title}</span>}
      {description != null && <span>{description}</span>}
      {label != null && <span>{label}</span>}
      {value != null && <span>{value}</span>}
      {children}
      {action}
    </div>
  );
}

function Button({ children, label }: StubProps) {
  return (
    <button type="button">
      {label != null && <span>{label}</span>}
      {children}
    </button>
  );
}

export function cn(...classes: unknown[]): string {
  return classes.filter(Boolean).join(' ');
}

export {
  Stub as Card,
  Stub as CardContent,
  Stub as CardHeader,
  Stub as CategoryIcon,
  Stub as CopyField,
  Stub as ProfileSummaryCard,
  Stub as Skeleton,
  Stub as StatePanel,
  Stub as StatusBadge,
  Stub as VerificationBanner,
  Stub as AttributionNote,
  Button,
};