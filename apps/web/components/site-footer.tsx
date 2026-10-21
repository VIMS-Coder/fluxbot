import Link from 'next/link';
import { cn } from './ui';

export function SiteFooter({ className }: { className?: string }) {
  return (
    <footer
      className={cn(
        'mt-10 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-white/10 pt-6 text-xs text-zinc-600',
        className,
      )}
    >
      <span className="font-medium text-zinc-500">Fluxbot</span>
      <Link href="/privacy" className="transition hover:text-zinc-300">
        Privacy
      </Link>
      <Link href="/terms" className="transition hover:text-zinc-300">
        Terms
      </Link>
      <a
        href="https://github.com/martintondel02/fluxbot"
        className="transition hover:text-zinc-300"
        target="_blank"
        rel="noreferrer"
      >
        Source
      </a>
      <span className="ml-auto">Not affiliated with Fluxer</span>
    </footer>
  );
}
