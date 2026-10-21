import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Fluxbot — the self-hostable Fluxer bot',
    template: '%s · Fluxbot',
  },
  description:
    'Levels, fun commands and roles for any Fluxer instance, configured from a real web dashboard.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
