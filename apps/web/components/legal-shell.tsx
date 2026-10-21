import Link from 'next/link';
import { env } from '@/lib/env';
import { SiteFooter } from './site-footer';

export const LEGAL_UPDATED = 'October 22, 2026';

export function OperatorContact() {
  if (env.operatorContactEmail) {
    return <a href={`mailto:${env.operatorContactEmail}`}>{env.operatorContactEmail}</a>;
  }
  return <a href={env.supportUrl}>the project issue tracker</a>;
}

export function LegalShell({
  title,
  summary,
  children,
}: {
  title: string;
  summary: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-8">
      <header className="flex items-center justify-between">
        <Link href="/" className="text-sm font-semibold tracking-tight text-zinc-100">
          fluxbot
        </Link>
        <Link href="/login" className="text-sm text-zinc-500 transition hover:text-zinc-300">
          Sign in
        </Link>
      </header>

      <main className="flex-1 py-10">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-50">{title}</h1>
        <p className="mt-3 text-sm text-zinc-500">
          Last updated {LEGAL_UPDATED}. This deployment is operated by {env.operatorName}.
        </p>
        <p className="mt-5 text-sm leading-relaxed text-zinc-400">{summary}</p>

        <div className="mt-8 space-y-5 text-sm leading-relaxed text-zinc-400 [&_a]:text-violet-300 [&_a]:underline [&_a]:underline-offset-2 [&_h2]:mt-9 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-zinc-100 [&_li]:pl-1 [&_strong]:text-zinc-200 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5">
          {children}
        </div>
      </main>

      <SiteFooter className="mt-0" />
    </div>
  );
}
