import { CooldownStore, createLogger } from '@fluxbot/core';
import { createDatabase, upsertInstance } from '@fluxbot/db';
import { discoverInstance, fetchApplicationMe, normalizeOrigin } from '@fluxbot/fluxer';
import { allCommands } from '@fluxbot/modules';
import { Client, Events } from '@fluxerjs/core';
import { type CommandDeps, CommandIndex } from './commands';
import { loadEnv } from './env';
import { wireEvents } from './events';
import { FluxerActions } from './runtime/actions';
import { ConfigService } from './runtime/configService';
import { GuildRegistry } from './runtime/guildRegistry';
import { startScheduler } from './scheduler';

const startedAt = new Date();

async function main(): Promise<void> {
  const env = loadEnv();
  const logger = createLogger({ level: env.logLevel });

  logger.info('Starting Fluxbot', {
    instance: env.instanceOrigin,
    version: env.version,
  });

  const database = createDatabase(env.databaseUrl);
  const { db, sql } = database;

  const origin = normalizeOrigin(env.instanceOrigin);
  const discovery = await discoverInstance(origin);
  logger.info('Instance discovered', {
    api: discovery.endpoints.api_public,
    gateway: discovery.endpoints.gateway,
    selfHosted: discovery.features.self_hosted === true,
  });

  const instance = await upsertInstance(db, {
    origin,
    discovery: discovery.raw,
    appId: env.appId,
  });

  const application = await fetchApplicationMe({
    discovery,
    botToken: env.botToken,
  });
  const botId = application.id;

  if (env.appId && env.appId !== botId) {
    logger.warn('FLUXER_APP_ID does not match the token application', {
      envAppId: env.appId,
      tokenAppId: botId,
    });
  }
  logger.info('Bot token validated', { bot: application.bot?.username ?? application.name, botId });

  const registry = new GuildRegistry(db, instance.id, logger.child({ component: 'guilds' }));
  await registry.bootstrap();

  const configs = new ConfigService(db, sql, logger.child({ component: 'config' }), (guildUuid) =>
    registry.invalidate(guildUuid),
  );
  await configs.startListening();

  const client = await Client.fromDiscovery(origin);

  const actions = new FluxerActions(client);
  const deps: CommandDeps & { client: Client } = {
    client,
    db,
    instanceId: instance.id,
    actions,
    configs,
    registry,
    index: new CommandIndex(allCommands),
    cooldowns: new CooldownStore(),
    logger: logger.child({ component: 'commands' }),
    botId,
    operatorIds: env.operatorIds,
    instanceOrigin: origin,
    version: env.version,
  };

  wireEvents({
    ...deps,
    logger: logger.child({ component: 'events' }),
  });

  const ready = new Promise<void>((resolve) => {
    client.once(Events.Ready, () => resolve());
  });

  await client.login(env.botToken);
  await Promise.race([
    ready,
    new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error('Timed out waiting for the gateway to become ready')),
        30_000,
      ),
    ),
  ]);

  logger.info('Fluxbot is online', {
    user: client.user?.username,
    guilds: registry.size,
    commands: deps.index.getAll().length,
  });

  const stopScheduler = startScheduler({
    db,
    sql,
    client,
    actions,
    instanceId: instance.id,
    discovery,
    botToken: env.botToken,
    registry,
    logger: logger.child({ component: 'scheduler' }),
    version: env.version,
    startedAt,
  });

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info('Shutting down', { signal });

    stopScheduler();
    await client.destroy().catch(() => {});
    await sql.end({ timeout: 5 }).catch(() => {});

    logger.info('Goodbye');
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled rejection', {
      error: reason instanceof Error ? reason.message : String(reason),
    });
  });
}

main().catch((error) => {
  // Logger may not exist yet if env loading failed.
  console.error('Fatal startup error:', error instanceof Error ? error.stack : error);
  process.exit(1);
});
