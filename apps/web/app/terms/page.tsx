import { LegalShell, OperatorContact } from '@/components/legal-shell';

// Operator identity and contact come from runtime env, not the build.
export const dynamic = 'force-dynamic';

export const metadata = { title: 'Terms' };

export default function TermsPage() {
  return (
    <LegalShell
      title="Terms of service"
      summary="These terms govern your use of this hosted Fluxbot deployment — the dashboard and the bot. The Fluxbot source code is MIT licensed; if you run your own deployment, you operate it under your own terms."
    >
      <h2>1. The service</h2>
      <p>
        Fluxbot is a bot and web dashboard for Fluxer communities. This deployment is in active
        development: features may change, break or be removed. The service is provided free of
        charge and without any service-level guarantee.
      </p>

      <h2>2. Who can use it</h2>
      <ul>
        <li>You need a Fluxer account and must comply with Fluxer&apos;s own terms.</li>
        <li>
          You must be old enough to use Fluxer in your jurisdiction and at least 13 years old.
        </li>
        <li>
          To configure a guild, you must hold the permissions required by that guild (normally
          Manage Server or Administrator). You confirm that you are authorised to make those
          changes.
        </li>
      </ul>

      <h2>3. Acceptable use</h2>
      <p>You may not use Fluxbot to:</p>
      <ul>
        <li>break the law, harass people, or distribute malware or illegal content;</li>
        <li>spam, mass-mention, raid, or otherwise disrupt communities;</li>
        <li>evade permissions, rate limits, or moderation controls;</li>
        <li>scrape, resell, or provide the service to others as your own without permission;</li>
        <li>
          violate Fluxer&apos;s or Discord&apos;s terms, including their automation and bot rules;
        </li>
        <li>attempt to access data or guilds you are not authorised to manage.</li>
      </ul>

      <h2>4. Your content and configuration</h2>
      <p>
        You keep ownership of the content and configuration you provide. You grant the operator
        permission to store and process it as needed to run the service — for example, to save
        module settings, grant roles, or send messages you configured. You are responsible for the
        modules you enable and the actions the bot takes as a result.
      </p>

      <h2>5. Bridges and cross-platform features</h2>
      <p>
        If a Discord bridge is enabled, messages in linked channels are copied to the other platform
        with the author&apos;s display name and avatar. Only link channels you are authorised to
        bridge, make sure participants are told, and comply with the rules of both platforms.
        Content that leaves one platform is subject to the destination&apos;s terms and moderation.
      </p>

      <h2>6. Availability and changes</h2>
      <p>
        The operator may modify, suspend or discontinue any part of the service at any time,
        including for maintenance, security or abuse. There is no guarantee of uptime, data
        durability, or continued availability of any feature.
      </p>

      <h2>7. Suspension and termination</h2>
      <p>
        The operator may suspend or remove access, or disable a guild or bridge, if these terms are
        violated or if the service is being abused. You can stop using the service at any time and
        ask for your data to be deleted as described in the privacy policy.
      </p>

      <h2>8. Third-party services</h2>
      <p>
        Fluxbot depends on Fluxer and, for some features, Discord and a hosting or proxy provider
        such as Cloudflare. Those services are not controlled by the operator and have their own
        terms and availability. Fluxbot is not affiliated with or endorsed by Fluxer or Discord.
      </p>

      <h2>9. Disclaimers</h2>
      <p>
        The service is provided <strong>“as is” and “as available”</strong>, without warranties of
        any kind, express or implied, including merchantability, fitness for a particular purpose,
        and non-infringement. The operator does not warrant that the service will be uninterrupted,
        error-free, or that data will never be lost.
      </p>

      <h2>10. Limitation of liability</h2>
      <p>
        To the maximum extent permitted by law, the operator is not liable for indirect, incidental,
        special, consequential or punitive damages, or for lost data, lost profits, or service
        interruptions arising from your use of Fluxbot. Where liability cannot be excluded, it is
        limited to the amount you paid to use this deployment, which is zero.
      </p>

      <h2>11. Intellectual property</h2>
      <p>
        The Fluxbot source code is licensed under the MIT License. “Fluxer”, “Discord” and their
        logos are trademarks of their respective owners. This deployment does not claim affiliation
        with either platform.
      </p>

      <h2>12. Changes to these terms</h2>
      <p>
        These terms may be updated as the service evolves. The date at the top of the page reflects
        the current version. Continuing to use the service after a change means you accept the
        updated terms.
      </p>

      <h2>13. Contact</h2>
      <p>
        Questions about these terms: <OperatorContact />.
      </p>
    </LegalShell>
  );
}
