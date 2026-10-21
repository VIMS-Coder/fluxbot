import { GuildSidebar } from '@/components/guild-sidebar';
import { requireGuildAdmin } from '@/lib/guard';

export default async function GuildLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ guildId: string }>;
}) {
  const { guildId } = await params;
  const access = await requireGuildAdmin(guildId);

  return (
    <div className="min-h-screen lg:flex">
      <GuildSidebar
        guildId={access.guild.id}
        guildFluxerId={access.guild.guildId}
        guildName={access.guild.name}
        userName={access.session.user.globalName ?? access.session.user.username}
        userFluxerId={access.session.user.fluxerId}
      />
      <main className="min-w-0 flex-1 px-4 py-8 sm:px-6 lg:px-10">{children}</main>
    </div>
  );
}
