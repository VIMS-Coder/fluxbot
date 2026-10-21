import { getInstanceByOrigin, type Instance as InstanceRow, upsertInstance } from '@fluxbot/db';
import {
  discoverInstance,
  type InstanceDiscovery,
  normalizeOrigin,
  parseDiscovery,
} from '@fluxbot/fluxer';
import { cache } from 'react';
import { getDb } from './db';
import { DEMO_ORIGIN, ensureDemoData } from './demo';
import { env } from './env';

/** Resolve (and cache for the request) the configured Fluxer instance. */
export const getInstance = cache(async (): Promise<InstanceRow> => {
  const db = getDb();

  if (env.demoMode) {
    await ensureDemoData();
  }

  const origin = normalizeOrigin(env.demoMode ? DEMO_ORIGIN : env.instanceOrigin);
  const existing = await getInstanceByOrigin(db, origin);
  if (existing) return existing;

  if (env.demoMode) {
    throw new Error('Demo instance seed failed');
  }

  const discovery = await discoverInstance(origin);
  return upsertInstance(db, {
    origin,
    discovery: discovery.raw,
    appId: env.appId,
  });
});

/** Typed discovery document, rehydrated from the database. */
export const getDiscovery = cache(async (): Promise<InstanceDiscovery> => {
  const instance = await getInstance();
  return parseDiscovery(instance.discovery);
});
