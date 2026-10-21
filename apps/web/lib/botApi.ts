import { botAddReaction, botRequest, type InstanceDiscovery } from '@fluxbot/fluxer';
import { env } from './env';
import { getDiscovery } from './instance';

/**
 * The dashboard never exposes the bot token to the browser. These helpers run
 * server-side only, using the token from the environment.
 */
export async function botApi<T>(
  discovery: InstanceDiscovery,
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  return botRequest<T>({
    discovery,
    botToken: env.botToken,
    method,
    path,
    body,
  });
}

export async function reactAsBot(options: {
  channelId: string;
  messageId: string;
  emoji: string;
}): Promise<void> {
  const discovery = await getDiscovery();
  await botAddReaction({
    discovery,
    botToken: env.botToken,
    channelId: options.channelId,
    messageId: options.messageId,
    emoji: options.emoji,
  });
}

/** Send a message as the bot (used by the reaction-role menu builder). */
export async function sendAsBot(options: {
  channelId: string;
  content: string;
}): Promise<{ id: string }> {
  const discovery = await getDiscovery();
  return botApi<{ id: string }>(discovery, 'POST', `/channels/${options.channelId}/messages`, {
    content: options.content,
  });
}
