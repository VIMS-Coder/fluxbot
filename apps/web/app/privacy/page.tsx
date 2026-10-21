import { LegalShell, OperatorContact } from '@/components/legal-shell';

// Operator identity and contact come from runtime env, not the build.
export const dynamic = 'force-dynamic';

export const metadata = { title: 'Privacy' };

export default function PrivacyPage() {
  return (
    <LegalShell
      title="Privacy policy"
      summary="This page explains what this Fluxbot deployment stores when you sign in and use the dashboard or the bot. Fluxbot is open-source software; the deployment itself is operated by the person named above. If you run Fluxbot yourself, you are responsible for your own policy."
    >
      <h2>1. What we collect</h2>
      <ul>
        <li>
          <strong>Fluxer account:</strong> user ID, username, display name and avatar. The dashboard
          requests only the <code>identify</code> and <code>guilds</code> scopes. It does not
          request the <code>email</code> scope, so this deployment does not receive your email
          address.
        </li>
        <li>
          <strong>Guilds you manage:</strong> guild ID, name, icon, cached channel and role lists,
          your permission mask in that guild, and whether the bot is installed.
        </li>
        <li>
          <strong>Login and session data:</strong> a SHA-256 hash of the session token (the raw
          token stays in your browser cookie), OAuth access and refresh tokens encrypted with
          AES-256-GCM, the IP address and user agent seen at sign-in, and session timestamps.
        </li>
        <li>
          <strong>Configuration and audit data:</strong> module settings, prefix, per-command
          overrides, level rewards, role mappings, and audit entries recording who changed what,
          including before/after values.
        </li>
        <li>
          <strong>Engagement data:</strong> XP totals, level, message counts and leaderboard
          position. Message text is not stored by the levels module.
        </li>
        <li>
          <strong>Product analytics:</strong> command name, guild, user ID and timestamp. The
          dashboard displays the last seven days of these events.
        </li>
      </ul>
      <p>
        The current modules do not store message content. Future logging or automod features will be
        opt-in per guild and will document their retention before release.
      </p>

      <h2>2. Cookies</h2>
      <ul>
        <li>
          <code>fluxbot_session</code> keeps you signed in. It is HttpOnly, SameSite=Lax, marked
          Secure on HTTPS deployments, and lasts up to 30 days.
        </li>
        <li>
          <code>fluxbot_oauth</code> holds the short-lived login state and PKCE verifier. It expires
          after 10 minutes.
        </li>
      </ul>
      <p>There are no advertising cookies and no third-party analytics scripts on the dashboard.</p>

      <h2>3. Why we process it</h2>
      <ul>
        <li>To authenticate you and decide which guilds you may configure.</li>
        <li>To run the modules and commands you enable.</li>
        <li>To keep an audit trail of administrative changes.</li>
        <li>To secure the service, diagnose failures and understand feature usage.</li>
      </ul>
      <p>
        We do not sell personal data, build advertising profiles, or share data with data brokers.
      </p>

      <h2>4. Where it is stored and for how long</h2>
      <ul>
        <li>
          Data is stored in a PostgreSQL database on the operator&apos;s infrastructure, encrypted
          in transit with TLS where the deployment is correctly configured.
        </li>
        <li>Sessions expire after 30 days; expired sessions are pruned automatically.</li>
        <li>
          Command analytics are shown for seven days and may be retained until the operator prunes
          them.
        </li>
        <li>
          Configuration, audit entries and XP data remain until a guild admin or the operator
          deletes them.
        </li>
        <li>
          Backups may retain copies for a limited period after deletion. Keep the encryption key
          separate from database dumps; without it, stored OAuth tokens cannot be decrypted.
        </li>
      </ul>

      <h2>5. When data leaves this deployment</h2>
      <ul>
        <li>
          The Fluxer instance you sign in on receives the API calls needed to authenticate you and
          read your guilds.
        </li>
        <li>
          If the deployment is behind Cloudflare or a similar proxy, that provider processes traffic
          to terminate TLS and forward requests.
        </li>
        <li>
          If a Discord bridge is enabled in the future, messages in linked channels will be sent to
          the other platform. Bridges are opt-in and disabled by default.
        </li>
      </ul>

      <h2>6. Your choices</h2>
      <p>
        Depending on where you live, you may have the right to access, correct, delete, export or
        object to the processing of your personal data. Contact <OperatorContact /> to make a
        request. We may need to verify that you control the Fluxer account in question.
      </p>
      <p>
        Guild configuration is controlled by that guild&apos;s administrators. Removing the bot from
        a guild does not automatically delete its stored configuration; ask the operator if you want
        it removed. Some data may be retained where the law requires it or in backups for a limited
        period.
      </p>

      <h2>7. Security</h2>
      <p>
        The dashboard uses least-privilege OAuth scopes, encrypts OAuth tokens at rest, stores only
        hashes of session tokens, re-checks Fluxer permissions on every request, and records
        administrative changes in an audit log. No system is perfectly secure; report suspected
        issues through <OperatorContact />.
      </p>

      <h2>8. Children</h2>
      <p>
        Fluxbot is not directed at children under 13, or under the minimum age required to use
        Fluxer in your jurisdiction, whichever is higher.
      </p>

      <h2>9. Changes</h2>
      <p>
        This policy may be updated as Fluxbot changes. The date at the top of the page always
        reflects the current version. Material changes will be announced in the dashboard or the
        project repository.
      </p>

      <h2>10. Contact</h2>
      <p>
        This deployment is operated by <strong>the operator named above</strong>. For privacy
        questions or deletion requests, use <OperatorContact />.
      </p>
    </LegalShell>
  );
}
