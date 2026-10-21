# Contributing

Thanks for helping. Fluxbot is a small TypeScript monorepo and most features are
a module plus a dashboard form.

## Setup

Requirements: Node.js 22.13+, pnpm 10+, and a Postgres database (Docker or Podman
is fine).

```bash
pnpm install
cp .env.example .env
docker compose up -d postgres
pnpm db:migrate
```

Useful commands:

```bash
pnpm dev             # bot + dashboard
pnpm dev:web         # dashboard only (add DEMO_MODE=true to use sample data)
pnpm dev:bot         # bot only
pnpm lint            # Biome check (format + lint)
pnpm lint:fix        # apply safe fixes and formatting
pnpm typecheck
pnpm test
pnpm build
```

## Testing without a Fluxer instance

`scripts/fake-fluxer.mjs` implements enough of the public API to boot the bot:

```bash
# terminal 1
pnpm fake:instance

# terminal 2
FLUXER_INSTANCE_ORIGIN=http://127.0.0.1:4280 \
FLUXER_BOT_TOKEN=900000000000000001.smoke \
pnpm dev:bot
```

It sends a scripted conversation after Ready and prints the bot's replies. It is
also a good place to reproduce gateway bugs.

## Adding a module

1. Create `packages/modules/src/<module>.ts`:
   - a zod config schema (with defaults),
   - `CommandDefinition`s,
   - optional event handlers that accept `RuntimeContext`.
2. Register it in `packages/modules/src/index.ts` (`modules` array).
3. Add the commands to `packages/modules/src/catalog.ts`. The drift test in
   `modules.test.ts` fails until the catalog matches the real definitions.
4. Add a migration in `packages/db` if the module needs its own tables.
5. Add a dashboard page under `apps/web/app/g/[guildId]/<module>/page.tsx`, a
   server action in `apps/web/app/actions.ts`, and a link in
   `apps/web/components/nav-links.tsx`.
6. Wire any event handlers in `apps/bot/src/events.ts`.
7. Write tests for pure logic (curves, parsers, rules) and run the fake-instance
   smoke test.

Keep protocol details in `packages/fluxer` and database queries in
`packages/db`. Modules should not import `@fluxerjs/core`; they receive a
`RuntimeContext` with `actions`, `db`, `config` and `logger`.

## Code style

- Biome formats and lints everything: run `pnpm lint:fix` before committing.
- TypeScript is strict with `noUncheckedIndexedAccess`; avoid `any` in new code.
- Prefer small, typed functions over classes unless state is involved.
- Dashboard text is English-only for now; keep strings in components, not in the
  database.

## Commit and PR expectations

- Conventional commit subjects (`feat:`, `fix:`, `docs:`, `chore:`).
- One logical change per PR. Include a short “why” in the description.
- CI must pass: lint, typecheck, tests, migrations, dashboard build, image build.
- Never commit `.env`, tokens, database dumps or screenshots containing secrets.

## Reporting security issues

See [SECURITY.md](SECURITY.md). Please do not open a public issue for a
vulnerability.
