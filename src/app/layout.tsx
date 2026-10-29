import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Admission & Fee Management Portal | ABC English Medium School',
  description: 'Enterprise admission, student ledger, fee management, and leaving certificate portal.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen bg-school-surface-subtle text-school-text">
        {children}
      </body>
    </html>
  );
}
