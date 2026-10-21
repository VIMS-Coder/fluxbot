import { ArrowLeft, LogIn } from 'lucide-react';
import Link from 'next/link';
import { SiteFooter } from '@/components/site-footer';
import { Banner } from '@/components/ui';
import { env, redirectUri } from '@/lib/env';

export const metadata = { title: 'Sign in' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <Link
        href="/"
        className="mb-8 inline-flex w-fit items-center gap-2 text-sm text-zinc-500 hover:text-zinc-300"
      >
        <ArrowLeft className="size-4" /> Back
      </Link>

      <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">Sign in to Fluxbot</h1>
      <p className="mt-2 text-sm leading-relaxed text-zinc-400">
        You will be sent to your Fluxer instance to approve access. Fluxbot requests{' '}
        <code className="text-violet-200">identify</code> and{' '}
        <code className="text-violet-200">guilds</code> — enough to show your servers and check your
        permissions. It never asks for your password.
      </p>

      {error ? (
        <div className="mt-6">
          <Banner tone="red">{error}</Banner>
        </div>
      ) : null}

      {env.demoMode ? (
        <div className="mt-6">
          <Banner tone="amber">
            Demo mode is active. Signing in creates a local sample account and guild; no Fluxer
            instance is contacted.
          </Banner>
        </div>
      ) : null}

      <a
        href="/auth/login"
        className="mt-8 inline-flex items-center justify-center gap-2 rounded-lg bg-violet-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-violet-400"
      >
        <LogIn className="size-4" />
        {env.demoMode ? 'Enter the demo dashboard' : 'Continue with Fluxer'}
      </a>

      <div className="mt-8 space-y-2 text-xs leading-relaxed text-zinc-600">
        <p>
          The application&apos;s registered redirect URI must be{' '}
          <code className="text-zinc-400">{redirectUri}</code>.
        </p>
        <p>
          Instance: <code className="text-zinc-400">{env.instanceOrigin || 'demo mode'}</code>
        </p>
      </div>

      <SiteFooter className="mt-10" />
    </div>
  );
}
