import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { NavLink } from '@acta-products/ui/components/nav-link';
import { MobileMenu } from './mobile-menu';
import { WalletButton } from './wallet-button';

export async function Header() {
  const t = await getTranslations('nav');
  const tCommon = await getTranslations('common');

  const navLinks = [
    { href: '/', label: t('home') },
    { href: '/credentials', label: t('credentials') },
    { href: '/share', label: t('share') },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto max-w-6xl px-4 flex h-14 items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-2 font-display font-semibold text-foreground"
        >
          <span className="text-primary">ACTA</span>
          <span className="hidden sm:inline text-foreground/70 font-normal text-sm">
            {tCommon('appName')}
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => (
            <NavLink key={link.href} asChild>
              <Link href={link.href}>{link.label}</Link>
            </NavLink>
          ))}
        </nav>

        {/* WalletButton is a Client Component — safe inside this Server Component */}
        <div className="flex items-center gap-2">
          <WalletButton />
          <MobileMenu links={navLinks} />
        </div>
      </div>
    </header>
  );
}
