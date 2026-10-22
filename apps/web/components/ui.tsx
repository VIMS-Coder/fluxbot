import { type ClassValue, clsx } from 'clsx';
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from 'react';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-2xl border border-white/10 bg-white/[0.03] p-6', className)}>
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-base font-semibold text-zinc-100">{title}</h2>
        {description ? <p className="mt-1 text-sm text-zinc-400">{description}</p> : null}
      </div>
      {actions}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">{title}</h1>
        {description ? <p className="mt-2 max-w-2xl text-sm text-zinc-400">{description}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

const buttonStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-violet-500 text-white hover:bg-violet-400 focus-visible:outline-violet-400 disabled:bg-violet-500/50',
  secondary:
    'border border-white/15 bg-white/5 text-zinc-100 hover:border-white/25 hover:bg-white/10',
  danger: 'border border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20',
  ghost: 'text-zinc-400 hover:bg-white/5 hover:text-zinc-100',
};

export function Button({
  variant = 'primary',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed',
        buttonStyles[variant],
        className,
      )}
      {...props}
    />
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-violet-400 focus:outline-none',
        className,
      )}
      {...props}
    />
  );
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        'w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-100 focus:border-violet-400 focus:outline-none',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        'w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-violet-400 focus:outline-none',
        className,
      )}
      {...props}
    />
  );
}

export function Field({
  label,
  hint,
  children,
  htmlFor,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <label className="block space-y-1.5" htmlFor={htmlFor}>
      <span className="block text-sm font-medium text-zinc-300">{label}</span>
      {children}
      {hint ? <span className="block text-xs leading-relaxed text-zinc-500">{hint}</span> : null}
    </label>
  );
}

export function Toggle({
  name,
  defaultChecked,
  label,
  description,
}: {
  name: string;
  defaultChecked?: boolean;
  label: string;
  description?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-black/20 p-4 transition hover:border-white/20">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="mt-0.5 size-4 accent-violet-500"
      />
      <span>
        <span className="block text-sm font-medium text-zinc-200">{label}</span>
        {description ? (
          <span className="mt-0.5 block text-xs text-zinc-500">{description}</span>
        ) : null}
      </span>
    </label>
  );
}

type BadgeTone = 'green' | 'amber' | 'red' | 'zinc' | 'violet';

const badgeStyles: Record<BadgeTone, string> = {
  green: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  amber: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  red: 'border-red-500/30 bg-red-500/10 text-red-300',
  zinc: 'border-white/10 bg-white/5 text-zinc-400',
  violet: 'border-violet-500/30 bg-violet-500/10 text-violet-300',
};

export function Badge({ tone = 'zinc', children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium',
        badgeStyles[tone],
      )}
    >
      {children}
    </span>
  );
}

export function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-4">
      <div className="text-xs uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-zinc-100">{value}</div>
      {hint ? <div className="mt-1 text-xs text-zinc-500">{hint}</div> : null}
    </div>
  );
}

export function Banner({
  tone = 'violet',
  children,
}: {
  tone?: 'violet' | 'green' | 'red' | 'amber';
  children: ReactNode;
}) {
  const styles = {
    violet: 'border-violet-500/30 bg-violet-500/10 text-violet-200',
    green: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
    red: 'border-red-500/30 bg-red-500/10 text-red-200',
    amber: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
  }[tone];

  return <div className={cn('mb-6 rounded-xl border px-4 py-3 text-sm', styles)}>{children}</div>;
}

export function EmptyState({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-white/15 bg-black/10 p-8 text-center">
      <div className="text-sm font-medium text-zinc-300">{title}</div>
      {description ? <div className="mt-1 text-sm text-zinc-500">{description}</div> : null}
      {children ? <div className="mt-4 flex justify-center">{children}</div> : null}
    </div>
  );
}

export function Divider() {
  return <div className="my-6 h-px bg-white/10" />;
}

export function Code({ children }: { children: ReactNode }) {
  return (
    <code className="rounded border border-white/10 bg-black/40 px-1.5 py-0.5 text-[0.85em] text-violet-200">
      {children}
    </code>
  );
}
