import { getTranslations } from 'next-intl/server';

export default async function SharePage() {
  const t = await getTranslations('share');

  return (
    <section className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <h1 className="text-3xl font-semibold tracking-tight font-display">{t('title')}</h1>
      <p className="max-w-md text-muted-foreground">{t('description')}</p>
    </section>
  );
}
