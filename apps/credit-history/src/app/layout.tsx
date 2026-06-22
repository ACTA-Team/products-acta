import type { Metadata } from 'next';
import { Space_Grotesk, Inter, JetBrains_Mono } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { ActaProvider } from '@/providers/acta-provider';
import { SessionProvider } from '@/session/session-provider';
import './globals.css';

const fontDisplay = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

const fontSans = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const fontMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('meta');
  return {
    title: t('title'),
    description: t('description'),
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const messages = await getMessages();

  return (
    <html
      lang="en"
      className={`h-full antialiased ${fontDisplay.variable} ${fontSans.variable} ${fontMono.variable}`}
    >
      <body className="min-h-full flex flex-col">
        <NextIntlClientProvider messages={messages}>
          {/*
           * ActaProvider: mounts ActaConfig as low as possible — inside
           * NextIntlClientProvider but outside the page content, so only
           * components that need the ACTA client context are affected.
           *
           * SessionProvider: wraps the shell so the header's WalletButton
           * and any page-level session gating can both access useSession().
           */}
          <ActaProvider>
            <SessionProvider>
              <Header />
              <main className="flex flex-1 flex-col">{children}</main>
              <Footer />
            </SessionProvider>
          </ActaProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}