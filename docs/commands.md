# Commands

Fluxbot uses prefix commands. The default prefix is `!` and can be changed per
server in the dashboard or with `!prefix`. Mentioning the bot works too:
`@Fluxbot ping`.

Aliases are shown in parentheses.

## Core

| Command | Description |
|---|---|
| `help [command]` (`commands`, `h`) | List every command, or explain one |
| `ping` | Check that the bot is alive |
| `about` (`info`) | Version, instance and dashboard hint |
| `prefix [new prefix]` | Show or change the prefix (requires Manage Server) |

## Levels

| Command | Description |
|---|---|
| `rank [user]` (`level`) | Level, XP progress, rank and message count |
| `leaderboard [page]` (`lb`, `top`) | Top 10 members by XP |
| `rewards` | List roles granted at specific levels |
| `xp <action> …` | Configure levels (requires Manage Server) |

`xp` actions: `status`, `enable`, `disable`, `rate <min> <max>`,
`cooldown <seconds>`, `announce <#channel|none>`, `reward <level> <role>`,
`unreward <level>`.

## Fun

| Command | Description |
|---|---|
| `dice [NdM]` (`roll`) | Roll dice; default `1d6`, max 100 dice and 100,000 sides |
| `coinflip` (`flip`, `coin`) | Heads or tails |
| `8ball <question>` (`eightball`) | Magic 8-ball answer |
| `choose a \| b \| c` (`pick`) | Pick one option at random |
| `ship [user] [user]` (`love`) | Compatibility score between two members |

## Roles

| Command | Description |
|---|---|
| `roles` | List self-assignable roles |
| `iam <role>` (`giverole`) | Give yourself a self-assignable role |
| `iamnot <role>` (`removerole`) | Remove it again |

Reaction roles are configured from the dashboard; members toggle them by reacting
to the menu message.

## Permissions and cooldowns

- Commands that require Fluxer permissions are enforced from the member's
  effective permissions, including the Administrator bypass.
- Each command has a default cooldown; a server can override it per command in
  the dashboard.
- Commands can be disabled per server, and the permission level can be raised to
  **Moderators** or **Admins** without changing the code.
