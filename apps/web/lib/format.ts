/** Small formatting helpers shared by server components. */

export function relativeTime(date: Date | string | null | undefined): string {
  if (!date) return 'never';
  const value = typeof date === 'string' ? new Date(date) : date;
  const delta = Date.now() - value.getTime();

  if (delta < 0) return 'just now';
  const seconds = Math.floor(delta / 1000);
  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return value.toLocaleDateString();
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return '—';
  const value = typeof date === 'string' ? new Date(date) : date;
  return value.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function initials(name: string): string {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '');
  return letters.join('') || '?';
}

export function roleName(roles: Array<{ id: string; name: string }>, roleId: string): string {
  return roles.find((role) => role.id === roleId)?.name ?? `Deleted role (${roleId})`;
}

export function channelName(
  channels: Array<{ id: string; name: string | null }>,
  channelId: string | null | undefined,
): string {
  if (!channelId) return 'Same channel';
  const channel = channels.find((candidate) => candidate.id === channelId);
  return channel?.name ? `#${channel.name}` : channelId;
}

export function maskLabel(mask: string): string {
  const value = Number.parseInt(mask, 10);
  if (!Number.isFinite(value)) return '0';
  return value.toLocaleString();
}

/** Deterministic accent colour for a guild avatar. */
export function guildColor(id: string): string {
  const palette = ['#8b5cf6', '#06b6d4', '#f59e0b', '#ec4899', '#22c55e', '#6366f1'];
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) % 997;
  return palette[hash % palette.length] ?? '#8b5cf6';
}
