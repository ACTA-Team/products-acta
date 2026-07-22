import { getTranslations } from 'next-intl/server';

export async function Footer() {
  const t = await getTranslations('footer');
  const tCommon = await getTranslations('common');

  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto max-w-6xl px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
        <p className="font-display font-semibold text-foreground/80">
          <span className="text-primary">ACTA</span> {tCommon('appName')}
        </p>
        <p className="text-center">{t('tagline')}</p>
        <p>
          © {new Date().getFullYear()} {t('rights')}
        </p>
      </div>
    </footer>
  );
}
