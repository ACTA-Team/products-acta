import { DID_STELLAR_PREFIX } from '@acta-products/acta/did';
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Badge,
} from '@acta-products/ui';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { ShieldCheck, Share2, Wallet, ArrowRight } from 'lucide-react';

export default async function Home() {
  const t = await getTranslations('home');

  return (
    <section className="flex-1 w-full max-w-4xl mx-auto px-4 py-16 md:py-24 flex flex-col gap-12 justify-center items-center">
      {/* Hero Header */}
      <div className="flex flex-col items-center text-center gap-4 max-w-2xl">
        <Badge variant="secondary" className="px-3 py-1 text-xs gap-1.5 font-semibold text-primary">
          <ShieldCheck className="size-3.5 text-emerald-500" />
          {t('protocol')}
        </Badge>
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-foreground via-muted-foreground to-foreground bg-clip-text text-transparent">
          {t('title')}
        </h1>
        <p className="text-muted-foreground text-base md:text-lg">{t('subtitle')}</p>
      </div>

      {/* Action Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full mt-4">
        {/* Share presentation card */}
        <Card className="hover:border-primary/40 hover:bg-primary/[0.01] transition-all duration-300 flex flex-col justify-between">
          <CardHeader>
            <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary mb-2">
              <Share2 className="size-5" />
            </div>
            <CardTitle className="text-xl">{t('shareTitle')}</CardTitle>
            <CardDescription className="text-sm">{t('shareDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">{t('shareFeatures')}</CardContent>
          <CardFooter className="border-t border-border/40 pt-4 flex justify-between items-center">
            <Badge variant="success" className="text-[10px]">
              {t('ready')}
            </Badge>
            <Button asChild size="sm" className="cursor-pointer">
              <Link href="/share">
                {t('getStarted')}
                <ArrowRight className="size-3.5 ml-1.5" />
              </Link>
            </Button>
          </CardFooter>
        </Card>

        {/* Vault dashboard */}
        <Card className="hover:border-primary/40 hover:bg-primary/[0.01] transition-all duration-300 flex flex-col justify-between">
          <CardHeader>
            <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary mb-2">
              <Wallet className="size-5" />
            </div>
            <CardTitle className="text-xl">{t('vaultTitle')}</CardTitle>
            <CardDescription className="text-sm">{t('vaultDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">{t('vaultFeatures')}</CardContent>
          <CardFooter className="border-t border-border/40 pt-4 flex justify-between items-center">
            <Badge variant="success" className="text-[10px]">
              {t('ready')}
            </Badge>
            <Button asChild size="sm" className="cursor-pointer">
              <Link href="/vault">
                {t('getStarted')}
                <ArrowRight className="size-3.5 ml-1.5" />
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </div>

      {/* Footer Info */}
      <div className="flex flex-col items-center gap-2 text-center text-xs text-muted-foreground border-t border-border/60 w-full pt-8 mt-4">
        <p className="font-mono">
          {t('identityMethod')}{' '}
          <code className="bg-muted px-1.5 py-0.5 rounded text-foreground">
            {DID_STELLAR_PREFIX}
          </code>
        </p>
        <p>{t('techStack')}</p>
      </div>
    </section>
  );
}
