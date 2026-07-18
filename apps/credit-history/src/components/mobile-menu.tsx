'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { LocaleSwitcher } from './locale-switcher';

interface MobileMenuProps {
  links: { href: string; label: string }[];
}

export function MobileMenu({ links }: MobileMenuProps) {
  const [open, setOpen] = useState(false);
  const t = useTranslations('nav');

  return (
    <div className="md:hidden">
      <button
        aria-label={open ? t('closeMenu') : t('openMenu')}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="p-2 rounded-md text-foreground/70 hover:text-primary transition-colors"
      >
        {open ? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="size-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="size-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="4" y1="12" x2="20" y2="12" />
            <line x1="4" y1="6" x2="20" y2="6" />
            <line x1="4" y1="18" x2="20" y2="18" />
          </svg>
        )}
      </button>

      {open && (
        <div className="absolute top-14 left-0 right-0 bg-background border-b border-border shadow-sm z-50">
          <nav className="flex flex-col px-4 py-3 gap-1">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="text-sm font-medium py-2 px-3 rounded-md hover:bg-muted hover:text-primary transition-colors text-foreground/70"
              >
                {link.label}
              </Link>
            ))}
            <div className="border-t border-border/60 pt-3 mt-2">
              <LocaleSwitcher showLabel />
            </div>
          </nav>
        </div>
      )}
    </div>
  );
}
