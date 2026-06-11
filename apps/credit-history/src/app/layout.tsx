import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Credit History — ACTA',
  description:
    'Portable credit history for financial inclusion, built on ACTA verifiable credentials.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
