'use client';

import {
  BarChart3,
  LayoutDashboard,
  ScrollText,
  Settings,
  Sparkles,
  Terminal,
  UserCog,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from './ui';

const items = [
  { href: '', label: 'Overview', icon: LayoutDashboard },
  { href: '/levels', label: 'Levels', icon: BarChart3 },
  { href: '/fun', label: 'Fun', icon: Sparkles },
  { href: '/roles', label: 'Roles', icon: UserCog },
  { href: '/commands', label: 'Commands', icon: Terminal },
  { href: '/audit', label: 'Audit log', icon: ScrollText },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function NavLinks({ guildId }: { guildId: string }) {
  const pathname = usePathname();
  const base = `/g/${guildId}`;

  return (
    <nav className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
      {items.map((item) => {
        const href = `${base}${item.href}`;
        const active = item.href === '' ? pathname === base : pathname.startsWith(href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={href}
            className={cn(
              'flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition',
              active
                ? 'bg-violet-500/15 text-violet-200'
                : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-100',
            )}
          >
            <Icon className="size-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
