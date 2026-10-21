import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { config as loadDotenv } from 'dotenv';

// In development the bot runs from apps/bot; the shared .env lives at the root.
const rootEnv = join(import.meta.dirname, '..', '..', '..', '.env');
if (existsSync(rootEnv)) loadDotenv({ path: rootEnv });

export interface BotEnv {
  instanceOrigin: string;
  botToken: string;
  databaseUrl: string;
  appId: string | null;
  clientSecret: string | null;
  operatorIds: string[];
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  version: string;
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `Missing ${name}. Copy .env.example to .env and fill in your Fluxer application details.`,
    );
  }
  return value;
}

export function loadEnv(): BotEnv {
  const level = (process.env.LOG_LEVEL ?? 'info').toLowerCase();
  return {
    instanceOrigin: required('FLUXER_INSTANCE_ORIGIN'),
    botToken: required('FLUXER_BOT_TOKEN'),
    databaseUrl: required('DATABASE_URL'),
    appId: process.env.FLUXER_APP_ID?.trim() || null,
    clientSecret: process.env.FLUXER_CLIENT_SECRET?.trim() || null,
    operatorIds: (process.env.BOT_OPERATOR_IDS ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean),
    logLevel:
      level === 'debug' || level === 'warn' || level === 'error' || level === 'info'
        ? level
        : 'info',
    version: process.env.FLUXBOT_VERSION ?? '0.1.0',
  };
}
